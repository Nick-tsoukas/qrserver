// path: src/api/subscription/controllers/subscription.js
'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const UNPARSED = Symbol.for('unparsedBody');

module.exports = {
  // GET /api/stripe/subscription-status
  async subscriptionStatus(ctx) {
    // 1) Ensure we have an authenticated user
    const jwtUser = ctx.state.user;
    if (!jwtUser) {
      return ctx.unauthorized('You must be logged in.');
    }

    // 2) Load the full user record from Strapi, including our custom fields
    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      jwtUser.id,
      { fields: ['id', 'customerId', 'subscriptionStatus', 'trialEndsAt', 'gracePeriodStart'] }
    );

    if (!user || !user.customerId) {
      return ctx.badRequest('Stripe customer not found');
    }

    try {
      // 3) Fetch the latest subscription from Stripe
      const subsList = await stripe.subscriptions.list({
        customer: user.customerId,
        status:   'all',
        limit:    1,
      });
      const sub = subsList.data[0];

      // 4) Return everything, including gracePeriodStart
      ctx.send({
        status:           sub?.status      || 'inactive',
        plan:             sub?.items[0]?.plan?.nickname || null,
        trialEndsAt:      sub?.trial_end   || null,
        gracePeriodStart: user.gracePeriodStart || null,
      });
    } catch (error) {
      strapi.log.error('[subscriptionStatus] error retrieving Stripe subscription', error);
      ctx.throw(500, 'Error retrieving subscription status');
    }
  },

  // POST /api/stripe/create-billing-portal-session
  async createBillingPortalSession(ctx) {
    strapi.log.debug('[createBillingPortalSession] entry', {
      headers: ctx.request.headers,
      query: ctx.request.query,
      body: ctx.request.body,
    });
  
    const jwtUser = ctx.state.user;
    strapi.log.debug('[createBillingPortalSession] ctx.state.user', jwtUser);
    if (!jwtUser?.id) {
      strapi.log.warn('[createBillingPortalSession] no authenticated user');
      return ctx.unauthorized('You must be logged in.');
    }
  
    // Fetch only the customerId field from the full user record
    let user;
    try {
      user = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        jwtUser.id,
        { fields: ['customerId'] }
      );
      strapi.log.debug('[createBillingPortalSession] fetched user', { id: jwtUser.id, user });
    } catch (fetchErr) {
      strapi.log.error('[createBillingPortalSession] error fetching user', fetchErr);
      return ctx.internalServerError('Error loading user data');
    }
  
    const customerId = user?.customerId;
    if (!customerId) {
      strapi.log.warn('[createBillingPortalSession] missing customerId on user', { userId: jwtUser.id });
      return ctx.badRequest('Stripe customer not found');
    }
    strapi.log.debug('[createBillingPortalSession] using customerId', customerId);
  
    try {
      strapi.log.debug('[createBillingPortalSession] calling Stripe.billingPortal.sessions.create', {
        customer: customerId,
        return_url: process.env.BILLING_RETURN_URL,
      });
      const session = await stripe.billingPortal.sessions.create({
        customer:   customerId,
        return_url: process.env.BILLING_RETURN_URL,
      });
      strapi.log.debug('[createBillingPortalSession] Stripe session created', session);
      return ctx.send({ url: session.url });
    } catch (err) {
      strapi.log.error('[createBillingPortalSession] Stripe API error', err);
      return ctx.internalServerError('Error creating billing portal session');
    }
  },
  

  // POST /webhooks/stripe
  async webhook(ctx) {
    strapi.log.debug('[Webhook] Received', { headers: ctx.request.headers });
    const signature = ctx.request.headers['stripe-signature'];
    const rawBody   = ctx.request.body[UNPARSED];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      strapi.log.debug('[Webhook] Event type:', event.type);
    } catch (err) {
      strapi.log.error('[Webhook] Signature verification failed:', err.message);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    // Dispatch to the correct handler
    const handler = {
      'checkout.session.completed':    onCheckoutCompleted,
      'invoice.payment_succeeded':     onInvoicePaid,
      'invoice.payment_failed':        onInvoiceFailed,
      'payment_intent.payment_failed': onInvoiceFailed,
      'charge.failed':                 onInvoiceFailed,
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
};

// ─── Handlers ─────────────────────────────────────────────────────────────

async function onCheckoutCompleted(session) {
  strapi.log.debug('[Webhook] checkout.session.completed', session);
  if (!session.subscription) {
    return;
  }

  const [user] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { customerId: session.customer } }
  );
  if (!user) {
    return strapi.log.warn(`[Webhook] No user for customer ${session.customer}`);
  }

  const isTrialing = Boolean(session.trial_end);
  await strapi.entityService.update(
    'plugin::users-permissions.user',
    user.id,
    {
      data: {
        subscriptionStatus: isTrialing ? 'trialing' : 'active',
        subscriptionId:     session.subscription,
        trialEndsAt:        isTrialing ? new Date(session.trial_end * 1000) : null,
      },
    }
  );
}

async function onInvoicePaid(invoice) {
  if (invoice.billing_reason === 'subscription_create' || invoice.amount_due === 0) {
    return;
  }

  const [user] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { customerId: invoice.customer } }
  );
  if (!user) return;

  await strapi.entityService.update(
    'plugin::users-permissions.user',
    user.id,
    {
      data: {
        subscriptionStatus: 'active',
        subscriptionId:     invoice.subscription,
        trialEndsAt:        null,
      },
    }
  );
}

async function onInvoiceFailed(data) {
  const [user] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { customerId: data.customer } }
  );
  if (!user) return;

  const updates = { subscriptionStatus: 'pastDue' };
  if (!user.gracePeriodStart) {
    updates.gracePeriodStart = new Date();
  }

  await strapi.entityService.update(
    'plugin::users-permissions.user',
    user.id,
    { data: updates }
  );
}

async function onSubscriptionCanceled(subscription) {
  const [user] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { subscriptionId: subscription.id } }
  );
  if (!user) return;

  await strapi.entityService.update(
    'plugin::users-permissions.user',
    user.id,
    { data: { subscriptionStatus: 'canceled' } }
  );
}

async function onUnhandledEvent(data, event) {
  strapi.log.info(`[Webhook] Unhandled event: ${event.type}`);
}
