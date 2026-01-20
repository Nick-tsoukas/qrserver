const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db');

console.log('=== AUTHENTICATED ROLE PERMISSIONS ===\n');

const authPerms = db.prepare(`
  SELECT p.action 
  FROM up_permissions p 
  JOIN up_permissions_role_links l ON p.id = l.permission_id 
  JOIN up_roles r ON l.role_id = r.id 
  WHERE r.type = 'authenticated'
  ORDER BY p.action
`).all();

console.log('Enabled permissions for Authenticated role:');
authPerms.forEach(p => console.log(`  ${p.action}`));

console.log('\n--- Checking specific permissions ---');
const needed = [
  'api::qr.qr.find',
  'api::qr.qr.findOne',
  'api::event.event.find',
  'api::event.event.findOne',
  'api::band.band.find',
  'api::band.band.findOne',
];

needed.forEach(action => {
  const found = authPerms.some(p => p.action === action);
  console.log(`  ${found ? '✅' : '❌'} ${action}`);
});

db.close();
