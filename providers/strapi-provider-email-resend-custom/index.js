'use strict';

const { Resend } = require('resend');

module.exports = {
  /**
   * Initializes the custom Resend email provider.
   * @param {Object} providerOptions - Provider-specific options (e.g., apiKey).
   * @param {Object} settings        - Email plugin settings from Strapi (e.g., defaultFrom, defaultReplyTo).
   * @return {Object}                - An object with a `send` function that Strapi calls.
   */
  init(providerOptions = {}, settings = {}) {
    const { apiKey } = providerOptions;
    const resend = new Resend(apiKey);

    return {
      /**
       * Sends an email using Resend.
       * @param {Object} options - The email fields passed by Strapi (to, from, subject, text, html, etc.).
       */
      async send(options) {
        // Merge Strapi settings + plugin options
        const from = options.from || settings.defaultFrom;
        const to = options.to;
        const subject = options.subject;
        const html = options.html;  // If you want to support text-only, you can also pass options.text.

        try {
          await resend.emails.send({
            from,
            to,
            subject,
            html,
          });
        } catch (err) {
          throw new Error(`Resend provider error: ${err.message}`);
        }
      },
    };
  },
};
