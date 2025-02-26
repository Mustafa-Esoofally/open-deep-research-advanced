/**
 * Environment variables utility
 * This provides a simplified interface for accessing environment variables with validation
 */

// Critical environment variables that must be set for the application to work
const REQUIRED_SERVER_ENV_VARS = [
  'NEXT_SERVER_OPENROUTER_API_KEY',
  'NEXT_SERVER_FIRECRAWL_API_KEY'
];

// Available model options for validation
const AVAILABLE_MODELS = [
  'deepseek/deepseek-r1:free',
  'groq/deepseek-r1-distill-llama-70b',
  'perplexity/sonar-reasoning',
  'anthropic/claude-3.7-sonnet',
  'google/gemini-2.0-flash-001',
  // Legacy options for backward compatibility
  'openai/o1',
  'openai/o1-mini', 
  'openai/o3-mini',
  'anthropic/claude-3-opus',
  'anthropic/claude-3-sonnet'
];

/**
 * Multiple checks to detect if we're in a build environment
 * This is crucial to prevent environment validation errors during build
 */
export const isBuildTime = () => {
  // Common Next.js build environments
  const isNextBuild = process.env.NEXT_PHASE === 'phase-production-build';
  const isVercelBuild = process.env.VERCEL === '1' && !process.env.VERCEL_ENV;
  const isCIBuild = process.env.CI === 'true' || process.env.CI === '1';
  
  // Build vs runtime context
  if (typeof process !== 'undefined' && 
      typeof window === 'undefined' && 
      process.env.NODE_ENV === 'production') {
    if (isNextBuild || isVercelBuild || isCIBuild) {
      console.log('🔨 Build-time environment detected');
      return true;
    }
  }
  
  return false;
};

// Initialize the build time detection early
const IS_BUILD_TIME = isBuildTime();

/**
 * Validates if all required environment variables are set
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  // Skip validation during build time
  if (IS_BUILD_TIME) {
    return { valid: true, missing: [] };
  }

  const missing: string[] = [];

  // Check for required environment variables
  for (const envVar of REQUIRED_SERVER_ENV_VARS) {
    if (!process.env[envVar] || process.env[envVar]?.trim() === '') {
      missing.push(envVar);
    }
  }

  // In development mode, provide helpful information
  if (process.env.NODE_ENV === 'development' && missing.length > 0) {
    console.error(`\n⚠️ Missing environment variables: ${missing.join(', ')}`);
    console.error(`Add them to your .env.local file in this format:\n`);
    for (const missingVar of missing) {
      console.error(`${missingVar}=your-value-here`);
    }
    console.error(`\nThen restart your development server.\n`);
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Gets an API key with proper fallback and validation
 */
function getApiKey(key: string, fallback: string = ''): string {
  // During build time, always return a placeholder to prevent build failures
  if (IS_BUILD_TIME) {
    return 'build-time-placeholder';
  }
  
  // Check for server prefix first, then regular name
  const serverKey = `NEXT_SERVER_${key}`;
  const value = process.env[serverKey] || process.env[key] || fallback;
  
  // Only warn in development mode
  if (!value && process.env.NODE_ENV === 'development') {
    console.warn(`⚠️ Warning: ${key} is not set. Using fallback.`);
  }
  
  return value;
}

/**
 * Environment object with typed access to environment variables and default values
 */
export const env = {
  // API keys
  OPENROUTER_API_KEY: getApiKey('OPENROUTER_API_KEY'),
  FIRECRAWL_API_KEY: getApiKey('FIRECRAWL_API_KEY'),
  
  // Other configuration
  OPENROUTER_MODEL: (() => {
    const model = process.env.OPENROUTER_MODEL || 'openai/o3-mini';
    return AVAILABLE_MODELS.includes(model) ? model : 'openai/o3-mini';
  })(),
  OPENROUTER_TEMPERATURE: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
  OPENROUTER_MAX_TOKENS: parseInt(process.env.OPENROUTER_MAX_TOKENS || '4000'),
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  DEFAULT_MODEL_KEY: process.env.DEFAULT_MODEL_KEY || 'deepseek-distill-70b',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  APP_NAME: process.env.APP_NAME || 'Advanced Deep Research',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Environment status
  IS_DEV: process.env.NODE_ENV === 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
  IS_BUILD_TIME: IS_BUILD_TIME,
  
  // Check if we're missing any required variables (for conditional logic)
  IS_VALID: () => validateEnv().valid
};

// For logging only - we never throw errors during initialization
if (IS_BUILD_TIME) {
  console.log('🔨 Running in build mode - environment validation skipped');
} else {
  const envStatus = validateEnv();
  if (!envStatus.valid) {
    console.error(`⚠️ Missing required environment variables: ${envStatus.missing.join(', ')}`);
    
    // Only throw in production runtime, never during build
    if (process.env.NODE_ENV === 'production' && !IS_BUILD_TIME) {
      throw new Error(`Missing required environment variables: ${envStatus.missing.join(', ')}`);
    }
  }
} 