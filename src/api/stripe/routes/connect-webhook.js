"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/stripe/connect/webhook",
      handler: "connect-webhook.handle",
      config: {
        auth: false,
      },
    },
  ],
};
