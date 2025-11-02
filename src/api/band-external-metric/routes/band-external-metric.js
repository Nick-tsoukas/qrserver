'use strict';

module.exports = {
  routes: [
    // 1) custom routes FIRST
    {
      method: 'GET',
      path: '/band-external-metrics/latest',
      handler: 'band-external-metric.latest',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/band-external-metrics/upsert',
      handler: 'band-external-metric.upsert',
      config: { auth: false },
    },

    // 2) THEN generic CRUD
    {
      method: 'GET',
      path: '/band-external-metrics',
      handler: 'band-external-metric.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/band-external-metrics/:id',
      handler: 'band-external-metric.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/band-external-metrics',
      handler: 'band-external-metric.create',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/band-external-metrics/:id',
      handler: 'band-external-metric.update',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/band-external-metrics/:id',
      handler: 'band-external-metric.delete',
      config: { auth: false },
    },
  ],
};
