'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications',
      handler: 'notification.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/notifications/:id/read',
      handler: 'notification.markRead',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/notifications/unread-count',
      handler: 'notification.unreadCount',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
