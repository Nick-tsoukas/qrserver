const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db');

const perms = db.prepare(`
  SELECT p.id, p.action, r.type as role 
  FROM up_permissions p 
  JOIN up_permissions_role_links l ON p.id = l.permission_id 
  JOIN up_roles r ON l.role_id = r.id 
  WHERE p.action LIKE '%qr%' 
     OR p.action LIKE '%band.band.find%' 
     OR p.action LIKE '%event.event.find%'
  ORDER BY r.type, p.action
`).all();

console.log('Current permissions in database:\n');
console.log('AUTHENTICATED:');
perms.filter(p => p.role === 'authenticated').forEach(p => console.log(`  ${p.action}`));
console.log('\nPUBLIC:');
perms.filter(p => p.role === 'public').forEach(p => console.log(`  ${p.action}`));

db.close();
