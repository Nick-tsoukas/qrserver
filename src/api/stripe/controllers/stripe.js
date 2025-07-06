// path: src/api/subscription/controllers/stripe.js
'use strict';

const Stripe = require('stripe');
const crypto = require('crypto');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const UNPARSED = Symbol.for('unparsedBody');

module.exports = {
  // 1) Check subscription status
  // src/api/stripe/controllers/stripe.js
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


  // 2) Retrieve billing info
  async getBillingInfo(ctx) {
    strapi.log.debug('[getBillingInfo] entry', { user: ctx.state.user });
    const user = ctx.state.user;
    if (!user || !user.customerId) {
      strapi.log.warn('[getBillingInfo] No Stripe customer on user', { user });
      return ctx.badRequest('Stripe customer not found');
    }
    try {
      const customer = await stripe.customers.retrieve(user.customerId);
      const subscriptions = await stripe.subscriptions.list({
        customer: user.customerId,
        status:   'all',
        limit:    1,
      });
      const subscription = subscriptions.data[0];

      strapi.log.debug('[getBillingInfo] Retrieved billing info', {
        customer,
        subscription,
        trialEndsAt: user.trialEndsAt,
      });

      return ctx.send({ customer, subscription, trialEndsAt: user.trialEndsAt });
    } catch (error) {
      strapi.log.error('[getBillingInfo] error', error);
      return ctx.throw(500, 'Error retrieving billing information');
    }
  },

  // 3) Create a Stripe Billing Portal session
  async createBillingPortalSession(ctx) {
    strapi.log.debug('[createBillingPortalSession] entry', { user: ctx.state.user });
    const user = ctx.state.user;
    if (!user || !user.customerId) {
      strapi.log.warn('[createBillingPortalSession] No Stripe customer on user', { user });
      return ctx.badRequest('Stripe customer not found');
    }
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer:   user.customerId,
        return_url: process.env.BILLING_RETURN_URL,
      });
      strapi.log.debug('[createBillingPortalSession] Created billing portal session', { session });
      return ctx.send({ url: session.url });
    } catch (error) {
      strapi.log.error('[createBillingPortalSession] error', error);
      return ctx.throw(500, 'Error creating billing portal session');
    }
  },

  // 4) Create a Stripe Customer
  async createCustomer(ctx) {
    strapi.log.debug('[createCustomer] entry', { body: ctx.request.body });
    try {
      const { email, name } = ctx.request.body;
      if (!email || !name) {
        strapi.log.warn('[createCustomer] Missing email or name', { email, name });
        return ctx.badRequest('Missing email or name.');
      }
      const customer = await stripe.customers.create({ email, name });
      strapi.log.debug('[createCustomer] Stripe customer created', { customer });
      return ctx.send({ customerId: customer.id });
    } catch (error) {
      strapi.log.error('[createCustomer] error', error);
      return ctx.throw(500, 'Failed to create Stripe customer');
    }
  },

  // 5) Create a Checkout Session (for card setup)
  async createCheckoutSession(ctx) {
    strapi.log.debug('[createCheckoutSession] entry', { body: ctx.request.body });
    try {
      const { customerId } = ctx.request.body;
      if (!customerId) {
        strapi.log.warn('[createCheckoutSession] Missing customerId');
        return ctx.badRequest('Missing customerId.');
      }
      const session = await stripe.checkout.sessions.create({
        customer:             customerId,
        payment_method_types: ['card'],
        mode:                 'setup',
        success_url:          'https://musicbizqr.com/signupSuccess?session_id={CHECKOUT_SESSION_ID}',
        cancel_url:           'https://musicbizqr.com/signupCancelled',
      });
      strapi.log.debug('[createCheckoutSession] Checkout session created', { session });
      return ctx.send({ url: session.url });
    } catch (error) {
      strapi.log.error('[createCheckoutSession] error', error);
      return ctx.throw(500, 'Failed to create checkout session');
    }
  },

  // 6) Confirm payment, create Stripe subscription & Strapi user
  async confirmPayment(ctx) {
    strapi.log.debug('[confirmPayment] entry', { body: ctx.request.body });
    try {
      const { session_id, email, password, name } = ctx.request.body;
      if (!session_id || !email || !password || !name) {
        strapi.log.warn('[confirmPayment] Missing required fields', { session_id, email, name });
        return ctx.badRequest('Missing required fields.');
      }

      // 1️⃣ Retrieve the Checkout Session
      strapi.log.debug('[confirmPayment] Retrieving Stripe session', { session_id });
      const session = await stripe.checkout.sessions.retrieve(session_id);
      strapi.log.debug('[confirmPayment] Session retrieved', { session });
      if (!session || !session.customer) {
        strapi.log.error('[confirmPayment] No customer in session', { session });
        return ctx.badRequest('Invalid session or no customer found.');
      }
      const customerId = session.customer;

      // 2️⃣ Ensure they have a card on file
      strapi.log.debug('[confirmPayment] Listing payment methods', { customerId });
      const pmList = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
      strapi.log.debug('[confirmPayment] Payment methods count', { count: pmList.data.length });
      if (!pmList.data.length) {
        strapi.log.error('[confirmPayment] No payment method found', { customerId });
        return ctx.badRequest('No payment method found for this customer.');
      }

      // 3️⃣ Create the Stripe subscription (30-day trial)
      strapi.log.debug('[confirmPayment] Creating Stripe subscription', { customerId });
      const subscription = await stripe.subscriptions.create({
        customer:           customerId,
        items:              [{ price: 'price_1QRHWpC26iqgLxbxvIw2311F' }],
        trial_period_days:  30,
      });
      strapi.log.debug('[confirmPayment] Subscription created', { subscription });

      // 4️⃣ Create the Strapi user (core fields only)
      strapi.log.debug('[confirmPayment] Fetching authenticated role');
      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });
      if (!authRole) {
        strapi.log.error('[confirmPayment] Authenticated role not found');
        return ctx.badRequest('Authenticated role not found.');
      }
      const confirmationToken = crypto.randomBytes(20).toString('hex');
      strapi.log.debug('[confirmPayment] Creating Strapi user', { email });
      const newUser = await strapi.plugin('users-permissions').service('user').add({
        email,
        password,
        username:          email,
        provider:          'local',
        confirmed:         false,
        confirmationToken,
        role:              authRole.id,
      });
      strapi.log.debug('[confirmPayment] Strapi user created', { userId: newUser.id });

      // 5️⃣ Update user with Stripe fields
      const trialEndsAt = new Date(subscription.trial_end * 1000);
      strapi.log.debug('[confirmPayment] Updating user with Stripe data', {
        userId:             newUser.id,
        customerId,
        subscriptionId:     subscription.id,
        subscriptionStatus: 'trialing',
        trialEndsAt,
      });
      await strapi.entityService.update(
        'plugin::users-permissions.user',
        newUser.id,
        {
          data: {
            customerId,
            subscriptionId:     subscription.id,
            subscriptionStatus: 'trialing',
            trialEndsAt,
          },
        }
      );
      strapi.log.info('[confirmPayment] User updated with Stripe data', { userId: newUser.id });

      // 6️⃣ Send confirmation email
      strapi.log.debug('[confirmPayment] Sending confirmation email', { to: email });
      await strapi.plugin('email').service('email').send({
        to:      email,
        from:    'noreply@musicbizqr.com',
        subject: 'Confirm your email',
        text:    `Hi ${name},\n\nPlease confirm your email by clicking: https://qrserver-production.up.railway.app/api/auth/confirm-email?token=${confirmationToken}\n\nThank you!`,
      });
      strapi.log.info('[confirmPayment] Confirmation email sent', { to: email });

      // 7️⃣ Return success
      strapi.log.debug('[confirmPayment] Responding to client', { userId: newUser.id });
      return ctx.send({
        message: 'Confirmation email sent. Please check your inbox.',
        user:    { id: newUser.id, email: newUser.email },
      });
    } catch (error) {
      strapi.log.error('[confirmPayment] Error in confirmPayment', error);
      return ctx.internalServerError('Payment confirmation failed.');
    }
  },

  // 8) A simple test route
  async testRoute(ctx) {
    return ctx.send({ message: 'This is a test route' });
  },
};
