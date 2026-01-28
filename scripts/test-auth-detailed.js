/**
 * Detailed auth endpoint test
 */
const BASE_URL = 'https://qrserver-production.up.railway.app';

async function testAuthEndpoint() {
  console.log('Testing auth endpoint...\n');
  
  // Test 1: Check if auth endpoint exists
  try {
    const res = await fetch(`${BASE_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'test@test.com',
        password: 'test123'
      })
    });
    
    console.log('Status:', res.status, res.statusText);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    
    const text = await res.text();
    console.log('Response body:', text.substring(0, 1000));
    
    try {
      const json = JSON.parse(text);
      console.log('\nParsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Not valid JSON');
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
  
  // Test 2: Check health/admin endpoint
  console.log('\n--- Testing admin endpoint ---');
  try {
    const res = await fetch(`${BASE_URL}/admin`);
    console.log('Admin status:', res.status);
  } catch (err) {
    console.error('Admin error:', err.message);
  }
  
  // Test 3: Check users-permissions plugin routes
  console.log('\n--- Testing users-permissions routes ---');
  try {
    const res = await fetch(`${BASE_URL}/api/users-permissions/roles`);
    console.log('Roles status:', res.status);
    const text = await res.text();
    console.log('Roles response:', text.substring(0, 200));
  } catch (err) {
    console.error('Roles error:', err.message);
  }
}

testAuthEndpoint();
