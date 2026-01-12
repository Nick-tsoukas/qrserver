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
    // QR analytics
    {
      method: "GET",
      path: "/analytics/qr-rollups",
      handler: "analytics.qrRollups",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/qr-geo",
      handler: "analytics.qrGeo",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/qr-sources",
      handler: "analytics.qrSources",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/analytics/qr-devices",
      handler: "analytics.qrDevices",
      config: { auth: false },
    },
    // MBQ Pulse
    {
      method: "GET",
      path: "/analytics/pulse",
      handler: "analytics.pulse",
      config: { auth: false },
    },
    // Push dry-run (dev/debug)
    {
      method: "GET",
      path: "/analytics/push/dry-run",
      handler: "analytics.pushDryRun",
      config: { auth: false },
    },
    // Push opt-in
    {
      method: "POST",
      path: "/push/opt-in",
      handler: "analytics.pushOptIn",
      config: { policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/push/opt-in/status",
      handler: "analytics.pushOptInStatus",
      config: { policies: [], middlewares: [] },
    },
    // Geo States (USA Heat Map)
    {
      method: "GET",
      path: "/analytics/geo-states",
      handler: "analytics.geoStates",
      config: { auth: false },
    },
  ],
};
