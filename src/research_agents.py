from typing import List, Dict, Any, Optional, Tuple
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, Tool, create_openai_tools_agent
from langchain.tools import Tool
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema.messages import AIMessage, HumanMessage, SystemMessage
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import requests
import os
import json
import traceback
from firecrawl import FirecrawlApp
from datetime import datetime
import logging
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class ResearchContext:
    query: str
    depth: int
    breadth: int
    current_depth: int = 0
    learnings: List[str] = None
    directions: List[str] = None
    sources: List[str] = None

    def __post_init__(self):
        self.learnings = self.learnings or []
        self.directions = self.directions or []
        self.sources = self.sources or []

class ResearchAgents:
    def __init__(self, llm: ChatOpenAI):
        self.llm = llm
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            output_key="output",
            input_key="input"
        )
        # Setup logging
        self.setup_logging()
        self.tools = self._initialize_tools()
        self.research_chain = self._create_research_chain()
        self.analysis_chain = self._create_analysis_chain()
        self.followup_chain = self._create_followup_chain()

    def setup_logging(self):
        """Setup logging configuration"""
        self.logger = logging.getLogger('research_agents')
        self.logger.setLevel(logging.INFO)
        
        # Create logs directory if it doesn't exist
        if not os.path.exists('logs'):
            os.makedirs('logs')
            
        # Create a unique log file for each session
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = f'logs/agent_reasoning_{timestamp}.log'
        
        handler = logging.FileHandler(log_file)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)

    @retry(stop=stop_after_attempt(3),
           wait=wait_exponential(multiplier=1, min=2, max=10),
           retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)))
    async def search_web(self, query: str, num_results: int = 10) -> str:
        """Perform web search and extract relevant information"""
        self.logger.info(f"Starting web search for query: {query}")
        
        try:
            app = FirecrawlApp(os.getenv("FIRECRAWL_API_KEY"))
            self.logger.info("FirecrawlApp initialized successfully")
            
            search_result = app.search(query, {
                "pageOptions": {
                    "num": num_results
                }
            })
            
            if not search_result or 'error' in search_result:
                error_msg = "Search failed: No results or API error"
                self.logger.error(error_msg)
                return error_msg
            
            # Format results
            results = []
            for result in search_result.get('data', []):
                formatted_result = f"""### {result.get('title', 'No title')}
- **URL**: {result.get('url', '#')}
- **Summary**: {result.get('snippet', 'No summary available')}
"""
                results.append(formatted_result)
            
            if not results:
                return "No relevant results found."
            
            return "\n".join(results)
            
        except Exception as e:
            error_msg = f"Search error: {str(e)}"
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            return error_msg

    def _initialize_tools(self) -> List[Tool]:
        """Initialize search tool"""
        return [
            Tool(
                name="web_search",
                func=self.search_web,
                description="Search for information about a topic.",
                coroutine=self.search_web
            )
        ]

    def _create_research_chain(self) -> AgentExecutor:
        """Create the research chain"""
        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are a research assistant tasked with gathering and synthesizing information.
            For the given research query and context, you should:
            1. Use the web_search tool to find relevant information
            2. Extract key details and insights from the search results
            3. Organize findings in a clear structure with proper headings
            4. Cite sources with URLs where possible
            5. Identify potential directions for deeper research
            
            When you receive input, it will contain:
            - Main Query: The primary research question
            - Additional Context: Follow-up questions and their answers
            
            Focus on depth and quality rather than breadth. Each search should aim to uncover
            meaningful insights rather than just surface-level information.
            
            Format your response in Markdown with clear sections and citations."""),
            MessagesPlaceholder(variable_name="chat_history"),
            HumanMessage(content="{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])

        agent = create_openai_tools_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt
        )

        return AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=self.memory,
            verbose=True
        )

    def get_agent_chain(self) -> str:
        """Get the agent's reasoning chain from memory"""
        try:
            # Extract messages from memory
            messages = self.memory.chat_memory.messages
            
            # Format the reasoning chain
            chain = []
            for msg in messages:
                if isinstance(msg, HumanMessage):
                    chain.append(f"## User Query\n{msg.content}\n")
                elif isinstance(msg, AIMessage):
                    chain.append(f"## Agent Response\n{msg.content}\n")
                elif isinstance(msg, SystemMessage):
                    chain.append(f"## System Message\n{msg.content}\n")
            
            return "\n".join(chain)
            
        except Exception as e:
            self.logger.error(f"Error getting agent chain: {str(e)}")
            return "Error: Could not retrieve agent reasoning chain"

    def _create_analysis_chain(self) -> AgentExecutor:
        """Create the analysis chain"""
        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are an analysis assistant tasked with analyzing research findings.
            When given research results, you should:
            1. Identify key insights and patterns
            2. Evaluate the significance of findings
            3. Draw meaningful conclusions
            4. Provide actionable recommendations
            5. Note any limitations or areas needing further research
            
            Format your response in clear sections:
            - Key Insights
            - Significance
            - Conclusions
            - Recommendations
            - Limitations
            
            Use Markdown formatting for better readability."""),
            MessagesPlaceholder(variable_name="chat_history"),
            HumanMessage(content="{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])

        agent = create_openai_tools_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt
        )

        return AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=self.memory,
            verbose=True
        )

    def _create_followup_chain(self) -> ChatPromptTemplate:
        """Create the followup questions chain"""
        return ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are a research assistant tasked with generating follow-up questions.
            Your goal is to ask clarifying questions that will help focus and guide the research.
            Questions should be:
            1. Clear and specific
            2. Directly related to the research topic
            3. Aimed at understanding user's research goals
            4. Brief and to the point
            
            Return only the questions, without any additional text or explanations.""")
        ])

    async def generate_followup_questions(self, context: ResearchContext) -> List[str]:
        """Generate follow-up questions based on the initial query"""
        try:
            # Create a focused input for question generation
            input_text = f"Given this research query, generate {context.breadth} focused follow-up questions to clarify the research direction: {context.query}"
            
            # Direct LLM call without agent overhead
            messages = self.followup_chain.format_messages(human_message=input_text)
            result = await self.llm.ainvoke(messages)
            
            # Extract and clean questions
            questions = [q.strip() for q in result.content.split('\n') if q.strip() and '?' in q]
            return questions[:context.breadth]
            
        except Exception as e:
            self.logger.error(f"Error generating follow-up questions: {str(e)}")
            return [
                f"What specific aspects of {context.query} are you most interested in?",
                f"What is your primary goal in researching {context.query}?",
                f"Are there any particular applications or use cases you want to focus on?"
            ]

    async def research_iteration(self, context: ResearchContext) -> Tuple[List[str], List[str]]:
        """Perform one iteration of research"""
        try:
            # Generate search queries based on context
            queries = [context.query]
            if context.current_depth > 0:
                followup_questions = await self.generate_followup_questions(context)
                queries.extend(followup_questions)

            # Limit queries by breadth parameter
            queries = queries[:context.breadth]

            # Perform research for each query
            all_findings = []
            all_directions = []
            
            for query in queries:
                result = await self.research_chain.ainvoke({"input": query})
                findings = result["output"]
                all_findings.append(findings)
                
                # Extract potential new research directions
                analysis = await self.analyze(findings)
                directions = [d.strip() for d in analysis.split("\n") if d.strip()]
                all_directions.extend(directions)

            return all_findings, all_directions

        except Exception as e:
            self.logger.error(f"Research iteration error: {str(e)}")
            return [], []

    async def deep_research(self, query: str, depth: int = 2, breadth: int = 4) -> ResearchContext:
        """Perform deep research with iterative exploration"""
        context = ResearchContext(query=query, depth=depth, breadth=breadth)
        
        try:
            while context.current_depth < context.depth:
                self.logger.info(f"Starting research iteration at depth {context.current_depth}")
                
                # Perform research iteration
                findings, directions = await self.research_iteration(context)
                
                # Update context with new findings
                context.learnings.extend(findings)
                context.directions.extend(directions)
                context.current_depth += 1
                
                self.logger.info(f"Completed research iteration {context.current_depth}")
                
            return context
            
        except Exception as e:
            self.logger.error(f"Deep research error: {str(e)}")
            raise

    async def research(self, query: str, depth: int = 2, breadth: int = 4) -> str:
        """Enhanced research method with depth and breadth parameters"""
        try:
            context = await self.deep_research(query, depth, breadth)
            
            # Compile final research output
            output = f"""# Research Findings

## Original Query
{context.query}

## Key Learnings
{chr(10).join(context.learnings)}

## Research Directions
{chr(10).join(context.directions)}

## Sources
{chr(10).join(context.sources)}
"""
            return output
            
        except Exception as e:
            self.logger.error(f"Research error: {str(e)}")
            raise

    async def analyze(self, research_data: str) -> str:
        """Analyze research findings"""
        try:
            result = await self.analysis_chain.ainvoke({"input": research_data})
            return result["output"]
        except Exception as e:
            self.logger.error(f"Analysis error: {str(e)}")
            raise
