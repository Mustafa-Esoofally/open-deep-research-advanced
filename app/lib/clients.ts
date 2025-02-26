import { ChatOpenAI } from '@langchain/openai';
import axios from 'axios';
import { set } from 'zod';
import { env } from './env';

// Use environment variables from our validated env utility
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const FIRECRAWL_API_KEY = env.FIRECRAWL_API_KEY;
const OPENROUTER_MODEL = env.OPENROUTER_MODEL;
const OPENROUTER_TEMPERATURE = env.OPENROUTER_TEMPERATURE;
const OPENROUTER_MAX_TOKENS = env.OPENROUTER_MAX_TOKENS;
const APP_URL = env.APP_URL;
const APP_NAME = env.APP_NAME;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Validate critical configuration
if (!env.IS_BUILD_TIME && (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === '')) {
  console.error('⚠️ ERROR: OpenRouter API key is not set in environment variables.');
  console.error('Please set NEXT_SERVER_OPENROUTER_API_KEY in your .env.local file in the project root.');
  // In development, we'll show a warning but allow the app to start
  // In production, this would be a critical error
  if (env.IS_PROD) {
    throw new Error('OpenRouter API key is not set');
  }
}

// Firecrawl configuration
const FIRECRAWL_BASE_URL = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1';
const FIRECRAWL_REQUEST_TIMEOUT = parseInt(process.env.FIRECRAWL_REQUEST_TIMEOUT || '60000'); // 60 seconds

// Log configuration for debugging (only in development)
if (env.IS_DEV) {
  console.log('API Client Configuration:');
  console.log('- OpenRouter API Key:', OPENROUTER_API_KEY ? `[Set] (first 5 chars: ${OPENROUTER_API_KEY.substring(0, 5)}...)` : '[Not set]');
  console.log('- Firecrawl API Key:', FIRECRAWL_API_KEY ? '[set]' : '[Not set]');
  console.log('- OpenRouter Model:', OPENROUTER_MODEL);
  console.log('- Firecrawl Base URL:', FIRECRAWL_BASE_URL);
  console.log('- Firecrawl Timeout:', FIRECRAWL_REQUEST_TIMEOUT, 'ms');
}

// Create a custom OpenRouter client class
class CustomOpenRouterClient {
  private apiKey: string;
  
  constructor() {
    this.apiKey = OPENROUTER_API_KEY;
  }

