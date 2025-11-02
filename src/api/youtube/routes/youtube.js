'use strict';

module.exports = {
  routes: [
    // 1. get google auth url
    {
      method: 'GET',
      path: '/youtube/oauth/init',
      handler: 'youtube.oauthInit',
      config: {
        auth: false,
      },
    },

    // 2. handle google callback (Nuxt will call this, not Google directly)
    {
      method: 'POST',
      path: '/youtube/oauth/callback',
      handler: 'youtube.oauthCallback',
      config: {
        auth: false,
      },
    },

    // 3. user had multiple channels, they picked one
    {
      method: 'POST',
      path: '/youtube/select-channel',
      handler: 'youtube.selectChannel',
      config: {
        auth: false,
      },
    },

    // 4. optional: manual re-sync for a band
    {
      method: 'POST',
      path: '/youtube/sync',
      handler: 'youtube.sync',
      config: {
        auth: false,
      },
    },
  ],
};
