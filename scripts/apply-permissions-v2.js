'use strict';

/**
 * PHASE 4: Apply Safe Permission Removals
 * 
 * Removes permission-role links from the database for REMOVE decisions.
 * Run with: node scripts/apply-permissions-v2.js
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

  const db = new Database(dbPath);

  // Get role IDs
  const roles = db.prepare('SELECT * FROM up_roles').all();
  const publicRole = roles.find(r => r.type === 'public');
  const authenticatedRole = roles.find(r => r.type === 'authenticated');

  if (!publicRole || !authenticatedRole) {
    console.error('❌ Could not find roles');
    db.close();
    process.exit(1);
  }

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
    return;
  }

  console.log(`📋 Found ${toDisable.length} permissions to disable:\n`);
  for (const p of toDisable) {
    console.log(`  [${p.role}] ${p.action}`);
  }

  console.log('\n🔧 Applying changes (removing permission-role links)...\n');

  const changes = [];
  const deleteStmt = db.prepare('DELETE FROM up_permissions_role_links WHERE permission_id = ? AND role_id = ?');

  for (const p of toDisable) {
    try {
      const result = deleteStmt.run(p.id, p.roleId);
      if (result.changes > 0) {
        console.log(`  ✅ Disabled: ${p.action}`);
        changes.push({ ...p, status: 'disabled' });
      } else {
        console.log(`  ⚠️ Already disabled or not found: ${p.action}`);
        changes.push({ ...p, status: 'not_found' });
      }
    } catch (err) {
      console.error(`  ❌ Failed to disable ${p.action}: ${err.message}`);
      changes.push({ ...p, status: 'failed', error: err.message });
    }
  }

  // Create after snapshot
  console.log('\n📸 Creating after snapshot...');
  
  const permissions = db.prepare('SELECT * FROM up_permissions').all();
  const permissionRoleLinks = db.prepare('SELECT * FROM up_permissions_role_links').all();

  const publicPermsAfter = [];
  const authPermsAfter = [];

  for (const perm of permissions) {
    const links = permissionRoleLinks.filter(l => l.permission_id === perm.id);
    for (const link of links) {
      if (link.role_id === publicRole.id) {
        publicPermsAfter.push({ id: perm.id, action: perm.action, enabled: true });
      } else if (link.role_id === authenticatedRole.id) {
        authPermsAfter.push({ id: perm.id, action: perm.action, enabled: true });
      }
    }
  }

  const afterSnapshot = {
    generatedAt: new Date().toISOString(),
    roles: {
      public: { id: publicRole.id, name: publicRole.name, type: publicRole.type },
      authenticated: { id: authenticatedRole.id, name: authenticatedRole.name, type: authenticatedRole.type },
    },
    permissions: {
      public: publicPermsAfter,
      authenticated: authPermsAfter,
    },
  };

  const afterPath = path.join(snapshotDir, 'after.json');
  fs.writeFileSync(afterPath, JSON.stringify(afterSnapshot, null, 2));
  console.log(`✅ Saved after snapshot: ${afterPath}`);

  db.close();

  // Generate diff report
  let diffMd = `# Permission Changes Report\n\n`;
  diffMd += `Applied: ${new Date().toISOString()}\n\n`;
  
  diffMd += `## Changes Applied\n\n`;
  diffMd += `| Role | Action | Status |\n`;
  diffMd += `|------|--------|--------|\n`;
  for (const c of changes) {
    const statusIcon = c.status === 'disabled' ? '✅' : c.status === 'not_found' ? '⚠️' : '❌';
    diffMd += `| ${c.role} | \`${c.action}\` | ${statusIcon} ${c.status} |\n`;
  }
  diffMd += `\n`;

  // Show remaining REVIEW items
  const remainingReview = [
    ...plan.public.filter(p => p.decision === 'REVIEW' && p.enabled),
    ...plan.authenticated.filter(p => p.decision === 'REVIEW' && p.enabled),
  ];

  diffMd += `## Remaining REVIEW Items (${remainingReview.length})\n\n`;
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
  diffMd += `To revert these changes, restore from before.json or use Strapi admin panel.\n`;

  const diffPath = path.join(snapshotDir, 'changes.md');
  fs.writeFileSync(diffPath, diffMd);
  console.log(`✅ Saved changes report: ${diffPath}`);

  // Summary
  console.log('\n📊 CHANGES SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Permissions disabled: ${changes.filter(c => c.status === 'disabled').length}`);
  console.log(`Not found/already disabled: ${changes.filter(c => c.status === 'not_found').length}`);
  console.log(`Failed: ${changes.filter(c => c.status === 'failed').length}`);
  console.log(`Remaining REVIEW items: ${remainingReview.length}`);

  console.log('\n✅ Phase 4 complete. Run smoke tests to verify app functionality.');
  console.log('\n⚠️  IMPORTANT: Restart Strapi for changes to take effect!');
}

main();
