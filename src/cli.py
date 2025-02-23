from typing import List, Optional, Dict
import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.prompt import Prompt, Confirm, IntPrompt
from rich.panel import Panel
from rich.markdown import Markdown
import asyncio
from research_agents import ResearchAgents
from langchain_openai import ChatOpenAI
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
import logging
import traceback
from research_agents import ResearchContext

# Load environment variables from .env file
load_dotenv(override=True)

console = Console()

async def generate_follow_up_questions(agent: ResearchAgents, query: str) -> List[str]:
    """Generate focused research directions based on the initial query"""
    context = ResearchContext(
        query=query,
        depth=1,
        breadth=3,
        learnings=[],
        directions=[]
    )
    
    try:
        # Generate research directions
        directions = await agent.generate_followup_questions(context)
        return [d for d in directions if d and len(d.strip()) > 0]
    except Exception as e:
        console.print(f"[yellow]Warning: Error generating research directions: {str(e)}")
        return [
            f"Explore the latest developments in {query}",
            f"Investigate key challenges and limitations in {query}",
            f"Research future trends and potential applications of {query}"
        ]

def run_research_sync(
    query: Optional[str] = None,
    depth: Optional[int] = None,
    breadth: Optional[int] = None
):
    """Synchronous wrapper for the research command"""
    try:
        asyncio.run(run_research(query, depth, breadth))
    except Exception as e:
        console.print(f"[red]Error: {str(e)}")
        sys.exit(1)

