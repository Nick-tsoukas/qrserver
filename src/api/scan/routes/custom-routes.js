'use strict';

/**
 * Custom routes for scan
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/scans/track',
      handler: 'scan.track',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/scans/backfill',
      handler: 'scan.backfill',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
