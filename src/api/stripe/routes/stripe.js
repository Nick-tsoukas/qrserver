"use strict";

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/stripe/create-billing-portal-session',
      handler: 'stripe.createBillingPortalSession',
      config: {
        auth: {
          scope: [], // ✅ this ensures authentication is required
        },
      },
    },
    {
      method: 'GET',
      path: '/stripe/subscription-status',
      handler: 'stripe.subscriptionStatus',
      config: {
        auth: {
          scope: [],
        },
      },
    },
    {
      method: 'GET',
      path: '/stripe/billing',
      handler: 'stripe.getBillingInfo',
      config: {
        auth: {
          scope: [],
        },
      },
    },
    
    {
      method: "POST",
      path: "/stripe/create-customer",
      handler: "stripe.createCustomer",
    },
    {
      method: "POST",
      path: "/stripe/create-checkout-session",
      handler: "stripe.createCheckoutSession",
    },
    {
      method: "POST",
      path: "/stripe/confirm-payment",
      handler: "stripe.confirmPayment",
    },
    {
      method: 'POST',
      path: '/stripe/webhook',
      handler: 'stripe.webhook',
      config: {
        auth: false,
      }
    },
    {
      method: "GET",
      path: "/stripe/test",
      handler: "stripe.testRoute",
    },
    // (Optional) Webhook route if you want to handle subscription events
    // {
    //   method: "POST",
    //   path: "/stripe/webhook",
    //   handler: "stripe.webhook",
    // }
  ],
};
