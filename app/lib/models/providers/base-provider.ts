// Base provider interface for all model providers
export interface ModelProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  modelId: string;
  headers?: Record<string, string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<any>; // Support for multimodal content
}

export interface ModelResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: any; // Raw response for debugging
}

// Base provider abstract class
export abstract class BaseModelProvider {
  protected options: ModelProviderOptions;

  constructor(options: ModelProviderOptions) {
    this.options = {
      temperature: 0.7,
      maxTokens: 4000,
      ...options,
    };
  }

  // Main method to be implemented by all providers
  abstract chat(messages: ChatMessage[]): Promise<ModelResponse>;

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