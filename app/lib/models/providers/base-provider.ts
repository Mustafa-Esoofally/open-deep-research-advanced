// Base provider interface for all model providers
export interface ModelProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  modelId: string;
  headers?: Record<string, string>;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  [key: string]: any;
}

export interface ChatMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

export interface ModelResponse {
  content: string;
  metadata?: {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    raw?: any;
  };
}

// Callback for streaming responses
export type StreamChunkCallback = (chunk: string) => string | void;

// Base provider abstract class
export abstract class BaseModelProvider {
  protected options: ModelProviderOptions;

  constructor(options: ModelProviderOptions) {
    this.options = {
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      ...options,
    };
  }

  // Main method to be implemented by all providers
  abstract chat(messages: ChatMessage[]): Promise<ModelResponse>;

  // Streaming chat completion (to be implemented by subclasses)
  async streamChat(
    messages: ChatMessage[],
    callback: StreamChunkCallback
  ): Promise<ModelResponse> {
    // Default implementation that falls back to regular chat
    console.warn('streamChat not implemented in this provider, falling back to regular chat');
    const response = await this.chat(messages);
    
    // Process the entire response as one chunk through the callback
    if (callback) {
      callback(response.content);
    }
    
    return response;
  }

  // Helper for wrapping in LangChain compatible format
  createLangChainAdapter() {
    return {
      invoke: async ({ query, searchResults }: { query: string; searchResults: string }) => {
        const messages = [
          {
            role: 'system' as const,
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

        const response = await this.chat(messages);
        return { content: response.content };
      },
      pipe: function () {
        return this;
      }
    };
  }
} 