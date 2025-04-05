'use strict';

module.exports = {
  async send(ctx) {
    try {
      // Get the email service from Strapi
      const emailService = strapi.plugins['email'].services.email;
      // Alternatively in Strapi v4 style: const emailService = strapi.plugin('email').service('email');

      // Send test email
      await emailService.send({
        to: 'nick.tsoukas101@gmail.com',
        from: 'noreply@musicbizqr.com',
        replyTo: 'noreply@musicbizqr.com',
        subject: 'Hello from Strapi + Resend',
        text: 'This is a test email using Resend provider with Strapi!',
      });

      ctx.send({ message: 'Email sent successfully' });
    } catch (err) {
      ctx.send({ error: err.message });
    }
  }
};
