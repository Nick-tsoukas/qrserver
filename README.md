# MusicBizQR - Strapi Backend

Strapi CMS backend for MusicBizQR. ff

## Setup

```bash
npm install
npm run develop
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgres://...

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_DEFAULT_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_TRIAL_DAYS=30

# Email
EMAIL_DEFAULT_FROM=noreply@musicbizqr.com

# URLs
BILLING_RETURN_URL=https://musicbizqr.com/account
PUBLIC_APP_URL=https://musicbizqr.com
```

---

## Stripe & Subscription Integration

### Overview

This backend handles all Stripe subscription management including user registration, billing, and webhook processing.

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/stripe/register` | POST | No | Register new user with 30-day trial |
| `/api/stripe/subscription-status` | GET | Yes | Get current subscription status |
| `/api/stripe/create-billing-portal-session` | POST | Yes | Get Stripe billing portal URL |
| `/api/stripe/webhook` | POST | No | Stripe webhook handler |

### User Fields (Stripe-related)

| Field | Type | Description |
|-------|------|-------------|
| `customerId` | String | Stripe customer ID |
| `subscriptionId` | String | Stripe subscription ID |
| `subscriptionStatus` | Enum | `trialing`, `active`, `pastDue`, `canceled`, `unpaid` |
| `trialEndsAt` | DateTime | When trial ends |
| `gracePeriodStart` | DateTime | When grace period started (after failed payment) |
| `cancelAt` | DateTime | Scheduled cancellation date |
| `plan` | String | Plan nickname from Stripe |

### Registration Flow

**Endpoint:** `POST /api/stripe/register`

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Process:**
1. Create Stripe customer
2. Create subscription with 30-day trial
3. Create Strapi user (unconfirmed)
4. Send confirmation email
5. Update user with Stripe metadata

**Response:**
```json
{
  "user": { "id": 1, "email": "john@example.com" },
  "message": "Registration successful! Please check your email to confirm your account."
}
```

### Webhook Handler

**Endpoint:** `POST /api/stripe/webhook`

**Location:** `src/api/subscription/controllers/subscription.js`

**Handled Events:**

| Event | Handler | Action |
|-------|---------|--------|
| `checkout.session.completed` | `onCheckoutCompleted` | Sets status to `trialing` or `active` |
| `invoice.payment_succeeded` | `onInvoicePaid` | Sets status to `active`, clears grace period |
| `invoice.payment_failed` | `onInvoiceFailed` | Sets status to `pastDue`, starts grace period |
| `customer.subscription.updated` | `onSubscriptionUpdated` | Syncs status, plan, trial end, cancel date |
| `customer.subscription.deleted` | `onSubscriptionCanceled` | Sets status to `canceled` |

**Stripe Dashboard Webhook Setup:**
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://qrserver-production.up.railway.app/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### Subscription Status Flow

```
User signs up
    ↓
Status: trialing (30 days)
    ↓
Trial ends, Stripe charges card
    ↓
┌─────────────────┬─────────────────┐
│ Payment Success │ Payment Failed  │
│ Status: active  │ Status: pastDue │
└─────────────────┴─────────────────┘
```

### Billing Portal

**Endpoint:** `POST /api/stripe/create-billing-portal-session`

Returns a Stripe-hosted billing portal URL where users can:
- Update payment method
- View invoices
- Cancel subscription

---

## Stripe Connect (Merch Payments)

Separate webhook for Stripe Connect (band payouts):

**Endpoint:** `POST /api/stripe/connect/webhook`

**Location:** `src/api/stripe/controllers/connect-webhook.js`

Handles:
- `account.updated` - Updates band's `stripeOnboardingComplete` status
- `checkout.session.completed` - Finalizes merch orders, sends pickup emails

---

## Debugging

**Check user subscription in Strapi Admin:**
1. Go to Content Manager → Users
2. Find user by email
3. Check `subscriptionStatus`, `trialEndsAt`, `customerId`

**Test webhook locally:**
```bash
stripe listen --forward-to localhost:1337/api/stripe/webhook
```

**Stripe Dashboard:**
- Customers: https://dashboard.stripe.com/customers
- Subscriptions: https://dashboard.stripe.com/subscriptions
- Webhooks: https://dashboard.stripe.com/webhooks
