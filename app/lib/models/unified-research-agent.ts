import { openRouterClient, firecrawlApiKey, firecrawlBaseUrl, firecrawlRequestTimeout, firecrawlHeaders, defaultFirecrawlOptions } from '../clients';
import pLimit from 'p-limit';
import { modelRegistry } from './providers';
import axios from 'axios';

// Add a utility function for structured logging
/**
 * Structured logger for better debugging
 */
class AgentLogger {
  private enabled: boolean;
  
  constructor() {
    this.enabled = process.env.NODE_ENV === 'development';
  }
  
  /**
   * Log an informational message with optional data
   */
  info(message: string, data?: any): void {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 19);
    if (data) {
      console.log(`[${timestamp}] 🔍 [Research] ${message}`, data);
    } else {
      console.log(`[${timestamp}] 🔍 [Research] ${message}`);
    }
  }
  
  /**
   * Log a warning with optional data
   */
  warn(message: string, data?: any): void {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 19);
    if (data) {
      console.warn(`[${timestamp}] ⚠️ [Research] ${message}`, data);
    } else {
      console.warn(`[${timestamp}] ⚠️ [Research] ${message}`);
    }
  }
  
  /**
   * Log an error with optional data
   */
  error(message: string, error?: any): void {
    // Always log errors regardless of env
    const timestamp = new Date().toISOString().substring(11, 19);
    if (error) {
      console.error(`[${timestamp}] ❌ [Research] ${message}`, error);
    } else {
      console.error(`[${timestamp}] ❌ [Research] ${message}`);
    }
  }
}

const logger = new AgentLogger();

// Progress types
export interface ResearchProgress {
  progress?: number;
  status?: string;
  currentDepth?: number;
  totalDepth?: number;
  currentBreadth?: number;
  totalBreadth?: number;
  currentQuery?: string;
  totalQueries?: number;
  completedQueries?: number;
}

// Result types
export interface Source {
  title: string;
  url: string;
  relevance: number;
  domain?: string;
  favicon?: string;
}

export interface ResearchResult {
  research: string;
  analysis: string;
  sources: Source[];
  confidence: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert researcher. You answer questions with comprehensive, well-structured, and evidence-based responses. When responding:
- Be highly organized with clear sections and coherent structure
- Suggest solutions the user may not have considered
- Be proactive and anticipate the user's information needs
- Provide detailed explanations with appropriate depth
- Value logical arguments over appeals to authority
- Consider new technologies, contrarian ideas, and emerging research
- When speculating, clearly note it as such
- Cite relevant sources whenever possible with links
- Maintain academic rigor and objectivity`;

// Increase this if you have higher API rate limits
const CONCURRENCY_LIMIT = 2;

/**
 * Unified Research Agent that can handle both regular and deep research modes
 */
export class UnifiedResearchAgent {
  private progressCallback?: (progress: ResearchProgress) => void;
  private abortController: AbortController;
  private modelKey: string;

  constructor(config: { 
    progressCallback?: (progress: ResearchProgress) => void;
    modelKey?: string;
  } = {}) {
    this.progressCallback = config.progressCallback;
    this.abortController = new AbortController();
    this.modelKey = config.modelKey || process.env.DEFAULT_MODEL_KEY || 'deepseek-r1';
    logger.info(`Agent initialized with model: ${this.modelKey}`);
  }

  /**
   * Abort the current research process
   */
  public abort() {
    this.abortController.abort();
  }

  /**
   * Report progress to the caller
   */
  private reportProgress(progressUpdate: ResearchProgress) {
    if (this.progressCallback) {
      this.progressCallback(progressUpdate);
    }
  }

  /**
   * Trims a prompt to ensure it doesn't exceed token limits
   */
  private trimPrompt(text: string, maxChars = 4000): string {
    if (!text) return '';
    return text.length > maxChars ? text.substring(0, maxChars) + '...' : text;
  }

  /**
   * Search the web using Firecrawl API
   */
  private async searchWeb(query: string): Promise<{ results: any[]; sources: Source[] }> {
    try {
      logger.info(`Searching web for: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
      
      // Construct the search endpoint
      const endpoint = `${firecrawlBaseUrl}/search`;
      
      // Format request according to Firecrawl API
      const requestPayload = {
        query,
        ...defaultFirecrawlOptions,
        timeout: Math.floor(firecrawlRequestTimeout * 0.75) // 75% of the total timeout
      };

