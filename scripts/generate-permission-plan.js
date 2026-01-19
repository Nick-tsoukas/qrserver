'use strict';

/**
 * PHASE 3: Generate Permission Plan Script
 * 
 * Analyzes the audit results and creates a KEEP/REMOVE/REVIEW plan.
 * Run with: node scripts/generate-permission-plan.js
 */

const fs = require('fs');
const path = require('path');

// Known safe public read endpoints (based on Nuxt frontend usage)
const SAFE_PUBLIC_READS = [
  // Bands - public pages need to read band data
  'api::band.band.find',
  'api::band.band.findOne',
  // Events - public event pages
  'api::event.event.find',
  'api::event.event.findOne',
  // SEO pages - articles
  'api::seo-page.seo-page.find',
  'api::seo-page.seo-page.findOne',
  // How-to videos (if public)
  'api::howtovideo.howtovideo.find',
  'api::howtovideo.howtovideo.findOne',
];

// Known safe public write endpoints (analytics tracking)
const SAFE_PUBLIC_WRITES = [
  // These are public tracking endpoints - fans don't need auth
  'api::link-click.link-click.track',
  'api::media-play.media-play.track',
  'api::band-page-view.band-page-view.track',
  'api::event-page-view.event-page-view.track',
  'api::scan.scan.create', // QR scan tracking
  'api::band-share.band-share.track',
  'api::band-ui-event.band-ui-event.track',
];

// Auth endpoints that should remain public
const SAFE_AUTH_ENDPOINTS = [
  'plugin::users-permissions.auth.callback',
  'plugin::users-permissions.auth.connect',
  'plugin::users-permissions.auth.forgotPassword',
  'plugin::users-permissions.auth.resetPassword',
  'plugin::users-permissions.auth.register',
  'plugin::users-permissions.auth.emailConfirmation',
  'plugin::users-permissions.auth.sendEmailConfirmation',
];

// Endpoints that should NEVER be public
const NEVER_PUBLIC = [
  // User enumeration
  'plugin::users-permissions.user.find',
  'plugin::users-permissions.user.findOne',
  'plugin::users-permissions.role.find',
  'plugin::users-permissions.role.findOne',
  // Upload
  'plugin::upload.content-api.upload',
  'plugin::upload.content-api.destroy',
  // Any delete/update on content
];

// Authenticated role - safe defaults
const AUTH_SAFE = [
  'plugin::users-permissions.user.me',
  'plugin::users-permissions.user.update', // Update own profile
  'plugin::users-permissions.auth.changePassword',
];

