'use strict';

/**
 * Custom routes for event-page-view
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/event-page-views/track',
      handler: 'event-page-view.track',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
