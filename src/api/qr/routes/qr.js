// path: src/api/qr/routes/qr.js
'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    // ─ Public READ (no auth, no policies)
    {
      method: 'GET',
      path: '/qrs',
      handler: 'qr.find',
      config: {
        auth: false,
        policies: [],    // ← bypass global policies
      },
    },
    {
      method: 'GET',
      path: '/qrs/:id',
      handler: 'qr.findOne',
      config: {
        auth: false,
        policies: [],
      },
    },

    // ─ Protected CREATE
    {
      method: 'POST',
      path: '/qrs',
      handler: 'qr.create',
      config: {
        auth: true,
        policies: [
          'plugin::users-permissions.isAuthenticated',
          'global::subscription-active',
          'api::qr.only-one-qr',
        ],
      },
    },

    // ─ Protected UPDATE
    {
      method: 'PUT',
      path: '/qrs/:id',
      handler: 'qr.update',
      config: {
        auth: true,
        policies: [
          'plugin::users-permissions.isAuthenticated',
          'global::subscription-active',
          'api::qr.owns-qr',
        ],
      },
    },

    // ─ Protected DELETE
    {
      method: 'DELETE',
      path: '/qrs/:id',
      handler: 'qr.delete',
      config: {
        auth: true,
        policies: [
          'plugin::users-permissions.isAuthenticated',
          'global::subscription-active',
          'api::qr.owns-qr',
        ],
      },
    },
  ],
};
