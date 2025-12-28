"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/bands/:id/payments/onboard",
      handler: "payments.onboard",
      config: {
        policies: [
          "plugin::users-permissions.isAuthenticated",
          "api::band.owns-band",
        ],
      },
    },
    {
      method: "GET",
      path: "/bands/:id/payments/summary",
      handler: "payments.summary",
      config: {
        policies: [
          "plugin::users-permissions.isAuthenticated",
          "api::band.owns-band",
        ],
      },
    },
  ],
};
