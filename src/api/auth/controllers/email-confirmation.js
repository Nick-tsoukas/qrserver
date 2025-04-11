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

    // Set the JWT in a cookie for the frontend
    ctx.cookies.set('strapi_jwt', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 14 * 24 * 60 * 60,  // 14 days in seconds
      path: '/',
      sameSite: true,
    });

    // Redirect to the frontend dashboard (the Nuxt Strapi module will pick up the cookie)
    ctx.redirect('https://musicbizqr.com/dashboard');
    // For local testing you might uncomment the following line:
    // ctx.redirect('http://localhost:3000/dashboard');
  },
};
