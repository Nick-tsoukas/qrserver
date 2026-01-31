# Strapi Permissions System

## Overview

This document describes the permission management system for the MusicBizQR Strapi backend. The system uses a set of scripts to audit, plan, apply, and revert permission changes.

**⚠️ CRITICAL WARNING**: The permission scripts modify the database directly. Changes affect how the REST API returns data, including **relation population**. Incorrect permission changes can break features like QR code routing.

## How Strapi v4 Permissions Work

### Database Structure

Strapi v4 stores permissions in three tables:

1. **`up_roles`** - Defines roles (public, authenticated, custom roles)
2. **`up_permissions`** - Defines all possible permissions (actions)
3. **`up_permissions_role_links`** - Links permissions to roles (if linked = enabled)

### Key Concept: Permission = Action + Role Link

A permission is **enabled** for a role if there's a row in `up_permissions_role_links` linking the permission ID to the role ID. Removing this link **disables** the permission.

### Relation Population and Permissions

**This is critical**: When the REST API populates a relation (e.g., `?populate=band`), Strapi checks if the **current user's role** has permission to read the related content type.

For example, if you request:
```
GET /api/qrs?populate=band
```

Strapi will:
1. Check if you have `api::qr.qr.find` permission ✅
2. Check if you have `api::band.band.find` permission to populate the band ⚠️

If the second check fails, **the relation is silently stripped from the response** - it returns `null` even though the data exists in the database.

### entityService vs db.query

- **`strapi.entityService`** - Respects permissions, sanitizes output
- **`strapi.db.query`** - Direct database access, bypasses permissions

The admin panel uses different internal APIs that may show data even when the REST API can't access it.

## Permission Scripts

### Directory Structure

```
qrdb/scripts/
├── audit-permissions.js      # Phase 2: Audit current state
├── generate-permission-plan.js # Phase 3: Create KEEP/REMOVE/REVIEW plan
├── apply-permissions.js      # Phase 4a: Apply changes (old version)
├── apply-permissions-v2.js   # Phase 4b: Apply changes (direct DB)
├── revert-permissions.js     # Revert to before.json state
├── inventory-routes.js       # List all routes
├── check-perms.js           # Quick permission check
└── permission-snapshots/     # Snapshots and reports
    ├── before.json          # State before changes
    ├── after.json           # State after changes
    ├── permission-plan.json # The plan
    ├── permission-plan.md   # Human-readable plan
    ├── changes.md           # What was changed
    ├── audit.md             # Audit report
    └── high-risk.json       # High-risk permissions
```

### Workflow

#### Phase 1: Inventory Routes (Optional)
```bash
node scripts/inventory-routes.js
```
Lists all API routes and their handlers. Useful for understanding what endpoints exist.

#### Phase 2: Audit Permissions
```bash
node scripts/audit-permissions.js
```
- Reads the SQLite database (`.tmp/data.db`)
- Creates `before.json` snapshot
- Generates `audit.md` report
- Identifies high-risk permissions

**Output**: `permission-snapshots/before.json`, `audit.md`, `high-risk.json`

#### Phase 3: Generate Plan
```bash
node scripts/generate-permission-plan.js
```
- Reads `before.json`
- Applies rules to categorize each permission:
  - **KEEP**: Safe, should remain enabled
  - **REMOVE**: Should be disabled (auto-apply safe)
  - **REVIEW**: Needs manual decision
- Creates `permission-plan.json` and `permission-plan.md`

**Rules Applied**:
- Auth endpoints (login, register, etc.) → KEEP
- Public read for bands, events, SEO pages → KEEP
- Analytics tracking endpoints → KEEP
- User/role enumeration → REMOVE
- Public create/update/delete → REMOVE
- Upload endpoints for public → REMOVE

#### Phase 4: Apply Changes
```bash
node scripts/apply-permissions-v2.js
```
- Reads `permission-plan.json`
- Applies only REMOVE decisions
- Deletes rows from `up_permissions_role_links`
- Creates `after.json` snapshot
- Generates `changes.md` report

**⚠️ WARNING**: This modifies the database directly. Always run on local first!

#### Revert Changes
```bash
node scripts/revert-permissions.js
```
- Reads `before.json`
- Restores all permissions to their previous state
- Requires Strapi to be bootstrapped

## Safe Permission Lists

### Public Role - Safe to Keep

