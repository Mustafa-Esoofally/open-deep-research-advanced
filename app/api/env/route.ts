import { NextRequest } from 'next/server';
import { validateEnv, refreshEnv } from '@/app/lib/env';

// This is a safe API endpoint to verify environment variables
// It doesn't expose actual keys, just validation status
export async function GET() {
  // Force environment refresh to get latest values
  refreshEnv();
  
  // Check environment variables
  const envStatus = validateEnv();
  
  // Determine the appropriate status code
  // In development, we return 200 even if env vars are missing
  // In production, we return 503 if env vars are missing
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = (envStatus.valid || isDevelopment) ? 200 : 503;
  
  // Return environment status (valid or not) without exposing sensitive info
  return new Response(
    JSON.stringify({
      valid: envStatus.valid,
      // Only return names of missing variables, not values
      missingVariables: envStatus.valid ? [] : envStatus.missing,
      // Include basic configuration info that's safe to expose
      config: {
        nodeEnv: process.env.NODE_ENV || 'development',
        appName: process.env.APP_NAME || 'Advanced Deep Research',
      },
      // Help message for developers
      development: isDevelopment ? {
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
} 