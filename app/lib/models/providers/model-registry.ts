import { BaseModelProvider } from './base-provider';
import { OpenRouterModels, OpenRouterProvider, createModelProvider } from './openrouter-provider';

// Type for model configuration
export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  provider: string;
  contextLength: number;
  capabilities: string[];
  defaultTemperature: number;
  defaultMaxTokens: number;
}

// Available models with their configurations
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'o1': {
    id: OpenRouterModels.O1,
    name: 'OpenAI o1',
    description: 'OpenAI\'s most powerful model for advanced reasoning.',
    provider: 'openai',
    contextLength: 200000,
    capabilities: ['reasoning', 'coding', 'math', 'science'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  },
  'o1-mini': {
    id: OpenRouterModels.O1_MINI,
    name: 'OpenAI o1-mini',
    description: 'A smaller, faster, and more affordable variant of OpenAI o1.',
    provider: 'openai',
    contextLength: 128000,
    capabilities: ['reasoning', 'coding'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  },
  'deepseek-r1': {
    id: OpenRouterModels.DEEPSEEK_R1,
    name: 'DeepSeek R1',
    description: 'Open-source model with strong reasoning capabilities.',
    provider: 'deepseek',
    contextLength: 128000,
    capabilities: ['reasoning', 'math', 'coding'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  },
  'sonar-reasoning': {
    id: OpenRouterModels.SONAR_REASONING,
    name: 'Perplexity Sonar Reasoning',
    description: 'Reasoning model by Perplexity based on DeepSeek R1.',
    provider: 'perplexity',
    contextLength: 127000,
    capabilities: ['reasoning', 'research'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  },
  'aion-1.0': {
    id: OpenRouterModels.AION_1_0,
    name: 'Aion 1.0',
    description: 'Multi-model system built on DeepSeek-R1 with augmented capabilities.',
    provider: 'aion-labs',
    contextLength: 32768,
    capabilities: ['reasoning', 'coding'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  },
  'claude-sonnet-3.7': {
    id: OpenRouterModels.CLAUDE_SONNET_3_7,
    name: 'Claude 3.5 Sonnet',
    description: 'Advanced model from Anthropic with strong reasoning and coding skills.',
    provider: 'anthropic',
    contextLength: 200000,
    capabilities: ['reasoning', 'coding', 'data science'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  }
};

// Model Registry to manage all model providers
export class ModelRegistry {
  private static instance: ModelRegistry;
  private providers: Map<string, BaseModelProvider> = new Map();
  
  private constructor() {
    // Singleton instance
  }
  
  // Get the singleton instance
  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }
  
  // Get all available model configs
  public getAvailableModels(): ModelConfig[] {
    return Object.values(MODEL_CONFIGS);
  }
  
  // Get a specific model config
  public getModelConfig(modelKey: string): ModelConfig | undefined {
    return MODEL_CONFIGS[modelKey];
  }
  
  // Get or create a provider for a specific model
  public getProvider(modelKey: string, options: any = {}): BaseModelProvider {
    // Check if we already have this provider instance
    const providerKey = `${modelKey}-${JSON.stringify(options)}`;
    
    if (this.providers.has(providerKey)) {
      return this.providers.get(providerKey)!;
    }
    
    // Get the model configuration
    const modelConfig = this.getModelConfig(modelKey);
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelKey}`);
    }
    
    // Create a new provider based on the model configuration
    let provider: BaseModelProvider;
    
    // Currently all models use OpenRouter, but we can extend this for other provider types
    provider = createModelProvider(modelConfig.id as OpenRouterModels, {
      temperature: options.temperature || modelConfig.defaultTemperature,
      maxTokens: options.maxTokens || modelConfig.defaultMaxTokens,
      ...options
    });
    
    // Store the provider for reuse
    this.providers.set(providerKey, provider);
    
    return provider;
  }
  
  // Clear all providers (useful for testing or when changing API keys)
  public clearProviders(): void {
    this.providers.clear();
  }
} 