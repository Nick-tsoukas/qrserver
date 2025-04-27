'use strict';

module.exports = {
  /**
   * Triggered before `create` (i.e. POST /qrs)
   */
  async beforeCreate(event) {
    const { data, params } = event;
    const { ctx } = params;

    // You should be authenticated; Strapi will put the current user in ctx.state.user
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized("You must be logged in to create a QR code.");
    }

    // Count how many QRs this user already owns
    const existingCount = await strapi.db
      .query('api::qr.qr')
      .count({ where: { users_permissions_user: user.id } });

    if (existingCount >= 1) {
      // Prevent creation
      return ctx.throw(400, 'You may only have one QR code at a time.');
    }

    // Otherwise, let the create proceed…
  },
};
