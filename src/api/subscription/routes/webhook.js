// File: src/api/subscription/routes/webhook.js
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/stripe',
      handler: 'api::subscription.subscription.webhook',  
      config: { auth: false, prefix: '' },
    },

    {
      method: 'POST',
      path: '/stripe/webhook',
      handler: 'api::subscription.subscription.webhook',
      config: { auth: false },
    },

  ],
};
