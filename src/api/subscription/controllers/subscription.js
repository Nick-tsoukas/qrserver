// path: src/api/subscription/controllers/subscription.js
'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const crypto = require('crypto');
const UNPARSED = Symbol.for('unparsedBody');
const confirmationToken = crypto.randomBytes(20).toString('hex');


module.exports = {
  // GET /api/stripe/subscription-status
  async subscriptionStatus(ctx) {
    strapi.log.debug('[subscriptionStatus] entry', { jwtUser: ctx.state.user });
    const jwtUser = ctx.state.user;
    if (!jwtUser) {
      return ctx.unauthorized('You must be logged in.');
    }
  
    // Fetch the *full* user from the DB so we get customerId, trialEndsAt, etc.
    const [dbUser] = await strapi.entityService.findMany(
      'plugin::users-permissions.user',
      { filters: { id: jwtUser.id } }
    );
    if (!dbUser?.customerId) {
      strapi.log.warn('[subscriptionStatus] No Stripe customer on DB user', { dbUser });
      return ctx.badRequest('Stripe customer not found');
    }
  
    try {
      // Now pass the real customerId to Stripe
      const subsList = await stripe.subscriptions.list({
        customer: dbUser.customerId,
        status:   'all',
        limit:    1,
      });
      const sub = subsList.data[0];
  
      strapi.log.debug('[subscriptionStatus] Retrieved subscription', { subscription: sub });
  
      return ctx.send({
        status:      sub?.status        || 'inactive',
        plan:        sub?.items.data[0]?.plan?.nickname || null,
        trialEndsAt: sub?.trial_end     || null,
        // you can also return dbUser.gracePeriodStart here
        gracePeriodStart: dbUser.gracePeriodStart || null,
      });
    } catch (err) {
      strapi.log.error('[subscriptionStatus] Stripe error', err);
      return ctx.throw(500, 'Error retrieving subscription status');
    }
  },

  // POST /api/stripe/create-billing-portal-session
  async createBillingPortalSession(ctx) {
    strapi.log.debug('[createBillingPortalSession] entry', { user: ctx.state.user });
    const jwtUser = ctx.state.user;
    if (!jwtUser?.id) return ctx.unauthorized('You must be logged in.');

    let user;
    try {
      user = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        jwtUser.id,
        { fields: ['customerId'] }
      );
      strapi.log.debug('[createBillingPortalSession] loaded user', user);
    } catch (e) {
      strapi.log.error('[createBillingPortalSession] fetch error', e);
      return ctx.internalServerError('Error loading user data');
    }

    if (!user?.customerId) {
      strapi.log.warn('[createBillingPortalSession] no customerId', { userId: jwtUser.id });
      return ctx.badRequest('Stripe customer not found');
    }

    try {
      strapi.log.debug('[createBillingPortalSession] creating session for', user.customerId);
      const session = await stripe.billingPortal.sessions.create({
        customer:   user.customerId,
        return_url: process.env.BILLING_RETURN_URL,
      });
      strapi.log.debug('[createBillingPortalSession] session created', session);
      ctx.send({ url: session.url });
    } catch (err) {
      strapi.log.error('[createBillingPortalSession] Stripe error', err);
      ctx.throw(500,'Error creating billing portal session');
    }
  },

  // POST /api/stripe/webhook
  async webhook(ctx) {
    strapi.log.debug('[Webhook] Received event', { headers: ctx.request.headers });
    const sig   = ctx.request.headers['stripe-signature'];
    const raw   = ctx.request.body[UNPARSED];
    let event;

    try {
      event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
      strapi.log.debug('[Webhook] event.type', event.type);
    } catch (e) {
      strapi.log.error('[Webhook] Signature verification failed', e.message);
      return ctx.badRequest(`Webhook Error: ${e.message}`);
    }

    const handler = {
      'checkout.session.completed':    onCheckoutCompleted,
      'invoice.payment_succeeded':     onInvoicePaid,
      'invoice.payment_failed':        onInvoiceFailed,
      'payment_intent.payment_failed': onInvoiceFailed,
      'charge.failed':                 onInvoiceFailed,
      'customer.subscription.updated': onSubscriptionUpdated,
      'customer.subscription.deleted': onSubscriptionCanceled,
    }[event.type] || onUnhandledEvent;

    try {
      await handler(event.data.object, event);
    } catch (err) {
      strapi.log.error('[Webhook] Handler error for', event.type, err);
      return ctx.internalServerError('Webhook handling failed');
    }

    ctx.send({ received: true });
  },

