"""Main entry point for advanced deep research."""
import os
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

import asyncio
from rich.console import Console
from rich.prompt import Prompt
from rich.progress import Progress, SpinnerColumn, TextColumn

from src.advanced_deep_research.configuration import Configuration
from src.advanced_deep_research.graph import graph

async def main():
    """Main entry point."""
    # Set required API keys
    os.environ["OPENROUTER_API_KEY"] = os.getenv("OPENROUTER_API_KEY", "")
    os.environ["TAVILY_API_KEY"] = os.getenv("TAVILY_API_KEY", "")
    
    # Check for required API keys
    if not os.environ["TAVILY_API_KEY"]:
        raise ValueError("TAVILY_API_KEY environment variable is required")
    if not os.environ["OPENROUTER_API_KEY"]:
        raise ValueError("OPENROUTER_API_KEY environment variable is required")
    
    console = Console()
    
    # Print welcome message
    console.print("\n[bold blue]Advanced Deep Research[/bold blue]")
    console.print("A tool for conducting comprehensive research using AI\n")
    
    # Initialize configuration
    config = Configuration()
    
    # Get research topic
    topic = Prompt.ask("\nWhat would you like to research")
    
    # Initialize state
    state = {
        "topic": topic,
        "sections": [],
        "completed_sections": [],
        "report_sections_from_research": "",
        "final_report": ""
    }
    
    # Create progress display
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True
    ) as progress:
        # Run research graph
        try:
            result = await graph.ainvoke(
                state,
                config=config.model_dump()
            )
            
            if result and result.get("final_report"):
                console.print("\n[bold green]Research completed successfully![/bold green]")
                console.print("\n[bold]Final Report:[/bold]")
                console.print(result["final_report"])
            else:
                console.print("\n[bold red]Research failed. Check error logs for details.[/bold red]")
                
        except Exception as e:
            console.print(f"\n[bold red]Error during research: {str(e)}[/bold red]")

if __name__ == "__main__":
    asyncio.run(main())
