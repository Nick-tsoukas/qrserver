// path: src/api/band/routes/band.js
'use strict';

module.exports = {
  type: 'content-api',   // ← tell Strapi these are content‐API routes
  routes: [
    // PUBLIC: list all bands
    {
      method: 'GET',
      path: '/bands',
      handler: 'band.find',
      config: { auth: false },
    },
    // PUBLIC: search bands (must be before :id to avoid matching "search" as an ID)
    {
      method: 'GET',
      path: '/bands/search',
      handler: 'band.search',
      config: { auth: false },
    },
    // PUBLIC: get by slug (must be before :id)
    {
      method: 'GET',
      path: '/bands/slug/:slug',
      handler: 'band.findBySlug',
      config: { auth: false },
    },
    // PUBLIC: get by ID
    {
      method: 'GET',
      path: '/bands/:id',
      handler: 'band.findOne',
      config: { auth: false },
    },

    // PROTECTED: create one band
    {
      method: 'POST',
      path: '/bands',
      handler: 'band.create',
      config: {
        policies: [
          'plugin::users-permissions.isAuthenticated',  // correct policy name
          'global::subscription-active',
          'api::band.only-one-band',
        ],
      },
    },
    // PROTECTED: update
    {
      method: 'PUT',
      path: '/bands/:id',
      handler: 'band.update',
      config: {
        policies: [
          'plugin::users-permissions.isAuthenticated',
          'global::subscription-active',
          'api::band.owns-band',
        ],
      },
    },
    // PROTECTED: delete
    {
      method: 'DELETE',
      path: '/bands/:id',
      handler: 'band.delete',
      config: {
        policies: [
          'plugin::users-permissions.isAuthenticated',
          'global::subscription-active',
          'api::band.owns-band',
        ],
      },
    },
  ],
};
