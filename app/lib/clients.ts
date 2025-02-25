import { ChatOpenAI } from '@langchain/openai';

// Load environment variables with fallbacks
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'fc-878bb268d04f45ea9a4fa5fcfbb51fb4';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/o3-mini-high';
const OPENROUTER_TEMPERATURE = parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7');
const OPENROUTER_MAX_TOKENS = parseInt(process.env.OPENROUTER_MAX_TOKENS || '4000');
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const APP_NAME = process.env.APP_NAME || 'Advanced Deep Research';

// Firecrawl configuration
const FIRECRAWL_BASE_URL = process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1';
const FIRECRAWL_REQUEST_TIMEOUT = parseInt(process.env.FIRECRAWL_REQUEST_TIMEOUT || '60000'); // 60 seconds

// Log configuration for debugging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('API Client Configuration:');
  console.log('- OpenRouter API Key:', OPENROUTER_API_KEY ? '[Set]' : '[Not set]');
  console.log('- Firecrawl API Key:', FIRECRAWL_API_KEY ? '[Set]' : '[Not set]');
  console.log('- OpenRouter Model:', OPENROUTER_MODEL);
  console.log('- Firecrawl Base URL:', FIRECRAWL_BASE_URL);
  console.log('- Firecrawl Timeout:', FIRECRAWL_REQUEST_TIMEOUT, 'ms');
}

// Initialize OpenRouter client
export const openRouterClient = new ChatOpenAI({
  modelName: 'anthropic/claude-3-opus-20240229',
  openAIApiKey: OPENROUTER_API_KEY,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
  },
  temperature: 0.5,
  streaming: true,
  maxTokens: OPENROUTER_MAX_TOKENS,
});

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