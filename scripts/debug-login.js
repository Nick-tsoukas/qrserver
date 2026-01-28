/**
 * Debug script to test specific login credentials
 * Run: node scripts/debug-login.js
 */

// Change this to your production URL
const BASE_URL = 'https://qrserver-production.up.railway.app';

async function testLogin(identifier, password) {
  try {
    console.log(`\n=== Testing login for: ${identifier} ===`);
    
    const loginRes = await fetch(`${BASE_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: identifier,
        password: password,
      }),
    });
    
    console.log(`Status: ${loginRes.status} ${loginRes.statusText}`);
    
    const data = await loginRes.json();
    
    if (loginRes.ok) {
      console.log('✅ Login successful!');
      console.log('User ID:', data.user?.id);
      console.log('Email:', data.user?.email);
      console.log('Username:', data.user?.username);
      console.log('Subscription Status:', data.user?.subscriptionStatus);
      console.log('Plan:', data.user?.plan || '(blank)');
      console.log('Confirmed:', data.user?.confirmed);
      console.log('Blocked:', data.user?.blocked);
      console.log('JWT Token:', data.jwt?.substring(0, 50) + '...');
    } else {
      console.log('❌ Login failed!');
      console.log('Error:', data.error?.message || 'Unknown error');
      console.log('Error details:', JSON.stringify(data.error, null, 2));
    }
    
    return { success: loginRes.ok, data };
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkUserExists(identifier) {
  try {
    console.log(`\n=== Checking if user exists: ${identifier} ===`);
    
    // This would require admin access, but let's try to see if we can get any info
    const response = await fetch(`${BASE_URL}/api/users?filters[email][$eq]=${identifier}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`User lookup status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Users found:', data.length);
      return data;
    } else {
      const error = await response.json();
      console.log('User lookup failed:', error.error?.message || 'Unknown error');
    }
    
  } catch (error) {
    console.log('User lookup error:', error.message);
  }
}

async function main() {
  console.log('=== Login Debug Script ===');
  console.log('Make sure your Strapi server is running on http://localhost:1337');
  
  // Test your specific credentials
  await testLogin('nick.tsoukas101', 'password101');
  
  // Test some variations
  await testLogin('nick.tsoukas101@gmail.com', 'password101');
  await testLogin('nick.tsoukas101', 'password101!');
  await testLogin('nick.tsoukas101', 'Password101');
  
  // Check if user exists
  await checkUserExists('nick.tsoukas101');
}

main().catch(console.error);
