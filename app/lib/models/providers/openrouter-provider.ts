import { BaseModelProvider, ChatMessage, ModelProviderOptions, ModelResponse } from './base-provider';
import { env, refreshEnv } from '../../env';

// OpenRouter model IDs
export enum OpenRouterModels {
  O1 = 'openai/o1',
  O1_MINI = 'openai/o1-mini',
  DEEPSEEK_R1 = 'deepseek/deepseek-r1',
  SONAR_REASONING = 'perplexity/sonar-reasoning',
  AION_1_0 = 'aion-labs/aion-1.0',
  CLAUDE_SONNET_3_7 = 'anthropic/claude-3.5-sonnet',
}

// Extended options for OpenRouter
export interface OpenRouterOptions extends ModelProviderOptions {
  appName?: string;
  appUrl?: string;
}

export class OpenRouterProvider extends BaseModelProvider {
  private lastKeyRefresh: number;
  private apiKey: string;
  private baseUrl: string;
  private appName: string;
  private appUrl: string;

  constructor(options: OpenRouterOptions) {
    super(options);
    
    // Initialize with values from options or environment
    const runtimeEnv = refreshEnv();
    this.lastKeyRefresh = Date.now();
    this.apiKey = options.apiKey || runtimeEnv.OPENROUTER_API_KEY;
    this.baseUrl = options.baseUrl || 'https://openrouter.ai/api/v1';
    this.appName = options.appName || runtimeEnv.APP_NAME || 'Advanced Deep Research';
    this.appUrl = options.appUrl || runtimeEnv.APP_URL || 'http://localhost:3000';
    
    // Validate critical configuration
    if (!this.apiKey || this.apiKey.trim() === '') {
      console.error('⚠️ ERROR: OpenRouter API key is not set.');
      throw new Error('OpenRouter API key is not set');
    }
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

  async chat(messages: ChatMessage[]): Promise<ModelResponse> {
    try {
      // Always use the latest API key
      const currentApiKey = this.refreshApiKey();
      
      console.log('Calling OpenRouter with model:', this.options.modelId);
      
      // Verify API key is available before making the request
      if (!currentApiKey || currentApiKey.trim() === '') {
        console.error('ERROR: No OpenRouter API key found.');
        throw new Error('OpenRouter API key is not set');
      }
      
      // Add request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout
      
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`,
            'HTTP-Referer': this.appUrl,
            'X-Title': this.appName,
            ...this.options.headers,
          },
          body: JSON.stringify({
            model: this.options.modelId,
            messages: messages,
            temperature: this.options.temperature,
            max_tokens: this.options.maxTokens,
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
          throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        }
  
        const data = await response.json();
        
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
        
        // Extract usage information if available
        const usage = data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined;

        return {
          content: firstChoice.message.content,
          usage,
          raw: data
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('OpenRouter processing error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenRouter request timed out after 120 seconds');
      }
      throw error;
    }
  }
}

// Factory function to create providers for specific models
export function createModelProvider(model: OpenRouterModels, options: Partial<OpenRouterOptions> = {}): OpenRouterProvider {
  return new OpenRouterProvider({
    modelId: model,
    ...options
  });
} 