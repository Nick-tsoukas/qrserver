"use strict";

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = {
  async onboard(ctx) {
    const bandId = ctx.params.id;

    const band = await strapi.entityService.findOne("api::band.band", bandId, {
      fields: ["id", "stripeAccountId"],
    });

    if (!band) return ctx.notFound("Band not found");

    // TODO (later): enforce band ownership

    let accountId = band.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      await strapi.entityService.update("api::band.band", bandId, {
        data: { stripeAccountId: accountId },
      });
    }

    // If onboarding was completed previously (e.g. webhook missed), reconcile flags now.
    try {
      const acct = await stripe.accounts.retrieve(accountId);
      if (acct?.details_submitted === true) {
        await strapi.entityService.update("api::band.band", bandId, {
          data: { stripeOnboardingComplete: true, paymentsEnabled: true },
        });
      }
    } catch (e) {
      strapi.log.warn("[payments.onboard] Unable to retrieve Stripe account", {
        bandId,
        accountId,
        message: e?.message,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL,
      return_url: process.env.STRIPE_CONNECT_RETURN_URL,
      type: "account_onboarding",
    });

    ctx.body = {
      url: accountLink.url,
      accountId,
    };
  },

  async summary(ctx) {
    const bandId = Number(ctx.params.id);
    if (!bandId) return ctx.badRequest("Band id is required");

    const recentLimit = Math.max(1, Math.min(50, Number(ctx.query.limit || 20)));

    const paidRows = await strapi.entityService.findMany(
      "api::support-moment.support-moment",
      {
        filters: {
          band: { id: bandId },
          status: "paid",
        },
        fields: ["id", "amount"],
        sort: { paidAt: "desc" },
        pagination: { limit: 100000 },
        publicationState: "preview",
      }
    );

    const totalPaidCount = Array.isArray(paidRows) ? paidRows.length : 0;
    const totalPaidAmount = (Array.isArray(paidRows) ? paidRows : []).reduce(
      (sum, r) => sum + Number(r?.amount || 0),
      0
    );

    const recent = await strapi.entityService.findMany(
      "api::support-moment.support-moment",
      {
        filters: {
          band: { id: bandId },
        },
        fields: [
          "id",
          "amount",
          "currency",
          "status",
          "supportLabel",
          "buttonKey",
          "paidAt",
          "createdAt",
        ],
        sort: { createdAt: "desc" },
        pagination: { limit: recentLimit },
        publicationState: "preview",
      }
    );

    ctx.body = {
      totals: {
        totalPaidCount,
        totalPaidAmount,
        currency: "usd",
      },
      recent,
    };
  },
};
