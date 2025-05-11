'use strict';

const Stripe = require('stripe');
const crypto = require('crypto');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

module.exports = {
  // 1) Check subscription status
  async subscriptionStatus(ctx) {
    const user = ctx.state.user;
    console.log("🔍 Checking subscription status for user:", user?.email);

    if (!user || !user.customerId) {
      console.warn("⚠️ No Stripe customer ID found for user.");
      return ctx.badRequest("Stripe customer not found");
    }

    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.customerId,
        status: 'all',
        limit: 1,
      });
      const subscription = subscriptions.data[0];
      console.log("✅ Stripe subscription retrieved:", subscription?.id);

      return ctx.send({
        status: subscription ? subscription.status : 'inactive',
        plan:   subscription ? subscription.items.data[0].plan.nickname : null,
        trialEndsAt: subscription ? subscription.trial_end : null,
      });
    } catch (error) {
      console.error("❌ Stripe fetch error (subscriptionStatus):", error);
      ctx.throw(500, "Error retrieving subscription status");
    }
  },

  // 2) Retrieve billing info
  async getBillingInfo(ctx) {
    const user = ctx.state.user;
    console.log("🔍 Retrieving billing info for:", user?.email);

    if (!user || !user.customerId) {
      console.warn("⚠️ No Stripe customer ID found for billing info request.");
      return ctx.badRequest("Stripe customer not found");
    }

    try {
      const customer = await stripe.customers.retrieve(user.customerId);
      const subscriptions = await stripe.subscriptions.list({
        customer: user.customerId,
        status: 'all',
        limit: 1,
      });
      const subscription = subscriptions.data[0];
      console.log("✅ Billing info retrieved for:", customer.id);

      return ctx.send({
        customer,
        subscription,
        trialEndsAt: user.trialEndsAt,
      });
    } catch (error) {
      console.error("❌ Stripe fetch error (getBillingInfo):", error);
      ctx.throw(500, "Error retrieving billing information");
    }
  },

  // 3) Create a Stripe Billing Portal session
  async createBillingPortalSession(ctx) {
    const user = ctx.state.user;
    console.log("🌀 Creating billing portal for:", user?.email);

    if (!user || !user.customerId) {
      console.warn("⚠️ No Stripe customer ID for billing portal.");
      return ctx.badRequest("Stripe customer not found for user");
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer:   user.customerId,
        return_url: process.env.BILLING_RETURN_URL || 'https://musicbizqr.com/account',
      });
      console.log("✅ Billing portal session created:", session.id);
      return ctx.send({ url: session.url });
    } catch (error) {
      console.error("❌ Stripe Billing Portal Error:", error);
      ctx.throw(500, "Unable to create billing portal session");
    }
  },

  // 4) Create a Stripe Customer
  async createCustomer(ctx) {
    try {
      const { email, name } = ctx.request.body;
      if (!email || !name) {
        return ctx.badRequest("Missing email or name.");
      }
      const customer = await stripe.customers.create({ email, name });
      console.log("✅ Stripe customer created:", customer.id);
      return ctx.send({ customerId: customer.id });
    } catch (error) {
      console.error("❌ Error creating Stripe customer:", error);
      ctx.throw(500, "Failed to create Stripe customer");
    }
  },

  // 5) Create a Checkout Session (for card setup)
  async createCheckoutSession(ctx) {
    try {
      const { customerId } = ctx.request.body;
      if (!customerId) {
        return ctx.badRequest("Missing customerId.");
      }
      const session = await stripe.checkout.sessions.create({
        customer:             customerId,
        payment_method_types: ['card'],
        mode:                 'setup',
        success_url:          'https://musicbizqr.com/signupSuccess?session_id={CHECKOUT_SESSION_ID}',
        cancel_url:           'https://musicbizqr.com/signupCancelled',
      });
      return ctx.send({ url: session.url });
    } catch (error) {
      console.error("❌ Error creating checkout session:", error);
      ctx.throw(500, "Failed to create checkout session");
    }
  },

  // 6) Confirm payment, create Stripe subscription & Strapi user
  async confirmPayment(ctx) {
    try {
      const { session_id, email, password, name } = ctx.request.body;
      if (!session_id || !email || !password || !name) {
        return ctx.badRequest("Missing required fields.");
      }

      // Retrieve the session and customer
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session?.customer) {
        return ctx.badRequest("Invalid session or no customer found.");
      }
      const customerId = session.customer;

      // Ensure they have a payment method
      const paymentMethods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
      if (!paymentMethods.data.length) {
        return ctx.badRequest("No payment method found for this customer.");
      }

      // Create a subscription with a 30-day trial
      const subscription = await stripe.subscriptions.create({
        customer:           customerId,
        items:              [{ price: 'price_1QRHWpC26iqgLxbxvIw2311F' }],
        trial_period_days:  30,
      });

      // Create the Strapi user
      const authRole = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: 'authenticated' } });
      if (!authRole) return ctx.badRequest("Authenticated role not found.");

      const confirmationToken = crypto.randomBytes(20).toString('hex');
      const newUser = await strapi
        .plugin("users-permissions")
        .service("user")
        .add({
          email,
          password,
          username:           email,
          provider:           'local',
          customerId,
          subscriptionId:     subscription.id,
          subscriptionStatus: 'trialing',
          trialEndsAt:        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          confirmed:          false,
          confirmationToken,
          role:               authRole.id,
        });

      // Send confirmation email
      await strapi.plugin("email").service("email").send({
        to:      email,
        from:    "noreply@musicbizqr.com",
        subject: "Confirm your email",
        text:    `Hi ${name},\n\nPlease confirm your email:\n\nhttps://qrserver-production.up.railway.app/api/auth/confirm-email?token=${confirmationToken}\n\nThank you!`,
      });

      return ctx.send({
        message: "Confirmation email sent. Please check your inbox.",
        user:    { id: newUser.id, email: newUser.email },
      });
    } catch (error) {
      console.error("🔥 Error in confirmPayment:", error);
      ctx.send({ message: "Payment confirmation failed.", error: error.message || "Unknown error" });
    }
  },

  // 7) Stripe webhook handler
  async webhook(ctx) {
    // ─── Debug: inspect raw vs parsed body and signature ───────────────────────────
    const unparsedKey = Symbol.for('unparsedBody');
    const rawBody     = ctx.request.body[unparsedKey];
    const parsedBody  = ctx.request.body;
    const sigHeader   = ctx.request.headers['stripe-signature'];
  
    strapi.log.debug('🪵 [DEBUG] parsedBody exists?       ', Boolean(parsedBody));
    strapi.log.debug('🪵 [DEBUG] unparsed rawBody exists?', Boolean(rawBody));
    strapi.log.debug('🪵 [DEBUG] rawBody length           ', rawBody?.length);
    strapi.log.debug('🪵 [DEBUG] rawBody snippet          ', rawBody?.toString().slice(0,200));
    strapi.log.debug('🪵 [DEBUG] stripe-signature header  ', sigHeader);
  
    // ─── Existing signature verification ────────────────────────────────────────────
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sigHeader,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      strapi.log.info('✅ Webhook verified');
    } catch (err) {
      strapi.log.warn('⚠️ Signature verify failed, falling back:', err.message);
      event = parsedBody;
    }
  
    // ─── Helper to update the user by subscriptionId ────────────────────────────────
    const updateUser = async (subscriptionId, data) => {
      if (!subscriptionId) return;
      try {
        await strapi.db
          .query('plugin::users-permissions.user')
          .update({ where: { subscriptionId }, data });
        strapi.log.info(`🔄 Updated user ${subscriptionId}:`, data);
      } catch (err) {
        strapi.log.error(`❌ Failed to update user ${subscriptionId}:`, err);
      }
    };
  
    // ─── Dispatch based on event type ───────────────────────────────────────────────
    const { type } = event;
    const obj = event.data && event.data.object;
  
    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await updateUser(obj.id, {
          subscriptionStatus: obj.status,
          trialEnd:           new Date(obj.trial_end * 1000),
          periodEnd:          new Date(obj.current_period_end * 1000),
        });
        break;
  
      case 'customer.subscription.trial_will_end':
        strapi.log.info(`🔔 Trial ending soon for ${obj.id} at ${new Date(obj.trial_end * 1000)}`);
        break;
  
      case 'customer.subscription.deleted':
        await updateUser(obj.id, { subscriptionStatus: 'canceled' });
        break;
  
      case 'invoice.created':
      case 'invoice.finalized':
        strapi.log.info(`🧾 Invoice ${obj.id} for sub ${obj.subscription} is ${type}`);
        break;
  
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await updateUser(obj.subscription, {
          subscriptionStatus: 'active',
          periodEnd:          new Date(obj.period_end * 1000),
        });
        break;
  
      case 'invoice.payment_failed':
        await updateUser(obj.subscription, { subscriptionStatus: 'past_due' });
        break;
  
      case 'charge.succeeded':
        if (obj.subscription) {
          await updateUser(obj.subscription, {
            subscriptionStatus: 'active',
            periodEnd:          new Date(obj.created * 1000),
          });
          strapi.log.info(`🔄 Updated user ${obj.subscription} via charge.succeeded`);
        }
        break;
  
      case 'charge.failed':
        if (obj.subscription) {
          await updateUser(obj.subscription, { subscriptionStatus: 'past_due' });
          strapi.log.info(`🔄 Updated user ${obj.subscription} via charge.failed`);
        }
        break;
  
      case 'payment_intent.succeeded':
        if (obj.subscription) {
          await updateUser(obj.subscription, {
            subscriptionStatus: 'active',
            periodEnd:          new Date(obj.created * 1000),
          });
          strapi.log.info(`🔄 Updated user ${obj.subscription} via payment_intent.succeeded`);
        }
        break;
  
      default:
        strapi.log.debug(`⤷ Unhandled Stripe event: ${type}`);
    }
  
    // ─── Acknowledge receipt ────────────────────────────────────────────────────────
    ctx.send({ received: true });
  },
  
  
  
  

  // 8) A simple test route
  async testRoute(ctx) {
    return ctx.send({ message: "This is a test route" });
  },
};
