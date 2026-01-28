// Custom controller for updating users via API token
'use strict';

module.exports = {
  async update(ctx) {
    const { id } = ctx.params;
    const data = ctx.request.body;

    try {
      // Update the user using the users-permissions plugin service
      const updatedUser = await strapi.entityService.update(
        'plugin::users-permissions.user',
        id,
        { data }
      );

      return { data: updatedUser };
    } catch (error) {
      strapi.log.error('[user-admin] Update error:', error);
      return ctx.badRequest('Failed to update user', { error: error.message });
    }
  },

  async findByEmail(ctx) {
    const { email } = ctx.params;

    try {
      const users = await strapi.entityService.findMany(
        'plugin::users-permissions.user',
        {
          filters: { email: email },
          limit: 1,
        }
      );

      return users;
    } catch (error) {
      strapi.log.error('[user-admin] FindByEmail error:', error);
      return ctx.badRequest('Failed to find user', { error: error.message });
    }
  },
};
