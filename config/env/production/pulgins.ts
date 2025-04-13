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
        requestChecksumCalculation: function () {
          return false;
        },
        responseChecksumValidation: function () {
          return false;
        },

      },
      actionOptions: {
        upload: {
          async beforeUpload(file) {
            // ...
          },
          async afterUpload(file, { data }) {
            // ...
          },
          async onError(error) {
            console.error('Upload failed:', error.message);
            console.error('Full error stack:', error);
          },
        },
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
      providerOptions: {
        apiKey: env('RESEND_API_KEY'),
      },
      settings: {
        defaultFrom: env('EMAIL_DEFAULT_FROM'),
        defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO'),
      },
    },
  },

  //------------------------------------------------
  // 3) USERS & PERMISSIONS CONFIG (Optional)
  //------------------------------------------------
  'users-permissions': {
    config: {
      emailConfirmation: true,
      emailConfirmationRedirection: 'https://my-frontend.com/after-confirmation',
    },
  },
});
