// path: src/api/subscription/controllers/subscription.js
'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

module.exports = {
  // GET /api/subscription/status
  async subscriptionStatus(ctx) {
    const user = ctx.state.user;
    if (!user || !user.customerId) {
      return ctx.badRequest('Stripe customer not found');
    }
    const subs = await stripe.subscriptions.list({
      customer: user.customerId,
      status: 'all',
      limit: 1,
    });
    const subscription = subs.data[0];
    ctx.send({
      status: subscription?.status || 'inactive',
      plan: subscription?.items.data[0].plan.nickname || null,
      trialEndsAt: subscription?.trial_end || null,
    });
  },

  // POST /api/billing/portal-session
  async createBillingPortalSession(ctx) {
    const user = ctx.state.user;
    if (!user || !user.customerId) {
      return ctx.badRequest('Stripe customer not found');
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: process.env.BILLING_RETURN_URL,
    });
    ctx.send({ url: session.url });
  },

  // POST /webhooks/stripe
  async webhook(ctx) {
    // Pull in the raw request-body buffer for signature verification
    const rawBody = ctx.request.body[Symbol.for('unparsedBody')];
    const signature = ctx.request.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('⚠️  Webhook signature verification failed.', err.message);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // TODO: mark the user as confirmed, create subscription record, etc.
        console.log('✅ Checkout session completed for customer:', session.customer);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // TODO: update subscription status in your database
        console.log('✅ Invoice paid:', invoice.id);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        // TODO: mark subscription inactive in your database
        console.log('⚠️ Subscription canceled:', subscription.id);
        break;
      }
      default:
        console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
    }

    // Acknowledge receipt of the event
    ctx.send({ received: true });
  },
};