function main() {
  console.log('🚀 Generating permission plan...\n');

  const snapshotDir = path.join(__dirname, 'permission-snapshots');
  const beforePath = path.join(snapshotDir, 'before.json');

  if (!fs.existsSync(beforePath)) {
    console.error('❌ before.json not found. Run audit-permissions.js first.');
    process.exit(1);
  }

  const audit = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
  
  const plan = {
    generatedAt: new Date().toISOString(),
    public: [],
    authenticated: [],
  };

  // Process Public permissions
  console.log('📋 Analyzing Public role permissions...');
  for (const perm of audit.permissions.public) {
    const action = perm.action;
    let decision = 'REVIEW';
    let reason = '';
    let risk = 'LOW';

    if (!perm.enabled) {
      decision = 'KEEP';
      reason = 'Already disabled';
      risk = 'NONE';
    }
    // Safe public reads
    else if (SAFE_PUBLIC_READS.includes(action)) {
      decision = 'KEEP';
      reason = 'Required for public band/event/article pages';
      risk = 'LOW';
    }
    // Safe public writes (analytics)
    else if (SAFE_PUBLIC_WRITES.includes(action)) {
      decision = 'KEEP';
      reason = 'Analytics tracking endpoint - needs rate limiting';
      risk = 'LOW';
    }
    // Safe auth endpoints
    else if (SAFE_AUTH_ENDPOINTS.includes(action)) {
      decision = 'KEEP';
      reason = 'Required for authentication flow';
      risk = 'LOW';
    }
    // Never public
    else if (NEVER_PUBLIC.some(np => action.includes(np)) || 
             action.includes('user.find') || 
             action.includes('role.find')) {
      decision = 'REMOVE';
      reason = 'User/role enumeration risk';
      risk = 'HIGH';
    }
    // Any create/update/delete on content types
    else if (action.includes('.create') && !SAFE_PUBLIC_WRITES.includes(action)) {
      decision = 'REMOVE';
      reason = 'Create operation should not be public';
      risk = 'HIGH';
    }
    else if (action.includes('.update')) {
      decision = 'REMOVE';
      reason = 'Update operation should not be public';
      risk = 'HIGH';
    }
    else if (action.includes('.delete')) {
      decision = 'REMOVE';
      reason = 'Delete operation should not be public';
      risk = 'HIGH';
    }
    // Upload
    else if (action.includes('upload')) {
      decision = 'REMOVE';
      reason = 'Upload should not be public';
      risk = 'HIGH';
    }
    // Generic find/findOne - review
    else if (action.includes('.find')) {
      decision = 'REVIEW';
      reason = 'Read operation - verify if content should be public';
      risk = 'MEDIUM';
    }
    else {
      decision = 'REVIEW';
      reason = 'Unknown action - needs manual review';
      risk = 'MEDIUM';
    }

    plan.public.push({
      id: perm.id,
      action,
      enabled: perm.enabled,
      decision,
      reason,
      risk,
    });
  }

  // Process Authenticated permissions
  console.log('📋 Analyzing Authenticated role permissions...');
  for (const perm of audit.permissions.authenticated) {
    const action = perm.action;
    let decision = 'REVIEW';
    let reason = '';
    let risk = 'LOW';

    if (!perm.enabled) {
      decision = 'KEEP';
      reason = 'Already disabled';
      risk = 'NONE';
    }
    // Safe auth operations
    else if (AUTH_SAFE.includes(action)) {
      decision = 'KEEP';
      reason = 'Required for user account management';
      risk = 'LOW';
    }
    // User enumeration
    else if (action === 'plugin::users-permissions.user.find') {
      decision = 'REMOVE';
      reason = 'User enumeration - not needed for normal users';
      risk = 'HIGH';
    }
    else if (action === 'plugin::users-permissions.role.find') {
      decision = 'REMOVE';
      reason = 'Role enumeration - not needed for normal users';
      risk = 'HIGH';
    }
    // Own content operations - usually OK but need ownership checks
    else if (action.includes('.create')) {
      decision = 'REVIEW';
      reason = 'Create operation - verify validation exists';
      risk = 'MEDIUM';
    }
    else if (action.includes('.update')) {
      decision = 'REVIEW';
      reason = 'Update operation - verify ownership check exists';
      risk = 'MEDIUM';
    }
    else if (action.includes('.delete')) {
      decision = 'REVIEW';
      reason = 'Delete operation - verify ownership check exists';
      risk = 'MEDIUM';
    }
    // Read operations - generally OK for authenticated users
    else if (action.includes('.find')) {
      decision = 'KEEP';
      reason = 'Read operation for authenticated users';
      risk = 'LOW';
    }
    else {
      decision = 'REVIEW';
      reason = 'Unknown action - needs manual review';
      risk = 'MEDIUM';
    }

    plan.authenticated.push({
      id: perm.id,
      action,
      enabled: perm.enabled,
      decision,
      reason,
      risk,
    });
  }

  // Save plan JSON
  const planJsonPath = path.join(snapshotDir, 'permission-plan.json');
  fs.writeFileSync(planJsonPath, JSON.stringify(plan, null, 2));
  console.log(`\n✅ Saved plan JSON: ${planJsonPath}`);

  // Generate markdown report
  let md = `# Permission Plan\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Legend\n\n`;
  md += `- **KEEP**: Permission is safe and should remain as-is\n`;
  md += `- **REMOVE**: Permission should be disabled (safe to auto-apply)\n`;
  md += `- **REVIEW**: Needs manual review before changing\n\n`;

  // Summary
  const publicRemove = plan.public.filter(p => p.decision === 'REMOVE' && p.enabled);
  const publicReview = plan.public.filter(p => p.decision === 'REVIEW' && p.enabled);
  const authRemove = plan.authenticated.filter(p => p.decision === 'REMOVE' && p.enabled);
  const authReview = plan.authenticated.filter(p => p.decision === 'REVIEW' && p.enabled);

  md += `## Summary\n\n`;
  md += `| Role | Safe Removals | Needs Review |\n`;
  md += `|------|---------------|---------------|\n`;
  md += `| Public | ${publicRemove.length} | ${publicReview.length} |\n`;
  md += `| Authenticated | ${authRemove.length} | ${authReview.length} |\n\n`;

  // Public role details
  md += `## Public Role\n\n`;
  md += `### 🔴 REMOVE (Safe to disable)\n\n`;
  if (publicRemove.length === 0) {
    md += `_None_\n\n`;
  } else {
    md += `| Action | Risk | Reason |\n`;
    md += `|--------|------|--------|\n`;
    for (const p of publicRemove) {
      md += `| \`${p.action}\` | ${p.risk} | ${p.reason} |\n`;
    }
    md += `\n`;
  }

  md += `### 🟡 REVIEW (Needs manual decision)\n\n`;
  if (publicReview.length === 0) {
    md += `_None_\n\n`;
  } else {
    md += `| Action | Risk | Reason |\n`;
    md += `|--------|------|--------|\n`;
    for (const p of publicReview) {
      md += `| \`${p.action}\` | ${p.risk} | ${p.reason} |\n`;
    }
    md += `\n`;
  }

  md += `### 🟢 KEEP\n\n`;
  const publicKeep = plan.public.filter(p => p.decision === 'KEEP' && p.enabled);
  if (publicKeep.length === 0) {
    md += `_None_\n\n`;
  } else {
    md += `| Action | Reason |\n`;
    md += `|--------|--------|\n`;
    for (const p of publicKeep) {
      md += `| \`${p.action}\` | ${p.reason} |\n`;
    }
    md += `\n`;
  }

  // Authenticated role details
  md += `## Authenticated Role\n\n`;
  md += `### 🔴 REMOVE (Safe to disable)\n\n`;
  if (authRemove.length === 0) {
    md += `_None_\n\n`;
  } else {
    md += `| Action | Risk | Reason |\n`;
    md += `|--------|------|--------|\n`;
    for (const p of authRemove) {
      md += `| \`${p.action}\` | ${p.risk} | ${p.reason} |\n`;
    }
    md += `\n`;
  }

  md += `### 🟡 REVIEW (Needs manual decision)\n\n`;
  if (authReview.length === 0) {
    md += `_None_\n\n`;
  } else {
    md += `| Action | Risk | Reason |\n`;
    md += `|--------|------|--------|\n`;
    for (const p of authReview) {
      md += `| \`${p.action}\` | ${p.risk} | ${p.reason} |\n`;
    }
    md += `\n`;
  }

  md += `### 🟢 KEEP\n\n`;
  const authKeep = plan.authenticated.filter(p => p.decision === 'KEEP' && p.enabled);
  if (authKeep.length === 0) {
    md += `_None_\n\n`;
  } else {
    md += `| Action | Reason |\n`;
    md += `|--------|--------|\n`;
    for (const p of authKeep) {
      md += `| \`${p.action}\` | ${p.reason} |\n`;
    }
  }

  const planMdPath = path.join(snapshotDir, 'permission-plan.md');
  fs.writeFileSync(planMdPath, md);
  console.log(`✅ Saved plan Markdown: ${planMdPath}`);

  // Print summary
  console.log('\n📊 PLAN SUMMARY');
  console.log('═'.repeat(60));
  console.log(`\nPublic Role:`);
  console.log(`  🔴 Safe to REMOVE: ${publicRemove.length}`);
  console.log(`  🟡 Needs REVIEW: ${publicReview.length}`);
  console.log(`  🟢 KEEP: ${publicKeep.length}`);
  console.log(`\nAuthenticated Role:`);
  console.log(`  🔴 Safe to REMOVE: ${authRemove.length}`);
  console.log(`  🟡 Needs REVIEW: ${authReview.length}`);
  console.log(`  🟢 KEEP: ${authKeep.length}`);

  console.log('\n✅ Phase 3 complete. Review permission-plan.md before applying changes.');
}

main();
