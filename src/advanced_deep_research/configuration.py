"""Configuration management."""
import os
from enum import Enum
from dataclasses import dataclass, fields
from typing import Any, Optional

from langchain_core.runnables import RunnableConfig

DEFAULT_REPORT_STRUCTURE = """Use this structure to create a report on the user-provided topic:

1. Introduction (no research needed)
   - Brief overview of the topic area

2. Main Body Sections:
   - Each section should focus on a sub-topic of the user-provided topic
   
3. Conclusion
   - Aim for 1 structural element (either a list of table) that distills the main body sections 
   - Provide a concise summary of the report"""

class SearchAPI(Enum):
    FIRECRAWL = "firecrawl"
    TAVILY = "tavily"

class PlannerProvider(Enum):
    OPENROUTER = "openrouter"

@dataclass
class Configuration:
    """The configurable fields for the chatbot."""
    report_structure: str = DEFAULT_REPORT_STRUCTURE # Defaults to the default report structure
    number_of_queries: int = 2 # Number of search queries to generate per iteration
    max_search_depth: int = 2 # Maximum number of reflection + search iterations
    planner_provider: PlannerProvider = PlannerProvider.OPENROUTER # Defaults to Openrouter as provider
    planner_model: str = "gryphe/mythomist-7b" # Defaults to Mythomist-7B as planner model
    writer_model: str = "mistralai/mistral-7b" # Defaults to Mistral-7B as writer model
    search_api: SearchAPI = SearchAPI.TAVILY # Default to TAVILY

    @classmethod
    def from_runnable_config(cls, config: RunnableConfig) -> "Configuration":
        """Create a configuration from a RunnableConfig."""
        if not config:
            return cls()

        # Extract configurable fields from config
        config_fields = {field.name: config.get(field.name) for field in fields(cls)}
        return cls(**{k: v for k, v in config_fields.items() if v is not None})

    def model_dump(self) -> dict:
        """Convert the configuration to a dictionary."""
        return {
            "report_structure": self.report_structure,
            "number_of_queries": self.number_of_queries,
            "max_search_depth": self.max_search_depth,
            "planner_provider": self.planner_provider.value,
            "planner_model": self.planner_model,
            "writer_model": self.writer_model,
            "search_api": self.search_api.value
        }
