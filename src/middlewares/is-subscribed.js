module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("You must be logged in.");
      }
      // only allow if subscriptionStatus is trialing or active
      if (!["trialing", "active"].includes(user.subscriptionStatus)) {
        return ctx.forbidden("Your subscription is not active. Please renew to continue.");
      }
      await next();
    };
  };
  