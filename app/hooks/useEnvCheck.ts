'use client';

import { useState, useEffect } from 'react';

type EnvStatus = {
  valid: boolean;
  missingVariables: string[];
  config: {
    nodeEnv: string;
    appName: string;
  };
  loading: boolean;
  error: string | null;
  isDevelopment: boolean;
  helpMessage?: string;
};

/**
 * Hook to safely check environment variables without exposing sensitive info
 * Uses the /api/env endpoint to verify environment configuration
 */
export function useEnvCheck() {
  const [status, setStatus] = useState<EnvStatus>({
    valid: false,
    missingVariables: [],
    config: {
      nodeEnv: 'unknown',
      appName: 'Unknown App',
    },
    loading: true,
    error: null,
    isDevelopment: false
  });

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const checkEnv = async () => {
        try {
          const response = await fetch('/api/env');
          const data = await response.json();
          const isDevelopment = data.config?.nodeEnv === 'development';
          
          if (!response.ok) {
            // Even if it's not OK but we're in development, we show a warning but allow usage
            if (isDevelopment) {
              setStatus({
                valid: false,
                missingVariables: data.missingVariables || [],
                config: data.config || { nodeEnv: 'development', appName: 'Unknown App' },
                loading: false,
                error: 'Missing required environment variables (Development Mode)',
                isDevelopment: true,
                helpMessage: data.development?.helpMessage
              });
            } else {
              setStatus({
                valid: false,
                missingVariables: data.missingVariables || [],
                config: data.config || { nodeEnv: 'unknown', appName: 'Unknown App' },
                loading: false,
                error: 'Missing required environment variables',
                isDevelopment: false
              });
            }
            return;
          }
          
          setStatus({
            valid: data.valid,
            missingVariables: data.missingVariables || [],
            config: data.config || { nodeEnv: 'unknown', appName: 'Unknown App' },
            loading: false,
            error: null,
            isDevelopment,
            helpMessage: data.development?.helpMessage
          });
        } catch (err) {
          console.error('Error checking environment:', err);
          setStatus(prev => ({
            ...prev,
            valid: false,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to check environment',
            isDevelopment: false
          }));
        }
      };
      
      checkEnv();
    }
  }, []);

  return status;
} 