// config/plugins.js
module.exports = ({ env }) => ({
  //------------------------------------------------
  // 1) UPLOAD PLUGIN CONFIG (AWS-S3)
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
      },
      actionOptions: {
        upload: {
          async beforeUpload(file) {
            console.log('Uploading file to AWS S3...');
            console.log('File details:', JSON.stringify(file, null, 2));
            console.log('AWS Region:', env('AWS_REGION'));
            console.log('Bucket Name:', env('AWS_BUCKET'));

            if (env('NODE_ENV') !== 'production') {
              console.log('AWS Access Key ID:', env('AWS_ACCESS_KEY_ID'));
              console.log('AWS Secret Access Key:', env('AWS_ACCESS_SECRET'));
            }
          },
          async afterUpload(file, { data }) {
            console.log('S3 Upload Response:', data);
            console.log('Uploaded file details:', JSON.stringify(file, null, 2));
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
