// path: src/api/band/routes/live-signals.js
'use strict';

/**
 * Live Signals Route
 * Provides real-time analytics data for the Smart Link Live Surface feature
 */

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/bands/:id/live-signals',
      handler: 'live-signals.getLiveSignals',
      config: { auth: false },
    },
  ],
};
