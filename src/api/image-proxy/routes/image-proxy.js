'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/image-proxy',
      handler: 'image-proxy.proxy',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
