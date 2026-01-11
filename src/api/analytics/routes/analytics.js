"use strict";

module.exports = {
  routes: [
    // Band analytics
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
    {
      method: "GET",
      path: "/analytics/follows",
      handler: "analytics.follows",
      config: { auth: false },
    },
    // Event analytics
    {
      method: "GET",
      path: "/analytics/event-rollups",
      handler: "analytics.eventRollups",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/event-geo",
      handler: "analytics.eventGeo",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/event-sources",
      handler: "analytics.eventSources",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/event-devices",
      handler: "analytics.eventDevices",
      config: { auth: false },
    },
  ],
};
