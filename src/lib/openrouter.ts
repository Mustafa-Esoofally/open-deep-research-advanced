import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText } from 'ai';

// OpenRouter configuration
export const openRouterConfig = {
  defaultModel: 'openai/o3-mini',
};

// Function to generate text using OpenRouter
export async function generateOpenRouterResponse(
  prompt: string,
  model = openRouterConfig.defaultModel
) {
  try {
    const { text } = await generateText({
      model: openrouter(model),
      prompt,
    });
    return text;
  } catch (error) {
    console.error('Error generating text with OpenRouter:', error);
    throw error;
  }
}

// Function to stream text using OpenRouter
export async function streamOpenRouterResponse(
  prompt: string,
  onChunk: (chunk: string) => void,
  model = openRouterConfig.defaultModel
) {
  try {
    const stream = await streamText({
      model: openrouter(model),
      prompt,
    });

    for await (const chunk of stream) {
      onChunk(chunk);
    }
  } catch (error) {
    console.error('Error streaming text with OpenRouter:', error);
    throw error;
  }
}
