'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/media-plays/track',
      handler: 'media-play.track',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