  async chat(messages: Array<{ role: string; content: string }>, options: { model?: string } = {}) {
    try {
      // Get the model from options or environment 
      let model = options.model || OPENROUTER_MODEL;
      
      // Initialize providerRouting as undefined
      let providerRouting: any = undefined;
      
      // Configure provider routing for specific models
      if (model === 'deepseek/deepseek-r1-distill-llama-70b' || model === 'deepseek-distill-70b') {
        providerRouting = {
          order: ['Groq'],
          allow_fallbacks: false
        };
        // Only log this in development mode
        if (env.IS_DEV) {
          console.log(`Routing DeepSeek model to Groq provider`);
        }
      }
      
      // If the model looks like a model key (not a full ID with provider prefix),
      // try to get the full ID from the registry
      if (model && !model.includes('/')) {
        try {
          // Dynamically import to avoid circular dependencies
          const { modelRegistry } = await import('./models/providers');
          const fullModelId = modelRegistry.getModelId(model);
          if (fullModelId) {
            model = fullModelId;
            
            // Get the model config for additional info (only needed for specific debug scenarios)
            const modelConfig = modelRegistry.getModelConfig(model);
            if (modelConfig && modelConfig.provider && env.IS_DEV) {
              console.log(`Using: ${modelConfig.name} (${modelConfig.provider})`);
            }
          }
        } catch (error) {
          // Only log the essential error information
          console.warn('Failed to convert model key to ID');
        }
      }
      
      // Only log in development mode
      if (env.IS_DEV) {
        console.log('Calling OpenRouter with model:', model);
      }
      
      // Verify API key is available before making the request
      if (!this.apiKey) {
        console.error('ERROR: No OpenRouter API key found. Please set NEXT_SERVER_OPENROUTER_API_KEY in your environment variables.');
        throw new Error('OpenRouter API key is missing');
      }
      
      // Log key status only in development mode
      if (env.IS_DEV) {
        console.log('OpenRouter API Key status:', 'API key is set');
      }
      
      // New improved response format in OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://advanced-deep-research.vercel.app/',
          'X-Title': 'Advanced Deep Research',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          provider_routing: providerRouting,
          route: 'fallback', // Use fallback route for reduced latency
        }),
      });
      
      // Check if the response is unauthorized (401)
      if (response.status === 401) {
        const errorData = await response.text();
        console.error('OpenRouter API error: Authentication failed');
        
        // Include just enough debugging information to diagnose the issue
        if (env.IS_DEV) {
          console.log(`API key length: ${this.apiKey?.length || 0}`);
          console.log(`API key first 5 chars: ${this.apiKey?.substring(0, 5) || 'N/A'}`);
        }
        
        throw new Error('Authentication failed with OpenRouter API. Please check your API key.');
      }
      
      // Handle other errors
      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenRouter API error:', response.status, errorData);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
      }
      
      // Parse the response
      const data = await response.json();
      
      // Validate the response format
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('Invalid response format from OpenRouter');
        throw new Error('Invalid response format from OpenRouter');
      }
      
      const firstChoice = data.choices[0];
      if (!firstChoice.message || !firstChoice.message.content) {
        console.error('Missing message content in OpenRouter response');
        throw new Error('Missing message content in OpenRouter response');
      }
      
      return firstChoice.message.content;
    } catch (error) {
      // Log the error but don't include the full error object
      console.error('OpenRouter processing error:', error instanceof Error ? error.message : 'Unknown error');
      throw error; // Re-throw to allow callers to handle it
    }
  }

  /**
   * Stream a chat completion response from OpenRouter
   * @param messages Array of chat messages
   * @param options Options including model selection
   * @returns An async generator that yields content chunks
   */
  async *streamChat(messages: Array<{ role: string; content: string }>, options: { model?: string } = {}): AsyncGenerator<string> {
    try {
      // Get the model from options or environment 
      let model = options.model || OPENROUTER_MODEL;
      
      // Initialize providerRouting as undefined
      let providerRouting: any = undefined;
      
      // Configure provider routing for specific models
      if (model === 'deepseek/deepseek-r1-distill-llama-70b' || model === 'deepseek-distill-70b') {
        providerRouting = {
          order: ['Groq'],
          allow_fallbacks: false
        };
        // Only log this in development mode
        if (env.IS_DEV) {
          console.log(`Routing DeepSeek model to Groq provider for streaming`);
        }
      }
      
      // If the model looks like a model key (not a full ID with provider prefix),
      // try to get the full ID from the registry
      if (model && !model.includes('/')) {
        try {
          // Dynamically import to avoid circular dependencies
          const { modelRegistry } = await import('./models/providers');
          const fullModelId = modelRegistry.getModelId(model);
          if (fullModelId) {
            model = fullModelId;
          }
        } catch (error) {
          console.warn('Failed to convert model key to ID for streaming');
        }
      }
      
      // Verify API key is available before making the request
      if (!this.apiKey) {
        console.error('ERROR: No OpenRouter API key found for streaming');
        throw new Error('OpenRouter API key is missing');
      }
      
      // Make the streaming request to OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://advanced-deep-research.vercel.app/',
          'X-Title': 'Advanced Deep Research',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          provider_routing: providerRouting,
          route: 'fallback',
          stream: true, // Enable streaming
        }),
      });
      
      // Handle API errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter streaming error: ${response.status}`, errorText);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }
      
      // Process the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      
      if (!reader) {
        throw new Error('Failed to get reader from response');
      }
      
      // Accumulate partial chunks if necessary
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process each line (SSE format)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          // Skip empty lines and keep-alive messages
          if (!line.trim() || line === ':' || line === 'data: [DONE]') continue;
          
          try {
            // Extract the data part from SSE format
            const dataMatch = line.match(/^data: (.*)$/);
            if (!dataMatch) continue;
            
            const data = JSON.parse(dataMatch[1]);
            
            // Skip incomplete or empty chunks
            if (!data.choices || !data.choices[0] || !data.choices[0].delta) continue;
            
            // Extract content delta
            const contentDelta = data.choices[0].delta.content;
            if (contentDelta) {
              yield contentDelta;
            }
          } catch (error) {
            console.error('Error parsing streaming response chunk:', error);
            // Continue to next line
          }
        }
      }
    } catch (error) {
      console.error('OpenRouter streaming error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}

// Export a single instance of the client
export const openRouterClient = new CustomOpenRouterClient();

// Create an adapter that's compatible with the LangChain pipe() method
export const openRouterAdapter = {
  model: OPENROUTER_MODEL,
  
  // Set the model to use
  setModel(modelId: string) {
    this.model = modelId;
    return this;
  },
  
  // This method processes the inputs and returns a result
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

      const content = await openRouterClient.chat(messages, { model: openRouterAdapter.model });
      return { content };
    } catch (error) {
      console.error('OpenRouter adapter error:', error);
      throw error;
    }
  },
  
  // Create a chainable pipe
  pipe() {
    return this;
  },

  // These properties and methods are needed to implement the LangChain RunnableLike interface
  lc_serializable: true,
  lc_namespace: ["custom", "adapters"],
  
  withConfig() {
    return this;
  },
  
  withRetry() {
    return this;
  },
  
  batch() {
    return [this];
  },
  
  stream() {
    return {
      async *invoke(messages: Array<{ role: string; content: string }>) {
        for await (const chunk of openRouterClient.streamChat(messages, { model: openRouterAdapter.model })) {
          yield chunk;
        }
      }
    };
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