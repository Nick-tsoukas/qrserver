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
async function onCheckoutCompleted(session) {
  strapi.log.debug('[Webhook Debug] checkout.session.completed', session);
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { customerId: session.customer } });
  if (!user) return strapi.log.warn(`No user for customer ${session.customer}`);
  const isTrialing = !!session.trial_end;
  await strapi.entityService.update('plugin::users-permissions.user', user.id, {
    data: { subscriptionStatus: isTrialing ? 'trialing' : 'active', subscriptionId: session.subscription, trialEndsAt: isTrialing ? new Date(session.trial_end * 1000) : null }
  });
  strapi.log.info(`[Webhook Debug] User ${user.id} subscription started`);
}

async function onInvoicePaid(invoice) {
  strapi.log.debug('[Webhook Debug] invoice.payment_succeeded', invoice);
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { customerId: invoice.customer } });
  if (!user) return strapi.log.warn(`No user for customer ${invoice.customer}`);
  await strapi.entityService.update('plugin::users-permissions.user', user.id, { data: { subscriptionStatus: 'active', subscriptionId: invoice.subscription, trialEndsAt: null } });
  strapi.log.info(`[Webhook Debug] User ${user.id} marked active`);
}

async function onInvoiceFailed(data, event) {
  strapi.log.debug(`[Webhook Debug] ${event.type}`, data);
  const customerId = data.customer;
  const [user] = await strapi.entityService.findMany('plugin::users-permissions.user', { filters: { customerId } });
  if (!user) return strapi.log.warn(`No user for customer ${customerId}`);
  await strapi.entityService.update('plugin::users-permissions.user', user.id, { data: { subscriptionStatus: 'past_due' } });
  strapi.log.info(`[Webhook Debug] User ${user.id} marked past_due`);
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
