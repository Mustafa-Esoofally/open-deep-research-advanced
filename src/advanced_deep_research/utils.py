"""Utility functions for research process."""

import os
import asyncio
import requests
from typing import List, Dict, Any, Optional

from tavily import TavilyClient
from .state import Section, SearchQuery

# Initialize Tavily client with API key from environment variable
api_key = os.getenv("TAVILY_API_KEY")
if not api_key:
    raise ValueError("TAVILY_API_KEY environment variable is required")

tavily_client = TavilyClient(api_key=api_key)

def deduplicate_and_format_sources(search_response, max_tokens_per_source=1000, include_raw_content=True):
    """
    Takes a list of search responses and formats them into a readable string.
    Limits the raw_content to approximately max_tokens_per_source.
 
    Args:
        search_responses: List of search response dicts, each containing:
            - query: str
            - results: List of dicts with fields:
                - title: str
                - url: str
                - content: str
                - score: float
                - raw_content: str|None
        max_tokens_per_source: int
        include_raw_content: bool
            
    Returns:
        str: Formatted string with deduplicated sources
    """
    # Collect all results
    sources_list = []
    for response in search_response:
        sources_list.extend(response['results'])
    
    # Deduplicate by URL
    unique_sources = {source['url']: source for source in sources_list}

    # Format output
    formatted_text = "Sources:\n\n"
    for i, source in enumerate(unique_sources.values(), 1):
        formatted_text += f"Source {source['title']}:\n===\n"
        formatted_text += f"URL: {source['url']}\n===\n"
        formatted_text += f"Most relevant content from source: {source['content']}\n===\n"
        if include_raw_content and source.get('raw_content'):
            # Using rough estimate of 4 characters per token
            char_limit = max_tokens_per_source * 4
            raw_content = source['raw_content'][:char_limit]
            formatted_text += f"Full content: {raw_content}\n===\n"
        formatted_text += "\n"
    
    return formatted_text

def format_sections(sections: List[Section]) -> str:
    """Format a list of sections into a string."""
    formatted_text = "Report Sections:\n\n"
    for i, section in enumerate(sections, 1):
        formatted_text += f"{i}. {section.name}\n"
        formatted_text += f"Description: {section.description}\n"
        if section.content:
            formatted_text += f"Content:\n{section.content}\n"
        formatted_text += "\n"
    return formatted_text

async def tavily_search_async(search_queries: List[SearchQuery]) -> List[Dict[str, Any]]:
    """
    Performs concurrent web searches using the Tavily API.

    Args:
        search_queries (List[SearchQuery]): List of search queries to process

    Returns:
        List[dict]: List of search responses from Tavily API, one per query. Each response has format:
            {
                'query': str, # The original search query
                'results': [                     # List of search results
                    {
                        'title': str,            # Title of the webpage
                        'url': str,              # URL of the result
                        'content': str,          # Summary/snippet of content
                        'score': float,          # Relevance score
                        'raw_content': str|None  # Full page content if available
                    },
                    ...
                ]
            }
    """
    search_tasks = []
    for query in search_queries:
        # Run synchronous search in a thread pool
        loop = asyncio.get_event_loop()
        search_tasks.append(
            loop.run_in_executor(
                None,
                lambda q=query: {  # Use default arg to capture query value
                    'query': q.search_query,
                    'results': tavily_client.search(
                        query=q.search_query,
                        search_depth="advanced",
                        include_raw_content=True,
                        max_results=5
                    ).get('results', [])
                }
            )
        )

    # Execute all searches concurrently
    responses = await asyncio.gather(*search_tasks)
    return responses
