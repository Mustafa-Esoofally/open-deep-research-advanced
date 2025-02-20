"""Example of basic research using advanced-deep-research."""
import asyncio
from advanced_deep_research import Config
from advanced_deep_research.graph import graph

async def main():
    # Initialize configuration
    config = Config(
        firecrawl_api_key="your-firecrawl-api-key",
        openai_api_key="your-openai-api-key"
    )
    
    # Define research topic
    topic = "Impact of artificial intelligence on climate change solutions"
    
    # Initialize state
    state = {
        "topic": topic,
        "sections": [],
        "completed_sections": [],
        "final_report": ""
    }
    
    # Run research graph
    result = await graph.ainvoke(
        state,
        config=config.dict()
    )
    
    if result and result.get("final_report"):
        print("Research completed successfully!")
        print("\nFinal Report:")
        print(result["final_report"])
    else:
        print("Research failed. Check error logs for details.")

if __name__ == "__main__":
    asyncio.run(main())
