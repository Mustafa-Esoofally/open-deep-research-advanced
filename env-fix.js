/**
 * Environment Variable Fix Utility
 * 
 * This script helps ensure environment variables are correctly set up for Vercel deployment.
 * It reads your local .env files and outputs the values in a format that can be 
 * easily copied into Vercel environment variable settings.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('🔄 Preparing environment variables for Vercel...');

// Read environment files
const envFiles = [
  '.env.local',
  '.env',
  '.env.production'
];

// Store all variables
const allVars = {};

// Process each file
envFiles.forEach(filename => {
  const filePath = path.join(process.cwd(), filename);
  
  if (fs.existsSync(filePath)) {
    try {
      console.log(`📂 Reading ${filename}...`);
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = dotenv.parse(content);
      
      // Add to our collection
      Object.keys(parsed).forEach(key => {
        if (!allVars[key]) {
          allVars[key] = parsed[key];
        }
      });
      
      console.log(`✅ Found ${Object.keys(parsed).length} variables in ${filename}`);
    } catch (err) {
      console.error(`❌ Error reading ${filename}: ${err.message}`);
    }
  } else {
    console.log(`⚠️ File not found: ${filename}`);
  }
});

// Critical variables that must be set in Vercel
const criticalVars = [
  // Server-side only variables (prefixed)
  'NEXT_SERVER_OPENROUTER_API_KEY',
  'NEXT_SERVER_FIRECRAWL_API_KEY',
  'NEXT_SERVER_PERPLEXITY_API_KEY',
  
  // Regular variables (will be used as fallbacks)
  'OPENROUTER_API_KEY',
  'FIRECRAWL_API_KEY',
  
  // Configuration
  'OPENROUTER_MODEL',
  'PERPLEXITY_MODEL',
  'APP_NAME',
  'APP_URL'
];

// Count how many of the critical variables we found
const foundCritical = criticalVars.filter(key => allVars[key]);

console.log('\n📋 Vercel Environment Variables Status:');
console.log(`Found ${foundCritical.length} of ${criticalVars.length} critical variables`);

console.log('\n📋 Variables for Vercel:');
console.log('==================================');

// Output each critical variable with its value
criticalVars.forEach(key => {
  const value = allVars[key];
  
  if (value) {
    // For API keys, mask the middle part
    if (key.includes('API_KEY') || key.includes('SECRET')) {
      const maskedValue = `${value.substring(0, 5)}...${value.substring(value.length - 5)}`;
      console.log(`${key}=${maskedValue}`);
    } else {
      console.log(`${key}=${value}`);
    }
  } else {
    console.log(`${key}=[NOT SET]`);
  }
});

// Special handling for API keys to ensure both formats are available
if (allVars['NEXT_SERVER_OPENROUTER_API_KEY'] && !allVars['OPENROUTER_API_KEY']) {
  console.log('\n🔀 You should also set these variables in Vercel:');
  console.log(`OPENROUTER_API_KEY=${allVars['NEXT_SERVER_OPENROUTER_API_KEY'].substring(0, 5)}...`);
}

if (allVars['NEXT_SERVER_FIRECRAWL_API_KEY'] && !allVars['FIRECRAWL_API_KEY']) {
  console.log(`FIRECRAWL_API_KEY=${allVars['NEXT_SERVER_FIRECRAWL_API_KEY'].substring(0, 5)}...`);
}

console.log('\n✅ Instructions:');
console.log('1. Copy the above variables to your Vercel project settings');
console.log('2. Go to https://vercel.com/your-username/your-project/settings/environment-variables');
console.log('3. Add each variable with its value');
console.log('4. Make sure to redeploy your application after updating environment variables'); 