"use strict";

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const CANON_KEYS = new Set([
  "pay_entry",
  "tip_band",
  "pay_merch",
  "support_band",
  "help_get_home",
  "after_show_support",
]);

function getButton(band, key) {
  const btn = (band.paymentButtons || []).find((b) => b.key === key);
  return btn || null;
}

module.exports = {
  async create(ctx) {
    const bandId = ctx.params.id;
    const { buttonKey, amount } = ctx.request.body || {};

    if (!CANON_KEYS.has(buttonKey)) {
      return ctx.badRequest("Invalid buttonKey");
    }

    const band = await strapi.entityService.findOne("api::band.band", bandId, {
      fields: ["id", "name", "slug", "stripeAccountId", "paymentsEnabled", "stripeOnboardingComplete", "paymentButtons"],
      publicationState: "preview",
    });

    if (!band) return ctx.notFound("Band not found");

    if (!band.paymentsEnabled || !band.stripeOnboardingComplete || !band.stripeAccountId) {
      return ctx.badRequest("Payments not enabled for this band");
    }

    const btn = getButton(band, buttonKey);
    if (!btn || btn.enabled !== true) {
      return ctx.badRequest("This payment option is not enabled");
    }

    // Resolve amount in cents
    let cents = null;

    if (btn.pricingMode === "fixed") {
      cents = Math.round(Number(btn.fixedAmount || 0) * 100);
    } else if (btn.pricingMode === "presets") {
      // client must send amount matching a preset
      const a = Number(amount);
      if (!btn.presetAmounts?.includes(a)) return ctx.badRequest("Invalid amount");
      cents = Math.round(a * 100);
    } else if (btn.pricingMode === "min") {
      const a = Number(amount);
      if (!a || a < Number(btn.minAmount || 0)) return ctx.badRequest("Amount too low");
      cents = Math.round(a * 100);
    } else {
      return ctx.badRequest("Unsupported pricingMode");
    }

    if (!cents || cents < 50) return ctx.badRequest("Amount invalid");

    // 1) Create Support Moment (pending)
    const support = await strapi.entityService.create("api::support-moment.support-moment", {
      data: {
        band: band.id,
        bandNameSnapshot: band.name,
        bandSlugSnapshot: band.slug,
        buttonKey,
        supportLabel: btn.title,
        badgeId: btn.badgeId || null,
        amount: cents / 100,
        currency: "usd",
        status: "pending",
        source: "band-profile",
        shareOptIn: false,
        showAmountOnShare: false,
        supporterWallOptIn: false,
      },
    });

    const publicAppUrl = String(process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");

    // 2) Create Stripe Checkout Session on the CONNECTED account
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${band.name} — ${btn.title}`,
              },
              unit_amount: cents,
            },
            quantity: 1,
          },
        ],
        success_url: `${publicAppUrl}/${band.slug}?paid=1&sm=${support.id}`,
        cancel_url: `${publicAppUrl}/${band.slug}?canceled=1`,
        metadata: {
          supportMomentId: String(support.id),
          bandId: String(band.id),
          buttonKey,
        },
      },
      {
        stripeAccount: band.stripeAccountId, // ✅ money goes to the band
      }
    );

    // (Optional now, useful later) store session id
    await strapi.entityService.update("api::support-moment.support-moment", support.id, {
      data: {
        stripeCheckoutSessionId: session.id || null,
        stripePaymentIntentId: session.payment_intent || null,
      },
    });

    ctx.body = { url: session.url, supportMomentId: support.id };
  },
};
