import { ChatOpenAI } from '@langchain/openai';
import axios from 'axios';
import { set } from 'zod';
import { env, refreshEnv } from './env';

// Get a fresh copy of environment variables
const runtimeEnv = refreshEnv();

// Use environment variables from our validated env utility
const OPENROUTER_API_KEY = runtimeEnv.OPENROUTER_API_KEY;
const FIRECRAWL_API_KEY = runtimeEnv.FIRECRAWL_API_KEY;
const OPENROUTER_MODEL = runtimeEnv.OPENROUTER_MODEL;
const OPENROUTER_TEMPERATURE = runtimeEnv.OPENROUTER_TEMPERATURE;
const OPENROUTER_MAX_TOKENS = runtimeEnv.OPENROUTER_MAX_TOKENS;
const APP_URL = runtimeEnv.APP_URL;
const APP_NAME = runtimeEnv.APP_NAME;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Validate critical configuration
if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === '') {
  console.error('⚠️ ERROR: OpenRouter API key is not set in environment variables.');
  console.error('Please set NEXT_SERVER_OPENROUTER_API_KEY in your .env.local file in the project root.');
  // In development, we'll show a warning but allow the app to start
  // In production, this would be a critical error
  if (runtimeEnv.NODE_ENV === 'production') {
    throw new Error('OpenRouter API key is not set');
  }
}

// Firecrawl configuration
const FIRECRAWL_BASE_URL = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1';
const FIRECRAWL_REQUEST_TIMEOUT = parseInt(process.env.FIRECRAWL_REQUEST_TIMEOUT || '60000'); // 60 seconds

// Log configuration for debugging (only in development)
if (runtimeEnv.NODE_ENV === 'development') {
  console.log('API Client Configuration (loaded at', new Date(runtimeEnv._lastLoaded).toISOString(), '):');
  console.log('- OpenRouter API Key:', OPENROUTER_API_KEY ? `[Set] (first 5 chars: ${OPENROUTER_API_KEY.substring(0, 5)}...)` : '[Not set]');
  console.log('- Firecrawl API Key:', FIRECRAWL_API_KEY ? '[set]' : '[Not set]');
  console.log('- OpenRouter Model:', OPENROUTER_MODEL);
  console.log('- Firecrawl Base URL:', FIRECRAWL_BASE_URL);
  console.log('- Firecrawl Timeout:', FIRECRAWL_REQUEST_TIMEOUT, 'ms');
}

// Create a custom OpenRouter client class
class CustomOpenRouterClient {
  private lastKeyRefresh: number;
  private apiKey: string;
  
  constructor() {
    this.lastKeyRefresh = Date.now();
    this.apiKey = OPENROUTER_API_KEY;
  }
  
  // Function to refresh API keys if needed
  private refreshApiKey() {
    // Check if it's been more than 5 minutes since last refresh
    const now = Date.now();
    if (now - this.lastKeyRefresh > 5 * 60 * 1000) {
      const freshEnv = refreshEnv();
      this.apiKey = freshEnv.OPENROUTER_API_KEY;
      this.lastKeyRefresh = now;
      console.log('API key refreshed at', new Date(now).toISOString());
    }
    return this.apiKey;
  }

