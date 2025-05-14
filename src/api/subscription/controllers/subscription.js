// path: src/api/subscription/controllers/subscription.js
'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const UNPARSED = Symbol.for('unparsedBody');

// Map of event types to handler functions
const eventHandlers = {
  'checkout.session.completed':      onCheckoutCompleted,
  'invoice.payment_succeeded':       onInvoicePaid,
  'invoice.payment_failed':          onInvoiceFailed,
  'payment_intent.payment_failed':   onInvoiceFailed,
  'charge.failed':                   onInvoiceFailed,
  'customer.subscription.deleted':   onSubscriptionCanceled,
};

module.exports = {
  // GET /api/subscription/status
  async subscriptionStatus(ctx) {
    const user = ctx.state.user;
    if (!user || !user.customerId) return ctx.badRequest('Stripe customer not found');
    try {
      const subsList = await stripe.subscriptions.list({ customer: user.customerId, status: 'all', limit: 1 });
      const sub = subsList.data[0];
      ctx.send({
        status:      sub?.status      || 'inactive',
        plan:        sub?.items.data[0].plan.nickname || null,
        trialEndsAt: sub?.trial_end   || null,
      });
    } catch (error) {
      strapi.log.error('[Webhook Debug] subscriptionStatus error:', error);
      ctx.throw(500, 'Error retrieving subscription status');
    }
  },

  // POST /api/billing/portal-session
  async createBillingPortalSession(ctx) {
    const user = ctx.state.user;
    if (!user || !user.customerId) return ctx.badRequest('Stripe customer not found');
    try {
      const session = await stripe.billingPortal.sessions.create({ customer: user.customerId, return_url: process.env.BILLING_RETURN_URL });
      ctx.send({ url: session.url });
    } catch (error) {
      strapi.log.error('[Webhook Debug] createBillingPortalSession error:', error);
      ctx.throw(500, 'Error creating billing portal session');
    }
  },

  // POST /webhooks/stripe
  async webhook(ctx) {
    strapi.log.debug('[Webhook Debug] Received webhook', { headers: ctx.request.headers });
    const signature = ctx.request.headers['stripe-signature'];
    const rawBody   = ctx.request.body[UNPARSED];
    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
      strapi.log.debug('[Webhook Debug] Event type:', event.type);
    } catch (err) {
      strapi.log.error('[Webhook Debug] Signature verification failed:', err.message);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    const handler = eventHandlers[event.type] || onUnhandledEvent;
    try {
      await handler(event.data.object, event);
    } catch (err) {
      strapi.log.error('[Webhook Debug] Handler error for', event.type, err);
      return ctx.internalServerError('Webhook handling failed');
    }

    ctx.send({ received: true });
  },
};

// ─── Handlers ────────────────────────────────────────────────────────────────
// ─── onCheckoutCompleted ───────────────────────────────────────────────────
async function onCheckoutCompleted(session) {
  strapi.log.debug('[Webhook Debug] checkout.session.completed received', {
    id: session.id,
    mode: session.mode,
    customer: session.customer,
    trial_end: session.trial_end,
  });

  // ◼️ Only handle sessions that actually start a subscription
  if (!session.subscription) {
    strapi.log.info(
      `[Webhook Debug] Skipping checkout.session.completed (no subscription): mode=${session.mode}`
    );
    return;
  }

  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: { customerId: session.customer },
  });
  if (!user) {
    strapi.log.warn(`[Webhook Debug] No user found for customer ${session.customer}`);
    return;
  }

  const isTrialing = Boolean(session.trial_end);
  strapi.log.debug('[Webhook Debug] Updating subscription state', {
    userId: user.id,
    isTrialing,
    trialEndUnix: session.trial_end,
  });

  await strapi.entityService.update('plugin::users-permissions.user', user.id, {
    data: {
      subscriptionStatus: isTrialing ? 'trialing' : 'active',
      subscriptionId:     session.subscription,
      trialEndsAt:        isTrialing ? new Date(session.trial_end * 1000) : null,
    },
  });

  strapi.log.info(
    `[Webhook Debug] User ${user.id} marked ${isTrialing ? 'trialing' : 'active'}`
  );
}

// ─── onInvoicePaid ───────────────────────────────────────────────────────────
async function onInvoicePaid(invoice) {
  strapi.log.debug('[Webhook Debug] invoice.payment_succeeded', invoice);

  // ○ Skip the initial trial‐creation invoice (no real charge)
  if (invoice.billing_reason === 'subscription_create' || invoice.amount_due === 0) {
    strapi.log.info('[Webhook Debug] Skipping initial subscription invoice');
    return;
  }

  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: { customerId: invoice.customer },
  });
  if (!user) {
    return strapi.log.warn(`[Webhook Debug] No user for customer ${invoice.customer}`);
  }

  await strapi.entityService.update('plugin::users-permissions.user', user.id, {
    data: {
      subscriptionStatus: 'active',
      subscriptionId:     invoice.subscription,
      trialEndsAt:        null,
    },
  });

  strapi.log.info(`[Webhook Debug] User ${user.id} marked active on invoice payment`);
}



// async function onInvoicePaid(invoice) {
//   strapi.log.debug('[Webhook Debug] invoice.payment_succeeded', invoice);
//   const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { customerId: invoice.customer } });
//   if (!user) return strapi.log.warn(`No user for customer ${invoice.customer}`);
//   await strapi.entityService.update('plugin::users-permissions.user', user.id, { data: { subscriptionStatus: 'active', subscriptionId: invoice.subscription, trialEndsAt: null } });
//   strapi.log.info(`[Webhook Debug] User ${user.id} marked active`);
// }

async function onInvoiceFailed(data, event) {
  strapi.log.debug(`[Webhook Debug] ${event.type}`, data);
  const customerId = data.customer;
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { customerId } });
  if (!user) return strapi.log.warn(`No user for customer ${customerId}`);
  await strapi.entityService.update('plugin::users-permissions.user', user.id, { data: { subscriptionStatus: 'pastDue' } });
  strapi.log.info(`[Webhook Debug] User ${user.id} marked pastDue`);
}

async function onSubscriptionCanceled(subscription) {
  strapi.log.debug('[Webhook Debug] customer.subscription.deleted', subscription);
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { subscriptionId: subscription.id } });
  if (!user) return strapi.log.warn(`No user for subscription ${subscription.id}`);
  await strapi.entityService.update('plugin::users-permissions.user', user.id, { data: { subscriptionStatus: 'canceled' } });
  strapi.log.info(`[Webhook Debug] User ${user.id} canceled`);
}

async function onUnhandledEvent(data, event) {
  strapi.log.info(`[Webhook Debug] Unhandled event type: ${event.type}`);
}
