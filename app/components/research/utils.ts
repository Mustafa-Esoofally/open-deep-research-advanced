import { MODEL_CONFIGS, ModelConfig } from '@/app/lib/models/providers/model-registry';

// Format time for chat messages
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// Extract domain from URL
export const extractDomain = (url: string): string => {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch (error) {
    return url;
  }
};

// Get model display name from model key
export const getModelDisplayName = (modelKey: string): string => {
  if (!modelKey) return 'Unknown Model';

  // If model key exists directly in MODEL_CONFIGS
  if (MODEL_CONFIGS[modelKey]) {
    return MODEL_CONFIGS[modelKey].name;
  }
  
  // Fallback to formatting the key if model not found in registry
  return modelKey
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

// Debug logging helper
export const debugLog = (message: string, data?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
}; 