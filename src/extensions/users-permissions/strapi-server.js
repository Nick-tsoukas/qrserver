// path: src/extensions/users-permissions/strapi-server.js
module.exports = (plugin) => {
    plugin.policies['isAuthenticated'] = (policyContext, config, { strapi }) => {
      // returns true if logged in (ctx.state.user exists), false otherwise
      return Boolean(policyContext.state.user);
    };
    return plugin;
  };