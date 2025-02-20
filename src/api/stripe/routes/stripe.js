"use strict";

module.exports = {
  routes: [
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
      method: "POST",
      path: "/stripe/webhook",
      handler: "stripe.webhook",
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
