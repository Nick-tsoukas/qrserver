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
      const customer = await stripe.customers.retrieve(user.customerIdtomerId);
      const subscriptions = await stripe.subscriptions.list({
        customer: user.customerIdtomerId,
        status: "all",
        limit: 1,
      });

      const subscription = subscriptions.data[0];
      console.log("✅ Billing info retrieved for:", customer.id);

      return {
        customer,
        subscription,
        trialEndsAt: user.trialEndsAt,
      };
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
  
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email,
        name,
      });
  
      console.log("✅ Stripe customer created:", customer.id);
  
      return ctx.send({ customerId: customer.id });
    } catch (error) {
      console.error("❌ Error creating Stripe customer:", error);
      ctx.throw(500, "Failed to create Stripe customer");
    }
  }
  

  // (unchanged: other routes remain the same)
};