// config/env/production/plugins.ts
module.exports = ({ env }) => ({
  jwt: {
    secret: env('JWT_SECRET'),
  },

  //------------------------------------------------
  // 1) UPLOAD PLUGIN CONFIG (AWS S3)
  //------------------------------------------------
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        baseUrl: env('CDN_URL'),
        rootPath: env('CDN_ROOT_PATH'),
        s3Options: {
          region: env('AWS_REGION'),
          credentials: {
            accessKeyId: env('AWS_ACCESS_KEY_ID'),
            secretAccessKey: env('AWS_ACCESS_SECRET'),
          },
        },
        params: {
          Bucket: env('AWS_BUCKET'),
        },
        computeChecksums: false,
        requestChecksumCalculation: () => false,
        responseChecksumValidation: () => false,
      },
      actionOptions: {
        upload: { async beforeUpload(file) {/*...*/}, async afterUpload(file, { data }) {/*...*/}, async onError(err) { console.error('Upload error:', err); } },
        uploadStream: {},
        delete: {},
      },
    },
  },

  //------------------------------------------------
  // 2) EMAIL PLUGIN CONFIG (RESEND-CUSTOM)
  //------------------------------------------------
  email: {
    config: {
      provider: 'strapi-provider-email-resend',
      providerOptions: { apiKey: env('RESEND_API_KEY') },
      settings: { defaultFrom: env('EMAIL_DEFAULT_FROM'), defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO') },
    },
  },

  //------------------------------------------------
  // 3) USERS & PERMISSIONS CONFIG test push to git 
  //------------------------------------------------
  'users-permissions': {
    config: {
      // Disable Strapi's default confirmation email behavior if using custom logic
      emailConfirmation: false,
      // Redirect after confirmation (if default handler is still used)
      emailConfirmationRedirection: 'https://my-frontend.com/after-confirmation',
      // **Custom email template override**
      email: {
        email_confirmation: {
          subject: 'Please Confirm Your Email',
          text: data => `
Hello ${data.user.username || data.user.email},

You’re almost set! Confirm your email by clicking the link below:
https://qrserver-production.up.railway.app/api/auth/confirm-email?token=${data.confirmationToken}

Thank you for joining!
          `,
          html: data => `
<p>Hello ${data.user.username || data.user.email},</p>
<p>You’re almost set! Confirm your email by clicking the link below:</p>
<p><a href="https://qrserver-production.up.railway.app/api/auth/confirm-email?token=${data.confirmationToken}">Confirm Email</a></p>
<p>Thank you for joining!</p>
          `,
        },
      },
    },
  },
});
