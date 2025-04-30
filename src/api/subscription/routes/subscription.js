// path: src/api/subscription/routes/subscription.js
module.exports = {
    routes: [
      {
        method: 'POST',
        path: '/webhooks/stripe',
        handler: 'api::subscription.subscription.webhook',
        config: { auth: false },
      },
    ],
    
  };
  
  