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
        auth: false,
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
      method: "GET",
      path: "/stripe/test",
      handler: "stripe.testRoute",
    },
  
  ],
};
