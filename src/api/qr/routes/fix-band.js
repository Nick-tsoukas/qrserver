'use strict';

module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/qrs/:id/fix-band/:bandId',
      handler: 'qr.fixBand',
      config: {
        auth: false, // Temporarily public for the fix - remove after
      },
    },
    {
      method: 'GET',
      path: '/qrs/:id/debug-band',
      handler: 'qr.debugBand',
      config: {
        auth: false,
      },
    },
  ],
};
