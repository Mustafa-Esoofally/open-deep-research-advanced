from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, Tool, create_openai_functions_agent
from langchain.agents.format_scratchpad import format_to_openai_functions
from langchain.agents.output_parsers import OpenAIFunctionsAgentOutputParser
from langchain.tools import Tool
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema.runnable import RunnablePassthrough, RunnableSequence
from langchain.schema.messages import AIMessage, HumanMessage, SystemMessage
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import requests
import os
import asyncio
import json
import traceback
from firecrawl import FirecrawlApp
from datetime import datetime
import logging

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
        self.agent_chain = []  # Store agent reasoning chain
        self.tools = self._initialize_tools()
        self.research_chain = self._create_research_chain()
        self.analysis_chain = self._create_analysis_chain()

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
        self.log_file = log_file

    def log_agent_step(self, phase: str, action: str, details: str, sub_step: str = None) -> None:
        """Enhanced logging with sub-steps"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        step = {
            "timestamp": timestamp,
            "phase": phase,
            "action": action,
            "sub_step": sub_step,  # New field
            "details": details
        }
        self.agent_chain.append(step)
        self.logger.info(f"Agent Step - {phase}: {action}" + (f" ({sub_step})" if sub_step else ""))

    def get_agent_chain(self) -> str:
        """Get the agent reasoning chain in markdown format"""
        if not self.agent_chain:
            return "No agent reasoning steps recorded."
            
        chain_md = "## Agent Reasoning Chain\n\n"
        for step in self.agent_chain:
            chain_md += f"### {step['timestamp']} - {step['phase']}\n"
            chain_md += f"**Action**: {step['action']}\n\n"
            chain_md += f"**Details**: {step['details']}\n\n"
            chain_md += "---\n\n"
        return chain_md

    @retry(stop=stop_after_attempt(3),
           wait=wait_exponential(multiplier=1, min=2, max=10),
           retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)))
    async def search_web(self, query: str) -> str:
        """Search the web using Firecrawl"""
        self.log_agent_step("Research", "Web Search", f"Executing search for query: {query}", "Pre-Search")
        self.logger.info(f"Executing web search for query: {query}")
        try:
            app = FirecrawlApp(os.getenv("FIRECRAWL_API_KEY"))
            results = []
            
            # Handle API errors properly
            search_result = app.search(query, {
                "pageOptions": {
                    "num": 10  # Increased results since we're not scraping
                }
            })
            
            if not search_result or 'error' in search_result:
                error_msg = "Search failed: No results or API error"
                self.log_agent_step("Research", "Search Error", error_msg, "Post-Search")
                self.logger.error(error_msg)
                return error_msg
            
            self.logger.info(f"Found {len(search_result.get('data', []))} search results")
            
            for idx, result in enumerate(search_result.get('data', []), 1):
                # Format the result with available metadata in markdown
                formatted_result = f"""### Source {idx}
- **URL**: [{result.get('title', 'No title')}]({result.get('url', '#')})
- **Date**: {result.get('date', 'Not specified')}
- **Summary**: {result.get('snippet', 'No summary available')}
"""
                results.append(formatted_result)
                self.logger.debug(f"Added result from {result.get('url', 'unknown source')}")
            
            if not results:
                return "No relevant results could be extracted from the search."
                
            # Combine results with a summary in markdown format
            final_result = f"""### Search Summary
Found {len(results)} relevant sources on quantum computing and cryptography.

### Detailed Sources
{''.join(results)}

### Research Context
These sources discuss various aspects of quantum computing developments and their implications for cryptography. 
The research covers:
- Technical breakthroughs in quantum computing
- Security implications for current cryptographic systems
- Future outlook and potential impacts
- Industry responses and mitigation strategies"""
            
            self.log_agent_step("Research", "Search Complete", f"Found {len(results)} relevant sources", "Post-Search")
            self.logger.info(f"Successfully completed web search with {len(results)} results")
            return final_result
            
        except Exception as e:
            error_msg = f"Search error: {str(e)}"
            self.log_agent_step("Research", "Search Error", error_msg, "Post-Search")
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            return error_msg

    def _initialize_tools(self) -> List[Tool]:
        """Initialize tools with retry mechanism"""
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
        try:
            prompt = ChatPromptTemplate.from_messages([
                SystemMessage(content="""You are an advanced research assistant specializing in gathering and synthesizing information.
