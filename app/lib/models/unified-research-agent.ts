import { openRouterClient, firecrawlApiKey, firecrawlBaseUrl, firecrawlRequestTimeout, firecrawlHeaders, defaultFirecrawlOptions } from '../clients';
import axios from 'axios';

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
    this.modelKey = config.modelKey || process.env.DEFAULT_MODEL_KEY || 'o1-mini';
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
  private async searchWeb(query: string): Promise<{ results: any[]; success: boolean; sources: Source[] }> {
    const maxRetries = 2;
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        this.reportProgress({ 
          progress: 20, 
          status: 'Searching the web...' 
        });
        
        console.log(`Starting Firecrawl search for: "${query}" (attempt ${retries + 1}/${maxRetries + 1})`);
        
        // Construct the search endpoint from the base URL
        const endpoint = `${firecrawlBaseUrl}/search`;
        
        // Format request according to Firecrawl API
        const requestPayload = {
          query,
          ...defaultFirecrawlOptions,
          timeout: Math.floor(firecrawlRequestTimeout * 0.75) // 75% of the total timeout
        };
        
        const response = await axios.post(endpoint, 
          requestPayload,
          {
            headers: firecrawlHeaders,
            timeout: firecrawlRequestTimeout
          }
        );
        
        // Validate response data structure
        if (
          response.data && 
          response.data.data && 
          Array.isArray(response.data.data) && 
          response.data.data.length > 0
        ) {
          this.reportProgress({ 
            progress: 40, 
            status: `Found ${response.data.data.length} search results` 
          });

          // Extract sources from the results
          const sources = response.data.data.map((result: any) => {
            const url = result.url || '';
            let domain = '';
            let favicon = '';
            
            if (url) {
              try {
                const urlObj = new URL(url);
                domain = urlObj.hostname.replace('www.', '');
                favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
              } catch (e) {
                // Ignore URL parsing errors
              }
            }
            
            return {
              title: result.title || 'Untitled',
              url,
              domain,
              favicon,
              relevance: 0.9 // Default relevance score
            };
          }).filter((source: Source) => source.url);
          
          return { 
            results: response.data.data, 
            success: true, 
            sources 
          };
        } else {
          // Handle empty results
          console.warn('Firecrawl returned empty results or unexpected response format');
          
          if (retries < maxRetries) {
            retries++;
            console.log(`Retrying search (${retries}/${maxRetries})...`);
            // Wait before retrying with increasing delay
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            continue;
          }
          
          return { 
            results: [], 
            success: false,
            sources: []
          };
        }
      } catch (error: any) {
        console.error('Firecrawl search error:', error);
        
        if (retries < maxRetries) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          continue;
        }
        
        return { 
          results: [], 
          success: false,
          sources: []
        };
      }
    }
    
    // This should be unreachable but keeps TypeScript happy
    return { results: [], success: false, sources: [] };
  }

  /**
   * Generate search queries based on the user query and previous learnings
   */
  private async generateSerpQueries(query: string, numQueries = 3, learnings?: string[]): Promise<Array<{query: string; researchGoal: string}>> {
    try {
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
          console.log(`Generated ${parsed.queries.length} queries`);
          return parsed.queries.slice(0, numQueries);
        } else {
          throw new Error('Invalid response format - no queries array found');
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        
        // Create a fallback query if parsing fails
        return [{
          query: query,
          researchGoal: "Directly answering the user's original query"
        }];
      }
    } catch (error) {
      console.error('Error generating SERP queries:', error);
      
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
      console.error('Error generating final report:', error);
      return `Sorry, I encountered an error while generating the final research report for: "${query}". Here are the key points I found:\n\n${learnings.map(l => `- ${l}`).join('\n')}`;
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
   * Process a query with regular research (single search + analysis)
   */
  private async *doRegularResearch(query: string): AsyncGenerator<string> {
    // Step 1: Search the web
    this.reportProgress({ progress: 10, status: 'Searching the web...' });
    const { results, sources } = await this.searchWeb(query);
    
    // Stream the search results back to the client
    if (results.length > 0) {
      yield JSON.stringify({
        type: 'search_results',
        content: this.formatSearchResults(results)
      }) + '\n';
      
      // Stream the sources
      yield JSON.stringify({
        type: 'sources',
        sources
      }) + '\n';
    }
    
    // Step 2: Generate the research report
    this.reportProgress({ progress: 50, status: 'Analyzing search results and generating report...' });
    const formattedResults = this.formatSearchResults(results);
    const { content } = await this.generateResearchReport(query, formattedResults, sources);
    
    // Stream the final response
    this.reportProgress({ progress: 100, status: 'Complete' });
    yield JSON.stringify({
      type: 'content',
      content
    }) + '\n';
  }

  /**
   * Process a query with deep research (multi-step, recursive analysis)
   */
  private async *doDeepResearch(query: string, options: { depth: number; breadth: number }): AsyncGenerator<string> {
    const depth = Math.min(Math.max(1, options.depth), 5); // Limit depth between 1-5
    const breadth = Math.min(Math.max(2, options.breadth), 5); // Limit breadth between 2-5
    
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
      
      while (queriesToProcess.length > 0 && currentDepth <= depth) {
        // Get all queries at the current depth level
        const currentLevelQueries = queriesToProcess.filter(q => q.depth === currentDepth);
        queriesToProcess = queriesToProcess.filter(q => q.depth > currentDepth);
        
        // Update progress
        progressData.currentDepth = currentDepth;
        progressData.status = `Researching depth ${currentDepth}/${depth}`;
        this.reportProgress(progressData);
        
        // Process all queries at this depth level
        const nextLevelQueries: {query: string; depth: number}[] = [];
        
        for (let i = 0; i < currentLevelQueries.length; i++) {
          const { query: currentQuery } = currentLevelQueries[i];
          
          // Skip if already processed
          if (visitedQueries.has(currentQuery)) continue;
          visitedQueries.add(currentQuery);
          
          // Update progress for this query
          progressData.currentQuery = currentQuery;
          progressData.status = `Researching: "${currentQuery}" (depth ${currentDepth}/${depth})`;
          this.reportProgress(progressData);
          
          // Generate search queries for this topic
          const generatedQueries = await this.generateSerpQueries(
            currentQuery, 
            breadth, 
            allLearnings
          );
          
          // Update total queries count
          progressData.totalQueries += generatedQueries.length;
          
          // Process each generated query
          for (let j = 0; j < generatedQueries.length; j++) {
            const generatedQuery = generatedQueries[j];
            progressData.currentBreadth = j + 1;
            progressData.currentQuery = generatedQuery.query;
            progressData.status = `Researching: ${generatedQuery.query} (${j+1}/${generatedQueries.length})`;
            this.reportProgress(progressData);
            
            // Search the web
            const { results, sources } = await this.searchWeb(generatedQuery.query);
            
            // Add sources to the collection
            for (const source of sources) {
              if (!visitedUrls.has(source.url)) {
                visitedUrls.add(source.url);
                allSources.push(source);
                
                // Stream sources back to the client
                yield JSON.stringify({
                  type: 'sources',
                  sources: [source]
                }) + '\n';
              }
            }
            
            // Process the search results
            const { learnings, followUpQuestions } = await this.processSerpResult(
              generatedQuery.query, 
              results, 
              Math.max(2, Math.floor(5 / depth)), // Adjust learnings based on depth
              Math.max(1, Math.floor(3 / depth))  // Adjust follow-ups based on depth
            );
            
            // Add and stream learnings
            for (const learning of learnings) {
              allLearnings.push(learning);
              
              yield JSON.stringify({
                type: 'learning',
                content: learning
              }) + '\n';
            }
            
            // Queue follow-up questions for the next depth
            if (currentDepth < depth) {
              for (const followUp of followUpQuestions.slice(0, breadth)) {
                nextLevelQueries.push({
                  query: followUp.query,
                  depth: currentDepth + 1
                });
              }
            }
            
            // Update progress
            progressData.completedQueries++;
            progressData.progress = Math.round((progressData.completedQueries / Math.max(progressData.totalQueries, 1)) * 100);
            this.reportProgress(progressData);
          }
        }
        
        // Add the next level queries to our queue
        queriesToProcess = [...queriesToProcess, ...nextLevelQueries];
        
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
      
    } catch (error) {
      console.error('Deep research error:', error);
      yield JSON.stringify({
        type: 'error',
        content: 'An error occurred during deep research.'
      }) + '\n';
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
      console.error('Error in processQueryStream:', error);
      yield JSON.stringify({
        type: 'error',
        content: 'An error occurred during research. Please try again.'
      }) + '\n';
    }
  }
} 