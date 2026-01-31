'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/qrs/lookup',
      handler: 'qr.lookup',
      config: {
        auth: false,
      },
    },
  ],
};
