import { openRouterClient, firecrawlApiKey, firecrawlBaseUrl, firecrawlRequestTimeout, firecrawlHeaders, defaultFirecrawlOptions } from '../clients';
import axios from 'axios';

// Types
export interface DeepResearchProgress {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
  status?: string;
  progress?: number;
}

export interface DeepResearchResult {
  learnings: string[];
  visitedUrls: string[];
  finalReport: string;
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

export class DeepResearchAgent {
  private progressCallback?: (progress: DeepResearchProgress) => void;
  private abortController: AbortController;

  constructor(config: { 
    progressCallback?: (progress: DeepResearchProgress) => void;
  } = {}) {
    this.progressCallback = config.progressCallback;
    this.abortController = new AbortController();
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
  private reportProgress(progressUpdate: Partial<DeepResearchProgress>) {
    if (this.progressCallback) {
      this.progressCallback(progressUpdate as DeepResearchProgress);
    }
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

      // Call the OpenRouter API
      const result = await openRouterClient.chat(messages);
      
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
        console.log('Original response:', result);
        
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
  ): Promise<{learnings: string[]; followUpQuestions: string[]}> {
    try {
      // Extract and format content from search results
      const contents = results
        .map(item => item.markdown || item.description || '')
        .filter(Boolean)
        .map(content => this.trimPrompt(content, 25000));

      console.log(`Processing results for "${query}", found ${contents.length} contents`);

      if (contents.length === 0) {
        return { learnings: [], followUpQuestions: [] };
      }

      const systemMessage = {
        role: 'system',
        content: DEFAULT_SYSTEM_PROMPT
      };

      const userPrompt = `Given the following contents from a search for the query "${query}", generate a list of learnings and follow-up questions.

CONTENTS:
${contents.map(content => `===\n${content}\n===`).join('\n\n')}

Extract the most important and relevant information. The learnings should be concise, detailed, and information-dense, including specific entities, metrics, numbers, or dates when present.

Return your response as a valid JSON object with this structure:
{
  "learnings": [
    "First detailed learning point",
    "Second detailed learning point",
    ...
  ],
  "followUpQuestions": [
    "First follow-up question to explore",
    "Second follow-up question to explore",
    ...
  ]
}`;

      const messages = [
        systemMessage,
        { role: 'user', content: userPrompt }
      ];

      // Call the OpenRouter API
      const result = await openRouterClient.chat(messages);
      
      // Parse the result to extract the learnings and questions
      try {
        // Find JSON object in the response (it might be wrapped in markdown code blocks)
        const jsonMatch = result.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || 
                        result.match(/{[\s\S]*"learnings"[\s\S]*}/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : result;
        const parsed = JSON.parse(jsonStr);
        
        if (parsed) {
          const learnings = Array.isArray(parsed.learnings) ? parsed.learnings.slice(0, numLearnings) : [];
          const followUpQuestions = Array.isArray(parsed.followUpQuestions) 
            ? parsed.followUpQuestions.slice(0, numFollowUpQuestions) 
            : [];
            
          console.log(`Extracted ${learnings.length} learnings and ${followUpQuestions.length} follow-up questions`);
          
          return {
            learnings,
            followUpQuestions
          };
        } else {
          throw new Error('Invalid response format');
        }
      } catch (parseError) {
        console.error('Error parsing SERP processing response:', parseError);
        console.log('Original response:', result);
        return { learnings: [], followUpQuestions: [] };
      }
    } catch (error) {
      console.error('Error processing SERP results:', error);
      return { learnings: [], followUpQuestions: [] };
    }
  }

  /**
   * Generate the final research report
   */
  private async generateFinalReport(query: string, learnings: string[], visitedUrls: string[]): Promise<string> {
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

The report should be:
1. Structured with clear headings and sections
2. Comprehensive, drawing from all relevant learnings
3. Well-organized with a logical flow
4. Include citations whenever possible
5. Format your response in Markdown

Include at minimum these sections:
- Introduction: Brief overview of the topic
- Main Findings: Detailed information organized by subtopics
- Analysis: Your interpretation and synthesis of the information
- Conclusion: Summary of key points`;

      const messages = [
        systemMessage,
        { role: 'user', content: userPrompt }
      ];

      // Call the OpenRouter API
      const result = await openRouterClient.chat(messages);
      
      // Append the visited URLs section to the report
      const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
      
      return result + urlsSection;
    } catch (error) {
      console.error('Error generating final report:', error);
      
      // Create a fallback report if generation fails
      return `# Research Report: ${query}\n\n## Summary\n\nThere was an error generating the complete research report.\n\n## Raw Findings\n\n${learnings.map(l => `- ${l}`).join('\n')}\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
    }
  }

  /**
   * Perform a web search using Firecrawl
   */
  private async searchWeb(query: string): Promise<{ results: any[]; urls: string[] }> {
    try {
      console.log(`Searching web for: "${query}"`);
      
      // Construct the search endpoint from the base URL
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
        
        // Extract URLs from results
        const urls = results
          .map((result: any) => result.url || '')
          .filter(Boolean);
        
        return { results, urls };
      } else {
        console.warn('Firecrawl returned empty or invalid results');
        return { results: [], urls: [] };
      }
    } catch (error) {
      console.error('Error searching web:', error);
      return { results: [], urls: [] };
    }
  }