async def run_research(
    query: Optional[str] = None,
    depth: Optional[int] = None,
    breadth: Optional[int] = None
):
    """Perform focused research with user interaction"""
    
    # Interactive query input if not provided
    if not query:
        console.print("\n[bold blue]Welcome to Advanced Deep Research![/bold blue]")
        console.print(Panel(
            "This tool will help you conduct comprehensive research on any topic.\n"
            "It uses AI to:\n"
            "- Generate focused follow-up questions\n"
            "- Perform iterative deep research\n"
            "- Analyze and synthesize findings\n"
            "- Generate detailed reports",
            title="About",
            border_style="blue"
        ))
        query = Prompt.ask(
            "\n[bold cyan]What would you like to research?[/bold cyan]"
        )
    
    # Get research parameters if not provided
    if depth is None:
        depth_str = Prompt.ask(
            "\n[bold cyan]Enter research depth[/bold cyan] (recommended 1-5, default 2)",
            default="2"
        )
        try:
            depth = int(depth_str)
            if not (1 <= depth <= 5):
                console.print("[yellow]Using default depth of 2 as input was out of range 1-5[/yellow]")
                depth = 2
        except ValueError:
            console.print("[yellow]Using default depth of 2 as input was not a valid number[/yellow]")
            depth = 2
    
    if breadth is None:
        breadth_str = Prompt.ask(
            "\n[bold cyan]Enter research breadth[/bold cyan] (recommended 2-10, default 4)",
            default="4"
        )
        try:
            breadth = int(breadth_str)
            if not (2 <= breadth <= 10):
                console.print("[yellow]Using default breadth of 4 as input was out of range 2-10[/yellow]")
                breadth = 4
        except ValueError:
            console.print("[yellow]Using default breadth of 4 as input was not a valid number[/yellow]")
            breadth = 4
    
    # Initialize logging
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    logging.basicConfig(
        filename=f'logs/research_{timestamp}.log',
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger('research_cli')
    logger.info("Starting research process")
    
    try:
        # Initialize LLM
        logger.info("Initializing OpenRouter LLM")
        console.print("\n[bold cyan]Initializing research system...[/bold cyan]")
        
        llm = ChatOpenAI(
            model="openai/o3-mini",
            temperature=0.7,
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            default_headers={
                "HTTP-Referer": os.getenv("APP_URL", "http://localhost:3000"),
                "X-Title": os.getenv("APP_NAME", "Advanced Deep Research")
            }
        )
        logger.info("OpenRouter LLM initialized successfully")
        
        # Initialize research agent
        logger.info("Initializing ResearchAgents")
        agent = ResearchAgents(llm)
        logger.info("ResearchAgents initialized successfully")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TimeElapsedColumn(),
            console=console
        ) as progress:
            # Generate follow-up questions
            console.print("\n[bold cyan]Creating research plan...[/bold cyan]")
            questions_task = progress.add_task("[bold]Generating clarifying questions...", total=1)
            follow_up_questions = await generate_follow_up_questions(agent, query)
            progress.update(questions_task, completed=True)
            
            # Ask follow-up questions
            console.print("\n[bold cyan]Please answer these questions to help focus the research:[/bold cyan]")
            answers = []
            for i, question in enumerate(follow_up_questions, 1):
                answer = Prompt.ask(f"\n[cyan]{i}. {question}[/cyan]")
                answers.append(answer)
            
            # Combine all information
            combined_query = f"""Main Query: {query}
Context:
{chr(10).join(f'Q: {q}\nA: {a}' for q, a in zip(follow_up_questions, answers))}"""
            
            # Show research configuration
            console.print(Panel(
                f"[bold]Research Plan[/bold]\n\n"
                f"[cyan]Query:[/cyan] {query}\n\n"
                f"[cyan]Research Context:[/cyan]" +
                "\n".join(f"\n- {q}\n  → {a}" for q, a in zip(follow_up_questions, answers)) +
                f"\n\n[cyan]Parameters:[/cyan]\n"
                f"- Depth: {depth} iterations\n"
                f"- Breadth: {breadth} parallel paths",
                title="Research Configuration",
                border_style="blue"
            ))
            
            if Confirm.ask("\nStart research with these parameters?", default=True):
                # Perform research
                console.print("\n[bold cyan]Researching your topic...[/bold cyan]")
                total_steps = depth * breadth + 2  # +2 for initial and final analysis
                research_task = progress.add_task(
                    "[bold]Conducting deep research...",
                    total=total_steps
                )
                
                try:
                    # Search and analyze
                    progress.update(research_task, advance=1, description="[bold]Gathering information...")
                    search_results = await agent.research(query, depth=depth, breadth=breadth)
                    
                    progress.update(research_task, advance=1, description="[bold]Analyzing results...")
                    analysis = await agent.analyze(search_results)
                    
                    # Generate report
                    report_task = progress.add_task("[bold]Generating comprehensive report...", total=1)
                    report_path = f'reports/deep_research_{timestamp}.md'
                    
                    # Ensure reports directory exists
                    os.makedirs('reports', exist_ok=True)
                    
                    report_content = f"""# Deep Research Report: {query}
*Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*

## Research Configuration
- **Depth**: {depth} iterations
- **Breadth**: {breadth} parallel paths
- **Query**: {query}

## Research Questions
### Main Query
{query}

### Follow-up Questions
{chr(10).join(f'#### Q{i+1}: {q}\n**Answer**: {a}\n' for i, (q, a) in enumerate(zip(follow_up_questions, answers), 1))}

## Research Findings
{search_results}

## Expert Analysis
{analysis}

## Research Process Summary
- Completed {depth} iterations of deep research
- Explored {breadth} parallel research paths per iteration
- Generated and incorporated follow-up questions
- Synthesized findings from multiple sources
- Performed expert analysis of results
"""
                    
                    with open(report_path, 'w', encoding='utf-8') as f:
                        f.write(report_content)
                    
                    progress.update(report_task, completed=True)
                    
                    # Display results
                    console.print(f"\n[green]Research complete! Report saved to: {report_path}")
                    
                    # Show summary in a panel
                    console.print("\n[bold cyan]Research Summary:[/bold cyan]")
                    console.print(Panel(
                        Markdown(analysis),
                        title="Key Findings",
                        border_style="blue"
                    ))
                    
                    # Ask if user wants to view full report
                    if Confirm.ask("\nWould you like to view the full report?", default=True):
                        console.print("\n[bold cyan]Full Research Report:[/bold cyan]")
                        console.print(Panel(
                            Markdown(report_content),
                            title="Full Report",
                            border_style="blue"
                        ))
                        
                    # Ask if user wants to open the report file
                    if Confirm.ask("\nWould you like to open the report file?", default=True):
                        try:
                            os.startfile(report_path) if os.name == 'nt' else os.system(f'open {report_path}')
                        except Exception as e:
                            console.print(f"[yellow]Could not open file automatically. Please open manually: {report_path}")
                            
                except Exception as e:
                    console.print(f"\n[red]Error during research: {str(e)}")
                    if Confirm.ask("\nWould you like to retry with reduced parameters?", default=True):
                        return await run_research(query, depth - 1 if depth > 1 else 1, breadth - 1 if breadth > 2 else 2)
            else:
                console.print("[yellow]Research cancelled by user.")
                return
            
    except Exception as e:
        logger.error(f"Error during research: {str(e)}")
        console.print(f"[red]Error: {str(e)}")
        console.print(Panel(
            f"Error Details:\n{traceback.format_exc()}",
            title="Error Information",
            border_style="red"
        ))
        sys.exit(1)

@click.command()
@click.option('--query', '-q', help='Initial research query')
@click.option('--depth', '-d', type=int, help='Research depth (1-5)')
@click.option('--breadth', '-b', type=int, help='Research breadth (2-10)')
def main(query: Optional[str], depth: Optional[int], breadth: Optional[int]):
    """Advanced Deep Research CLI - AI-powered research assistant"""
    try:
        run_research_sync(query, depth, breadth)
    except Exception as e:
        console.print(f"[red]Error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main() 