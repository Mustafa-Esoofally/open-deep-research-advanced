/**
 * Environment variables utility
 * This ensures environment variables are properly loaded and validated at runtime
 */

// Critical environment variables that must be set
const REQUIRED_ENV_VARS = ['NEXT_SERVER_OPENROUTER_API_KEY', 'NEXT_SERVER_FIRECRAWL_API_KEY'];

// Runtime environment cache validation
// This helps detect if we need to reload environment variables
const ENVIRONMENT_CACHE_KEY = 'env_cache_last_updated';
let lastLoadTime = Date.now();

// Environment variable validation
export function validateEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check for required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar] || process.env[envVar]?.trim() === '') {
      missing.push(envVar);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

// Get API key with proper fallback and validation
function getApiKey(key: string, fallback: string = ''): string {
  // Check for server prefix first, then regular name
  const serverKey = `NEXT_SERVER_${key}`;
  const value = process.env[serverKey] || process.env[key] || fallback;
  
  if (!value && process.env.NODE_ENV === 'development') {
    console.warn(`⚠️ Warning: ${key} is not set. Using fallback.`);
  }
  
  return value;
}

// Load and return environment variables with fallbacks
export function getEnv(forceRefresh: boolean = false) {
  // Note: We can't actually force a reload of process.env in Next.js
  // But this pattern allows us to detect if we're trying to use outdated values
  
  // Update last load time if forced refresh
  if (forceRefresh) {
    lastLoadTime = Date.now();
    console.log('Environment variables refresh requested at', new Date(lastLoadTime).toISOString());
  }
  
  return {
    // API keys - use server prefixed versions first
    OPENROUTER_API_KEY: getApiKey('OPENROUTER_API_KEY'),
    FIRECRAWL_API_KEY: getApiKey('FIRECRAWL_API_KEY'),
    
    // Other configuration
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openai/o3-mini',
    OPENROUTER_TEMPERATURE: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
    OPENROUTER_MAX_TOKENS: parseInt(process.env.OPENROUTER_MAX_TOKENS || '4000'),
    APP_URL: process.env.APP_URL || 'http://localhost:3000',
    APP_NAME: process.env.APP_NAME || 'Advanced Deep Research',
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Add last loaded timestamp for cache validation
    _lastLoaded: lastLoadTime
  };
}

// Verify environment is properly configured
const envStatus = validateEnv();
if (!envStatus.valid) {
  console.error(`⚠️ Missing required environment variables: ${envStatus.missing.join(', ')}`);
  console.error(`Check that you've created .env.local in the project root with these variables.`);
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${envStatus.missing.join(', ')}`);
  }
}

// Get a fresh copy of environment variables
export function refreshEnv() {
  return getEnv(true);
}

// Export environment variables
export const env = getEnv(); 