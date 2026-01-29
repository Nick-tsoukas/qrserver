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

  async register(ctx) {
    if (!validateSecret(ctx)) {
      return ctx.unauthorized('Invalid or missing authorization');
    }

    const { username, email, password, confirmed, provider } = ctx.request.body;

    if (!email || !password) {
      return ctx.badRequest('Missing email or password');
    }

    try {
      // Check if user already exists
      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email }
      });

      if (existingUser) {
        return ctx.badRequest('User with this email already exists');
      }

      // Get authenticated role
      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' }
      });

      if (!authRole) {
        return ctx.badRequest('Authenticated role not found');
      }

      // Create user directly without sending confirmation email
      const newUser = await strapi.plugins['users-permissions'].services.user.add({
        username: username || email,
        email,
        password,
        provider: provider || 'local',
        confirmed: confirmed !== false, // default to true
        role: authRole.id,
      });

      strapi.log.info('[user-admin] User registered:', { userId: newUser.id, email });

      return { data: newUser };
    } catch (error) {
      strapi.log.error('[user-admin] Register error:', error);
      return ctx.badRequest('Failed to register user', { error: error.message });
    }
  },
};
