"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/auth/confirm-email",
      handler: "email-confirmation.confirmEmail",
      config: {
        auth: false,
      },
    },
  ],
};
