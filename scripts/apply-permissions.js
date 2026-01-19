'use strict';

/**
 * PHASE 4: Apply Safe Permission Removals
 * 
 * Applies ONLY the REMOVE decisions from the permission plan.
 * Removes permission-role links from the database.
 * Run with: node scripts/apply-permissions.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function main() {
  console.log('🚀 Starting permission changes via direct DB...\n');

  const snapshotDir = path.join(__dirname, 'permission-snapshots');
  const planPath = path.join(snapshotDir, 'permission-plan.json');

  if (!fs.existsSync(planPath)) {
    console.error('❌ permission-plan.json not found. Run generate-permission-plan.js first.');
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  // Open database
  const dbPath = path.join(__dirname, '..', '.tmp', 'data.db');
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at', dbPath);
    process.exit(1);
  }

  // Get role IDs
  const db = new Database(dbPath);
  const roles = db.prepare('SELECT * FROM up_roles').all();
  const publicRole = roles.find(r => r.type === 'public');
  const authenticatedRole = roles.find(r => r.type === 'authenticated');

  // Collect permissions to disable
  const toDisable = [];
  
  for (const p of plan.public) {
    if (p.decision === 'REMOVE' && p.enabled) {
      toDisable.push({ id: p.id, action: p.action, role: 'public', roleId: publicRole.id });
    }
  }
  
  for (const p of plan.authenticated) {
    if (p.decision === 'REMOVE' && p.enabled) {
      toDisable.push({ id: p.id, action: p.action, role: 'authenticated', roleId: authenticatedRole.id });
    }
  }

  if (toDisable.length === 0) {
    console.log('✅ No permissions to remove. Everything is already secure!');
    db.close();
    process.exit(0);
  }

  console.log(`📋 Found ${toDisable.length} permissions to disable:\n`);
  for (const p of toDisable) {
    console.log(`  [${p.role}] ${p.action}`);
  }

  console.log('\n🔧 Applying changes (removing permission-role links)...');

  const changes = [];

  console.log('\n🔧 Applying changes...');
  for (const p of toDisable) {
    try {
      await app.query('plugin::users-permissions.permission').update({
        where: { id: p.id },
        data: { enabled: false },
      });
      console.log(`  ✅ Disabled: ${p.action}`);
      changes.push({ ...p, status: 'disabled' });
    } catch (err) {
      console.error(`  ❌ Failed to disable ${p.action}: ${err.message}`);
      changes.push({ ...p, status: 'failed', error: err.message });
    }
  }

  // Create after snapshot
  console.log('\n📸 Creating after snapshot...');
  
  const allPermissions = await app.query('plugin::users-permissions.permission').findMany({
    populate: ['role'],
  });

  const roles = await app.query('plugin::users-permissions.role').findMany();
  const publicRole = roles.find(r => r.type === 'public');
  const authenticatedRole = roles.find(r => r.type === 'authenticated');

  const publicPermissions = allPermissions.filter(p => p.role?.id === publicRole?.id);
  const authenticatedPermissions = allPermissions.filter(p => p.role?.id === authenticatedRole?.id);

  const afterSnapshot = {
    generatedAt: new Date().toISOString(),
    roles: {
      public: { id: publicRole?.id, name: publicRole?.name, type: publicRole?.type },
      authenticated: { id: authenticatedRole?.id, name: authenticatedRole?.name, type: authenticatedRole?.type },
    },
    permissions: {
      public: publicPermissions.map(p => ({ id: p.id, action: p.action, enabled: p.enabled })),
      authenticated: authenticatedPermissions.map(p => ({ id: p.id, action: p.action, enabled: p.enabled })),
    },
  };

  const afterPath = path.join(snapshotDir, 'after.json');
  fs.writeFileSync(afterPath, JSON.stringify(afterSnapshot, null, 2));
  console.log(`✅ Saved after snapshot: ${afterPath}`);

  // Generate diff report
  const beforePath = path.join(snapshotDir, 'before.json');
  const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));

  let diffMd = `# Permission Changes Report\n\n`;
  diffMd += `Applied: ${new Date().toISOString()}\n\n`;
  
  diffMd += `## Changes Applied\n\n`;
  diffMd += `| Role | Action | Status |\n`;
  diffMd += `|------|--------|--------|\n`;
  for (const c of changes) {
    const statusIcon = c.status === 'disabled' ? '✅' : '❌';
    diffMd += `| ${c.role} | \`${c.action}\` | ${statusIcon} ${c.status} |\n`;
  }
  diffMd += `\n`;

  // Show remaining REVIEW items
  const remainingReview = [
    ...plan.public.filter(p => p.decision === 'REVIEW' && p.enabled),
    ...plan.authenticated.filter(p => p.decision === 'REVIEW' && p.enabled),
  ];

  diffMd += `## Remaining REVIEW Items\n\n`;
  diffMd += `These permissions need manual review:\n\n`;
  if (remainingReview.length === 0) {
    diffMd += `_None_\n`;
  } else {
    diffMd += `| Role | Action | Risk | Reason |\n`;
    diffMd += `|------|--------|------|--------|\n`;
    for (const p of plan.public.filter(p => p.decision === 'REVIEW' && p.enabled)) {
      diffMd += `| public | \`${p.action}\` | ${p.risk} | ${p.reason} |\n`;
    }
    for (const p of plan.authenticated.filter(p => p.decision === 'REVIEW' && p.enabled)) {
      diffMd += `| authenticated | \`${p.action}\` | ${p.risk} | ${p.reason} |\n`;
    }
  }
  diffMd += `\n`;

  diffMd += `## How to Revert\n\n`;
  diffMd += `To revert these changes, use the before.json snapshot:\n\n`;
  diffMd += `\`\`\`bash\nnode scripts/revert-permissions.js\n\`\`\`\n`;

  const diffPath = path.join(snapshotDir, 'changes.md');
  fs.writeFileSync(diffPath, diffMd);
  console.log(`✅ Saved changes report: ${diffPath}`);

  // Summary
  console.log('\n📊 CHANGES SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Permissions disabled: ${changes.filter(c => c.status === 'disabled').length}`);
  console.log(`Failed: ${changes.filter(c => c.status === 'failed').length}`);
  console.log(`Remaining REVIEW items: ${remainingReview.length}`);

  console.log('\n✅ Phase 4 complete. Run smoke tests to verify app functionality.');

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
