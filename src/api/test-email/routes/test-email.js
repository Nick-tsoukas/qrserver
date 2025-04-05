'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/test-email',
      handler: 'test-email.send',
      config: {
        auth: false,
      },
    },
  ],
};
