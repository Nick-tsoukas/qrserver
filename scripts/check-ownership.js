const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db');

console.log('=== USER OWNERSHIP CHECK ===\n');

// Get all users
const users = db.prepare('SELECT id, username, email FROM up_users').all();
console.log('USERS:');
users.forEach(u => console.log(`  ID ${u.id}: ${u.email || u.username}`));

// Get bands with their user
console.log('\nBANDS:');
const bands = db.prepare(`
  SELECT b.id, b.name, l.user_id 
  FROM bands b 
  LEFT JOIN bands_users_permissions_user_links l ON b.id = l.band_id
`).all();
bands.forEach(b => console.log(`  ID ${b.id}: "${b.name}" -> User ${b.user_id || 'NONE'}`));

// Get QRs with their user
console.log('\nQRS:');
const qrs = db.prepare(`
  SELECT q.id, q.name, l.user_id 
  FROM qrs q 
  LEFT JOIN qrs_users_permissions_user_links l ON q.id = l.qr_id
`).all();
qrs.forEach(q => console.log(`  ID ${q.id}: "${q.name}" -> User ${q.user_id || 'NONE'}`));

// Get events with their user
console.log('\nEVENTS:');
const events = db.prepare(`
  SELECT e.id, e.title, l.user_id 
  FROM events e 
  LEFT JOIN events_users_permissions_user_links l ON e.id = l.event_id
`).all();
events.forEach(e => console.log(`  ID ${e.id}: "${e.title}" -> User ${e.user_id || 'NONE'}`));

db.close();
