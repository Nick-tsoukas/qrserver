// /src/extensions/users-permissions/config/email.js
module.exports = ({ env }) => ({
    email_confirmation: {
      subject: 'Confirm Your Email Address',
      // Text version of the email
      text: (data) => `
  Hello ${data.user.username || data.user.email},
  
  Please confirm your email address by clicking the link below:
  ${env('FRONTEND_URL')}/confirm?token=${data.confirmationToken}
  
  Thank you!
      `,
      // HTML version of the email
      html: (data) => `
        <p>Hello ${data.user.username || data.user.email},</p>
        <p>Please confirm your email address by clicking the link below:</p>
        <p><a href="${env('FRONTEND_URL')}/confirm?token=${data.confirmationToken}">Confirm Email</a></p>
        <p>Thank you!</p>
      `,
    },
  });