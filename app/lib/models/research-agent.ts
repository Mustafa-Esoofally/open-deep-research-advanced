import { ChatPromptTemplate } from '@langchain/core/prompts';
import axios from 'axios';
import { openRouterAdapter, firecrawlApiKey, firecrawlBaseUrl, firecrawlRequestTimeout, defaultFirecrawlOptions, firecrawlHeaders } from '../clients';

// Types
export interface ResearchResult {
  research: string;
  analysis: string;
  sources: string[];
  confidence: number;
}

export class LangChainAgent {
  private progressCallback?: (progress: number, status: string) => void;

  constructor(config: { 
    progressCallback?: (progress: number, status: string) => void;
  } = {}) {
    // Store progress callback if provided
    this.progressCallback = config.progressCallback;
  }

  private reportProgress(progress: number, status: string) {
    console.log(`Progress: ${progress}%, Status: ${status}`);
    if (this.progressCallback) {
      this.progressCallback(progress, status);
    }
  }

  // An enhanced search function using Firecrawl's API with better error handling and result formatting
  private async searchWeb(query: string): Promise<{ results: string; success: boolean; sources: string[] }> {
    const maxRetries = 2;
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        this.reportProgress(20, 'Searching the web with Firecrawl...');
        console.log(`Starting Firecrawl search for: "${query}" (attempt ${retries + 1}/${maxRetries + 1})`);
        
        // Construct the search endpoint from the base URL
        const endpoint = `${firecrawlBaseUrl}/search`;
        console.log(`Using Firecrawl endpoint: ${endpoint}`);
        
        // Format request according to Firecrawl V1 API using our standardized options
        const requestPayload = {
          query,
          ...defaultFirecrawlOptions,
          timeout: Math.floor(firecrawlRequestTimeout * 0.75) // 75% of the total timeout
        };

        console.log('Search request payload:', JSON.stringify(requestPayload, null, 2));
        
        const response = await axios.post(endpoint, 
          requestPayload,
          {
            headers: firecrawlHeaders,
            timeout: firecrawlRequestTimeout
          }
        );

        console.log('Firecrawl response status:', response.status);
        
        // Enhanced validation of response data structure
        if (
          response.data && 
          response.data.data && 
          Array.isArray(response.data.data) && 
          response.data.data.length > 0
        ) {
          this.reportProgress(40, `Found ${response.data.data.length} search results`);

          // Extract sources (URLs) from the results
          const sources = response.data.data
            .map((result: any) => result.url || '')
            .filter(Boolean);
          
          // Add favicon URLs to search results for better visualization
          const resultsWithFavicons = response.data.data.map((result: any) => {
            if (!result.url) return result;
            try {
              const url = new URL(result.url);
              result.favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
            } catch (e) {
              // Ignore favicon errors
            }
            return result;
          });
          
          // Format the search results with better structure
          const results = resultsWithFavicons.map((result: any, index: number) => {
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

          return { 
            results: results || 'No relevant results found.', 
            success: true, 
            sources 
          };
        } else {
          // Handle empty results with detailed logging
          console.warn('Firecrawl returned empty results or unexpected response format');
          console.log('Response data:', JSON.stringify(response.data, null, 2));
          
          if (retries < maxRetries) {
            retries++;
            console.log(`Retrying search (${retries}/${maxRetries})...`);
            // Wait before retrying with increasing delay
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            continue;
          }
          
          return { 
            results: 'The web search did not yield any relevant results for this query.', 
            success: false,
            sources: []
          };
        }
      } catch (error: any) {
        console.error('Firecrawl search error:', error);
        
        // Check if the error might be related to an API version mismatch
        const errorMessage = error.message || '';
        const errorResponse = error.response?.data || '';
        const isEndpointNotFoundError = 
          (error.response?.status === 404) || 
          errorMessage.includes('404') || 
          (typeof errorResponse === 'string' && errorResponse.includes('Cannot POST'));
          
        if (isEndpointNotFoundError) {
          console.error('Endpoint not found error detected. This may indicate an API version mismatch.');
          console.log('Current API base URL:', firecrawlBaseUrl);
          console.log('Trying alternative API path...');
          
          // Try an alternative path if we're getting endpoint not found errors
          try {
            const alternativeEndpoint = firecrawlBaseUrl.includes('/v1') 
              ? firecrawlBaseUrl.replace('/v1', '') + '/search'  // Try without version
              : firecrawlBaseUrl + '/v1/search';                 // Try with v1 version
              
            console.log(`Attempting alternative endpoint: ${alternativeEndpoint}`);
            
            // Reuse the same request payload structure defined above
            const alternativePayload = {
              query,
              ...defaultFirecrawlOptions,
              timeout: Math.floor(firecrawlRequestTimeout * 0.75)
            };
            
            const altResponse = await axios.post(alternativeEndpoint, 
              alternativePayload,
              {
                headers: firecrawlHeaders,
                timeout: firecrawlRequestTimeout
              }
            );
            
            if (altResponse.status === 200) {
              console.log('Alternative endpoint successful!');
              console.log('Please update the FIRECRAWL_BASE_URL in your environment variables to:', 
                alternativeEndpoint.replace('/search', ''));
                
              // Process the successful response
              if (
                altResponse.data && 
                altResponse.data.data && 
                Array.isArray(altResponse.data.data) && 
                altResponse.data.data.length > 0
              ) {
                // Extract sources (URLs) from the results
                const sources = altResponse.data.data
                  .map((result: any) => result.url || '')
                  .filter(Boolean);
                
                // Format the search results
                const results = altResponse.data.data.map((result: any, index: number) => {
                  const content = result.markdown || result.description || 'No content available';
                  const title = result.title || result.metadata?.title || 'Untitled';
                  const url = result.url || result.metadata?.sourceURL || '#';
                  
                  return `
## ${index + 1}. ${title}
**Source:** [${url}](${url})
${content}
                  `;
                }).join('\n\n');

                return { 
                  results: results || 'No relevant results found.', 
                  success: true, 
                  sources 
                };
              }
            }
          } catch (altError: unknown) {
            console.error('Alternative endpoint also failed:', (altError as Error).message || 'Unknown error');
          }
        }
        
        // Continue with normal error handling
        if (error.response) {
          const status = error.response.status;
          console.error(`Error status: ${status} - ${this.getStatusCodeMessage(status)}`);
          console.error('Error data:', error.response.data);
          
          // Special handling for specific status codes
          if (status === 429) {
            console.warn('Rate limit exceeded. Waiting longer before retry...');
            // Wait longer for rate limit errors
            await new Promise(resolve => setTimeout(resolve, 3000 * (retries + 1)));
          } else if (status === 401 || status === 403) {
            console.error('Authentication error. Check your API key.');
            // Less likely to be resolved by retry, but we'll try once more with a delay
            if (retries < 1) {
              retries++;
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            // If this is our second retry, it's likely a real auth issue
            return { 
              results: `## API Authentication Error
              
Unfortunately, there was an issue authenticating with the web search service. This might be due to an invalid API key or expired credentials.

The query was: ${query}

This report will be based on AI knowledge rather than real-time web search results.`,
              success: false,
              sources: []
            };
          } else if (status >= 500) {
            console.warn('Server error. It may be temporary.');
          }
        } else if (error.request) {
          console.error('No response received from server:', error.request);
          console.warn('This could indicate a network issue or service unavailability');
        } else if (error.code === 'ECONNABORTED') {
          console.error('Request timed out. The service might be experiencing heavy load.');
        }
        
        if (retries < maxRetries) {
          retries++;
          console.log(`Retrying search after error (${retries}/${maxRetries})...`);
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          continue;
        }
        
        // FALLBACK message after all retries failed
        return { 
          results: `## Web Search Unavailable
Unfortunately, I couldn't perform a live web search at this time. I'll provide information based on my knowledge.

The query was: ${query}

This is based on my existing knowledge rather than real-time web search results.`,
          success: false,
          sources: []
        };
      }
    }
    
    // This should never be reached due to the return statements above, but TypeScript requires it
    return {
      results: 'Failed to perform web search after multiple attempts.',
      success: false,
      sources: []
    };
  }
  
  // Helper method to get descriptive message for HTTP status codes
  private getStatusCodeMessage(status: number): string {
    const statusMessages: Record<number, string> = {
      400: 'Bad Request - The request was malformed or contains invalid parameters',
      401: 'Unauthorized - API key is missing or invalid',
      403: 'Forbidden - The API key doesn\'t have permission to perform the request',
      404: 'Not Found - The requested resource was not found (check API endpoint URL)',
      429: 'Too Many Requests - Rate limit exceeded, try again later',
      500: 'Internal Server Error - Something went wrong on the server',
      502: 'Bad Gateway - The server received an invalid response from upstream',
      503: 'Service Unavailable - The server is currently unable to handle the request',
      504: 'Gateway Timeout - The upstream server failed to respond in time'
    };
    
    return statusMessages[status] || `Unknown status code ${status}`;
  }

  // Process the query with OpenRouter LLM
  private async processWithLLM(query: string, searchResults: string, webSearchSucceeded: boolean): Promise<string> {
    this.reportProgress(60, 'Analyzing with OpenRouter...');

    // Different prompt templates based on whether web search succeeded
    let systemPrompt = '';
    if (webSearchSucceeded) {
      systemPrompt = `
You are a professional research assistant tasked with analyzing web search results and creating a comprehensive research report.

QUERY:
{query}

SEARCH RESULTS:
{searchResults}

Your task is to:
1. Analyze and synthesize the search results
2. Create a well-structured research report
3. Include relevant citations for facts and claims
4. Evaluate the reliability of information
5. Maintain academic rigor and objectivity

Format your response in clear, well-structured markdown with the following sections:
- Introduction: Brief overview of the topic
- Main Findings: Detailed information organized by subtopics
- Analysis: Your interpretation and synthesis of the information
- Conclusion: Summary of key points
- Sources: List of sources used with URLs

Always cite your sources throughout the text using [Source: URL] format.`;
    } else {
      systemPrompt = `
You are a professional research assistant tasked with creating a comprehensive research report.

QUERY:
{query}

NOTE: Live web search is currently unavailable. Please use your knowledge to create a report.

Your task is to:
1. Create a well-structured research report based on your knowledge
2. Provide the most up-to-date information you have on the topic
3. Be transparent about limitations in your knowledge
4. Maintain academic rigor and objectivity

Format your response in clear, well-structured markdown with the following sections:
- Introduction: Brief overview of the topic
- Main Findings: Detailed information organized by subtopics
- Analysis: Your interpretation and synthesis of the information
- Conclusion: Summary of key points
- Limitations: A note that this report is based on your knowledge rather than real-time research

Begin by clearly stating that this report is based on your knowledge as of your last update, not on real-time web search.`;
    }

    const prompt = ChatPromptTemplate.fromTemplate(systemPrompt);

    try {
      const response = await prompt.pipe(openRouterAdapter).invoke({
        query,
        searchResults
      });

      this.reportProgress(80, 'Research report generated successfully');
      return response.content as string;
    } catch (error) {
      console.error('OpenRouter processing error:', error);
      throw error;
    }
  }

  async processQuery(query: string): Promise<ResearchResult> {
    try {
      this.reportProgress(10, 'Initializing research process');
      
      // First, search the web
      const { results: searchResults, success: webSearchSucceeded, sources } = await this.searchWeb(query);
      
      // Then, process the results
      const response = await this.processWithLLM(query, searchResults, webSearchSucceeded);
      
      // Extract additional sources from the response
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const llmSources = Array.from(new Set(response.match(urlRegex) || [])) as string[];
      
      // Combine sources from search and from LLM
      const allSources = Array.from(new Set([...sources, ...llmSources]));
      
      this.reportProgress(90, 'Organizing research sections');
      
      // Split into research and analysis (assuming the last section is analysis)
      const sections = response.split(/\n##\s+/);
      let research = '';
      let analysis = '';
      
      if (sections.length > 1) {
        // Find the Analysis section
        const analysisIndex = sections.findIndex(section => 
          section.toLowerCase().startsWith('analysis') || 
          section.toLowerCase().includes('analysis:')
        );
        
        if (analysisIndex !== -1) {
          analysis = sections[analysisIndex];
          // Remove the Analysis section from the array
          sections.splice(analysisIndex, 1);
          // Join the remaining sections as research
          research = sections.join('\n## ');
        } else {
          // If no Analysis section found, use the last section as analysis
          analysis = sections.pop() || '';
          research = sections.join('\n## ');
        }
      } else {
        research = response;
      }
      
      this.reportProgress(100, 'Research complete');
      
      return {
        research,
        analysis,
        sources: allSources,
        confidence: webSearchSucceeded ? 0.85 : 0.65 // Lower confidence for non-web-search results
      };
    } catch (error) {
      console.error('Research error:', error);
      throw error;
    }
  }
  
  // Stream the query processing results
  async *processQueryStream(query: string): AsyncGenerator<string> {
    try {
      // Initial progress update
      yield JSON.stringify({
        type: 'progress',
        progress: 10,
        status: 'Searching the web...'
      }) + '\n';
      
      // First, search the web
      const { results: searchResults, success: webSearchSucceeded, sources } = await this.searchWeb(query);
      
      // Immediately emit the formatted search results for display
      if (webSearchSucceeded) {
        // Stream the search results data in a format the UI can render
        yield JSON.stringify({
          type: 'search_results',
          content: searchResults,
          status: 'Found search results'
        }) + '\n';
      }
      
      // Emit sources with richer metadata when available
      if (sources.length > 0) {
        try {
          // Try to extract rich metadata from the search results
          const enrichedSources = sources.map((url, index) => {
            // Try to extract domain
            let domain = 'unknown';
            let title = `Source ${index + 1}`;
            
            try {
              const urlObj = new URL(url);
              domain = urlObj.hostname.replace('www.', '');
              // Generate favicon URL for each source
              const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
              
              return {
                url,
                title,
                domain,
                favicon,
                relevance: 0.9 - (index * 0.05) // Decreasing relevance score
              };
            } catch (e) {
              // Fallback for invalid URLs
              return {
                url,
                title,
                domain,
                relevance: 0.5
              };
            }
          });
          
          yield JSON.stringify({
            type: 'sources',
            sources: enrichedSources
          }) + '\n';
        } catch (error) {
          // Fallback to simple sources list if enrichment fails
          yield JSON.stringify({
            type: 'sources',
            sources: sources.map(url => ({ url }))
          }) + '\n';
        }
      }
      
      // Progress update
      yield JSON.stringify({
        type: 'progress',
        progress: 50,
        status: webSearchSucceeded ? 'Processing search results...' : 'Using AI knowledge instead of web search...'
      }) + '\n';
      
      // Then, process the results with the LLM
      const response = await this.processWithLLM(query, searchResults, webSearchSucceeded);
      
      // Extract additional sources from the response
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const llmSources = Array.from(new Set(response.match(urlRegex) || [])) as string[];
      
      // Combine all sources 
      const allSources = Array.from(new Set([...sources, ...llmSources]));
      
      // Emit updated sources if we have new ones
      if (allSources.length > sources.length) {
        try {
          // Process additional sources found by the LLM
          const enrichedSources = allSources.map((url, index) => {
            // Try to extract domain
            let domain = 'unknown';
            let title = `Source ${index + 1}`;
            
            try {
              const urlObj = new URL(url);
              domain = urlObj.hostname.replace('www.', '');
              // Generate favicon URL for each source
              const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
              
              return {
                url,
                title,
                domain,
                favicon,
                relevance: 0.85 - (index * 0.05) // Decreasing relevance score
              };
            } catch (e) {
              // Fallback for invalid URLs
              return {
                url,
                title,
                domain,
                relevance: 0.5
              };
            }
          });
          
          yield JSON.stringify({
            type: 'sources',
            sources: enrichedSources
          }) + '\n';
        } catch (error) {
          // Fallback to simple sources list if enrichment fails
          yield JSON.stringify({
            type: 'sources',
            sources: allSources.map(url => ({ url }))
          }) + '\n';
        }
      }
      
      // Progress update
      yield JSON.stringify({
        type: 'progress',
        progress: 75,
        status: 'Organizing research findings...'
      }) + '\n';
      
      // Format the content with proper sections
      const formattedContent = this.formatResearchOutput(response, allSources, webSearchSucceeded);
      
      // Send the content
      yield JSON.stringify({
        type: 'content',
        content: formattedContent
      }) + '\n';
      
      // Final progress update
      yield JSON.stringify({
        type: 'progress',
        progress: 100,
        status: 'Research complete'
      }) + '\n';
      
    } catch (error) {
      console.error('Streaming error:', error);
      yield JSON.stringify({
        type: 'content',
        content: 'An error occurred while processing your request. Please try again with a more specific query.'
      }) + '\n';
    }
  }
  
  // Helper method to format research output
  private formatResearchOutput(content: string, sources: string[], webSearchSucceeded: boolean): string {
    // If web search failed, add a note at the beginning
    let formattedContent = '';
    
    if (!webSearchSucceeded && !content.includes('web search is currently unavailable')) {
      formattedContent = '> **Note:** This report was generated without real-time web search due to technical limitations. The information provided is based on the AI\'s knowledge.\n\n';
    }
    
    // If content already has good structure, use it but add our note
    if (content.includes('# ') || content.includes('## ')) {
      formattedContent += content;
    } else {
      // Add basic structure if missing
      formattedContent += '# Research Findings\n\n';
      formattedContent += content;
    }
    
    // Add sources section if not already included and if there are sources
    if (sources.length > 0 && 
        !content.toLowerCase().includes('# sources') && 
        !content.toLowerCase().includes('## sources')) {
      formattedContent += '\n\n## Sources\n\n';
      
      // Remove any duplicate sources and sort them
      const uniqueSources = Array.from(new Set(sources)).sort();
      
      // Format each source as a link
      uniqueSources.forEach((source, index) => {
        // Clean up the URL (remove trailing punctuation that might have been captured by regex)
        const cleanUrl = source.replace(/[.,;:)]+$/, '');
        formattedContent += `${index + 1}. [${cleanUrl}](${cleanUrl})\n`;
      });
    }
    
    // Add confidence level based on web search success
    const confidenceLevel = webSearchSucceeded ? 'High (Based on real-time web data)' : 'Moderate (Based on AI knowledge)';
    if (!formattedContent.includes('Confidence level')) {
      formattedContent += `\n\n> **Confidence level:** ${confidenceLevel}\n`;
    }
    
    return formattedContent;
  }
} 