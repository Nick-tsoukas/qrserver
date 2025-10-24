'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const { subDays } = require('date-fns');

module.exports = {
  '* * * * *': async ({ strapi }) => {
    strapi.log.info('[cron] heartbeat: cron is running');
  },
  // 🕒 Existing job — Stripe subscription reconciliation
  '0 3 * * *': async ({ strapi }) => {
    strapi.log.info('[cron] Reconciling Stripe subscriptions...');

    try {
      const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { subscriptionId: { $notNull: true } },
        fields: ['id', 'subscriptionId', 'plan', 'subscriptionStatus', 'trialEndsAt', 'cancelAt'],
        limit: 5000,
      });

      for (const u of users) {
        try {
          const sub = await stripe.subscriptions.retrieve(u.subscriptionId);

          const planNickname =
            sub?.items?.data?.[0]?.price?.nickname ||
            sub?.items?.data?.[0]?.plan?.nickname ||
            null;

          const updates = {
            subscriptionStatus: sub.status,
            plan: planNickname,
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
          };

          await strapi.entityService.update('plugin::users-permissions.user', u.id, { data: updates });

          strapi.log.info('[cron] Updated user subscription', {
            userId: u.id,
            status: sub.status,
          });
        } catch (err) {
          strapi.log.error('[cron] Failed to reconcile user', {
            userId: u.id,
            error: err.message,
          });
        }
      }
    } catch (err) {
      strapi.log.error('[cron] Fatal error during reconciliation', err);
    }
  },

  // 🕛 New job — Band analytics daily rollup (runs every day at midnight)
  '10 0 * * *': async ({ strapi }) => {
    strapi.log.info('[cron] Running daily band analytics rollup...');
    try {
      const bands = await strapi.entityService.findMany('api::band.band', { fields: ['id', 'name'] });
const service = strapi.service('api::band-insight-daily.band-insight-daily');
      const yesterday = subDays(new Date(), 1);

      for (const b of bands) {
        try {
          await service.computeDay({ bandId: b.id, day: yesterday });
          strapi.log.info(`[cron] ✅ Rolled up analytics for band: ${b.name}`);
        } catch (err) {
          strapi.log.error(`[cron] ❌ Rollup failed for band ${b.name}:`, err.message);
        }
      }
    } catch (err) {
      strapi.log.error('[cron] ❌ Fatal error during analytics rollup:', err);
    }
    strapi.log.info('[cron] Band analytics rollup complete.');
  },
};
