'use strict';

/**
 * Revert Permissions Script
 * 
 * Restores permissions from the before.json snapshot.
 * Run with: node scripts/revert-permissions.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Starting Strapi bootstrap to revert permission changes...\n');

  const snapshotDir = path.join(__dirname, 'permission-snapshots');
  const beforePath = path.join(snapshotDir, 'before.json');

  if (!fs.existsSync(beforePath)) {
    console.error('❌ before.json not found. Cannot revert.');
    process.exit(1);
  }

  const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));

  // Bootstrap Strapi
  const strapi = require('@strapi/strapi');
  const app = await strapi({ distDir: './dist' }).load();

  console.log('🔧 Reverting permissions to before.json state...\n');

  let restored = 0;
  let failed = 0;

  // Restore public permissions
  for (const p of before.permissions.public) {
    try {
      await app.query('plugin::users-permissions.permission').update({
        where: { id: p.id },
        data: { enabled: p.enabled },
      });
      restored++;
    } catch (err) {
      console.error(`  ❌ Failed to restore ${p.action}: ${err.message}`);
      failed++;
    }
  }

  // Restore authenticated permissions
  for (const p of before.permissions.authenticated) {
    try {
      await app.query('plugin::users-permissions.permission').update({
        where: { id: p.id },
        data: { enabled: p.enabled },
      });
      restored++;
    } catch (err) {
      console.error(`  ❌ Failed to restore ${p.action}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n📊 REVERT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Permissions restored: ${restored}`);
  console.log(`Failed: ${failed}`);

  console.log('\n✅ Revert complete. Permissions restored to before.json state.');

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
