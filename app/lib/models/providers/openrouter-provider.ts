import { BaseModelProvider, ChatMessage, ModelProviderOptions, ModelResponse } from './base-provider';
import { env, refreshEnv } from '../../env';

// Extended options for OpenRouter
export interface OpenRouterOptions extends ModelProviderOptions {
  appName?: string;
  appUrl?: string;
  providerRouting?: {
    order?: string[];
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    data_collection?: 'allow' | 'deny';
    ignore?: string[];
    quantizations?: string[];
    sort?: 'price' | 'throughput' | 'latency';
  };
}

export class OpenRouterProvider extends BaseModelProvider {
  private lastKeyRefresh: number;
  private apiKey: string;
  private baseUrl: string;
  private appName: string;
  private appUrl: string;
  private providerRouting?: OpenRouterOptions['providerRouting'];
  
  constructor(options: OpenRouterOptions) {
    super(options);
    this.lastKeyRefresh = Date.now();
    
    // Get environment variables or use defaults
    this.apiKey = options.apiKey || env.OPENROUTER_API_KEY;
    this.baseUrl = options.baseUrl || env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.appName = options.appName || env.APP_NAME || 'Advanced Research App';
    this.appUrl = options.appUrl || env.APP_URL || 'https://example.com';
    this.providerRouting = options.providerRouting;
    
    if (!this.apiKey) {
      console.warn('WARNING: OpenRouter API key not found. Set NEXT_SERVER_OPENROUTER_API_KEY in your .env.local file.');
    }
  }
  
  private refreshApiKey() {
    // Check if it's been more than 5 minutes since last refresh
    const now = Date.now();
    if (now - this.lastKeyRefresh > 5 * 60 * 1000) {
      const freshEnv = refreshEnv();
      this.apiKey = freshEnv.OPENROUTER_API_KEY;
      this.lastKeyRefresh = now;
    }
    return this.apiKey;
  }
  
  async chat(messages: ChatMessage[]): Promise<ModelResponse> {
    try {
      // Always use the latest API key
      const currentApiKey = this.refreshApiKey();
      
      if (!currentApiKey || currentApiKey.trim() === '') {
        console.error('ERROR: No OpenRouter API key found.');
        throw new Error('OpenRouter API key is not set');
      }
      
      // Add request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`,
            'HTTP-Referer': this.appUrl,
            'X-Title': this.appName
          },
          body: JSON.stringify({
            model: this.options.modelId,
            messages: messages.map(m => ({
              role: m.role,
              content: m.content
            })),
            temperature: this.options.temperature || 0.7,
            max_tokens: this.options.maxTokens || 1000,
            provider: this.providerRouting,
            ...this.options
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenRouter API error:', response.status, errorText);
          
          // Handle special case: if authentication fails, try refreshing the API key
          if (response.status === 401) {
            console.log('Authentication failed. Forcing refresh of API key...');
            const freshEnv = refreshEnv();
            this.apiKey = freshEnv.OPENROUTER_API_KEY;
          }
          
          throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        }
  
        const data = await response.json();
        
        // Extract response from model
        if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          throw new Error('Invalid response from OpenRouter');
        }
        
        const choice = data.choices[0];
        
        if (!choice || !choice.message || !choice.message.content) {
          throw new Error('Missing content in OpenRouter response');
        }
        
        return {
          content: choice.message.content,
          metadata: {
            model: data.model || this.options.modelId,
            usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            raw: data
          }
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error in OpenRouter provider:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenRouter request timed out after 60 seconds');
      }
      throw error;
    }
  }
}

// Factory function to create providers for specific models
export function createModelProvider(modelId: string, options: Partial<OpenRouterOptions> = {}): OpenRouterProvider {
  // Set up Groq as the preferred provider for DeepSeek R1 Distill model
  let providerRouting = options.providerRouting;
  
  if (modelId === 'deepseek/deepseek-r1-distill-llama-70b') {
    providerRouting = {
      order: ['Groq'],
      allow_fallbacks: false,
      ...providerRouting  // Preserve any user-specified routing options
    };
  }
  
  return new OpenRouterProvider({
    modelId,
    providerRouting,
    ...options
  });
} 