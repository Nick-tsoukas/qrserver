'use strict';

const { Resend } = require('resend');

module.exports = {
  /**
   * Initializes the custom Resend email provider.
   *
   * @param {Object} providerOptions - Provider-specific options (e.g., apiKey).
   * @param {Object} settings        - Strapi email plugin settings (e.g., defaultFrom, defaultReplyTo).
   * @return {Object}                - An object with a `send` function that Strapi calls whenever it sends email.
   */
  init(providerOptions = {}, settings = {}) {
    const { apiKey } = providerOptions;
    const resend = new Resend(apiKey);

    return {
      /**
       * Sends an email using Resend.
       *
       * @param {Object} options - Email fields passed by Strapi (to, from, subject, text, html, etc.).
       */
      async send(options) {
        // Merge default "from" address from Strapi settings if not provided
        const from = options.from || settings.defaultFrom;
        const to = options.to;
        const subject = options.subject;
        const html = options.html; // Optionally handle options.text if you prefer

        try {
          // Use Resend's client to send the email
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
