"use strict";

const Stripe = require("stripe");

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // Optionally set apiVersion if needed. Otherwise, Stripe uses your default account version.
});

module.exports = {
  /**
   * POST /api/stripe/create-customer
   * Body: { email, name }
   * Creates a Stripe customer and returns customerId
   */
  async createCustomer(ctx) {
    try {
      const { email, name } = ctx.request.body;
      if (!email || !name) {
        return ctx.badRequest("Missing email or name.");
      }

      // 1) Create Stripe customer
      const customer = await stripe.customers.create({ email, name });

      // 2) Return the customer's ID
      return ctx.send({ customerId: customer.id });
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Failed to create Stripe customer.");
    }
  },

  /**
   * POST /api/stripe/create-checkout-session
   * Body: { customerId }
   * Creates a Stripe Checkout session in "setup" mode to collect card details
   */
  async createCheckoutSession(ctx) {
    try {
      const { customerId } = ctx.request.body;
      if (!customerId) {
        return ctx.badRequest("Missing customerId.");
      }

      // 1) Create a "setup" session (no immediate charge)
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "setup", // storing card for future use
        success_url:
          "https://musicbizqr.com/signupSuccess?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://musicbizqr.com/signupCancelled",
      });

      // 2) Return the Stripe Checkout URL
      return ctx.send({ url: session.url });
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Failed to create checkout session.");
    }
  },

  /**
   * POST /api/stripe/confirm-payment
   * Body: { session_id, email, password, name }
   *
   * 1) Retrieve the session from Stripe
   * 2) Check for a stored payment method
   * 3) Create a 30-day trial subscription in Stripe
   * 4) Create the user in Strapi
   */
  async confirmPayment(ctx) {
    try {
      const { session_id, email, password, name } = ctx.request.body;
      console.log("🔹 Confirm Payment Triggered");
      console.log("✅ Received Data:", { session_id, email, name });
      if (!session_id || !email || !password || !name) {
        console.log("❌ Missing required fields");
        return ctx.badRequest("Missing required fields.");
      }

      // 1) Retrieve session from Stripe
      console.log("🔍 Retrieving Stripe session...");
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session || !session.customer) {
        console.error("❌ Invalid session or customer not found");
        return ctx.badRequest("Invalid session or no customer found.");
      }

      const customerId = session.customer;
      console.log("✅ Stripe Customer ID:", customerId);


      // 2) Check if there's a saved payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });
      console.log('checking payment')
      if (!paymentMethods.data.length) {
        console.error("❌ No payment method found for customer:", customerId);

        return ctx.badRequest("No payment method found for this customer.");
      }

      console.log("✅ Payment method found:", paymentMethods.data[0].id);


      // 3) Create a Stripe subscription with a 30-day trial
      //    Replace "price_12345" with your actual Price ID from Stripe.
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: "price_1QRHWpC26iqgLxbxvIw2311F" }], // your plan/price
        trial_period_days: 30,             // 30-day free trial
      });
      console.log("✅ Subscription Created:", subscription.id);


      // 4) Create user in Strapi with 30-day trial and store subscription info
      //    Using Strapi's Users-Permissions plugin
      console.log("🔹 Creating user in Strapi...");

      const newUser = await strapi
        .plugin("users-permissions")
        .service("user")
        .add({
          email,
          password,
          username: email, // or however you handle the username field
          name,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id, // store the subscription ID
          subscriptionStatus: "trialing",
          trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          confirmed: true, // set to false if you want them to confirm via email
        });

      // 5) Return the created user
      return ctx.send({ user: newUser });
    } catch (error) {
      console.error(error);
      return ctx.badRequest("Payment confirmation failed.");
    }
  },

  /**
   * POST /api/stripe/webhook
   * Handles subscription lifecycle events from Stripe
   *
   * Make sure to:
   * - Define this route in src/api/stripe/routes/stripe.js
   * - Allow Public access in Strapi Roles & Permissions
   * - Set STRIPE_WEBHOOK_SECRET in your .env (e.g., whsec_12345)
   */
  async testRoute(ctx) {
    return ctx.send({ message: "This is a test route" });
  },
  async webhook(ctx) {
    let event;
    try {
      // 1) Get the Stripe signature from the headers
      const sig = ctx.request.headers["stripe-signature"];

      // 2) Construct the event using rawBody & your webhook secret
      event = stripe.webhooks.constructEvent(
        ctx.request.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Stripe Webhook Error:", err.message);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    // 3) Handle the event by type
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        // Mark user subscription as active
        try {
          await strapi.db.query("plugin::users-permissions.user").update({
            where: { stripeSubscriptionId: subscriptionId },
            data: { subscriptionStatus: "active" },
          });
        } catch (updateErr) {
          console.error("Failed to update user status:", updateErr);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        // Mark user subscription as past_due
        try {
          await strapi.db.query("plugin::users-permissions.user").update({
            where: { stripeSubscriptionId: subscriptionId },
            data: { subscriptionStatus: "past_due" },
          });
        } catch (updateErr) {
          console.error("Failed to update user status:", updateErr);
        }
        break;
      }

      // Handle other events, e.g. customer.subscription.updated (for cancellations)
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        if (subscription.status === "canceled") {
          try {
            await strapi.db.query("plugin::users-permissions.user").update({
              where: { stripeSubscriptionId: subscription.id },
              data: { subscriptionStatus: "canceled" },
            });
          } catch (updateErr) {
            console.error("Failed to update user status:", updateErr);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    // 4) Return a 200 response to Stripe
    return ctx.send({ received: true });
  },
};
