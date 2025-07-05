'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/stripe/subscription-status',
      handler: 'api::subscription.subscription.subscriptionStatus',
      config: {
        auth: { scope: [] },   // or auth: false to test without a JWT
      },
    },
    {
      method: 'POST',
      path: '/stripe/create-billing-portal-session',
      handler: 'api::subscription.subscription.createBillingPortalSession',
      config: {
        auth: { scope: [] },
      },
    },

    {
      method: 'POST',
      path:   '/stripe/register',
      handler:'subscription.register',
      config: {
        auth: false  // allow guests to sign up
      }
    },
  ],
};
