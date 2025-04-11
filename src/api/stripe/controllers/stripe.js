"use strict";

const Stripe = require("stripe");
const crypto = require("crypto");


// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // Optionally set apiVersion if needed.
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

      // Create Stripe customer
      const customer = await stripe.customers.create({ email, name });
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

      // Create a "setup" session (no immediate charge)
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "setup", // storing card for future use
        success_url:
          "https://musicbizqr.com/signupSuccess?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://musicbizqr.com/signupCancelled",
      //   success_url:
      //   "http://localhost:3000/signupSuccess?session_id={CHECKOUT_SESSION_ID}",
      // cancel_url: "http//localhost:3000/signupCancelled",
      });

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
 * 4) Create the user in Strapi (using fields that match your schema)
 */
async confirmPayment(ctx) {
  try {
    const { session_id, email, password, name } = ctx.request.body;
    if (!session_id || !email || !password || !name) {
      return ctx.badRequest("Missing required fields.");
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session || !session.customer) {
      return ctx.badRequest("Invalid session or no customer found.");
    }
    const customerId = session.customer;

    // Ensure a payment method exists
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
    if (!paymentMethods.data.length) {
      return ctx.badRequest("No payment method found for this customer.");
    }

    // Create a Stripe subscription with a 30-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: "price_1QRHWpC26iqgLxbxvIw2311F" }],
      trial_period_days: 30,
    });

    // Retrieve the default public role
    const authRole = await strapi.db.query("plugin::users-permissions.role").findOne({
      where: { type: "authenticated" },
    });
    if (!authRole) {
      return ctx.badRequest("Authenticated role not found.");
    }

    // Generate a confirmation token
    const confirmationToken = crypto.randomBytes(20).toString("hex");

    // Create the user in Strapi with confirmed: false and store the token
    const newUser = await strapi
      .plugin("users-permissions")
      .service("user")
      .add({
        email,
        password,
        username: email, // using email as username (must be unique)
        provider: "local",
        customerId: customerId,
        subscriptionId: subscription.id,
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        confirmed: false, // user is not confirmed yet
        confirmationToken, // store token for email confirmation
        role: authRole.id,
      });

    // Send confirmation email using your email provider
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to: email,
        from: "noreply@musicbizqr.com", // adjust as needed
        subject: "Confirm your email",
        text: `Hi ${name},\n\nPlease confirm your email by clicking the following link:\n\nhttps://qrserver-production.up.railway.app/api/auth/confirm-email?token=${confirmationToken}\n\nThank you!`,
      });

    // Respond to the client that the confirmation email has been sent
    return ctx.send({ message: "Confirmation email sent. Please check your inbox." });
  } catch (error) {
    console.error("Error in confirmPayment:", error);
    return ctx.badRequest("Payment confirmation failed. No user created.");
  }
}
,

  /**
   * POST /api/stripe/webhook
   * Handles subscription lifecycle events from Stripe
   */
  async testRoute(ctx) {
    return ctx.send({ message: "This is a test route" });
  },

  async webhook(ctx) {
    let event;
    try {
      const sig = ctx.request.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(
        ctx.request.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Stripe Webhook Error:", err.message);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    // Handle the event by type
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        try {
          await strapi.db.query("plugin::users-permissions.user").update({
            where: { subscriptionId: subscriptionId },
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

        try {
          await strapi.db.query("plugin::users-permissions.user").update({
            where: { subscriptionId: subscriptionId },
            data: { subscriptionStatus: "past_due" },
          });
        } catch (updateErr) {
          console.error("Failed to update user status:", updateErr);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        if (subscription.status === "canceled") {
          try {
            await strapi.db.query("plugin::users-permissions.user").update({
              where: { subscriptionId: subscription.id },
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

    return ctx.send({ received: true });
  },
};
