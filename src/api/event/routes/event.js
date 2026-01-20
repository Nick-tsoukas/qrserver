'use strict';

/**
 * event router - Custom routes to match bands pattern
 */

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/events',
      handler: 'event.find',
      config: {
        auth: false,  // Match bands pattern - filtering by user happens in query
      },
    },
    {
      method: 'GET',
      path: '/events/:id',
      handler: 'event.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/events',
      handler: 'event.create',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
    {
      method: 'PUT',
      path: '/events/:id',
      handler: 'event.update',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
    {
      method: 'DELETE',
      path: '/events/:id',
      handler: 'event.delete',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
  ],
};
