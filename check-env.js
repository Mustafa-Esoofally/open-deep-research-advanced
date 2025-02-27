/**
 * Environment Variable Check Utility
 * 
 * Run this with: node check-env.js
 * This script validates that the environment variables are correctly loaded
 * and helps troubleshoot any issues with your .env.local configuration.
 */

console.log('Checking environment variables...');

// Require our env loader
require('./load-env')();

// Critical variables to check
const criticalVars = [
  'NEXT_SERVER_OPENROUTER_API_KEY',
  'OPENROUTER_API_KEY',
  'NEXT_SERVER_FIRECRAWL_API_KEY',
  'FIRECRAWL_API_KEY',
  'NEXT_SERVER_PERPLEXITY_API_KEY'
];

// Configuration variables to check
const configVars = [
  'OPENROUTER_MODEL',
  'PERPLEXITY_MODEL',
  'APP_NAME',
  'APP_URL'
];

console.log('\n📋 Environment Variables Status:');
console.log('==================================');

// Check critical variables
console.log('\n🔑 API Keys (Critical):');
criticalVars.forEach(varName => {
  const value = process.env[varName];
  const maskValue = value ? 
    `[SET] ${value.substring(0, 3)}...${value.substring(value.length - 3)}` :
    '[NOT SET]';
  
  console.log(` - ${varName}: ${maskValue}`);
});

// Check configuration variables
console.log('\n⚙️ Configuration:');
configVars.forEach(varName => {
  const value = process.env[varName];
  console.log(` - ${varName}: ${value || '[NOT SET]'}`);
});

// Check for missing variables and show advice
const missingCritical = criticalVars.filter(name => 
  // For each prefixed/regular pair, only one needs to be set
  (name.startsWith('NEXT_SERVER_') && 
   !process.env[name] && 
   !process.env[name.replace('NEXT_SERVER_', '')])
  ||
  (!name.startsWith('NEXT_SERVER_') && 
   !process.env[name] && 
   !process.env[`NEXT_SERVER_${name}`])
);

if (missingCritical.length > 0) {
  console.log('\n⚠️ MISSING CRITICAL VARIABLES:');
  missingCritical.forEach(name => {
    if (name.startsWith('NEXT_SERVER_')) {
      console.log(` - Either ${name} or ${name.replace('NEXT_SERVER_', '')} must be set`);
    }
  });
  
  console.log('\n💡 Add these to your .env.local file:');
  missingCritical.forEach(name => {
    if (name.startsWith('NEXT_SERVER_')) {
      console.log(`${name}=your-value-here`);
    }
  });
  
  console.log('\n💻 Or in Vercel, add them as environment variables in the project settings.');
} else {
  console.log('\n✅ All critical variables are set!');
}

console.log('\n🔍 NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('✅ Environment check complete.'); 