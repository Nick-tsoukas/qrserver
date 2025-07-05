// path: src/api/subscription/controllers/subscription.js
'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const UNPARSED = Symbol.for('unparsedBody');

module.exports = {
  // GET /api/stripe/subscription-status
  async subscriptionStatus(ctx) {
    const jwtUser = ctx.state.user;
    if (!jwtUser) return ctx.unauthorized('You must be logged in.');

    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      jwtUser.id,
      { fields: ['customerId','subscriptionStatus','trialEndsAt','gracePeriodStart','cancelAt'] }
    );
    if (!user?.customerId) return ctx.badRequest('Stripe customer not found');

    try {
      const subs = await stripe.subscriptions.list({
        customer: user.customerId,
        status:   'all',
        limit:    1,
      });
      const sub = subs.data[0];
      ctx.send({
        status:           sub?.status      || 'inactive',
        plan:             sub?.items[0]?.plan?.nickname || null,
        trialEndsAt:      sub?.trial_end   || null,
        gracePeriodStart: user.gracePeriodStart || null,
        cancelAt:         user.cancelAt || null,
      });
    } catch (err) {
      strapi.log.error('[subscriptionStatus] Stripe error', err);
      ctx.throw(500,'Error retrieving subscription status');
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
    return ctx.badRequest('Missing name, email or password');
  }

  // 1️⃣ Create the Strapi user
  const authRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });
  const newUser = await strapi
    .plugin('users-permissions')
    .service('user')
    .add({
      username: email,
      email,
      password,
      provider: 'local',
      confirmed: false,
      role: authRole.id,
    });
  strapi.log.info('[register] Strapi user created', { userId: newUser.id });

  // 2️⃣ Create a Stripe customer
  const customer = await stripe.customers.create({ email, name });
  strapi.log.info('[register] Stripe customer created', { customerId: customer.id });

  // 3️⃣ Create a subscription with 30-day trial
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: process.env.STRIPE_PRICE_ID }],
    trial_period_days: Number(process.env.STRIPE_TRIAL_DAYS || 30),
  });
  strapi.log.info('[register] Stripe subscription created', { subscriptionId: subscription.id });

  // 4️⃣ Update the Strapi user with Stripe data
  const trialEndsAt = new Date(subscription.trial_end * 1000);
  await strapi.entityService.update(
    'plugin::users-permissions.user',
    newUser.id,
    {
      data: {
        customerId:         customer.id,
        subscriptionId:     subscription.id,
        subscriptionStatus: 'trialing',
        trialEndsAt,
      },
    }
  );

  strapi.log.info('[register] User updated with Stripe data', { userId: newUser.id });

  // 5️⃣ Send confirmation email (optional)
  await strapi.plugin('email').service('email').send({
    to:      email,
    from:    'no-reply@yourdomain.com',
    subject: 'Please confirm your email',
    text:    `Hi ${name}, please confirm your email by clicking here: https://your-app.com/confirm?uid=${newUser.id}`,
  });

  return ctx.send({ user: { id: newUser.id, email: newUser.email } });
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
