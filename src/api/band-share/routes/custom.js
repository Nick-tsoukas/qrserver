'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/band-shares/record',
      handler: 'band-share.record',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
