# MBQ Smoke Test Checklist

After applying permission changes, verify these critical flows still work.

## Public Access (No Login Required)

### Band Pages
- [ ] Visit a public band page (e.g., `/neon-avenue`)
- [ ] Band info loads (name, image, bio)
- [ ] Streaming links display
- [ ] Events list displays
- [ ] Featured song/video loads
- [ ] QR code scan tracking works (scan a QR → page loads)

### Event Pages
- [ ] Visit a public event page (e.g., `/neon-avenue/event/chicago-show`)
- [ ] Event details load (title, date, venue)
- [ ] Ticket link works

### SEO/Article Pages
- [ ] Visit `/article` - article list loads
- [ ] Visit an article page - content loads
- [ ] Table of contents works

### Analytics Tracking (Public Writes)
- [ ] Link clicks are tracked (click a streaming link)
- [ ] Media plays are tracked (play a song/video)
- [ ] Page views are tracked (check analytics later)
- [ ] Share tracking works

## Authentication Flows

### Login
- [ ] Email/password login works
- [ ] Google OAuth login works (if enabled)
- [ ] Forgot password flow works
- [ ] Password reset email received

### Registration
- [ ] New user registration works
- [ ] Confirmation email received (if enabled)
- [ ] Email confirmation link works

## Authenticated Access (Logged In)

### Dashboard
- [ ] Dashboard loads after login
- [ ] User's bands list displays
- [ ] User's events list displays
- [ ] User's QR codes list displays
- [ ] Analytics charts load

### Band Management
- [ ] Can create a new band
- [ ] Can edit existing band
- [ ] Can upload band image
- [ ] Can add/edit streaming links
- [ ] Can delete band (if owner)

### Event Management
- [ ] Can create a new event
- [ ] Can edit existing event
- [ ] Can delete event (if owner)

### QR Code Management
- [ ] Can create a new QR code
- [ ] Can edit QR code settings
- [ ] Can download QR code image
- [ ] Can delete QR code (if owner)

## Stripe/Payment Flows

### Webhooks (Should NOT be affected by role permissions)
- [ ] Stripe Connect webhook still works (`/api/stripe/connect/webhook`)
- [ ] Payment confirmations work

### Subscription
- [ ] Subscription status check works
- [ ] Billing portal access works

## API Endpoints to Verify

### Should Work (Public)
```bash
# Band read
curl https://your-strapi.com/api/bands?filters[slug]=neon-avenue

# Event read
curl https://your-strapi.com/api/events?filters[slug]=chicago-show

# SEO page read
curl https://your-strapi.com/api/seo-pages?filters[slug]=my-article
```

### Should Work (Authenticated)
```bash
# User profile
curl -H "Authorization: Bearer YOUR_JWT" https://your-strapi.com/api/users/me

# User's bands
curl -H "Authorization: Bearer YOUR_JWT" https://your-strapi.com/api/bands?filters[users_permissions_user][id]=YOUR_USER_ID
```

### Should FAIL (Public - after lockdown)
```bash
# User enumeration (should return 403)
curl https://your-strapi.com/api/users

# Role enumeration (should return 403)
curl https://your-strapi.com/api/users-permissions/roles

# Create band without auth (should return 401/403)
curl -X POST https://your-strapi.com/api/bands -d '{"name":"test"}'
```

## If Something Breaks

1. **Immediate Revert:**
   ```bash
   cd qrdb
   node scripts/revert-permissions.js
   ```

2. **Check Logs:**
   - Strapi console for permission errors
   - Browser console for API errors

3. **Manual Fix:**
   - Go to Strapi Admin → Settings → Users & Permissions → Roles
   - Find the permission that needs to be re-enabled
   - Enable it and save

## Notes

- Webhook routes (`/api/stripe/connect/webhook`) use `auth: false` in route config, not role permissions
- Custom routes with `auth: false` are not affected by role permission changes
- Rate limiting should be added to public write endpoints (analytics tracking)
