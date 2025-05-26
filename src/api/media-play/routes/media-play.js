'use strict';

module.exports = {
  routes: [
    // Standard “find all” endpoint
    {
      method: 'GET',
      path: '/media-plays',
      handler: 'api::media-play.media-play.find',
      config: { policies: [] },
    },
    // Standard “find one” endpoint
    {
      method: 'GET',
      path: '/media-plays/:id',
      handler: 'api::media-play.media-play.findOne',
      config: { policies: [] },
    },
    // Custom track endpoint
    {
      method: 'POST',
      path: '/media-plays/track',
      handler: 'api::media-play.media-play.track',
      config: { policies: [] },
    },
  ],
};
