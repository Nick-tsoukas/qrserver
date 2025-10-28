"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/analytics/rollups",
      handler: "analytics.rollups",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/geo",
      handler: "analytics.geo",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/transitions",
      handler: "analytics.transitions",
      config: { auth: false },
    },
  ],
};
