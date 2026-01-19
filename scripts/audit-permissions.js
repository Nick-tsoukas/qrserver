'use strict';

/**
 * PHASE 2: Audit Permissions Script
 * 
 * Queries the SQLite database directly to audit permissions.
 * Run with: node scripts/audit-permissions.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function main() {
  console.log('🚀 Starting permissions audit via direct DB query...\n');

  // Open SQLite database
  const dbPath = path.join(__dirname, '..', '.tmp', 'data.db');
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at', dbPath);
    console.error('   Make sure Strapi has been run at least once in development mode.');
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  // Get roles
  console.log('📋 Fetching roles...');
  const roles = db.prepare('SELECT * FROM up_roles').all();

  const publicRole = roles.find(r => r.type === 'public');
  const authenticatedRole = roles.find(r => r.type === 'authenticated');

  if (!publicRole) {
    console.error('❌ Public role not found!');
    process.exit(1);
  }
  if (!authenticatedRole) {
    console.error('❌ Authenticated role not found!');
    process.exit(1);
  }

  console.log(`✅ Found Public role (id: ${publicRole.id})`);
  console.log(`✅ Found Authenticated role (id: ${authenticatedRole.id})`);

  // Get all permissions with role links
  console.log('\n📋 Fetching all permissions...');
  const permissions = db.prepare('SELECT * FROM up_permissions').all();
  const permissionRoleLinks = db.prepare('SELECT * FROM up_permissions_role_links').all();

  // Map permissions to roles
  // In Strapi v4, if a permission is linked to a role, it's ENABLED
  const publicPermissions = [];
  const authenticatedPermissions = [];

  for (const perm of permissions) {
    // Find all links for this permission
    const links = permissionRoleLinks.filter(l => l.permission_id === perm.id);
    
    for (const link of links) {
      if (link.role_id === publicRole.id) {
        publicPermissions.push({ 
          id: perm.id, 
          action: perm.action, 
          enabled: true,  // Linked = enabled in Strapi v4
          role: publicRole 
        });
      } else if (link.role_id === authenticatedRole.id) {
        authenticatedPermissions.push({ 
          id: perm.id, 
          action: perm.action, 
          enabled: true,  // Linked = enabled in Strapi v4
          role: authenticatedRole 
        });
      }
    }
  }

  db.close();

  console.log(`Public permissions: ${publicPermissions.length}`);
  console.log(`Authenticated permissions: ${authenticatedPermissions.length}`);

  // Build audit report
  const audit = {
    generatedAt: new Date().toISOString(),
    roles: {
      public: {
        id: publicRole.id,
        name: publicRole.name,
        type: publicRole.type,
      },
      authenticated: {
        id: authenticatedRole.id,
        name: authenticatedRole.name,
        type: authenticatedRole.type,
      },
    },
    permissions: {
      public: publicPermissions.map(p => ({
        id: p.id,
        action: p.action,
        enabled: p.enabled,
      })),
      authenticated: authenticatedPermissions.map(p => ({
        id: p.id,
        action: p.action,
        enabled: p.enabled,
      })),
    },
  };

  // Save snapshot
  const snapshotDir = path.join(__dirname, 'permission-snapshots');
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const jsonPath = path.join(snapshotDir, 'before.json');
  fs.writeFileSync(jsonPath, JSON.stringify(audit, null, 2));
  console.log(`\n✅ Saved permissions snapshot: ${jsonPath}`);

  // Identify high-risk permissions
  console.log('\n🚨 HIGH-RISK PERMISSIONS AUDIT');
  console.log('═'.repeat(60));

  const highRisk = {
    public: [],
    authenticated: [],
  };

  // Check Public role
  console.log('\n🔓 PUBLIC ROLE - Enabled Permissions:');
  const publicEnabled = publicPermissions.filter(p => p.enabled);
  
  for (const p of publicEnabled) {
    const action = p.action;
    let risk = 'LOW';
    let reason = '';

    // High risk: any create/update/delete
    if (action.includes('.create') || action.includes('.update') || action.includes('.delete')) {
      risk = 'HIGH';
      reason = 'Write operation exposed to public';
    }
    // High risk: upload
    else if (action.includes('upload')) {
      risk = 'HIGH';
      reason = 'Upload exposed to public';
    }
    // Medium risk: user/role find
    else if (action.includes('user.find') || action.includes('role.find')) {
      risk = 'MEDIUM';
      reason = 'User/role enumeration possible';
    }
    // Low risk: read operations on expected public content
    else if (action.includes('.find') || action.includes('.findOne')) {
      risk = 'LOW';
      reason = 'Read operation';
    }

    const entry = { action, risk, reason, enabled: true };
    
    if (risk === 'HIGH' || risk === 'MEDIUM') {
      highRisk.public.push(entry);
    }

    const riskIcon = risk === 'HIGH' ? '🔴' : risk === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`  ${riskIcon} ${action}`);
    if (reason) console.log(`     └─ ${reason}`);
  }

  // Check Authenticated role
  console.log('\n🔐 AUTHENTICATED ROLE - Enabled Permissions:');
  const authEnabled = authenticatedPermissions.filter(p => p.enabled);
  
  for (const p of authEnabled) {
    const action = p.action;
    let risk = 'LOW';
    let reason = '';

    // High risk: delete without ownership check indication
    if (action.includes('.delete')) {
      risk = 'MEDIUM';
      reason = 'Delete operation - verify ownership checks exist';
    }
    // Medium risk: create/update on sensitive resources
    else if (action.includes('.create') || action.includes('.update')) {
      // These need review but aren't necessarily wrong
      risk = 'REVIEW';
      reason = 'Write operation - verify ownership/validation';
    }
    // Medium risk: user.find or role.find
    else if (action.includes('user.find') || action.includes('role.find')) {
      risk = 'MEDIUM';
      reason = 'User/role enumeration - usually should be restricted';
    }

    const entry = { action, risk, reason, enabled: true };
    
    if (risk === 'HIGH' || risk === 'MEDIUM') {
      highRisk.authenticated.push(entry);
    }

    const riskIcon = risk === 'HIGH' ? '🔴' : risk === 'MEDIUM' ? '🟡' : risk === 'REVIEW' ? '🔵' : '🟢';
    console.log(`  ${riskIcon} ${action}`);
    if (reason) console.log(`     └─ ${reason}`);
  }

  // Summary
  console.log('\n📊 AUDIT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Public role enabled permissions: ${publicEnabled.length}`);
  console.log(`  - High/Medium risk: ${highRisk.public.length}`);
  console.log(`Authenticated role enabled permissions: ${authEnabled.length}`);
  console.log(`  - High/Medium risk: ${highRisk.authenticated.length}`);

  // Save high-risk report
  const riskPath = path.join(snapshotDir, 'high-risk.json');
  fs.writeFileSync(riskPath, JSON.stringify(highRisk, null, 2));
  console.log(`\n✅ Saved high-risk report: ${riskPath}`);

  // Generate markdown audit report
  let md = `# Permissions Audit Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  
  md += `## Summary\n\n`;
  md += `| Role | Total Permissions | Enabled | High Risk | Medium Risk |\n`;
  md += `|------|-------------------|---------|-----------|-------------|\n`;
  md += `| Public | ${publicPermissions.length} | ${publicEnabled.length} | ${highRisk.public.filter(p => p.risk === 'HIGH').length} | ${highRisk.public.filter(p => p.risk === 'MEDIUM').length} |\n`;
  md += `| Authenticated | ${authenticatedPermissions.length} | ${authEnabled.length} | ${highRisk.authenticated.filter(p => p.risk === 'HIGH').length} | ${highRisk.authenticated.filter(p => p.risk === 'MEDIUM').length} |\n`;
  md += `\n`;

  md += `## Public Role - Enabled Permissions\n\n`;
  md += `| Action | Risk | Reason |\n`;
  md += `|--------|------|--------|\n`;
  for (const p of publicEnabled) {
    const hr = highRisk.public.find(h => h.action === p.action);
    const risk = hr?.risk || 'LOW';
    const reason = hr?.reason || 'Read operation';
    const riskIcon = risk === 'HIGH' ? '🔴' : risk === 'MEDIUM' ? '🟡' : '🟢';
    md += `| \`${p.action}\` | ${riskIcon} ${risk} | ${reason} |\n`;
  }
  md += `\n`;

  md += `## Authenticated Role - Enabled Permissions\n\n`;
  md += `| Action | Risk | Reason |\n`;
  md += `|--------|------|--------|\n`;
  for (const p of authEnabled) {
    const hr = highRisk.authenticated.find(h => h.action === p.action);
    const risk = hr?.risk || 'LOW';
    const reason = hr?.reason || '';
    const riskIcon = risk === 'HIGH' ? '🔴' : risk === 'MEDIUM' ? '🟡' : risk === 'REVIEW' ? '🔵' : '🟢';
    md += `| \`${p.action}\` | ${riskIcon} ${risk} | ${reason} |\n`;
  }

  const mdPath = path.join(snapshotDir, 'audit.md');
  fs.writeFileSync(mdPath, md);
  console.log(`✅ Saved audit Markdown: ${mdPath}`);

  console.log('\n✅ Phase 2 complete. Review audit.md and before.json before proceeding.');
}

main();
