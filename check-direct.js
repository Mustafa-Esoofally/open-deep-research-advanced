/**
 * Direct environment file check
 * This script directly reads the .env.local file to confirm it has proper content
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('Directly checking .env.local file...');

// Path to .env.local
const envPath = path.resolve(process.cwd(), '.env.local');

// Check if file exists
if (fs.existsSync(envPath)) {
  console.log(`\n✅ Found .env.local at: ${envPath}`);
  
  // Read file contents directly
  try {
    const fileContents = fs.readFileSync(envPath, 'utf8');
    console.log('\n📋 File contents:');
    console.log('----------------------------------');
    console.log(fileContents);
    console.log('----------------------------------');
    
    // Try to parse with dotenv
    const parsedEnv = dotenv.parse(fileContents);
    console.log('\n📋 Parsed environment variables:');
    console.log('----------------------------------');
    Object.keys(parsedEnv).forEach(key => {
      const value = parsedEnv[key];
      // Mask values for security
      const displayValue = value ? 
        `[SET] ${value.substring(0, 3)}...${value.substring(value.length - 3)}` : 
        '[EMPTY]';
      console.log(`${key}: ${displayValue}`);
    });
    
    console.log('\n✅ Total variables found:', Object.keys(parsedEnv).length);
  } catch (err) {
    console.error('❌ Error reading or parsing .env.local file:', err.message);
  }
} else {
  console.error(`❌ ERROR: .env.local file not found at ${envPath}`);
} 