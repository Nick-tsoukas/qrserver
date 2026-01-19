'use strict';

/**
 * PHASE 1: Route Inventory Script
 * 
 * Scans the filesystem to discover all routes without needing database.
 * Run with: node scripts/inventory-routes.js
 */

const fs = require('fs');
const path = require('path');

function main() {
  console.log('🚀 Scanning filesystem for route inventory...\n');

  const routes = [];
  const contentTypes = [];
  const srcApi = path.join(__dirname, '..', 'src', 'api');

  // 1. Collect API routes from filesystem
  console.log('📦 Collecting API routes...');
  
  if (fs.existsSync(srcApi)) {
    const apiDirs = fs.readdirSync(srcApi).filter(f => {
      const stat = fs.statSync(path.join(srcApi, f));
      return stat.isDirectory() && f !== '.gitkeep';
    });

    for (const apiName of apiDirs) {
      const routesDir = path.join(srcApi, apiName, 'routes');
      const contentTypesDir = path.join(srcApi, apiName, 'content-types');
      
      // Check for content-type schema
      if (fs.existsSync(contentTypesDir)) {
        const ctDirs = fs.readdirSync(contentTypesDir).filter(f => 
          fs.statSync(path.join(contentTypesDir, f)).isDirectory()
        );
        for (const ctName of ctDirs) {
          const schemaPath = path.join(contentTypesDir, ctName, 'schema.json');
          if (fs.existsSync(schemaPath)) {
            try {
              const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
              contentTypes.push({
                uid: `api::${apiName}.${ctName}`,
                singularName: schema.info?.singularName || ctName,
                pluralName: schema.info?.pluralName || ctName + 's',
                kind: schema.kind || 'collectionType',
                draftAndPublish: schema.options?.draftAndPublish || false,
              });
            } catch (e) {
              console.warn(`  ⚠️ Could not parse ${schemaPath}`);
            }
          }
        }
      }

      // Check for route files
      if (fs.existsSync(routesDir)) {
        const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
        
        for (const routeFile of routeFiles) {
          const routePath = path.join(routesDir, routeFile);
          try {
            const routeModule = require(routePath);
            const routeKey = routeFile.replace('.js', '');
            
            // Handle both { routes: [...] } and direct array
            const routeList = routeModule.routes || (Array.isArray(routeModule) ? routeModule : []);
            
            for (const route of routeList) {
              routes.push({
                scope: `api::${apiName}`,
                routeKey,
                method: route.method || 'GET',
                path: route.path,
                handler: route.handler,
                config: route.config || {},
                policies: route.config?.policies || [],
                middlewares: route.config?.middlewares || [],
                auth: route.config?.auth,
                isPublicByConfig: route.config?.auth === false,
              });
            }
          } catch (e) {
            console.warn(`  ⚠️ Could not load ${routePath}: ${e.message}`);
          }
        }
      }
      
      // Add default CRUD routes for content types
      const ctSchema = path.join(srcApi, apiName, 'content-types', apiName, 'schema.json');
      if (fs.existsSync(ctSchema)) {
        try {
          const schema = JSON.parse(fs.readFileSync(ctSchema, 'utf8'));
          const pluralName = schema.info?.pluralName || apiName + 's';
          
          // Default Strapi CRUD routes
          const defaultRoutes = [
            { method: 'GET', path: `/${pluralName}`, handler: `${apiName}.find` },
            { method: 'GET', path: `/${pluralName}/:id`, handler: `${apiName}.findOne` },
            { method: 'POST', path: `/${pluralName}`, handler: `${apiName}.create` },
            { method: 'PUT', path: `/${pluralName}/:id`, handler: `${apiName}.update` },
            { method: 'DELETE', path: `/${pluralName}/:id`, handler: `${apiName}.delete` },
          ];
          
          for (const route of defaultRoutes) {
            // Check if not already added by custom routes
            const exists = routes.some(r => 
              r.scope === `api::${apiName}` && 
              r.method === route.method && 
              r.path === route.path
            );
            if (!exists) {
              routes.push({
                scope: `api::${apiName}`,
                routeKey: 'default',
                method: route.method,
                path: `/api${route.path}`,
                handler: route.handler,
                config: {},
                policies: [],
                middlewares: [],
                auth: undefined,
                isPublicByConfig: false,
              });
            }
          }
        } catch (e) {
          // Skip if can't parse
        }
      }
    }
  }

  // 2. Note about plugin routes
  console.log('🔌 Plugin routes (users-permissions, upload) use Strapi defaults...');
  
  // Add known users-permissions routes
  const usersPermissionsRoutes = [
    { method: 'POST', path: '/api/auth/local', handler: 'auth.callback' },
    { method: 'POST', path: '/api/auth/local/register', handler: 'auth.register' },
    { method: 'GET', path: '/api/auth/:provider/callback', handler: 'auth.callback' },
    { method: 'POST', path: '/api/auth/forgot-password', handler: 'auth.forgotPassword' },
    { method: 'POST', path: '/api/auth/reset-password', handler: 'auth.resetPassword' },
    { method: 'POST', path: '/api/auth/change-password', handler: 'auth.changePassword' },
    { method: 'GET', path: '/api/auth/email-confirmation', handler: 'auth.emailConfirmation' },
    { method: 'POST', path: '/api/auth/send-email-confirmation', handler: 'auth.sendEmailConfirmation' },
    { method: 'GET', path: '/api/users', handler: 'user.find' },
    { method: 'GET', path: '/api/users/me', handler: 'user.me' },
    { method: 'GET', path: '/api/users/:id', handler: 'user.findOne' },
    { method: 'PUT', path: '/api/users/:id', handler: 'user.update' },
    { method: 'DELETE', path: '/api/users/:id', handler: 'user.destroy' },
    { method: 'GET', path: '/api/users-permissions/roles', handler: 'role.find' },
    { method: 'GET', path: '/api/users-permissions/roles/:id', handler: 'role.findOne' },
  ];
  
  for (const route of usersPermissionsRoutes) {
    routes.push({
      scope: 'plugin::users-permissions',
      routeKey: 'users-permissions',
      method: route.method,
      path: route.path,
      handler: route.handler,
      config: {},
      policies: [],
      middlewares: [],
      auth: undefined,
      isPublicByConfig: false,
    });
  }
  
  // Add known upload routes
  const uploadRoutes = [
    { method: 'POST', path: '/api/upload', handler: 'content-api.upload' },
    { method: 'GET', path: '/api/upload/files', handler: 'content-api.find' },
    { method: 'GET', path: '/api/upload/files/:id', handler: 'content-api.findOne' },
    { method: 'DELETE', path: '/api/upload/files/:id', handler: 'content-api.destroy' },
  ];
  
  for (const route of uploadRoutes) {
    routes.push({
      scope: 'plugin::upload',
      routeKey: 'upload',
      method: route.method,
      path: route.path,
      handler: route.handler,
      config: {},
      policies: [],
      middlewares: [],
      auth: undefined,
      isPublicByConfig: false,
    });
  }

  // Sort routes by scope then path
  routes.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
    return a.path.localeCompare(b.path);
  });

  // Save JSON
  const snapshotDir = path.join(__dirname, 'permission-snapshots');
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const jsonPath = path.join(snapshotDir, 'routes.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ routes, contentTypes, generatedAt: new Date().toISOString() }, null, 2));
  console.log(`\n✅ Saved routes JSON: ${jsonPath}`);

  // Generate Markdown report
  const mdPath = path.join(snapshotDir, 'routes.md');
  let md = `# Route Inventory Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `**Total Routes:** ${routes.length}\n\n`;

  // Group by scope
  const byScope = {};
  for (const r of routes) {
    if (!byScope[r.scope]) byScope[r.scope] = [];
    byScope[r.scope].push(r);
  }

  // API Routes section
  md += `## API Routes\n\n`;
  for (const [scope, scopeRoutes] of Object.entries(byScope).filter(([s]) => s.startsWith('api::'))) {
    md += `### ${scope}\n\n`;
    md += `| Method | Path | Handler | Auth Config | Policies |\n`;
    md += `|--------|------|---------|-------------|----------|\n`;
    for (const r of scopeRoutes) {
      const authStr = r.isPublicByConfig ? '🔓 PUBLIC' : (r.auth ? JSON.stringify(r.auth) : 'default');
      const policiesStr = r.policies.length ? r.policies.join(', ') : '-';
      md += `| ${r.method} | \`${r.path}\` | ${r.handler} | ${authStr} | ${policiesStr} |\n`;
    }
    md += `\n`;
  }

  // Plugin Routes section
  md += `## Plugin Routes\n\n`;
  for (const [scope, scopeRoutes] of Object.entries(byScope).filter(([s]) => s.startsWith('plugin::'))) {
    md += `### ${scope}\n\n`;
    md += `| Method | Path | Handler | Auth Config | Policies |\n`;
    md += `|--------|------|---------|-------------|----------|\n`;
    for (const r of scopeRoutes) {
      const authStr = r.isPublicByConfig ? '🔓 PUBLIC' : (r.auth ? JSON.stringify(r.auth) : 'default');
      const policiesStr = r.policies.length ? r.policies.join(', ') : '-';
      md += `| ${r.method} | \`${r.path}\` | ${r.handler} | ${authStr} | ${policiesStr} |\n`;
    }
    md += `\n`;
  }

  // Content Types section
  md += `## Content Types\n\n`;
  md += `| UID | Singular | Plural | Kind | Draft & Publish |\n`;
  md += `|-----|----------|--------|------|------------------|\n`;
  for (const ct of contentTypes) {
    md += `| ${ct.uid} | ${ct.singularName} | ${ct.pluralName} | ${ct.kind} | ${ct.draftAndPublish} |\n`;
  }

  fs.writeFileSync(mdPath, md);
  console.log(`✅ Saved routes Markdown: ${mdPath}`);

  // Print summary
  console.log('\n📊 ROUTE INVENTORY SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Total routes: ${routes.length}`);
  console.log(`API scopes: ${Object.keys(byScope).filter(s => s.startsWith('api::')).length}`);
  console.log(`Plugin scopes: ${Object.keys(byScope).filter(s => s.startsWith('plugin::')).length}`);
  console.log(`Content types: ${contentTypes.length}`);
  
  const publicByConfig = routes.filter(r => r.isPublicByConfig);
  console.log(`\n🔓 Routes with auth:false (public by config): ${publicByConfig.length}`);
  for (const r of publicByConfig) {
    console.log(`   ${r.method.padEnd(6)} ${r.path}`);
  }

  console.log('\n✅ Phase 1 complete. Review routes.md and routes.json before proceeding.');
}

main();
