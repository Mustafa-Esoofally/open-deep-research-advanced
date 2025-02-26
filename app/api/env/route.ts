import { NextRequest } from 'next/server';
import { validateEnv, env } from '@/app/lib/env';

/**
 * Safe API endpoint to verify environment variables status
 * It deliberately doesn't expose actual keys, just validation status
 * During build time, it always returns a successful response
 */
export async function GET() {
  // Always return a valid response during build time
  if (env.IS_BUILD_TIME || env.IS_BROWSER) {
    console.log('🔨 Environment check API: Build-time or browser detected, returning mock response');
    return new Response(
      JSON.stringify({
        valid: true,
        missingVariables: [],
        config: {
          nodeEnv: env.NODE_ENV,
          appName: env.APP_NAME,
          isBuildTime: env.IS_BUILD_TIME,
          isBrowser: env.IS_BROWSER
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }
  
  try {
    // Check environment variables during runtime
    const envStatus = validateEnv();
    
    // Determine the appropriate status code
    // In development, we return 200 even if env vars are missing
    // In production, we return 503 if env vars are missing
    const statusCode = (envStatus.valid || env.IS_DEV) ? 200 : 503;
    
    // Return environment status (valid or not) without exposing sensitive info
    return new Response(
      JSON.stringify({
        valid: envStatus.valid,
        // Only return names of missing variables, not values
        missingVariables: envStatus.valid ? [] : envStatus.missing,
        // Include basic configuration info that's safe to expose
        config: {
          nodeEnv: env.NODE_ENV,
          appName: env.APP_NAME,
          // Safe to show which model we're using
          openrouterModel: env.OPENROUTER_MODEL,
          defaultModelKey: env.DEFAULT_MODEL_KEY,
          // Show if keys are present without exposing the actual keys
          hasOpenRouterKey: Boolean(env.OPENROUTER_API_KEY) && env.OPENROUTER_API_KEY !== 'placeholder-for-client-side',
          hasFirecrawlKey: Boolean(env.FIRECRAWL_API_KEY) && env.FIRECRAWL_API_KEY !== 'placeholder-for-client-side',
        },
        // Help message for developers
        development: env.IS_DEV ? {
          helpMessage: envStatus.valid 
            ? "Environment is properly configured." 
            : "Missing environment variables. Add them to your .env.local file then restart the server."
        } : undefined
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (error) {
    // Provide a fallback response if there's an error
    console.error('Error in environment check API:', error);
    return new Response(
      JSON.stringify({
        valid: false,
        missingVariables: [],
        error: 'Failed to check environment',
        config: {
          nodeEnv: env.NODE_ENV,
          appName: env.APP_NAME,
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }
} 