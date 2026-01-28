// Custom controller for updating users - secured by secret header
'use strict';

const ADMIN_SECRET = process.env.USER_ADMIN_SECRET || process.env.STRAPI_API_TOKEN;

function validateSecret(ctx) {
  const authHeader = ctx.request.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token || token !== ADMIN_SECRET) {
    return false;
  }
  return true;
}

module.exports = {
  async update(ctx) {
    if (!validateSecret(ctx)) {
      return ctx.unauthorized('Invalid or missing authorization');
    }

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
    if (!validateSecret(ctx)) {
      return ctx.unauthorized('Invalid or missing authorization');
    }

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
