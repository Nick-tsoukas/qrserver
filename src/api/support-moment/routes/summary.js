'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/support-moments/:id/summary',
      handler: 'support-moment.summary',
      config: {
        auth: false,
      },
    },
  ],
};
