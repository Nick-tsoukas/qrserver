"use strict";

const Stripe = require("stripe");
const crypto = require("crypto");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

module.exports = {
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
        status: "all",
        limit: 1,
      });

      const subscription = subscriptions.data[0];
      console.log("✅ Stripe subscription retrieved:", subscription?.id);

      return ctx.send({
        status: subscription ? subscription.status : "inactive",
        plan: subscription ? subscription.items.data[0].plan.nickname : null,
        trialEndsAt: subscription ? subscription.trial_end : null,
      });
    } catch (error) {
      console.error("❌ Stripe fetch error (subscriptionStatus):", error);
      ctx.throw(500, "Error retrieving subscription status");
    }
  },

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
        status: "all",
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

  async createBillingPortalSession(ctx) {
    const user = ctx.state.user;
    console.log("🌀 Creating billing portal for:", user?.email);

    if (!user || !user.customerId) {
      console.warn("⚠️ No Stripe customer ID for billing portal.");
      return ctx.badRequest("Stripe customer not found for user");
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.customerId,
        return_url: process.env.BILLING_RETURN_URL || "https://musicbizqr.com/account",
      });

      console.log("✅ Billing portal session created:", session.id);
      return ctx.send({ url: session.url });
    } catch (error) {
      console.error("❌ Stripe Billing Portal Error:", error);
      ctx.throw(500, "Unable to create billing portal session");
    }
  },

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

  async createCheckoutSession(ctx) {
    try {
      const { customerId } = ctx.request.body;
      if (!customerId) {
        return ctx.badRequest("Missing customerId.");
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "setup",
        success_url: "https://musicbizqr.com/signupSuccess?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://musicbizqr.com/signupCancelled",
      });

      return ctx.send({ url: session.url });
    } catch (error) {
      console.error("❌ Error creating checkout session:", error);
      ctx.throw(500, "Failed to create checkout session");
    }
  },

  async confirmPayment(ctx) {
    try {
      const { session_id, email, password, name } = ctx.request.body;
      if (!session_id || !email || !password || !name) {
        return ctx.badRequest("Missing required fields.");
      }

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session || !session.customer) {
        return ctx.badRequest("Invalid session or no customer found.");
      }

      const customerId = session.customer;
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      if (!paymentMethods.data.length) {
        return ctx.badRequest("No payment method found for this customer.");
      }

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: "price_1QRHWpC26iqgLxbxvIw2311F" }],
        trial_period_days: 30,
      });

      const authRole = await strapi.db.query("plugin::users-permissions.role").findOne({
        where: { type: "authenticated" },
      });

      if (!authRole) return ctx.badRequest("Authenticated role not found.");

      const confirmationToken = crypto.randomBytes(20).toString("hex");

      const newUser = await strapi
        .plugin("users-permissions")
        .service("user")
        .add({
          email,
          password,
          username: email,
          provider: "local",
          customerId,
          subscriptionId: subscription.id,
          subscriptionStatus: "trialing",
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          confirmed: false,
          confirmationToken,
          role: authRole.id,
        });

      await strapi.plugin("email").service("email").send({
        to: email,
        from: "noreply@musicbizqr.com",
        subject: "Confirm your email",
        text: `Hi ${name},\n\nPlease confirm your email by clicking the following link:\n\nhttps://qrserver-production.up.railway.app/api/auth/confirm-email?token=${confirmationToken}\n\nThank you!`,
      });

      return ctx.send({ message: "Confirmation email sent. Please check your inbox." });
    } catch (error) {
      console.error("❌ Error in confirmPayment:", error);
      return ctx.badRequest("Payment confirmation failed. No user created.");
    }
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

    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        try {
          await strapi.db.query("plugin::users-permissions.user").update({
            where: { subscriptionId },
            data: { subscriptionStatus: "active" },
          });
        } catch (err) {
          console.error("Failed to update user status:", err);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        try {
          await strapi.db.query("plugin::users-permissions.user").update({
            where: { subscriptionId },
            data: { subscriptionStatus: "past_due" },
          });
        } catch (err) {
          console.error("Failed to update user status:", err);
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
          } catch (err) {
            console.error("Failed to update user status:", err);
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

  async testRoute(ctx) {
    return ctx.send({ message: "This is a test route" });
  },
};