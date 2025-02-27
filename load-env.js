/**
 * Environment Variable Loader Utility
 * 
 * This script ensures all environment variables are properly loaded
 * from .env files for both development and production environments.
 * 
 * It's used in next.config.js to ensure consistent variable loading.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadEnvConfig() {
  console.log('🔄 Loading environment configuration...');
  
  const env = process.env.NODE_ENV || 'development';
  const isDev = env === 'development';
  
  try {
    // Paths to environment files
    const envLocal = path.resolve(process.cwd(), '.env.local');
    const envDevelopment = path.resolve(process.cwd(), '.env.development');
    const envProduction = path.resolve(process.cwd(), '.env.production');
    const envDefault = path.resolve(process.cwd(), '.env');
    
    // Load environment variables in this order
    const envFiles = [
      isDev && envDevelopment,
      !isDev && envProduction,
      envLocal,
      envDefault
    ].filter(Boolean);
    
    // Track loaded files for logging
    const loadedFiles = [];
    
    // Load each file if it exists
    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        try {
          console.log(`📂 Found environment file: ${path.basename(envFile)}`);
          const envFileContents = fs.readFileSync(envFile, 'utf8');
          const parsed = dotenv.parse(envFileContents);
          
          // Apply loaded variables to process.env
          for (const key in parsed) {
            if (!process.env[key]) {
              process.env[key] = parsed[key];
              // Uncomment for debugging
              // console.log(`📌 SET ${key}=${parsed[key].substring(0, 3)}...`);
            }
          }
          
          loadedFiles.push(path.basename(envFile));
          
          // Direct output of variable count from this file
          console.log(`✅ Loaded ${Object.keys(parsed).length} variables from ${path.basename(envFile)}`);
        } catch (err) {
          console.error(`❌ Error loading ${path.basename(envFile)}: ${err.message}`);
        }
      }
    }
    
    // Handle NEXT_SERVER_ variables special case to ensure compatibility
    const tempVars = {};
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('NEXT_SERVER_')) {
        const regularKey = key.replace('NEXT_SERVER_', '');
        if (!process.env[regularKey]) {
          tempVars[regularKey] = process.env[key];
        }
      }
    });
    
    // Apply the regular versions
    Object.keys(tempVars).forEach(key => {
      process.env[key] = tempVars[key];
    });
    
    // Set known critical variables directly for Next.js
    if (process.env.NEXT_SERVER_OPENROUTER_API_KEY) {
      process.env.OPENROUTER_API_KEY = process.env.NEXT_SERVER_OPENROUTER_API_KEY;
    }
    
    if (process.env.NEXT_SERVER_FIRECRAWL_API_KEY) {
      process.env.FIRECRAWL_API_KEY = process.env.NEXT_SERVER_FIRECRAWL_API_KEY;
    }
    
    // Output the loaded files
    console.log(`🔄 Environment loaded from: ${loadedFiles.join(', ') || 'No local env files'}`);
    
    // Return combined env variables
    return { 
      loadedFiles,
      count: loadedFiles.length 
    };
  } catch (error) {
    console.error('❌ Error in loadEnvConfig:', error.message);
    return { loadedFiles: [], count: 0 };
  }
}

// If this script is run directly (not required by another module)
if (require.main === module) {
  loadEnvConfig();
  
  // Output key environment variables for debugging (with masking)
  const criticalKeys = [
    'NEXT_SERVER_OPENROUTER_API_KEY', 
    'OPENROUTER_API_KEY',
    'NEXT_SERVER_FIRECRAWL_API_KEY',
    'FIRECRAWL_API_KEY'
  ];
  
  console.log('\n📋 Critical environment variables status:');
  criticalKeys.forEach(key => {
    const value = process.env[key];
    console.log(` - ${key}: ${value ? 
      `[SET] ${value.substring(0, 3)}...${value.substring(value.length - 3)}` : 
      '[NOT SET]'}`);
  });
}

module.exports = loadEnvConfig; 