  /**
   * Trim prompt to maximum context size
   */
  private trimPrompt(prompt: string, maxLength = 25000): string {
    if (!prompt) return '';
    if (prompt.length <= maxLength) return prompt;
    
    // Simple truncation - in a full implementation, we would use token-based truncation
    return prompt.slice(0, maxLength);
  }

  /**
   * Main deep research implementation with breadth and depth parameters
   */
  private async deepResearch(
    query: string,
    breadth: number,
    depth: number,
    learnings: string[] = [],
    visitedUrls: string[] = []
  ): Promise<{learnings: string[]; visitedUrls: string[]}> {
    // Initialize progress tracking
    const progress: DeepResearchProgress = {
      currentDepth: depth,
      totalDepth: depth,
      currentBreadth: breadth,
      totalBreadth: breadth,
      totalQueries: 0,
      completedQueries: 0,
      progress: Math.floor(((depth - depth) / depth) * 100)
    };
    
    // Generate SERP queries based on the user query and any previous learnings
    const serpQueries = await this.generateSerpQueries(query, breadth, learnings);
    
    // Update progress with the total number of queries
    progress.totalQueries = serpQueries.length;
    this.reportProgress(progress);
    
    // Process each query sequentially (could be parallelized with a concurrency limit)
    for (let i = 0; i < serpQueries.length; i++) {
      const serpQuery = serpQueries[i];
      
      // Update current query in progress
      progress.currentQuery = serpQuery.query;
      progress.progress = Math.floor((i / serpQueries.length) * 100);
      this.reportProgress(progress);
      
      try {
        // Perform web search
        const { results, urls } = await this.searchWeb(serpQuery.query);
        
        // Process the search results to extract learnings and follow-up questions
        const newBreadth = Math.ceil(breadth / 2);
        const newDepth = depth - 1;
        
        const { learnings: newLearnings, followUpQuestions } = await this.processSerpResult(
          serpQuery.query,
          results,
          newBreadth, // Number of learnings equals to the new breadth
          newBreadth  // Number of follow-up questions equals to the new breadth
        );
        
        // Combine learnings and visited URLs
        const allLearnings = [...learnings, ...newLearnings];
        const allUrls = [...visitedUrls, ...urls];
        
        // Update completed queries count
        progress.completedQueries = i + 1;
        this.reportProgress(progress);
        
        // If we still have depth, continue research with follow-up questions
        if (newDepth > 0 && followUpQuestions.length > 0) {
          console.log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`);
          
          // Update progress for the next depth level
          progress.currentDepth = newDepth;
          progress.currentBreadth = newBreadth;
          this.reportProgress(progress);
          
          // Construct the next query using research goal and follow-up questions
          const nextQuery = `
          Previous research goal: ${serpQuery.researchGoal}
          Follow-up research directions: ${followUpQuestions.map(q => `\n- ${q}`).join('')}
          `.trim();
          
          // Recursively continue the research
          const deeperResult = await this.deepResearch(
            nextQuery,
            newBreadth,
            newDepth,
            allLearnings,
            allUrls
          );
          
          // Return the combined results from deeper research
          return deeperResult;
        } else {
          // We've reached maximum depth, return current results
          return { learnings: allLearnings, visitedUrls: allUrls };
        }
      } catch (error) {
        if (this.abortController.signal.aborted) {
          throw new Error('Research aborted');
        }
        
        console.error(`Error processing query "${serpQuery.query}":`, error);
        // Continue with the next query even if this one failed
      }
    }
    
    // Return current results even if some queries failed
    return { learnings, visitedUrls };
  }

  /**
   * Public method to start the deep research process
   */
  public async runDeepResearch(query: string, options: {
    breadth?: number;
    depth?: number;
  } = {}): Promise<DeepResearchResult> {
    const breadth = options.breadth || 4;
    const depth = options.depth || 2;
    
    try {
      // Initialize the new AbortController for this research session
      this.abortController = new AbortController();
      
      // Start with initial progress report
      this.reportProgress({
        currentDepth: depth,
        totalDepth: depth,
        currentBreadth: breadth,
        totalBreadth: breadth,
        totalQueries: 0,
        completedQueries: 0,
        progress: 0,
        status: 'Initializing research process'
      });
      
      // Perform the deep research
      this.reportProgress({ status: 'Generating research queries' });
      const { learnings, visitedUrls } = await this.deepResearch(query, breadth, depth);
      
      // Generate the final report
      this.reportProgress({ 
        progress: 90, 
        status: 'Generating final research report' 
      });
      
      const finalReport = await this.generateFinalReport(query, learnings, visitedUrls);
      
      // Research complete
      this.reportProgress({ 
        progress: 100, 
        status: 'Research complete' 
      });
      
      return {
        learnings,
        visitedUrls,
        finalReport
      };
    } catch (error) {
      console.error('Deep research error:', error);
      
      if (this.abortController.signal.aborted) {
        throw new Error('Research was aborted');
      }
      
      throw error;
    }
  }

  /**
   * Stream the deep research results
   */
  public async *runDeepResearchStream(query: string, options: {
    breadth?: number;
    depth?: number;
  } = {}): AsyncGenerator<string> {
    try {
      // Set up progress stream handling
      const encoder = new TextEncoder();
      
      // Set up a progress callback to stream progress updates
      this.progressCallback = (progress) => {
        const progressUpdate = JSON.stringify({
          type: 'progress',
          progress: progress.progress || 0,
          status: progress.status || `Researching depth ${progress.currentDepth}/${progress.totalDepth}`,
          details: {
            depth: {
              current: progress.currentDepth,
              total: progress.totalDepth
            },
            breadth: {
              current: progress.currentBreadth,
              total: progress.totalBreadth
            },
            queries: {
              current: progress.completedQueries,
              total: progress.totalQueries,
              currentQuery: progress.currentQuery
            }
          }
        });
        
        return progressUpdate;
      };
      
      // Run the deep research and stream the results
      const result = await this.runDeepResearch(query, options);
      
      // Stream the sources
      yield JSON.stringify({
        type: 'sources',
        sources: result.visitedUrls.map(url => ({
          title: url.split('/').pop() || url,
          url,
          domain: new URL(url).hostname.replace('www.', ''),
          relevance: 0.9
        }))
      }) + '\n';
      
      // Stream each learning as it comes in
      for (const learning of result.learnings) {
        yield JSON.stringify({
          type: 'learning',
          content: learning
        }) + '\n';
      }
      
      // Stream the final report
      yield JSON.stringify({
        type: 'content',
        content: result.finalReport
      }) + '\n';
      
    } catch (error) {
      console.error('Deep research stream error:', error);
      
      // Stream the error
      yield JSON.stringify({
        type: 'error',
        content: 'An error occurred during deep research. Please try again.'
      }) + '\n';
    }
  }
} 