"""Advanced Deep Research - A tool for conducting comprehensive research."""
from .configuration import Configuration
from .state import (
    Section, ReportState, SectionState, 
    ReportStateInput, ReportStateOutput,
    SearchQuery, Queries, Feedback
)
from .utils import deduplicate_and_format_sources, format_sections
from .graph import graph

__version__ = "0.1.0"
