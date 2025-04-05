"use strict";

module.exports = {
  async confirmEmail(ctx) {
    const { token } = ctx.query;
    if (!token) {
      return ctx.badRequest("Missing token.");
    }

    // Find the user with the matching confirmation token
    const user = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: { confirmationToken: token },
    });

    if (!user) {
      return ctx.badRequest("Invalid or expired token.");
    }

    // Update the user: mark as confirmed and remove the token
    await strapi.db.query("plugin::users-permissions.user").update({
      where: { id: user.id },
      data: {
        confirmed: true,
        confirmationToken: null,
      },
    });

    // Generate a JWT for the user
    const jwt = strapi.plugin("users-permissions").service("jwt").issue({ id: user.id });

    // Redirect to the frontend dashboard with the JWT as a query parameter
    ctx.redirect(`https://musicbizqr.com/dashboard?token=${jwt}`);
    // ctx.redirect(`http://localhost:3000/dashboard?token=${jwt}`);

  },
};