```javascript
// Read operations for public pages
'api::band.band.find'
'api::band.band.findOne'
'api::event.event.find'
'api::event.event.findOne'
'api::seo-page.seo-page.find'
'api::seo-page.seo-page.findOne'

// Analytics tracking (public fans)
'api::link-click.link-click.track'
'api::media-play.media-play.track'
'api::band-page-view.band-page-view.track'
'api::scan.scan.create'

// Auth flow
'plugin::users-permissions.auth.callback'
'plugin::users-permissions.auth.register'
'plugin::users-permissions.auth.forgotPassword'
'plugin::users-permissions.auth.resetPassword'
```

### Public Role - Should Remove

```javascript
// User enumeration
'plugin::users-permissions.user.find'
'plugin::users-permissions.user.findOne'
'plugin::users-permissions.user.create'

// Upload
'plugin::upload.content-api.find'
'plugin::upload.content-api.findOne'
'plugin::upload.content-api.upload'

// Any create/update/delete on content (except analytics)
'api::*.*.create' (except safe tracking endpoints)
'api::*.*.update'
'api::*.*.delete'
```

## Known Issues

### Issue: Relations Return Null via REST API

**Symptom**: Admin panel shows a relation (e.g., QR → Band), but REST API returns `null` for that relation.

**Cause**: The public role doesn't have permission to read the related content type, OR the `entityService` is sanitizing the output.

**Diagnosis**:
```javascript
// In a Strapi controller, compare:
const entityResult = await strapi.entityService.findOne('api::qr.qr', id, {
  populate: ['band'],
});
// vs
const dbResult = await strapi.db.query('api::qr.qr').findOne({
  where: { id },
  populate: ['band'],
});
// If dbResult has the relation but entityResult doesn't, it's a permission issue
```

**Fix Options**:
1. Ensure the related content type has public read permission
2. Use `strapi.db.query` instead of `entityService` for internal operations
3. Create a custom endpoint that bypasses permission sanitization

### Issue: QR Codes Routing to Homepage

**Symptom**: QR codes that should route to band pages route to the homepage instead.

**Root Cause**: The `directqr.ts` server route calls Strapi's REST API to get QR data with the band relation populated. If permissions block the band relation, it returns `null`, and the redirect falls back to the homepage.

**Fix**: Created `/api/qrs/lookup` endpoint that uses `strapi.db.query` to bypass permission sanitization. See `src/api/qr/controllers/qr.js`.

## Production Deployment

### Before Applying Permission Changes

1. **Always test locally first** with a copy of production data
2. **Create a backup** of the production database
3. **Review the plan** in `permission-plan.md`
4. **Check REVIEW items** manually before proceeding

### Applying to Production

The scripts work on the local SQLite database (`.tmp/data.db`). For production (PostgreSQL on Railway):

1. **Option A**: Run scripts locally, then manually apply the same changes via Strapi admin
2. **Option B**: Modify scripts to connect to PostgreSQL (requires DATABASE_URL)
3. **Option C**: Use Strapi's transfer feature to sync permissions

### Verifying Changes

After applying changes:

1. Test public band pages load correctly
2. Test QR code scanning routes to correct pages
3. Test user registration/login flows
4. Test authenticated user can manage their content
5. Verify analytics tracking still works

## Troubleshooting

### "Permission denied" errors

Check if the action is enabled for the role:
```bash
node scripts/check-perms.js
```

### Relations not populating

1. Check if the related content type has `find` permission for the role
2. Use the debug endpoint: `GET /api/qrs/:id/debug-band`
3. Compare `entityService` vs `db.query` results

### Reverting changes

```bash
node scripts/revert-permissions.js
```

Or manually restore from `before.json` via Strapi admin.

## File References

| File | Purpose |
|------|---------|
| `scripts/audit-permissions.js` | Audit current permissions state |
| `scripts/generate-permission-plan.js` | Generate KEEP/REMOVE/REVIEW plan |
| `scripts/apply-permissions-v2.js` | Apply permission changes to DB |
| `scripts/revert-permissions.js` | Revert to previous state |
| `src/api/qr/controllers/qr.js` | QR controller with lookup/debug endpoints |
| `src/api/qr/routes/qr-lookup.js` | Custom lookup route definition |
| `qr/server/routes/directqr.ts` | Frontend QR redirect handler |

## Changelog

- **2026-01-19**: Initial permission audit and security hardening
- **2026-01-31**: Fixed QR routing issue caused by permission sanitization blocking band relation population. Added `/api/qrs/lookup` endpoint using `db.query`.
