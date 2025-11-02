'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/band-external-accounts',
      handler: 'band-external-account.find',
      config: {
        auth: false, // or true if you want to lock it down
      },
    },
    {
      method: 'GET',
      path: '/band-external-accounts/:id',
      handler: 'band-external-account.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/band-external-accounts',
      handler: 'band-external-account.create',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/band-external-accounts/:id',
      handler: 'band-external-account.update',
      config: {
        auth: false,
      },
    },
    {
      method: 'DELETE',
      path: '/band-external-accounts/:id',
      handler: 'band-external-account.delete',
      config: {
        auth: false,
      },
    },
  ],
};
