// path: src/extensions/users-permissions/strapi-server.js

module.exports = (plugin) => {
  // Override the confirmation email template with a hard-coded URL
  plugin.config.email.email_confirmation = {
    subject: 'Confirm Your Email Address',
    text: (data) => `
Hello ${data.user.username || data.user.email},

Please confirm your email by clicking the link below:
https://qrserver-production.up.railway.app/api/auth/confirm-email?token=${data.confirmationToken}

Thank you!
    `,
    html: (data) => `
<p>Hello ${data.user.username || data.user.email},</p>
<p>Please confirm your email by clicking the link below:</p>
<p>
  <a href="https://qrserver-production.up.railway.app/api/auth/confirm-email?token=${data.confirmationToken}">
    Confirm Email
  </a>
</p>
<p>Thank you!</p>
    `,
  };

  // Preserve or customize other plugin extensions (e.g., policies)
  plugin.policies = plugin.policies || {};
  plugin.policies['isAuthenticated'] = (policyContext, config, { strapi }) => {
    // returns true if logged in (ctx.state.user exists), false otherwise
    return Boolean(policyContext.state.user);
  };

  return plugin;
};
