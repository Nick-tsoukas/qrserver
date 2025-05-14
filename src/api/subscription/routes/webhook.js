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
      path: '/stripe/confirm-payment',
      handler: 'api::subscription.subscription.confirmPayment',
      config: { auth: false },
    },
  ],
};