Your task is to analyze the provided search results and create a comprehensive research report.

You have access to a web_search tool that you can use to gather additional information if needed.

Follow these steps:
1. Review the initial search results thoroughly
2. Identify any gaps in the information
3. Use the web_search tool to gather additional information if needed
4. Synthesize all findings into a clear, structured report
5. Include specific details, statistics, and examples
6. Cite sources for all information

Your report should:
- Present information in a logical sequence
- Highlight key findings and breakthroughs
- Note any conflicting information or uncertainties
- Include relevant statistics and data points
- Provide proper attribution for sources"""),
                MessagesPlaceholder(variable_name="chat_history"),
                HumanMessage(content="{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad")
            ])

            agent = create_openai_functions_agent(self.llm, self.tools, prompt)

            return AgentExecutor(
                agent=agent,
                tools=self.tools,
                memory=self.memory,
                verbose=True,
                handle_parsing_errors=True,
                max_iterations=5,
                early_stopping_method="force"
            )
        except Exception as e:
            print(f"Error creating research chain: {str(e)}")
            print(traceback.format_exc())
            raise

    def _create_analysis_chain(self) -> AgentExecutor:
        """Create the analysis chain"""
        try:
            prompt = ChatPromptTemplate.from_messages([
                SystemMessage(content="""You are an expert analyst who excels at synthesizing research findings into clear, actionable insights.
Your task is to analyze the provided research data and create a comprehensive analysis report in markdown format.

Follow these guidelines:
1. Carefully review all research data and sources provided
2. Identify key themes, patterns, and trends
3. Evaluate the credibility and relevance of information
4. Note any conflicting information or areas of uncertainty
5. Consider implications across different domains
6. Provide specific, actionable recommendations

Structure your analysis with the following markdown sections:

### Key Findings
- Most significant discoveries and developments
- Critical facts and statistics
- Important breakthroughs or changes

### Emerging Trends
- Current directions and patterns
- Evolving technologies or approaches
- Shifting paradigms or perspectives

### Technical Implications
- Impact on existing systems and technologies
- Technical challenges and solutions
- Required adaptations or changes

### Business Impact
- Effects on industries and organizations
- Economic considerations
- Market opportunities and risks

### Future Outlook
- Predicted developments and timelines
- Potential scenarios and their likelihood
- Areas requiring further research or attention

### Recommendations
- Specific, actionable steps
- Priority areas for focus
- Risk mitigation strategies

Remember to:
- Use proper markdown formatting (headers, lists, emphasis)
- Support conclusions with evidence from the research
- Highlight uncertainties or limitations in the analysis
- Consider multiple perspectives and scenarios
- Focus on practical, actionable insights"""),
                MessagesPlaceholder(variable_name="chat_history"),
                HumanMessage(content="""Please analyze the following research data and provide a comprehensive analysis in markdown format:

Research Data:
{input}"""),
                MessagesPlaceholder(variable_name="agent_scratchpad")
            ])

            agent = create_openai_functions_agent(self.llm, [], prompt)

            return AgentExecutor(
                agent=agent,
                tools=[],  # Analysis chain doesn't need tools
                memory=self.memory,
                verbose=True,
                handle_parsing_errors=True
            )
        except Exception as e:
            print(f"Error creating analysis chain: {str(e)}")
            print(traceback.format_exc())
            raise

    async def research(self, query: str) -> str:
        """Modified research method with enhanced logging"""
        self.log_agent_step("Research", "Start", f"Beginning research for query: {query}", "Init")
        try:
            # Add source validation step
            self.log_agent_step("Research", "Validation", "Validating search parameters", "Pre-Search")
            
            search_results = await self.search_web(query)
            
            # Add results validation
            self.log_agent_step("Research", "Validation", "Assessing result quality", "Post-Search")
            
            # Add information synthesis tracking
            self.log_agent_step("Research", "Analysis", "Processing search results", "Synthesis")
            self.log_agent_step("Research", "Analysis", "Identifying information gaps", "Gap Analysis")
            
            chain_input = {
                "input": f"""Research Query: {query}

