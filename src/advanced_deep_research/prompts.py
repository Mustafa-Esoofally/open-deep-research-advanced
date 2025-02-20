"""Prompts for research process."""

# Prompt to generate search queries to help with planning the report
RESEARCH_PLAN_PROMPT = """You are an expert technical writer, helping to plan a report. 

<Report topic>
{topic}
</Report topic>

<Report organization>
{report_organization}
</Report organization>

<Task>
Your goal is to generate {number_of_queries} search queries that will help gather comprehensive information for planning the report sections. 

The queries should:

1. Be related to the topic of the report
2. Help satisfy the requirements specified in the report organization

Make the queries specific enough to find high-quality, relevant sources while covering the breadth needed for the report structure.
</Task>"""

# Prompt to plan report sections
REPORT_PLAN_PROMPT = """You are an expert technical writer, helping to plan a report. 

<Report topic>
{topic}
</Report topic>

<Report organization>
{report_organization}
</Report organization>

<Task>
Your goal is to create a plan for the report sections based on the provided sources and report organization. For each section:

1. Give it a clear, descriptive name
2. Provide a brief overview of what will be covered
3. Indicate if it needs web research (set research=true) or can be written from the completed sections (set research=false)

The Introduction and Conclusion sections should have research=false as they will be written using the completed research sections as context.
</Task>"""

# Prompt to generate search queries for a section
SECTION_QUERY_PROMPT = """You are an expert technical writer, helping to research a section of a report.

<Section title>
{title}
</Section title>

<Task>
Your goal is to generate search queries that will help gather comprehensive information for this section.

The queries should:
1. Be specific to the section topic
2. Help find high-quality, relevant sources
3. Cover different aspects needed for the section
</Task>"""

# Prompt to analyze content
CONTENT_ANALYSIS_PROMPT = """You are an expert research assistant analyzing web content.

<Task>
Analyze the provided content to determine if it is relevant to the search query. If relevant, extract and summarize the key information.

The analysis should:
1. Focus on factual, accurate information
2. Prioritize recent sources when available
3. Include specific details, statistics, and examples
4. Maintain proper attribution

Format the output as a structured summary with relevant quotes and citations.
</Task>

<Query>
{query}
</Query>

<Content>
{content}
</Content>"""

# Prompt to write section content
SECTION_CONTENT_PROMPT = """You are an expert technical writer composing a section of a report.

<Section title>
{title}
</Section title>

<Task>
Your goal is to write content for this section using the provided sources. The content should:

1. Be comprehensive and well-organized
2. Include specific details, examples, and data from the sources
3. Maintain proper attribution
4. Use clear, professional language
</Task>"""

# Prompt to write final sections using completed sections as context
FINAL_SECTION_CONTENT_PROMPT = """You are an expert technical writer composing a section of a report.

<Section title>
{title}
</Section title>

<Task>
Your goal is to write this section using the completed research sections as context. The content should:

1. Draw insights and connections from across the research sections
2. Provide a clear narrative that ties the sections together
3. Use professional, engaging language
4. For conclusions, include a structural element (list/table) that distills key points
</Task>"""

# Prompt for feedback
FEEDBACK_PROMPT = """You are an expert editor evaluating a section of a technical report.

<Task>
Your goal is to evaluate the section content and determine if it needs improvement. Consider:

1. Comprehensiveness - Does it cover the key aspects?
2. Organization - Is it well-structured and clear?
3. Evidence - Does it include specific details and examples?
4. Writing - Is the language professional and engaging?

If improvements are needed:
1. Grade as "fail"
2. Generate follow-up search queries to fill gaps

If the section meets requirements:
1. Grade as "pass"
2. No follow-up queries needed
</Task>"""
