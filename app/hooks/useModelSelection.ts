'use client';

import { useState, useEffect } from 'react';
import { modelRegistry } from '@/app/lib/models/providers';
import { env } from '@/app/lib/env';

// Key for storing the selected model in localStorage
const MODEL_STORAGE_KEY = 'selected_model';

/**
 * Hook for managing model selection
 * Returns the selected model key, function to change the model,
 * and whether the selection is currently loading.
 */
export function useModelSelection() {
  // Default model from environment or fallback to deepseek-r1
  const defaultModel = env.DEFAULT_MODEL_KEY || 'deepseek-r1';
  
  // State for tracking selected model and loading state
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [isLoading, setIsLoading] = useState(true);

  // On initial load, get the saved model from localStorage
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      try {
        const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
        if (savedModel && modelRegistry.getModelConfig(savedModel)) {
          setSelectedModel(savedModel);
        }
      } catch (e) {
        console.error('Failed to load model from localStorage:', e);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // When model changes, save to localStorage
  const updateModel = (modelKey: string) => {
    if (!modelRegistry.getModelConfig(modelKey)) {
      console.error(`Invalid model key: ${modelKey}`);
      return;
    }
    
    setSelectedModel(modelKey);
    
    // Save to localStorage
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, modelKey);
    } catch (e) {
      console.error('Failed to save model to localStorage:', e);
    }
  };

  // Get the full model ID (including provider prefix) from the registry
  const getFullModelId = () => {
    const modelConfig = modelRegistry.getModelConfig(selectedModel);
    return modelConfig?.id || selectedModel;
  };

  return {
    selectedModel,
    updateModel,
    isLoading,
    modelId: getFullModelId() // Return the full model ID
  };
} 