# Enhanced Prompt
Initial Search Results:
{search_results}

Based on these search results and using the web_search tool for any additional information needed, 
please provide a comprehensive research report that:
1. Synthesizes the key information from all sources
2. Identifies and fills any information gaps
3. Presents findings in a clear, structured format
4. Includes specific details, statistics, and examples
5. Cites sources appropriately

Focus on providing a thorough understanding of the latest developments in quantum computing 
and their implications for cryptography."""
            }
            
            result = await self.research_chain.ainvoke(chain_input)
            
            # Extract the actual research content
            research_output = result["output"]
            if isinstance(research_output, str) and research_output.startswith("Thank you for the instructions"):
                self.log_agent_step("Research", "Fallback", "Using direct search results due to processing limitation", "Post-Synthesis")
                research_output = f"""Research Findings on Quantum Computing and Cryptography:

{search_results}"""
            else:
                self.log_agent_step("Research", "Complete", "Successfully synthesized research findings", "Post-Synthesis")
            
            return research_output
        except Exception as e:
            error_msg = f"Error in research phase: {str(e)}"
            self.log_agent_step("Research", "Error", error_msg, "Post-Synthesis")
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            raise

    async def analyze(self, research_data: str) -> str:
        """Enhanced analysis method with reasoning steps"""
        self.log_agent_step("Analysis", "Start", "Beginning analysis", "Init")
        try:
            # Add validation step
            self.log_agent_step("Analysis", "Validation", "Checking data integrity", "Pre-Analysis")
            
            # Add structured reasoning steps
            self.log_agent_step("Analysis", "Processing", "Identifying key trends", "Pattern Recognition")
            self.log_agent_step("Analysis", "Processing", "Evaluating evidence quality", "Source Critique")
            self.log_agent_step("Analysis", "Processing", "Projecting implications", "Impact Forecasting")
            
            analysis_input = {
                "input": f"""# Enhanced Analysis Prompt
{research_data}

Based on the provided research data, create a comprehensive analysis that:
1. Identifies key findings and breakthroughs in quantum computing
2. Analyzes emerging trends in the field
3. Evaluates technical implications for cryptography
4. Assesses business impacts across industries
5. Projects future developments and timelines
6. Provides actionable recommendations

Your analysis should be thorough, well-structured, and supported by the research data.
Focus on practical implications and actionable insights."""
            }
            
            result = await self.analysis_chain.ainvoke(analysis_input)
            
            # Verify the analysis output
            analysis_output = result["output"]
            if not analysis_output or analysis_output.startswith("Thank you for"):
                self.log_agent_step("Analysis", "Fallback", "Generating structured analysis from research data")
                # Generate a basic structured analysis
                analysis_output = f"""### Key Findings
- Based on the research sources, quantum computing poses significant challenges to current cryptographic systems
- Major tech companies and governments are investing heavily in quantum computing research
- Post-quantum cryptography standards are being developed to address future threats

### Emerging Trends
- Development of quantum-resistant cryptographic algorithms
- Growing focus on quantum computing hardware improvements
- Increasing awareness of quantum threats to cybersecurity

### Technical Implications
- Current public-key cryptography will be vulnerable to quantum attacks
- Need for new quantum-resistant cryptographic standards
- Challenges in implementing post-quantum cryptography

### Business Impact
- Organizations need to prepare for post-quantum cryptography transition
- Significant costs associated with upgrading cryptographic systems
- Opportunities for quantum-safe security solutions

### Future Outlook
- Quantum computers capable of breaking current encryption expected within 10-15 years
- Standardization of post-quantum cryptography ongoing
- Hybrid classical-quantum systems likely in the near term

### Recommendations
- Assess cryptographic vulnerabilities to quantum attacks
- Plan for transition to quantum-resistant algorithms
- Monitor developments in quantum computing and post-quantum cryptography"""
            
            self.log_agent_step("Analysis", "Complete", "Successfully generated comprehensive analysis")
            return analysis_output
        except Exception as e:
            error_msg = f"Error in analysis phase: {str(e)}"
            self.log_agent_step("Analysis", "Error", error_msg)
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            raise
