"""Core research functionality."""
from typing import List, Dict, Any, Optional, Callable
import asyncio
import json
from langchain.chat_models import ChatOpenAI
from langchain.tools import Tool
from langchain_core.output_parsers import JsonOutputParser

from .state import Section, SectionState, ResearchState, SearchQuery, Feedback
from .configuration import Config, LLMConfig
from .prompts import (
    RESEARCH_PLAN_PROMPT,
    CONTENT_ANALYSIS_PROMPT,
    SECTION_CONTENT_PROMPT,
    FEEDBACK_PROMPT
)
from .utils import ResearchProgress, ResearchProgressTracker, output

class ResearchAgent:
    """Agent for conducting deep research on topics using a plan-and-execute approach."""
    
    def __init__(self, config: Config):
        """Initialize research agent with configuration."""
        self.config = config
        self.firecrawl = FirecrawlApp(api_key=config.firecrawl_api_key)
        self.progress_tracker = ResearchProgressTracker()
        self.state: ResearchState = {
            "topic": "",
            "sections": [],
            "completed_sections": [],
            "final_report": ""
        }
        
        # Initialize LLM models
        self._init_llm_models(config.llm)
    
    def _init_llm_models(self, llm_config: LLMConfig) -> None:
        """Initialize LLM models with configuration."""
        # Create the planner model
        self.planner_llm = ChatOpenAI(
            openai_api_base=llm_config.base_url,
            openai_api_key=self.config.openai_api_key,
            model=llm_config.planner_model,
            temperature=llm_config.temperature,
            default_headers=llm_config.headers
        )
        
        # Create the researcher model
        self.researcher_llm = ChatOpenAI(
            openai_api_base=llm_config.base_url,
            openai_api_key=self.config.openai_api_key,
            model=llm_config.researcher_model,
            temperature=llm_config.temperature,
            default_headers=llm_config.headers
        )
    
    async def create_research_plan(self, topic: str) -> List[Section]:
        """Create a research plan for the given topic."""
        try:
            # Update state with new topic
            self.state["topic"] = topic
            
            # Generate plan using planner model
            chain = RESEARCH_PLAN_PROMPT | self.planner_llm | JsonOutputParser()
            result = await chain.ainvoke({"topic": topic})
            
            # Convert to Section objects and update state
            sections = [Section(**section) for section in result]
            self.state["sections"] = sections
            
            # Reset progress tracking
            self.progress_tracker.total_queries = sum(len(s.queries) for s in sections)
            self.progress_tracker.completed_queries = 0
            
            return sections
            
        except Exception as e:
            output.error(f"Error creating research plan: {str(e)}")
            return []

    async def _search_web(self, query: str) -> List[str]:
        """Tool for web search using Firecrawl."""
        try:
            results = await self.firecrawl.search(query)
            return [r.url for r in results]
        except Exception as e:
            output.error(f"Error in web search: {str(e)}")
            return []

    async def _analyze_content(self, url: str, query: str) -> Optional[Dict[str, Any]]:
        """Tool for content analysis using Firecrawl and LLM."""
        try:
            # Get content from URL
            content = await self.firecrawl.get_content(url)
            if not content:
                return None
            
            # Analyze content using researcher model
            chain = CONTENT_ANALYSIS_PROMPT | self.researcher_llm | JsonOutputParser()
            result = await chain.ainvoke({
                "query": query,
                "content": content
            })
            
            return result
            
        except Exception as e:
            output.error(f"Error analyzing content from {url}: {str(e)}")
            return None

    async def _research_section(
        self,
        section: Section,
        breadth: int,
        depth: int,
        on_progress: Optional[Callable[[ResearchProgress], None]] = None
    ) -> Optional[SectionState]:
        """Research a specific section of the report."""
        try:
            # Initialize section state
            section_state: SectionState = {
                "section": section,
                "search_iterations": 0,
                "source_content": "",
                "feedback": "",
                "completed": False
            }
            
            # Track progress for each query
            for query in section.queries:
                if on_progress:
                    on_progress(ResearchProgress(
                        phase="research",
                        section=section.title,
                        current_depth=1,
                        total_depth=depth,
                        current_breadth=0,
                        total_breadth=breadth,
                        current_query=query,
                        total_queries=self.progress_tracker.total_queries,
                        completed_queries=self.progress_tracker.completed_queries
                    ))

                # Perform web search
                search_results = await self._search_web(query)
                if not search_results:
                    continue

                # Analyze each result
                for url in search_results[:breadth]:
                    try:
                        analysis = await self._analyze_content(url, query)
                        if analysis:
                            section_state["source_content"] += f"\nSource ({url}):\n{json.dumps(analysis, indent=2)}\n"
                            section_state["search_iterations"] += 1
                    except Exception as e:
                        output.error(f"Error analyzing content from {url}: {str(e)}")
                        continue

                await self.progress_tracker.increment_completed()

            # Generate section content from collected sources
            if section_state["source_content"]:
                chain = SECTION_CONTENT_PROMPT | self.researcher_llm
                section.content = await chain.ainvoke({
                    "title": section.title,
                    "sources": section_state["source_content"]
                })
                
                # Get feedback on section
                feedback_chain = FEEDBACK_PROMPT | self.researcher_llm | JsonOutputParser()
                feedback = await feedback_chain.ainvoke({
                    "title": section.title,
                    "content": section.content
                })
                
                feedback_obj = Feedback(**feedback)
                if feedback_obj.grade == "pass":
                    section_state["completed"] = True
                    self.state["completed_sections"].append(section)
                else:
                    # Add follow-up queries
                    section.queries.extend([q.query for q in feedback_obj.follow_up_queries])
                    
                section_state["feedback"] = json.dumps(feedback, indent=2)
                
            return section_state

        except Exception as e:
            output.error(f"Error researching section {section.title}: {str(e)}")
            return None

    async def deep_research(
        self,
        query: str,
        breadth: int = None,
        depth: int = None,
        on_progress: Optional[Callable[[ResearchProgress], None]] = None
    ) -> Optional[str]:
        """Conduct deep research using a plan-and-execute approach."""
        try:
            # Use default config values if not specified
            breadth = breadth or self.config.research.default_breadth
            depth = depth or self.config.research.default_depth
            
            # Step 1: Create research plan
            output.info(f"Creating research plan for: {query}")
            plan = await self.create_research_plan(query)
            
            if not plan:
                output.error("Failed to create research plan")
                return None
                
            output.info("Research plan created. Sections:")
            for section in plan:
                output.info(f"- {section.title}")
            
            # Reset progress tracker for new research session
            self.progress_tracker = ResearchProgressTracker()
            self.progress_tracker.total_queries = sum(len(section.queries) for section in plan)
            
            # Step 2: Research main sections in parallel
            main_section_tasks = []
            for section in plan:
                if section.title.lower() not in ["introduction", "conclusion"]:
                    task = asyncio.create_task(self._research_section(
                        section,
                        breadth,
                        depth,
                        on_progress
                    ))
                    main_section_tasks.append(task)
            
            main_results = await asyncio.gather(*main_section_tasks)
            
            # Step 3: Research final sections with context
            final_section_tasks = []
            for section in plan:
                if section.title.lower() in ["introduction", "conclusion"]:
                    task = asyncio.create_task(self._research_section(
                        section,
                        breadth,
                        1,  # Final sections only need one level
                        on_progress
                    ))
                    final_section_tasks.append(task)
            
            final_results = await asyncio.gather(*final_section_tasks)
            
            # Step 4: Compile final report
            self.state["final_report"] = "\n\n".join(
                section.content for section in self.state["completed_sections"]
            )
            
            return self.state["final_report"]
            
        except Exception as e:
            output.error(f"Error in deep research: {str(e)}")
            return None
