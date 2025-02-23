import os
from typing import Dict, Any, TypedDict, List
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langsmith import Client
from research_agents import ResearchAgents
import asyncio
import sys
from datetime import datetime
import logging
import traceback
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Initialize environment variables
print("Loading environment variables...")
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
os.makedirs('reports', exist_ok=True)
os.makedirs('logs', exist_ok=True)

# Verify OpenRouter API key
if not os.getenv("OPENROUTER_API_KEY"):
    raise ValueError("OPENROUTER_API_KEY environment variable is not set")

# Initialize LangSmith client if API key is available
client = None
if os.getenv("LANGSMITH_API_KEY"):
    print("Initializing LangSmith client...")
    client = Client()

class ChatRequest(BaseModel):
    message: str

class ResearchState(TypedDict):
    query: str
    depth: int
    breadth: int
    research_data: List[str]
    analysis: str

# Initialize research agents at startup
research_agents = None

@app.on_event("startup")
async def startup_event():
    global research_agents
    research_agents = await create_research_workflow()

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        # Process the research query
        depth = 2  # Default depth
        breadth = 4  # Default breadth
        
        # Execute research phase
        research_result = await research_agents.research(request.message, depth=depth, breadth=breadth)
        
        # Execute analysis phase
        analysis_result = await research_agents.analyze(research_result)
        
        # Combine results into a response
        response = f"Research Results:\n{research_result}\n\nAnalysis:\n{analysis_result}"
        
        return {"response": response}
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return {"error": "Failed to process request"}, 500

async def create_research_workflow() -> ResearchAgents:
    print("Creating research workflow...")
    try:
        # Initialize the language model with OpenRouter
        llm = ChatOpenAI(
            model="openai/o3-mini",
            temperature=0.7,
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://research-project.com",
                "X-Title": "Advanced Deep Research"
            }
        )
        print("LLM initialized successfully with OpenRouter")
        
        # Initialize research agents
        research_agents = ResearchAgents(llm)
        print("Research agents initialized")
        
        return research_agents
        
    except Exception as e:
        print(f"Error in create_research_workflow: {str(e)}", file=sys.stderr)
        raise

async def process_research(query: str, depth: int = 2, breadth: int = 4) -> None:
    print("Processing research...")
    research_agents = await create_research_workflow()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    try:
        # Execute research phase with depth and breadth parameters
        print(f"\nExecuting research phase (depth={depth}, breadth={breadth})...")
        research_result = await research_agents.research(query, depth=depth, breadth=breadth)
        print("\nResearch Results:")
        print("----------------")
        print(research_result)
        
        # Execute analysis phase
        print("\nExecuting analysis phase...")
        analysis_result = await research_agents.analyze(research_result)
        print("\nAnalysis:")
        print("---------")
        print(analysis_result)
        
        # Generate markdown report
        report_md = f"""# Deep Research Report
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Research Parameters
- **Query**: {query}
- **Depth**: {depth}
- **Breadth**: {breadth}
- **Research Agent Version**: 1.0.0

{research_result}

## Expert Analysis
{analysis_result}

## Research Process
- Depth of {depth} iterations completed
- {breadth} parallel research paths explored per iteration
- Multiple verified sources consulted
- AI-powered analysis and synthesis
"""
        
        # Save the report
        report_path = f'reports/deep_research_report_{timestamp}.md'
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_md)
        print(f"\nMarkdown report saved to {report_path}")
        
        # Save agent reasoning chain separately
        reasoning_chain = research_agents.get_agent_chain()
        reasoning_file = f'reports/agent_reasoning_{timestamp}.md'
        with open(reasoning_file, "w", encoding="utf-8") as f:
            f.write("# Agent Reasoning Chain\n\n")
            f.write(reasoning_chain)
        print(f"\nAgent reasoning chain saved to {reasoning_file}")
        
    except Exception as e:
        error_msg = f"\nResearch failed: {str(e)}"
        logger.error(error_msg)
        if client:
            logger.info("Logging error to LangSmith...")
            try:
                client.log_feedback(
                    run_id=client.run_id,
                    key="error",
                    value=error_msg
                )
                logger.info("Logged error to LangSmith successfully")
            except Exception as feedback_error:
                logger.error(f"Failed to log error: {str(feedback_error)}")

async def main():
    print("Running main...")
    # Example research query with depth and breadth parameters
    query = "What are the latest developments in quantum computing and its potential impact on cryptography?"
    depth = 3  # Number of iterative research cycles
    breadth = 4  # Number of parallel research paths per iteration
    await process_research(query, depth=depth, breadth=breadth)
    print("Main completed successfully")

if __name__ == "__main__":
    try:
        import uvicorn
        print("Starting FastAPI server...")
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except Exception as e:
        print(f"Error starting server: {str(e)}", file=sys.stderr)
        traceback.print_exc()