      const response = await axios.post(
        endpoint, 
        requestPayload,
        {
          headers: firecrawlHeaders,
          timeout: firecrawlRequestTimeout,
          signal: this.abortController.signal
        }
      );
      
      if (
        response.data && 
        response.data.data && 
        Array.isArray(response.data.data)
      ) {
        const results = response.data.data;
        
        // Extract sources from results
        const sources: Source[] = results
          .map((result: any) => ({
            title: result.title || 'Untitled',
            url: result.url || '',
            snippet: result.snippet || result.description || ''
          }))
          .filter((source: Source) => source.url); // Filter out entries without URLs
        
        if (results.length === 0) {
          logger.warn(`No results found for query: "${query.substring(0, 30)}..."`);
        } else {
          logger.info(`Found ${results.length} results for web search`, {
            query: query.substring(0, 30),
            sourceCount: sources.length
          });
        }
        
        return { results, sources };
      } else {
        logger.warn('API returned empty or invalid results');
        return { results: [], sources: [] };
      }
    } catch (error) {
      logger.error('Error searching web:', error);
      return { results: [], sources: [] };
    }
  }

  /**
   * Generate search queries based on the user query and previous learnings
   */
  private async generateSerpQueries(query: string, numQueries = 3, learnings?: string[]): Promise<Array<{query: string; researchGoal: string}>> {
    try {
      logger.info(`Generating search queries for: "${query.substring(0, 40)}..."`);
      
      const systemMessage = {
        role: 'system',
        content: DEFAULT_SYSTEM_PROMPT
      };

      const userPrompt = `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: 
      
USER QUERY: ${query}

${learnings && learnings.length > 0 
  ? `Here are some learnings from previous research, use them to generate more specific queries: 
${learnings.join('\n')}`
  : ''}

Return your response as a valid JSON object with this structure:
{
  "queries": [
    {
      "query": "The search query to use",
      "researchGoal": "Detailed explanation of the goal of this query and how it advances the research"
    },
    ...
  ]
}`;

      const messages = [
        systemMessage,
        { role: 'user', content: userPrompt }
      ];

      // Call the OpenRouter API with the selected model
      const result = await openRouterClient.chat(messages, { model: this.modelKey });
      
      // Parse the result to extract the queries
      try {
        // Find JSON object in the response (it might be wrapped in markdown code blocks)
        const jsonMatch = result.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || 
                        result.match(/{[\s\S]*"queries"[\s\S]*}/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : result;
        const parsed = JSON.parse(jsonStr);
        
        if (parsed && Array.isArray(parsed.queries)) {
          const queries = parsed.queries.slice(0, numQueries);
          logger.info(`Generated ${queries.length} search queries`, {
            queries: queries.map((q: { query: string }) => q.query)
          });
          return queries;
        } else {
          throw new Error('Invalid response format - no queries array found');
        }
      } catch (parseError) {
        logger.error('Error parsing AI response for queries', parseError);
        
        // Create a fallback query if parsing fails
        logger.info('Using fallback query (original user query)');
        return [{
          query: query,
          researchGoal: "Directly answering the user's original query"
        }];
      }
    } catch (error) {
      logger.error('Error generating SERP queries:', error);
      
      // Return the original query as a fallback
      return [{
        query: query,
        researchGoal: "Directly answering the user's original query"
      }];
    }
  }

  /**
   * Process SERP results to extract learnings and follow-up questions
   */
  private async processSerpResult(
    query: string, 
    results: any[], 
    numLearnings = 3, 
    numFollowUpQuestions = 3
  ): Promise<{ 
    learnings: string[]; 
    followUpQuestions: Array<{query: string; goal: string}>;
  }> {
    try {
      // Skip if there are no results
      if (!results || results.length === 0) {
        return { learnings: [], followUpQuestions: [] };
      }

      // Format search results as text
      const formattedResults = results.map((result, index) => {
        const content = result.snippet || result.description || result.content || 'No content available';
        const title = result.title || `Result ${index + 1}`;
        const url = result.url || '#';
        
        return `
## Result ${index + 1}: ${title}
URL: ${url}
Content: ${content}
        `;
      }).join('\n\n');

      const systemMessage = {
        role: 'system',
        content: DEFAULT_SYSTEM_PROMPT
      };

      const userPrompt = `Given the user's query and these search results, extract key learnings and suggest follow-up questions.

USER QUERY: ${query}

SEARCH RESULTS:
${formattedResults}

Provide your response as a valid JSON object with this structure:
{
  "learnings": [
    "Key insight 1 from the search results, stated concisely as a standalone fact",
    "Key insight 2...",
    ...
  ],
  "followUpQuestions": [
    {
      "query": "A follow-up search query that would deepen the research",
      "goal": "Explanation of why this follow-up question is valuable"
    },
    ...
  ]
}

Make sure your response is a valid JSON object with the exact structure shown above. Include at most ${numLearnings} learnings and ${numFollowUpQuestions} follow-up questions.`;

      const messages = [
        systemMessage,
        { role: 'user', content: userPrompt }
      ];

      // Call the OpenRouter API with the selected model
      const result = await openRouterClient.chat(messages, { model: this.modelKey });

      // Parse the result
      try {
        // Find JSON object in the response (it might be wrapped in markdown code blocks)
        const jsonMatch = result.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || 
                        result.match(/{[\s\S]*"learnings"[\s\S]*}/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : result;
        const parsed = JSON.parse(jsonStr);
        
        if (parsed && Array.isArray(parsed.learnings) && Array.isArray(parsed.followUpQuestions)) {
          return {
            learnings: parsed.learnings.slice(0, numLearnings),
            followUpQuestions: parsed.followUpQuestions.slice(0, numFollowUpQuestions)
          };
        } else {
          throw new Error('Invalid response format');
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        return { learnings: [], followUpQuestions: [] };
      }
    } catch (error) {
      console.error('Error processing SERP results:', error);
      return { learnings: [], followUpQuestions: [] };
    }
  }

  /**
   * Generate a research report based on search results
   */
  private async generateResearchReport(query: string, searchResults: string, sources: Source[]): Promise<{ content: string; sources: Source[] }> {
    this.reportProgress({ progress: 60, status: 'Analyzing search results' });
    
    try {
      const systemMessage = {
        role: 'system',
        content: DEFAULT_SYSTEM_PROMPT
      };

      const userPrompt = `Please research this query thoroughly: ${query}

Search results:
${searchResults}

Create a comprehensive, well-structured report based on these search results. The report should:
1. Provide a thorough answer to the query
2. Analyze different perspectives and approaches
3. Include specific details, facts, and examples from the search results
4. Cite sources when referencing specific information
5. Be organized with clear headings and a logical structure
6. End with a conclusion or summary

Your report should be well-formatted in Markdown with appropriate headings, bullet points, and other formatting as needed.`;

      const messages = [
        systemMessage,
        { role: 'user', content: userPrompt }
      ];

      // Call the OpenRouter API
      const result = await openRouterClient.chat(messages, { model: this.modelKey });
      
      return { 
        content: result, 
        sources
      };
    } catch (error) {
      console.error('Error generating report:', error);
      return { 
        content: `Sorry, I encountered an error while generating a research report for: "${query}". Please try again or refine your query.`, 
        sources 
      };
    }
  }

  /**
   * Generate the final deep research report
   */
  private async generateFinalReport(query: string, learnings: string[], sources: Source[]): Promise<string> {
    try {
      const systemMessage = {
        role: 'system',
        content: DEFAULT_SYSTEM_PROMPT
      };

      const learningsString = this.trimPrompt(
        learnings.map(learning => `- ${learning}`).join('\n'),
        150000
      );
      
      // Log learnings count only in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`Generating final report using ${learnings.length} learnings`);
      }

      const userPrompt = `Given the following user query, write a comprehensive final report using the learnings from research. 
      
USER QUERY: ${query}

LEARNINGS:
${learningsString}

Write a well-structured, thorough report that directly addresses the query. Include:
1. A clear introduction that summarizes the key findings
2. Main sections that explore different aspects of the topic in detail
3. Specific facts, figures, and examples from the research
4. A conclusion that synthesizes the findings and provides actionable insights

Format the report in Markdown with appropriate headings, lists, and emphasis.`;

      const messages = [
        systemMessage,
        { role: 'user', content: userPrompt }
      ];

      const result = await openRouterClient.chat(messages, { model: this.modelKey });
      return result;
    } catch (error) {
      console.error('Error generating final report:', error instanceof Error ? error.message : 'Unknown error');
      // Return a more user-friendly error message with the learnings
      return `# Research Report: ${query}\n\n## Summary\n\nThere was an error generating the complete research report.\n\n## Raw Findings\n\n${learnings.map(l => `- ${l}`).join('\n')}\n\n## Sources\n\n${sources.map(s => `- [${s.title}](${s.url})`).join('\n')}`;
    }
  }

  /**
   * Process search results into a structured format
   */
  private formatSearchResults(rawResults: any[]): string {
    return rawResults.map((result: any, index: number) => {
      // Extract content from markdown or use description as fallback
      const content = result.markdown || result.description || 'No content available';
      const title = result.title || result.metadata?.title || 'Untitled';
      const url = result.url || result.metadata?.sourceURL || '#';
      const domain = url !== '#' ? new URL(url).hostname.replace('www.', '') : 'unknown';
      
      // Create a structured section for each result
      return `
## ${index + 1}. ${title}
**Source:** [${url}](${url}) (${domain})
${content}
      `;
    }).join('\n\n');
  }

  /**
   * Stream reasoning traces to provide visibility into the thought process
   */
  private streamReasoningTrace(trace: string): string {
    logger.info('Streaming reasoning trace', {
      length: trace.length,
      preview: trace.substring(0, 40) + '...'
    });
    
    return JSON.stringify({
      type: 'reasoning_trace',
      content: trace
    }) + '\n';
  }

  /**
   * Stream a progress update to the client
   */
  private streamProgress(progress: ResearchProgress): string {
    logger.info('Progress update', {
      progress: progress.progress || 0,
      status: progress.status
    });
    
    if (progress.currentQuery) {
      logger.info(`Current query: "${progress.currentQuery.substring(0, 50)}${progress.currentQuery.length > 50 ? '...' : ''}"`);
    }
    
    // Create a standardized progress message for streaming
    const progressData = {
      type: 'progress',
      progress: progress.progress || 0,
      status: progress.status || 'Researching...'
    };
    
    // Add details for deep research if available
    if (progress.currentDepth !== undefined && progress.totalDepth !== undefined) {
      Object.assign(progressData, {
        details: {
          depth: {
            current: progress.currentDepth,
            total: progress.totalDepth
          },
          breadth: {
            current: progress.currentBreadth || 0,
            total: progress.totalBreadth || 0
          },
          queries: {
            current: progress.completedQueries || 0,
            total: progress.totalQueries,
            currentQuery: progress.currentQuery
          }
        }
      });
    }
    
    return JSON.stringify(progressData) + '\n';
  }

  /**
   * Process a query with regular research (single search + analysis)
   */
  private async *doRegularResearch(query: string): AsyncGenerator<string> {
    // Step 1: Search the web
    this.reportProgress({ progress: 10, status: 'Searching the web...' });
    yield this.streamReasoningTrace(`Searching the web for information about: "${query}"`);
    
    const startTime = Date.now();
    let webSearchSucceeded = true;
    
    let sources: Source[] = [];
    let results: any[] = [];
    
    try {
      const searchResults = await this.searchWeb(query);
      results = searchResults.results;
      sources = searchResults.sources;
      
      if (results.length === 0) {
        throw new Error('No search results found');
      }
      
      const searchTime = Date.now() - startTime;
      yield this.streamReasoningTrace(`Found ${results.length} search results in ${(searchTime/1000).toFixed(1)} seconds.`);
      
      // Send search results in the stream
      yield JSON.stringify({
        type: 'search_results',
        content: this.formatSearchResults(results)
      }) + '\n';
      
      // Send source information
      for (const source of sources) {
        yield JSON.stringify({
          type: 'source_update',
          url: source.url,
          data: source
        }) + '\n';
      }
    } catch (error) {
      webSearchSucceeded = false;
      console.error('Web search error:', error);
      yield this.streamReasoningTrace(`Search engine lookup failed. Proceeding with limited information.`);
      
      // Continue even if web search fails
      // Just report the error to the client
      yield JSON.stringify({
        type: 'search_results',
        content: 'Search engine lookup failed. Will attempt to proceed with limited information.'
      }) + '\n';
    }
    
    // Step 2: Process the results with streaming
    this.reportProgress({ progress: 50, status: `Analyzing search results with ${this.getModelDisplayName()}...` });
    
    // Use the streaming model processing instead of waiting for the full response
    // Stream chunks directly to the client
    let processedContent = '';
    for await (const chunk of this.streamProcessWithSelectedModel(query, results)) {
      yield chunk; // Forward the stream chunks directly
      
      // Try to parse the chunk to extract content if it's a content_chunk type
      try {
        const parsed = JSON.parse(chunk);
        if (parsed.type === 'content_chunk' && parsed.content) {
          processedContent += parsed.content;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Log processing time (development only)
    const processingTime = Date.now() - startTime;
    if (processingTime > 5000 && process.env.NODE_ENV === 'development') {
      console.log(`Processing completed in ${(processingTime/1000).toFixed(1)}s`);
    }
    
    yield this.streamReasoningTrace(`Analyzed search results in ${(processingTime/1000).toFixed(1)} seconds.`);
    
    // Step 3: Generate final research report using processed results
    if (processedContent) {
      this.reportProgress({ progress: 70, status: 'Generating comprehensive research report...' });
      const reportStartTime = Date.now();
      
      yield this.streamReasoningTrace(`Generating comprehensive research report that synthesizes findings...`);
      
      const { content } = await this.generateResearchReport(query, processedContent, sources);
      
      const reportTime = Date.now() - reportStartTime;
      yield this.streamReasoningTrace(`Research report generated in ${(reportTime/1000).toFixed(1)} seconds.`);
      
      // Stream the final response
      this.reportProgress({ progress: 100, status: 'Complete' });
      yield JSON.stringify({
        type: 'content',
        content
      }) + '\n';
    } else {
      // If we failed to get processed content, report an error
      yield JSON.stringify({
        type: 'error',
        content: 'Failed to generate research results. Please try again with a different query.'
      }) + '\n';
    }
  }
  
  /**
   * Get a display name for the currently selected model
   */
  private getModelDisplayName(): string {
    const modelConfig = modelRegistry.getModelConfig(this.modelKey);
    return modelConfig ? modelConfig.name : this.modelKey;
  }
  
  /**
   * Process with the selected model instead of middleware
   */
  private async processWithSelectedModel(query: string, rawResults: any[]): Promise<string> {
    try {
      // Format the search results
      const formattedResults = this.formatSearchResults(rawResults);
      
      // Create the prompt for the selected model
      const modelConfig = modelRegistry.getModelConfig(this.modelKey);
      const maxPrompLength = modelConfig?.contextLength || 4000;
      const truncatedResults = this.trimPrompt(formattedResults, maxPrompLength);
      
      // Log token size info only in development mode
      if (process.env.NODE_ENV === 'development') {
        const approximateTokens = Math.ceil(truncatedResults.length / 4);
        if (approximateTokens > 10000) {
          console.log(`Approximate tokens for formatted results: ~${approximateTokens}`);
        }
      }
      
      // The prompt to analyze search results
      const prompt = `
You are a world-class research analyst tasked with generating a concise, insightful, and deeply researched report.

RESEARCH QUERY: ${query}

The following are search results collected from the web. Please analyze these results thoroughly and generate a comprehensive report that:

1. Synthesizes information from multiple sources
2. Provides well-reasoned analysis and insights 
3. Cites specific sources when referring to data or claims
4. Is organized with clear sections and a coherent structure
5. Highlights contrasting viewpoints where they exist
6. Provides actionable conclusions or recommendations
7. Notes any limitations in the available information

SEARCH RESULTS:
${truncatedResults}

Your response should be a complete, well-formatted report that could be presented to executives or academics. Use markdown formatting.
      `;
      
      // Call the selected model with the prompt
      const messages = [
        { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ];
      
      try {
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
          console.log(`Processing with model: ${this.modelKey}`);
        }
        
        // Use the existing chat method to call the model
        const result = await openRouterClient.chat(messages, { model: this.modelKey });
        
        if (!result) {
          throw new Error("Empty response from model");
        }
        
        // Return the response content directly as the API now returns the content
        return result;
      } catch (error) {
        // Log model-specific errors but don't expose full error details
        console.error(`Error with model ${this.modelKey}:`, error instanceof Error ? error.message : 'Unknown error');
        throw error; // Re-throw to be caught by the outer try/catch
      }
    } catch (error) {
      console.error('Error processing with selected model:', error instanceof Error ? error.message : 'Unknown error');
      return "An error occurred while processing search results with the selected model.";
    }
  }

  /**
   * Process with the selected model with streaming support
   */
  private async *streamProcessWithSelectedModel(query: string, rawResults: any[]): AsyncGenerator<string> {
    try {
      // Format the search results
      const formattedResults = this.formatSearchResults(rawResults);
      
      // Create the prompt for the selected model
      const modelConfig = modelRegistry.getModelConfig(this.modelKey);
      const maxPrompLength = modelConfig?.contextLength || 4000;
      const truncatedResults = this.trimPrompt(formattedResults, maxPrompLength);
      
      // The prompt to analyze search results
      const prompt = `
You are a world-class research analyst tasked with generating a concise, insightful, and deeply researched report.

RESEARCH QUERY: ${query}

The following are search results collected from the web. Please analyze these results thoroughly and generate a comprehensive report that:

1. Synthesizes information from multiple sources
2. Provides well-reasoned analysis and insights 
3. Cites specific sources when referring to data or claims
4. Is organized with clear sections and a coherent structure
5. Highlights contrasting viewpoints where they exist
6. Provides actionable conclusions or recommendations
7. Notes any limitations in the available information

SEARCH RESULTS:
${truncatedResults}

Your response should be a complete, well-formatted report that could be presented to executives or academics. Use markdown formatting.
      `;
      
      // Call the selected model with the prompt
      const messages = [
        { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ];
      
      // Use streaming to process the response
      yield JSON.stringify({
        type: 'reasoning_trace',
        content: `Starting to stream analysis from ${this.getModelDisplayName()}...`
      }) + '\n';
      
      // Process stream from OpenRouter
      let fullContent = '';
      try {
        // Use the streamChat method
        for await (const chunk of openRouterClient.streamChat(messages, { model: this.modelKey })) {
          if (chunk) {
            fullContent += chunk;
            
            // Stream each chunk to the client
            yield JSON.stringify({
              type: 'content_chunk',
              content: chunk
            }) + '\n';
          }
        }
        
        // Return the complete content
        return fullContent;
      } catch (error) {
        console.error(`Streaming error with model ${this.modelKey}:`, error instanceof Error ? error.message : 'Unknown error');
        
        // If we've received some content, return it even if streaming failed
        if (fullContent) {
          return fullContent;
        }
        
        throw error; // Re-throw if we have no content
      }
    } catch (error) {
      console.error('Error processing with selected model:', error instanceof Error ? error.message : 'Unknown error');
      yield JSON.stringify({
        type: 'error',
        content: 'An error occurred while processing search results with the model.'
      }) + '\n';
      return "An error occurred while processing search results with the selected model.";
    }
  }

  /**
   * Process a query with deep research (multi-step, recursive analysis)
   */
  private async *doDeepResearch(query: string, options: { depth: number; breadth: number }): AsyncGenerator<string> {
    const depth = Math.min(Math.max(1, options.depth), 5); // Limit depth between 1-5
    const breadth = Math.min(Math.max(2, options.breadth), 5); // Limit breadth between 2-5
    
    // Stream initial reasoning trace
    yield this.streamReasoningTrace(`Starting deep research for query: "${query}" with depth=${depth}, breadth=${breadth}`);
    yield this.streamReasoningTrace(`Deep research enables a more thorough analysis by exploring multiple angles and sub-questions.`);
    
    // Only log configuration in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`Starting deep research with depth=${depth}, breadth=${breadth}`);
    }
    
    const allLearnings: string[] = [];
    const visitedQueries = new Set<string>();
    const visitedUrls = new Set<string>();
    const allSources: Source[] = [];
    
    // Initialize progress tracking
    const progressData = {
      currentDepth: 0,
      totalDepth: depth,
      currentBreadth: 0,
      totalBreadth: breadth,
      completedQueries: 0,
      totalQueries: 0,
      currentQuery: '',
      progress: 0,
      status: 'Initializing deep research...'
    };
    
    try {
      // Process the initial query without recursion
      // We'll handle the depth in a flat approach (non-recursive but still iterative)
      let currentDepth = 1;
      let queriesToProcess: {query: string; depth: number}[] = [{query, depth: 1}];
      
      yield this.streamReasoningTrace(`Preparing initial query and planning research strategy...`);
      
      while (queriesToProcess.length > 0 && currentDepth <= depth) {
        // Get all queries at the current depth level
        const currentLevelQueries = queriesToProcess.filter(q => q.depth === currentDepth);
        queriesToProcess = queriesToProcess.filter(q => q.depth > currentDepth);
        
        // Update progress
        progressData.currentDepth = currentDepth;
        progressData.status = `Researching depth ${currentDepth}/${depth}`;
        this.reportProgress(progressData);
        
        yield this.streamReasoningTrace(`Starting depth ${currentDepth}/${depth} of research with ${currentLevelQueries.length} queries to explore.`);
        
        // Process each query at this depth level
        for (let i = 0; i < currentLevelQueries.length; i++) {
          const { query: currentQuery } = currentLevelQueries[i];
          
          // Skip if already processed
          if (visitedQueries.has(currentQuery)) continue;
          visitedQueries.add(currentQuery);
          
          // Update progress for this query
          progressData.currentQuery = currentQuery;
          progressData.status = `Researching: "${currentQuery}" (depth ${currentDepth}/${depth})`;
          this.reportProgress(progressData);
          
          yield this.streamReasoningTrace(`Researching sub-question: "${currentQuery}" (${i+1}/${currentLevelQueries.length} at depth ${currentDepth})`);
          
          try {
            // Generate search queries for this topic
            yield this.streamReasoningTrace(`Generating targeted search queries based on the sub-question...`);
            
            const generatedQueries = await this.generateSerpQueries(
              currentQuery, 
              breadth, 
              allLearnings
            );
            
            // Update total queries count
            progressData.totalQueries += generatedQueries.length;
            
            yield this.streamReasoningTrace(`Generated ${generatedQueries.length} search queries to explore different aspects of the question.`);

            // Process each generated query
            const limit = pLimit(CONCURRENCY_LIMIT);
            const searchPromises = generatedQueries.map((genQuery, index) => {
              return limit(async () => {
                try {
                  progressData.currentBreadth = index + 1;
                  progressData.totalBreadth = generatedQueries.length;
                  progressData.status = `Researching (${index + 1}/${generatedQueries.length}): ${genQuery.query}`;
                  progressData.currentQuery = genQuery.query;
                  this.reportProgress(progressData);
                  
                  // We'll capture trace messages and return them since we can't yield inside this async function
                  const traceMessages: string[] = [];
                  traceMessages.push(`Searching for: "${genQuery.query}" (${index + 1}/${generatedQueries.length})`);
                  traceMessages.push(`Search goal: ${genQuery.researchGoal}`);
                  
                  // Perform the search
                  const { results, sources } = await this.searchWeb(genQuery.query);
                  const numResults = results.length;
                  
                  traceMessages.push(`Found ${numResults} search results for query "${genQuery.query}"`);
                  
                  // Add to visited URLs
                  sources.forEach(source => {
                    if (source.url) visitedUrls.add(source.url);
                  });
                  
                  // Add to all sources
                  allSources.push(...sources);
                  
                  // Process the results
                  let extractedLearnings: string[] = [];
                  let extractedFollowUps: {query: string; depth: number}[] = [];
                  
                  if (numResults > 0) {
                    traceMessages.push(`Extracting key learnings from search results...`);
                    
                    // Extract learnings
                    const { learnings, followUpQuestions } = await this.processSerpResult(
                      genQuery.query,
                      results,
                      5, // numLearnings
                      3  // numFollowUpQuestions
                    );
                    
                    // Add learnings
                    if (learnings && learnings.length > 0) {
                      extractedLearnings = learnings;
                      traceMessages.push(`Extracted ${learnings.length} key insights from search results.`);
                    }
                    
                    // Prepare follow-up questions for the next depth level
                    if (followUpQuestions && followUpQuestions.length > 0 && currentDepth < depth) {
                      extractedFollowUps = followUpQuestions.map(q => ({
                        query: q.query,
                        depth: currentDepth + 1
                      }));
                      
                      traceMessages.push(`Generated ${followUpQuestions.length} follow-up questions for deeper research.`);
                    }
                  }
                  
                  progressData.completedQueries++;
                  const overallProgress = Math.min(
                    90,
                    20 + (70 * ((currentDepth - 1) / depth + progressData.completedQueries / progressData.totalQueries / depth))
                  );
                  progressData.progress = Math.floor(overallProgress);
                  this.reportProgress(progressData);
                  
                  return { 
                    success: true, 
                    traceMessages,
                    learnings: extractedLearnings,
                    followUps: extractedFollowUps
                  };
                } catch (error) {
                  console.error(`Error processing query "${genQuery.query}":`, 
                    error instanceof Error ? error.message : 'Unknown error');
                  return { 
                    success: false, 
                    error,
                    traceMessages: [`Error processing query "${genQuery.query}": ${error instanceof Error ? error.message : 'Unknown error'}`]
                  };
                }
              });
            });
            
            // Wait for all search tasks to complete
            const results = await Promise.all(searchPromises);
            
            // Now we can safely yield the trace messages and process the results
            for (const result of results) {
              // Stream all trace messages
              for (const trace of result.traceMessages || []) {
                yield this.streamReasoningTrace(trace);
              }
              
              // Add learnings and stream them
              if (result.learnings && result.learnings.length > 0) {
                allLearnings.push(...result.learnings);
                
                // Stream the learnings
                yield JSON.stringify({
                  type: 'learnings',
                  content: result.learnings.join('\n')
                }) + '\n';
              }
              
              // Add follow-up questions
              if (result.followUps && result.followUps.length > 0) {
                queriesToProcess.push(...result.followUps);
              }
            }
          } catch (topicError) {
            // Log the error but continue with the next topic
            console.error(`Error researching topic "${currentQuery}":`, 
              topicError instanceof Error ? topicError.message : 'Unknown error');
            yield this.streamReasoningTrace(`Error researching topic "${currentQuery}": ${topicError instanceof Error ? topicError.message : 'Unknown error'}`);
          }
        }
        
        // Move to the next depth
        currentDepth++;
      }
      
      // Generate final report
      progressData.status = 'Generating final report...';
      progressData.progress = 90;
      this.reportProgress(progressData);
      
      const finalReport = await this.generateFinalReport(query, allLearnings, allSources);
      
      // Stream the final report
      yield JSON.stringify({
        type: 'content',
        content: finalReport
      }) + '\n';
      
      // Mark as complete
      progressData.status = 'Complete';
      progressData.progress = 100;
      this.reportProgress(progressData);
      
      // Log the completion in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`Deep research completed: ${allLearnings.length} learnings, ${visitedUrls.size} sources`);
      }
      
    } catch (error) {
      // Log the top-level error with improved message
      console.error(`Deep research error for query "${query}":`, 
        error instanceof Error ? error.message : 'Unknown error');
      
      // Return a more detailed error to the client
      yield JSON.stringify({
        type: 'error',
        content: `An error occurred during deep research. We found ${allLearnings.length} insights before the error occurred.`
      }) + '\n';
      
      // If we have some results, still return them
      if (allLearnings.length > 0) {
        const partialReport = `# Partial Research Report: ${query}\n\n## Note\n\nAn error occurred during the research process, but here are the insights we gathered before the error:\n\n${allLearnings.map(l => `- ${l}`).join('\n')}\n\n## Sources\n\n${Array.from(visitedUrls).map(url => `- ${url}`).join('\n')}`;
        
        yield JSON.stringify({
          type: 'content',
          content: partialReport
        }) + '\n';
      }
    }
  }

  /**
   * Main method to process a query, with streaming results
   */
  public async *processQueryStream(
    query: string, 
    options: { 
      isDeepResearch?: boolean; 
      depth?: number; 
      breadth?: number; 
    } = {}
  ): AsyncGenerator<string> {
    // Set default options
    const deepResearch = options.isDeepResearch || false;
    const depth = options.depth || 2;
    const breadth = options.breadth || 3;
    
    try {
      if (deepResearch) {
        // Use deep research mode
        for await (const chunk of this.doDeepResearch(query, { depth, breadth })) {
          yield chunk;
        }
      } else {
        // Use regular research mode
        for await (const chunk of this.doRegularResearch(query)) {
          yield chunk;
        }
      }
    } catch (error) {
      // Only log unexpected errors that weren't caught by deeper methods
      console.error('Unhandled error in processQueryStream:', error);
      yield JSON.stringify({
        type: 'error',
        content: 'An error occurred during research. Please try again.'
      }) + '\n';
    }
  }
} 