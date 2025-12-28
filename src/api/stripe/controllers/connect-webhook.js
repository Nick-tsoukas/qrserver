"use strict";

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = {
  async handle(ctx) {
    const sig = ctx.request.headers["stripe-signature"];
    const secret =
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    const hasSecret = !!secret;

    const debug = String(process.env.DEBUG || "").toLowerCase() === "true";

    if (debug) {
      strapi.log.info("[connect webhook] received", {
        hasSignature: !!sig,
        hasSecret,
        contentType: ctx.request.headers["content-type"],
      });
    }

    if (!sig) {
      ctx.status = 400;
      ctx.body = "Webhook Error: No stripe-signature header value was provided.";
      return;
    }

    if (!hasSecret) {
      ctx.status = 500;
      ctx.body =
        "Webhook Error: STRIPE_CONNECT_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET) is not configured.";
      return;
    }

    // ✅ get raw body (requires includeUnparsed: true middleware)
    const rawBody =
      ctx.request.body?.[Symbol.for("unparsedBody")] ||
      ctx.request.body?.data?.[Symbol.for("unparsedBody")];

    if (!rawBody) {
      strapi.log.error("[connect webhook] Missing raw body");
      ctx.status = 400;
      ctx.body = "Missing raw body. Check middlewares includeUnparsed: true.";
      return;
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        secret
      );

      if (debug) strapi.log.info(`[connect webhook] ${event.type}`);
    } catch (err) {
      strapi.log.error("[connect webhook] signature verification failed", err);
      ctx.status = 400;
      ctx.body = `Webhook Error: ${err.message}`;
      return;
    }

    // Helpful debug for what Stripe is sending
    if (event.type === "account.updated") {
      const account = event.data.object;

      strapi.log.info(
        `[connect webhook] acct=${account.id} details=${account.details_submitted} charges=${account.charges_enabled} payouts=${account.payouts_enabled}`
      );

      // ✅ dev-friendly complete condition (tighten later)
      const isComplete = account.details_submitted === true;

      if (isComplete) {
        const bands = await strapi.entityService.findMany("api::band.band", {
          filters: { stripeAccountId: account.id },
          fields: ["id"],
          limit: 1,
          publicationState: "preview",
        });

        const band = bands?.[0];

        if (!band) {
          strapi.log.warn(`[connect webhook] No band found for stripeAccountId=${account.id}`);
        } else {
          await strapi.entityService.update("api::band.band", band.id, {
            data: { stripeOnboardingComplete: true, paymentsEnabled: true },
          });

          strapi.log.info(`✅ Connect complete for band ${band.id} (${account.id})`);
        }
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const supportMomentId = session?.metadata?.supportMomentId;

      if (!supportMomentId) {
        strapi.log.warn("[payments webhook] checkout.session.completed missing metadata.supportMomentId");
      } else {
        const existing = await strapi.entityService.findOne(
          "api::support-moment.support-moment",
          supportMomentId,
          {
            fields: ["id", "status"],
            publicationState: "preview",
          }
        );

        if (!existing) {
          strapi.log.warn(
            `[payments webhook] No support-moment found for id=${supportMomentId}`
          );
        } else if (existing.status === "paid") {
          if (debug) {
            strapi.log.info(
              `[payments webhook] support-moment ${supportMomentId} already paid (skip)`
            );
          }
        } else {
          let stripeChargeId = null;
          let stripePaymentIntentId = session.payment_intent || null;

          // If this event is for a connected account, Stripe includes event.account.
          // Use it to retrieve the PaymentIntent/charge on the correct account.
          const stripeAccount = event.account || null;

          if (stripePaymentIntentId && stripeAccount) {
            try {
              const pi = await stripe.paymentIntents.retrieve(
                stripePaymentIntentId,
                { expand: ["latest_charge"] },
                { stripeAccount }
              );
              stripePaymentIntentId = pi?.id || stripePaymentIntentId;
              stripeChargeId =
                (typeof pi?.latest_charge === "string"
                  ? pi.latest_charge
                  : pi?.latest_charge?.id) || null;
            } catch (e) {
              strapi.log.warn("[payments webhook] Unable to retrieve PaymentIntent", {
                supportMomentId,
                stripePaymentIntentId,
                stripeAccount,
                message: e?.message,
              });
            }
          }

          await strapi.entityService.update(
            "api::support-moment.support-moment",
            supportMomentId,
            {
              data: {
                status: "paid",
                paidAt: new Date().toISOString(),
                stripePaymentIntentId,
                stripeChargeId,
              },
            }
          );

          strapi.log.info(`[payments webhook] ✅ support-moment paid id=${supportMomentId}`);
        }
      }
    }

    ctx.body = { received: true };
  },
};