// POST /api/stripe/register
async register(ctx) {
  strapi.log.debug('[register] entry', { body: ctx.request.body });
  const { name, email, password } = ctx.request.body;
  if (!name || !email || !password) {
    strapi.log.warn('[register] missing parameters', { name, email, password });
    return ctx.badRequest('Missing name, email or password.');
  }

  // ─── Determine Price ID ─────────────────────────────────────────
  const priceId = process.env.STRIPE_PRICE_ID || 'price_1QRHWpC26iqgLxbxvIw2311F';
  strapi.log.debug('[register] using Stripe price ID:', priceId);

  // 1️⃣ Create Stripe Customer
  let customer;
  try {
    customer = await stripe.customers.create({ email, name });
    strapi.log.info('[register] Stripe customer created', { customerId: customer.id });
  } catch (err) {
    strapi.log.error('[register] Stripe customer creation failed', err);
    return ctx.internalServerError('Failed to create Stripe customer.');
  }

  // 2️⃣ Create Subscription with 30-day trial
  let subscription;
  try {
    subscription = await stripe.subscriptions.create({
      customer:          customer.id,
      items:             [{ price: priceId }],
      trial_period_days: Number(process.env.STRIPE_TRIAL_DAYS || 30),
    });
    strapi.log.info('[register] Stripe subscription created', {
      subscriptionId: subscription.id,
      trialEndsAt:    subscription.trial_end,
    });
  } catch (err) {
    strapi.log.error('[register] Stripe subscription creation failed', err);
    return ctx.internalServerError('Failed to create Stripe subscription.');
  }

  // 3️⃣ Generate confirmation token & create Strapi user
  const confirmationToken = crypto.randomBytes(20).toString('hex');
  let newUser;
  try {
    const authRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });
    strapi.log.debug('[register] using authenticated role', { roleId: authRole.id });

    newUser = await strapi
      .plugin('users-permissions')
      .service('user')
      .add({
        username:          email,
        email,
        password,
        provider:          'local',
        confirmed:         false,
        confirmationToken, // store token for confirmation link
        role:              authRole.id,
      });
    strapi.log.info('[register] Strapi user created', { userId: newUser.id });
  } catch (err) {
    strapi.log.error('[register] Strapi user creation failed', err);
    return ctx.internalServerError('Failed to create user account.');
  }

  // 4️⃣ Send confirmation email manually
  try {
    const confirmUrl = `https://qrserver-production.up.railway.app/api/auth/confirm-email?token=${confirmationToken}`;
    strapi.log.debug('[register] sending confirmation email', { to: email, confirmUrl });
    await strapi
      .plugin('email')
      .service('email')
      .send({
        to:      email,
        from:    process.env.EMAIL_DEFAULT_FROM,
        subject: 'Please confirm your email',
        text:    `Hi ${name},\n\nPlease confirm your email by clicking the link below:\n\n${confirmUrl}\n\nThank you!`,
      });
    strapi.log.info('[register] confirmation email sent');
  } catch (err) {
    strapi.log.error('[register] failed to send confirmation email', err);
    // continue even if email fails
  }

  // 5️⃣ Update user record with Stripe metadata (best-effort)
  try {
    const trialEndsAtDate = new Date(subscription.trial_end * 1000);
    await strapi.entityService.update(
      'plugin::users-permissions.user',
      newUser.id,
      {
        data: {
          customerId:         customer.id,
          subscriptionId:     subscription.id,
          subscriptionStatus: 'trialing',
          trialEndsAt:        trialEndsAtDate,
        },
      }
    );
    strapi.log.info('[register] user updated with Stripe data', { userId: newUser.id });
  } catch (err) {
    strapi.log.error('[register] failed to update user with Stripe data', err);
  }

  // ✅ All done
  strapi.log.debug('[register] completed successfully');
  return ctx.send({
    user:    { id: newUser.id, email: newUser.email },
    message: 'Registration successful! Please check your email to confirm your account.',
  });
},

};

