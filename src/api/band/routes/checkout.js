"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/bands/:id/payments/checkout",
      handler: "checkout.create",
      config: {
        auth: false, // public fans
      },
    },
  ],
};
