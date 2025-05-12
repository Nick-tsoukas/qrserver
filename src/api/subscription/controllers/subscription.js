// path: src/api/subscription/controllers/subscription.js
'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const UNPARSED = Symbol.for('unparsedBody');

// Map of specific event handlers
const eventHandlers = {
  'checkout.session.completed': onCheckoutCompleted,
  'invoice.payment_succeeded':  onInvoicePaid,
  'customer.subscription.deleted': onSubscriptionCanceled,
};

module.exports = {
  // GET /api/subscription/status
  async subscriptionStatus(ctx) {
    strapi.log.debug('[Webhook Debug] Entered subscriptionStatus');
    const user = ctx.state.user;
    strapi.log.debug('[Webhook Debug] Current user:', user);
    if (!user || !user.customerId) {
      strapi.log.warn('[Webhook Debug] No user or missing customerId');
      return ctx.badRequest('Stripe customer not found');
    }

    try {
      const subsList = await stripe.subscriptions.list({
        customer: user.customerId,
        status: 'all',
        limit: 1,
      });
      const sub = subsList.data[0];
      strapi.log.debug('[Webhook Debug] Retrieved subscription:', sub);

      ctx.send({
        status:      sub?.status      || 'inactive',
        plan:        sub?.items.data[0].plan.nickname || null,
        trialEndsAt: sub?.trial_end   || null,
      });
    } catch (error) {
      strapi.log.error('[Webhook Debug] Error listing subscriptions:', error);
      ctx.throw(500, 'Error retrieving subscription status');
    }
  },

  // POST /api/billing/portal-session
  async createBillingPortalSession(ctx) {
    strapi.log.debug('[Webhook Debug] Entered createBillingPortalSession');
    const user = ctx.state.user;
    strapi.log.debug('[Webhook Debug] Current user:', user);
    if (!user || !user.customerId) {
      strapi.log.warn('[Webhook Debug] No user or missing customerId');
      return ctx.badRequest('Stripe customer not found');
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer:   user.customerId,
        return_url: process.env.BILLING_RETURN_URL,
      });
      strapi.log.debug('[Webhook Debug] Created billing portal session:', session);

      ctx.send({ url: session.url });
    } catch (error) {
      strapi.log.error('[Webhook Debug] Error creating billing portal session:', error);
      ctx.throw(500, 'Error creating billing portal session');
    }
  },

  // POST /webhooks/stripe
  async webhook(ctx) {
    strapi.log.debug('[Webhook Debug] Received webhook request', {
      headers: ctx.request.headers,
      body:    ctx.request.body,
    });

    const signature = ctx.request.headers['stripe-signature'];
    strapi.log.debug('[Webhook Debug] Stripe signature header:', signature);

    const rawBody = ctx.request.body[UNPARSED];
    if (!rawBody) {
      strapi.log.error('[Webhook Debug] Raw body missing or not parsed');
    } else {
      strapi.log.debug('[Webhook Debug] Raw body length:', rawBody.length);
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      strapi.log.debug('[Webhook Debug] Successfully constructed Stripe event:', event);
    } catch (err) {
      strapi.log.error('[Webhook Debug] Stripe signature verification failed:', err.message);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    try {
      const handler = eventHandlers[event.type] || onUnhandledEvent;
      await handler(event.data.object, event);
    } catch (err) {
      strapi.log.error('[Webhook Debug] Error in handler:', err);
      return ctx.internalServerError('Webhook handling failed');
    }

    strapi.log.debug('[Webhook Debug] Webhook processed successfully, sending ack');
    ctx.send({ received: true });
  },
};

// ─── Handlers ────────────────────────────────────────────────────────────────

async function onCheckoutCompleted(session) {
  strapi.log.debug('[Webhook Debug] Handling checkout.session.completed', session);
  const customerId     = session.customer;
  const subscriptionId = session.subscription;
  const isTrialing     = !!session.trial_end;
  strapi.log.debug(`[Webhook Debug] customerId=${customerId}, subscriptionId=${subscriptionId}, isTrialing=${isTrialing}`);

  const [user] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { customerId } }
  );
  if (!user) {
    return strapi.log.warn(`[Webhook Debug] No Strapi user for Stripe customer ${customerId}`);
  }

  try {
    await strapi.entityService.update(
      'plugin::users-permissions.user',
      user.id,
      {
        data: {
          subscriptionStatus: isTrialing ? 'trialing' : 'active',
          subscriptionId,
          trialEndsAt: isTrialing ? new Date(session.trial_end * 1000) : null,
        },
      }
    );
    strapi.log.info(`[Webhook Debug] User ${user.id} subscription updated to ${isTrialing ? 'trialing' : 'active'}`);
  } catch (error) {
    strapi.log.error('[Webhook Debug] Error updating user subscription:', error);
  }
}

async function onInvoicePaid(invoice) {
  strapi.log.debug('[Webhook Debug] Handling invoice.payment_succeeded', invoice);
  const customerId     = invoice.customer;
  const subscriptionId = invoice.subscription;
  strapi.log.debug(`[Webhook Debug] customerId=${customerId}, subscriptionId=${subscriptionId}`);

  const [user] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { customerId } }
  );
  if (!user) {
    return strapi.log.warn(`[Webhook Debug] No Strapi user for Invoice customer ${customerId}`);
  }

  try {
    await strapi.entityService.update(
      'plugin::users-permissions.user',
      user.id,
      {
        data: { subscriptionStatus: 'active', subscriptionId, trialEndsAt: null },
      }
    );
    strapi.log.info(`[Webhook Debug] User ${user.id} moved from trial to active`);
  } catch (error) {
    strapi.log.error('[Webhook Debug] Error updating user after invoice paid:', error);
  }
}

async function onSubscriptionCanceled(subscription) {
  strapi.log.debug('[Webhook Debug] Handling customer.subscription.deleted', subscription);
  const subscriptionId = subscription.id;
  strapi.log.debug(`[Webhook Debug] subscriptionId=${subscriptionId}`);

  const [user] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { subscriptionId } }
  );
  if (!user) {
    return strapi.log.warn(`[Webhook Debug] No Strapi user for canceled subscription ${subscriptionId}`);
  }

  try {
    await strapi.entityService.update(
      'plugin::users-permissions.user',
      user.id,
      { data: { subscriptionStatus: 'canceled' } }
    );
    strapi.log.info(`[Webhook Debug] User ${user.id} subscription canceled`);
  } catch (error) {
    strapi.log.error('[Webhook Debug] Error updating user on subscription canceled:', error);
  }
}

async function onUnhandledEvent(data, event) {
  strapi.log.info(`[Webhook Debug] Unhandled event type: ${event.type}`, data);
}
