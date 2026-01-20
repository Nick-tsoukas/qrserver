/**
 * Test API authentication by making requests with a JWT token
 * Run: node scripts/test-api-auth.js
 */

const BASE_URL = 'http://localhost:1337';

async function testEndpoint(endpoint, token) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  } catch (e) {
    return { status: 'ERROR', error: e.message };
  }
}

async function main() {
  // First, login to get a token
  console.log('=== Testing API Authentication ===\n');
  
  console.log('1. Logging in as test101@gmail.com...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'test101@gmail.com',
      password: 'test123', // You may need to change this
    }),
  });
  
  if (!loginRes.ok) {
    console.log('   Login failed:', loginRes.status);
    const err = await loginRes.json();
    console.log('   Error:', err);
    console.log('\n   Please update the password in this script and try again.');
    return;
  }
  
  const loginData = await loginRes.json();
  const token = loginData.jwt;
  const userId = loginData.user?.id;
  console.log(`   ✅ Logged in! User ID: ${userId}`);
  console.log(`   Token: ${token.substring(0, 30)}...`);
  
  console.log('\n2. Testing endpoints...\n');
  
  // Test bands (should work)
  const bandsResult = await testEndpoint(`/api/bands?filters[users_permissions_user][id][$eq]=${userId}`, token);
  console.log(`   /api/bands: ${bandsResult.status} ${bandsResult.ok ? '✅' : '❌'}`);
  if (bandsResult.ok) console.log(`      Found ${bandsResult.data?.data?.length || 0} bands`);
  else console.log(`      Error:`, bandsResult.data?.error?.message || bandsResult.error);
  
  // Test QRs
  const qrsResult = await testEndpoint(`/api/qrs?filters[users_permissions_user][id][$eq]=${userId}`, token);
  console.log(`   /api/qrs: ${qrsResult.status} ${qrsResult.ok ? '✅' : '❌'}`);
  if (qrsResult.ok) console.log(`      Found ${qrsResult.data?.data?.length || 0} QRs`);
  else console.log(`      Error:`, qrsResult.data?.error?.message || qrsResult.error);
  
  // Test events
  const eventsResult = await testEndpoint(`/api/events?filters[users_permissions_user][id][$eq]=${userId}`, token);
  console.log(`   /api/events: ${eventsResult.status} ${eventsResult.ok ? '✅' : '❌'}`);
  if (eventsResult.ok) console.log(`      Found ${eventsResult.data?.data?.length || 0} events`);
  else console.log(`      Error:`, eventsResult.data?.error?.message || eventsResult.error);
  
  // Test without token (public access)
  console.log('\n3. Testing without token (public access)...\n');
  
  const bandsPublic = await testEndpoint('/api/bands', null);
  console.log(`   /api/bands (no auth): ${bandsPublic.status} ${bandsPublic.ok ? '✅' : '❌'}`);
  
  const qrsPublic = await testEndpoint('/api/qrs', null);
  console.log(`   /api/qrs (no auth): ${qrsPublic.status} ${qrsPublic.ok ? '✅' : '❌'}`);
  
  const eventsPublic = await testEndpoint('/api/events', null);
  console.log(`   /api/events (no auth): ${eventsPublic.status} ${eventsPublic.ok ? '✅' : '❌'}`);
}

main().catch(console.error);