  async chat(messages: Array<{ role: string; content: string }>) {
    try {
      // Always use the latest API key
      const currentApiKey = this.refreshApiKey();
      
      console.log('Calling OpenRouter with model:', OPENROUTER_MODEL);
      
      // Verify API key is available before making the request
      if (!currentApiKey || currentApiKey.trim() === '') {
        console.error('ERROR: No OpenRouter API key found. Please set NEXT_SERVER_OPENROUTER_API_KEY in your environment variables.');
        throw new Error('OpenRouter API key is not set');
      }
      
      // Debug log (first few characters only for security)
      console.log('OpenRouter API Key status:', 'API key is set (first 5 chars: ' + currentApiKey.substring(0, 5) + '...)');

      // Add request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`,
            'HTTP-Referer': APP_URL,
            'X-Title': APP_NAME
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: messages,
            temperature: OPENROUTER_TEMPERATURE,
            max_tokens: OPENROUTER_MAX_TOKENS
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
  
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = errorText;
          }
          
          console.error('OpenRouter API error:', response.status, errorData);
          
          // Handle special case: if authentication fails, try refreshing the API key
          if (response.status === 401) {
            console.log('Authentication failed. Trying to refresh API key...');
            const freshEnv = refreshEnv();
            this.apiKey = freshEnv.OPENROUTER_API_KEY;
            console.error(`OpenRouter authentication failed. Please check your API key.`);
            
            // Log the actual API key length for debugging (no sensitive content)
            console.log(`API key length: ${this.apiKey?.length || 0}`);
            console.log(`API key first 5 chars: ${this.apiKey?.substring(0, 5) || 'N/A'}`);
            
            // If in development, provide a helpful error message
            if (runtimeEnv.NODE_ENV === 'development') {
              console.error(`
==========================================================
🔑 API KEY ERROR TROUBLESHOOTING:
1. Ensure NEXT_SERVER_OPENROUTER_API_KEY is set in .env.local
2. Restart the development server completely
3. Check that your OpenRouter account is active
4. Verify the API key hasn't expired
==========================================================
              `);
            }
          }
          
          throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        }
  
        const data = await response.json();
        console.log('OpenRouter response received:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
        
        // Safely access the response data with proper error handling
        if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          console.error('Invalid response format from OpenRouter:', JSON.stringify(data, null, 2));
          throw new Error('OpenRouter returned an empty or invalid response');
        }
        
        // Ensure the first choice and its message exists
        const firstChoice = data.choices[0];
        if (!firstChoice || !firstChoice.message || !firstChoice.message.content) {
          console.error('Missing message content in OpenRouter response:', JSON.stringify(firstChoice, null, 2));
          throw new Error('OpenRouter response is missing message content');
        }
        
        return firstChoice.message.content;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('OpenRouter processing error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenRouter request timed out after 60 seconds');
      }
      throw error;
    }
  }
}

// Export a single instance of the client
export const openRouterClient = new CustomOpenRouterClient();

// Create an adapter that's compatible with the LangChain pipe() method
export const openRouterAdapter = {
  invoke: async ({ query, searchResults }: { query: string; searchResults: string }) => {
    try {
      // Format the prompt similar to what the LangChain version would do
      const messages = [
        {
          role: 'system',
          content: `You are a professional research assistant tasked with analyzing web search results and creating a comprehensive research report.

QUERY:
${query}

SEARCH RESULTS:
${searchResults}

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

Always cite your sources throughout the text using [Source: URL] format.`
        }
      ];

      const content = await openRouterClient.chat(messages);
      return { content };
    } catch (error) {
      console.error('OpenRouter adapter error:', error);
      throw error;
    }
  },
  pipe: function () {
    return this;
  }
};

// Export Firecrawl configuration
export const firecrawlApiKey = FIRECRAWL_API_KEY;
export const firecrawlBaseUrl = FIRECRAWL_BASE_URL;
export const firecrawlRequestTimeout = FIRECRAWL_REQUEST_TIMEOUT;

// Validate Firecrawl configuration
if (!firecrawlApiKey || firecrawlApiKey.trim() === '') {
  console.warn('⚠️ Warning: Firecrawl API key is not set. Web search functionality will not work properly.');
}

// Endpoints reference according to latest docs: https://docs.firecrawl.dev/api-reference/endpoint/search
// - Search: POST https://api.firecrawl.dev/v1/search
// - Scrape: POST https://api.firecrawl.dev/v1/scrape 
// - Map: POST https://api.firecrawl.dev/v1/map
// - Extract: POST https://api.firecrawl.dev/v1/extract 

// Export reusable Firecrawl request headers
export const firecrawlHeaders = {
  'Authorization': `Bearer ${firecrawlApiKey}`,
  'Content-Type': 'application/json'
};

// Export common Firecrawl options
export const defaultFirecrawlOptions = {
  limit: 10,
  country: 'us',
  lang: 'en',
  scrapeOptions: {
    formats: ['markdown', 'links'],
    onlyMainContent: true
  }
};

// Generate a unique user ID for this session (useful for tracking requests)
export const sessionId = Math.random().toString(36).substring(2, 15);