// ─── Handlers ────────────────────────────────────────────────────────────────

async function onCheckoutCompleted(session) {
  strapi.log.debug('[Webhook] checkout.session.completed', session.id);
  if (!session.subscription) return;
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: { customerId: session.customer }
  });
  if (!user) return strapi.log.warn('[Webhook] No user for customer', session.customer);

  const isTrial = Boolean(session.trial_end);
  await strapi.entityService.update('plugin::users-permissions.user', user.id, {
    data: {
      subscriptionStatus: isTrial ? 'trialing' : 'active',
      subscriptionId:     session.subscription,
      trialEndsAt:        isTrial ? new Date(session.trial_end * 1000) : null,
      gracePeriodStart:   null,
      cancelAt:           null
    }
  });
  strapi.log.info('[Webhook] User marked', { userId: user.id, status: isTrial ? 'trialing' : 'active' });
}

async function onInvoicePaid(invoice) {
  strapi.log.debug('[Webhook] invoice.payment_succeeded', invoice.id);
  if (invoice.billing_reason === 'subscription_create' || invoice.amount_due === 0) return;

  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: { customerId: invoice.customer }
  });
  if (!user) return;

  await strapi.entityService.update('plugin::users-permissions.user', user.id, {
    data: {
      subscriptionStatus:  'active',
      subscriptionId:      invoice.subscription,
      trialEndsAt:         null,
      gracePeriodStart:    null,
      cancelAt:            null
    }
  });
  strapi.log.info('[Webhook] User marked active', { userId: user.id });
}

async function onInvoiceFailed(data) {
  strapi.log.debug('[Webhook] invoice.payment_failed', data.id);
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: { customerId: data.customer }
  });
  if (!user) return;

  const updates = { subscriptionStatus: 'pastDue' };
  if (!user.gracePeriodStart) updates.gracePeriodStart = new Date();

  await strapi.entityService.update('plugin::users-permissions.user', user.id, { data: updates });
  strapi.log.info('[Webhook] User marked pastDue', { userId: user.id });
}

async function onSubscriptionUpdated(subscription) {
  strapi.log.debug('[Webhook] customer.subscription.updated', {
    id:                   subscription.id,
    status:               subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at:            subscription.cancel_at
  });

  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: { subscriptionId: subscription.id }
  });
  if (!user) {
    strapi.log.warn('[Webhook] No user for subscription', subscription.id);
    return;
  }

  const data = { subscriptionStatus: subscription.status };
  if (subscription.cancel_at_period_end && subscription.cancel_at) {
    data.cancelAt = new Date(subscription.cancel_at * 1000);
  }
  if (subscription.status === 'active') {
    data.gracePeriodStart = null;
    data.cancelAt = null;
  }

  await strapi.entityService.update('plugin::users-permissions.user', user.id, { data });
  strapi.log.info('[Webhook] User subscriptionStatus updated', { userId: user.id, newStatus: subscription.status });
}

async function onSubscriptionCanceled(subscription) {
  strapi.log.debug('[Webhook] customer.subscription.deleted', subscription.id);
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: { subscriptionId: subscription.id }
  });
  if (!user) return;

  await strapi.entityService.update('plugin::users-permissions.user', user.id, {
    data: { subscriptionStatus: 'canceled', gracePeriodStart: null, cancelAt: null }
  });
  strapi.log.info('[Webhook] User marked canceled', { userId: user.id });
}



async function onUnhandledEvent(data, event) {
  strapi.log.info('[Webhook] Unhandled event', event.type);
}
