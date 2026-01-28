/**
 * Check specific user account details
 * Run: node scripts/check-user.js
 */

const BASE_URL = 'https://qrserver-production.up.railway.app';

async function checkUserByEmail(email) {
  try {
    console.log(`\n=== Checking user: ${email} ===`);
    
    // Try to find user by email (this might require admin access, but let's try)
    const response = await fetch(`${BASE_URL}/api/users?filters[email][$eq]=${email}`, {
      headers: { 
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`User lookup status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Found users:', data.length);
      if (data.length > 0) {
        console.log('User details:');
        console.log('- ID:', data[0].id);
        console.log('- Username:', data[0].username);
        console.log('- Email:', data[0].email);
        console.log('- Confirmed:', data[0].confirmed);
        console.log('- Blocked:', data[0].blocked);
        console.log('- Provider:', data[0].provider);
        console.log('- Subscription Status:', data[0].subscriptionStatus);
        console.log('- Plan:', data[0].plan || '(blank)');
        console.log('- Created:', data[0].createdAt);
        console.log('- Updated:', data[0].updatedAt);
      }
    } else {
      const error = await response.json();
      console.log('User lookup failed:', error.error?.message || 'Unknown error');
      console.log('Full error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.log('Network error:', error.message);
  }
}

async function main() {
  console.log('=== User Account Check ===');
  
  // Check your specific account
  await checkUserByEmail('nick.tsoukas101@gmail.com');
  
  // Also try the username version
  await checkUserByEmail('nick.tsoukas101');
}

main().catch(console.error);
