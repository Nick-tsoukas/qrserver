// path: src/api/subscription/controllers/stripe.js
'use strict';

const Stripe = require('stripe');
const crypto = require('crypto');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const UNPARSED = Symbol.for('unparsedBody');

module.exports = {
  // 1) Check subscription status
  // src/api/stripe/controllers/stripe.js
// GET /api/stripe/subscription-status
async subscriptionStatus(ctx) {
  strapi.log.debug('[subscriptionStatus] entry', { jwtUser: ctx.state.user });
  const jwtUser = ctx.state.user;
  if (!jwtUser) return ctx.unauthorized('You must be logged in.');

  // Load DB user (keep as-is; no schema changes)
  const [dbUser] = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { id: jwtUser.id } }
  );
  if (!dbUser?.customerId) {
    strapi.log.warn('[subscriptionStatus] No Stripe customer on DB user', { dbUser });
    return ctx.badRequest('Stripe customer not found');
  }

  try {
    // Get latest sub from Stripe
    const subsList = await stripe.subscriptions.list({
      customer: dbUser.customerId,
      status: 'all',
      limit: 1,
    });
    const sub = subsList.data?.[0] || null;
    strapi.log.debug('[subscriptionStatus] Retrieved subscription', { subscription: sub?.id, status: sub?.status });

    // Derive live values (non-breaking)
    const planNickname =
      sub?.items?.data?.[0]?.price?.nickname ||
      sub?.items?.data?.[0]?.plan?.nickname || // legacy fallback
      null;

    // Keep frontend response in Stripe snake_case
    const liveStatusSnake = sub?.status || 'inactive';
    const liveTrialEndRaw = sub?.trial_end || null; // seconds
    const liveTrialEnd = liveTrialEndRaw ? new Date(liveTrialEndRaw * 1000) : null;

    // For DB write-through, map ONLY 'past_due' -> 'pastDue' to avoid breaking existing consumers
    const mapForUserRow = (s) => (s === 'past_due' ? 'pastDue' : (s || 'inactive'));

    // Prepare what's going to the user row (idempotent update)
    const nextData = {
      subscriptionStatus: mapForUserRow(liveStatusSnake),
      plan: planNickname,
      trialEndsAt: liveTrialEnd,
      // leave gracePeriodStart untouched here; webhooks control it
    };

    // Compute diff vs current dbUser to avoid unnecessary writes
    const needsUpdate =
      dbUser.subscriptionStatus !== nextData.subscriptionStatus ||
      dbUser.plan !== nextData.plan ||
      String(dbUser.trialEndsAt || '') !== String(nextData.trialEndsAt || '');

    if (needsUpdate) {
      await strapi.entityService.update('plugin::users-permissions.user', dbUser.id, { data: nextData });
      strapi.log.debug('[subscriptionStatus] user reconciled', { userId: dbUser.id, next: nextData });
    } else {
      strapi.log.debug('[subscriptionStatus] user already up-to-date', { userId: dbUser.id });
    }

    // Respond with the live truth (snake_case) for the frontend
    return ctx.send({
      status: liveStatusSnake,
      plan: planNickname,
      trialEndsAt: liveTrialEndRaw,                 // seconds (keeps your frontend math unchanged)
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
        status: 'all',
        limit: 1,
      });
  
      const subscription = subscriptions.data[0];
  
      // Check if there's at least one attached payment method
      const hasPaymentMethod =
        customer.invoice_settings?.default_payment_method != null;
  
      strapi.log.debug('[getBillingInfo] Retrieved billing info', {
        hasPaymentMethod,
        trialEndsAt: user.trialEndsAt,
      });
  
      return ctx.send({
        hasPaymentMethod,
        trialEndsAt: user.trialEndsAt,
      });
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
        items:              [{ price: process.env.STRIPE_DEFAULT_PRICE_ID }],
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

  // 9) Confirm social signup
async confirmSocial(ctx) {
  strapi.log.debug('[confirmSocial] raw body:', ctx.request.body)

  const { email, name, uid, provider } = ctx.request.body
  

  strapi.log.debug('[confirmSocial] entry', { email, name, uid, provider })

  if (!email || !name || !uid || !provider) {
    return ctx.badRequest('Missing required fields.')
  }

  // 1️⃣ Check if user already exists
  const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { email }
  })

  if (existingUser) {
    strapi.log.debug('[confirmSocial] User exists, logging in', { id: existingUser.id })
    const jwt = strapi.plugins['users-permissions'].services.jwt.issue({ id: existingUser.id })
    return ctx.send({ jwt })
  }

  // 2️⃣ Create Stripe customer
  const customer = await stripe.customers.create({ email, name })

  // 3️⃣ Create user with provider
  const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
  })
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: process.env.STRIPE_DEFAULT_PRICE_ID }], // make sure this is set!
    trial_period_days: 30,
  })

  const newUser = await strapi.plugins['users-permissions'].services.user.add({
    email,
    username: email,
    provider,
    confirmed: true,
    role: authRole.id,
    customerId: customer.id,
    subscriptionId: subscription.id,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
  })

  const jwt = strapi.plugins['users-permissions'].services.jwt.issue({ id: newUser.id })

  strapi.log.debug('[confirmSocial] User created and JWT issued', { id: newUser.id })

  return ctx.send({ jwt })
},


  // 8) A simple test route
  async testRoute(ctx) {
    return ctx.send({ message: 'This is a test route' });
  },
};
