'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  // Get notifications for authenticated user
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const notifications = await strapi.entityService.findMany('api::notification.notification', {
      filters: {
        user: user.id,
        channel: 'in_app',
      },
      sort: { createdAt: 'desc' },
      limit: 50,
      populate: ['band'],
    });

    return { data: notifications };
  },

  // Mark notification as read
  async markRead(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    const notification = await strapi.entityService.findOne('api::notification.notification', id, {
      populate: ['user'],
    });

    if (!notification) {
      return ctx.notFound('Notification not found');
    }

    if (notification.user?.id !== user.id) {
      return ctx.forbidden('Not your notification');
    }

    const updated = await strapi.entityService.update('api::notification.notification', id, {
      data: { readAt: new Date() },
    });

    return { data: updated };
  },

  // Get unread count
  async unreadCount(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const count = await strapi.entityService.count('api::notification.notification', {
      filters: {
        user: user.id,
        channel: 'in_app',
        readAt: { $null: true },
      },
    });

    return { count };
  },
}));
