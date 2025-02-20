"""Research process graph implementation."""
import os
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_community.chat_models import ChatOpenRouter

from langgraph.constants import Send
from langgraph.graph import START, END, StateGraph
from langgraph.types import interrupt, Command

from .state import ReportStateInput, ReportStateOutput, Sections, ReportState, SectionState, SectionOutputState, Queries, Feedback
from .prompts import report_planner_query_writer_instructions, report_planner_instructions, query_writer_instructions, section_writer_instructions, final_section_writer_instructions, section_grader_instructions
from .configuration import Configuration
from .utils import tavily_search_async, deduplicate_and_format_sources, format_sections

# Set writer model
writer_model = ChatOpenRouter(
    model=Configuration.writer_model,
    temperature=0,
    api_key=os.environ.get("OPENROUTER_API_KEY")
)

async def generate_report_plan(state: ReportState, config: RunnableConfig):
    """Generate the report plan."""
    # Inputs
    topic = state["topic"]
    feedback = state.get("feedback_on_report_plan", None)

    # Get configuration
    configurable = Configuration.from_runnable_config(config)
    report_structure = configurable.report_structure
    number_of_queries = configurable.number_of_queries

    # Convert JSON object to string if necessary
    if isinstance(report_structure, dict):
        report_structure = str(report_structure)

    # Generate search query
    structured_llm = writer_model.with_structured_output(Queries)

    # Format system instructions
    system_instructions_query = report_planner_query_writer_instructions.format(
        topic=topic,
        report_organization=report_structure,
        number_of_queries=number_of_queries
    )

    # Generate queries
    results = structured_llm.invoke([
        SystemMessage(content=system_instructions_query),
        HumanMessage(content="Generate search queries that will help with planning the sections of the report.")
    ])

    # Web search
    query_list = [query.search_query for query in results.queries]
    search_results = await tavily_search_async(query_list)

    # Format sources
    sources = deduplicate_and_format_sources(search_results)

    # Generate sections
    structured_llm = writer_model.with_structured_output(Sections)
    system_instructions = report_planner_instructions.format(
        topic=topic,
        report_organization=report_structure
    )

    # Generate sections
    results = structured_llm.invoke([
        SystemMessage(content=system_instructions),
        HumanMessage(content=f"Here are some relevant sources to help plan the report:\n\n{sources}")
    ])

    # Update state
    state["sections"] = results.sections
    return state

async def human_feedback(state: ReportState, config: RunnableConfig):
    """Get feedback on the report plan."""
    sections = state["sections"]
    formatted_sections = format_sections(sections)
    print("\nHere is the proposed report plan. Please review and provide feedback:\n")
    print(formatted_sections)
    
    feedback = input("\nDo you approve of this plan? (yes/no): ").lower()
    if feedback == "yes":
        return state
    else:
        feedback = input("\nPlease provide specific feedback on what to improve: ")
        state["feedback_on_report_plan"] = feedback
        return interrupt("Revising report plan based on feedback")

async def generate_queries(state: SectionState, config: RunnableConfig):
    """Generate search queries for a report section."""
    section = state["section"]
    structured_llm = writer_model.with_structured_output(Queries)
    
    results = structured_llm.invoke([
        SystemMessage(content=section_writer_instructions.format(title=section.name)),
        HumanMessage(content=f"Generate search queries to research this section: {section.description}")
    ])
    
    state["search_queries"] = results.queries
    return state

async def search_web(state: SectionState, config: RunnableConfig):
    """Search the web for each query."""
    queries = state["search_queries"]
    search_results = await tavily_search_async(queries)
    
    # Format sources
    state["source_str"] = deduplicate_and_format_sources(search_results)
    return state

async def write_section(state: SectionState, config: RunnableConfig):
    """Write a section of the report."""
    section = state["section"]
    sources = state["source_str"]
    
    # Write section content
    response = writer_model.invoke([
        SystemMessage(content=section_writer_instructions.format(title=section.name)),
        HumanMessage(content=f"Write the section content using these sources:\n\n{sources}")
    ])
    
    section.content = response.content
    state["completed_sections"].append(section)
    return state

async def write_final_sections(state: SectionState):
    """Write final sections of the report."""
    section = state["section"]
    completed_sections = state["completed_sections"]
    formatted_sections = format_sections(completed_sections)
    
    response = writer_model.invoke([
        SystemMessage(content=final_section_writer_instructions.format(title=section.name)),
        HumanMessage(content=f"Write the final section using the completed sections as context:\n\n{formatted_sections}")
    ])
    
    section.content = response.content
    state["completed_sections"].append(section)
    return state

async def gather_completed_sections(state: ReportState):
    """Gather completed sections from research."""
    sections = state["sections"]
    state["report_sections_from_research"] = format_sections(sections)
    return state

async def initiate_final_section_writing(state: ReportState):
    """Write any final sections using the Send API."""
    sections = state["sections"]
    final_sections = [s for s in sections if not s.research]
    return Send({"section": section} for section in final_sections)

async def compile_final_report(state: ReportState):
    """Compile the final report."""
    sections = state["sections"]
    formatted_sections = format_sections(sections)
    state["final_report"] = formatted_sections
    return state

# Build the graph
def build_research_graph():
    """Build the research process graph."""
    # Report section sub-graph
    section_builder = StateGraph(SectionState, output=SectionOutputState)
    
    # Add nodes
    section_builder.add_node("generate_queries", generate_queries)
    section_builder.add_node("search_web", search_web)
    section_builder.add_node("write_section", write_section)
    section_builder.add_node("write_final_sections", write_final_sections)
    
    # Add edges
    section_builder.add_edge("generate_queries", "search_web")
    section_builder.add_edge("search_web", "write_section")
    section_builder.add_edge("write_section", END)
    section_builder.add_edge("write_final_sections", END)
    
    # Conditional routing
    @section_builder.conditional_edge("START")
    def route_section(state: SectionState):
        section = state["section"]
        if section.research:
            return "generate_queries"
        else:
            return "write_final_sections"
    
    # Compile section sub-graph
    section_graph = section_builder.compile()
    
    # Main research graph
    research_builder = StateGraph(ReportStateInput, output=ReportStateOutput)
    
    # Add nodes
    research_builder.add_node("generate_report_plan", generate_report_plan)
    research_builder.add_node("human_feedback", human_feedback)
    research_builder.add_node("gather_completed_sections", gather_completed_sections)
    research_builder.add_node("initiate_final_section_writing", initiate_final_section_writing)
    research_builder.add_node("compile_final_report", compile_final_report)
    research_builder.add_node("process_section", section_graph)
    
    # Add edges
    research_builder.add_edge("generate_report_plan", "human_feedback")
    research_builder.add_edge("human_feedback", "gather_completed_sections")
    research_builder.add_edge("gather_completed_sections", "initiate_final_section_writing")
    research_builder.add_edge("initiate_final_section_writing", "process_section")
    research_builder.add_edge("process_section", "compile_final_report")
    research_builder.add_edge("compile_final_report", END)
    
    # Handle feedback interrupts
    research_builder.add_edge("human_feedback", "generate_report_plan", interrupt="Revising report plan based on feedback")
    
    return research_builder.compile()

# Create the graph
graph = build_research_graph()
