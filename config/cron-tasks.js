// config/cron-tasks.js
'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

module.exports = {
  // Run every day at 3 AM server time
  '0 3 * * *': async ({ strapi }) => {
    strapi.log.info('[cron] Reconciling Stripe subscriptions...');

    try {
      // Find users that have a subscriptionId
      const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { subscriptionId: { $notNull: true } },
        fields: ['id', 'subscriptionId', 'plan', 'subscriptionStatus', 'trialEndsAt', 'cancelAt'],
        limit: 5000, // safety limit
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
};
