'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './select';
import { Label } from './label';
import { MODEL_CONFIGS } from '@/app/lib/models/providers/model-registry';

export type ModelSelectorProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  showDescription?: boolean;
  label?: string;
};

export function ModelSelector({
  value,
  onValueChange,
  className = '',
  disabled = false,
  showDescription = true,
  label = 'Model'
}: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<string>(value || 'deepseek-r1');
  
  // Get ordered models
  const models = Object.entries(MODEL_CONFIGS).map(([modelKey, config]) => ({
    modelKey,
    ...config
  }));
  
  // Sort models by provider and name
  const sortedModels = models.sort((a, b) => {
    if (a.provider === b.provider) {
      return a.name.localeCompare(b.name);
    }
    return a.provider.localeCompare(b.provider);
  });
  
  // Group models by provider
  const modelsByProvider: Record<string, typeof models> = {};
  models.forEach(model => {
    if (!modelsByProvider[model.provider]) {
      modelsByProvider[model.provider] = [];
    }
    modelsByProvider[model.provider].push(model);
  });
  
  // Sort providers
  const sortedProviders = Object.keys(modelsByProvider).sort();

  // Update internal state when value prop changes
  useEffect(() => {
    if (value && value !== selectedModel) {
      setSelectedModel(value);
    }
  }, [value]);

  // Handle model change
  const handleModelChange = (modelKey: string) => {
    setSelectedModel(modelKey);
    if (onValueChange) {
      onValueChange(modelKey);
    }
  };

  return (
    <div className={`${className} space-y-2`}>
      {label && <Label>{label}</Label>}
      <Select
        value={selectedModel}
        onValueChange={handleModelChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {sortedProviders.map(provider => (
            <SelectGroup key={provider}>
              <SelectLabel className="capitalize">{provider}</SelectLabel>
              {modelsByProvider[provider].map(model => (
                <SelectItem 
                  key={model.modelKey} 
                  value={model.modelKey}
                  title={showDescription ? model.description : undefined}
                >
                  {model.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {showDescription && selectedModel && (
        <p className="text-xs text-muted-foreground">
          {MODEL_CONFIGS[selectedModel]?.description}
        </p>
      )}
    </div>
  );
} 