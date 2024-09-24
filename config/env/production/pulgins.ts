module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        // Optional: If using a CDN or custom domain
        baseUrl: env('CDN_URL'),
        rootPath: env('CDN_ROOT_PATH'),
        s3Options: {
          region: env('AWS_REGION'),
          credentials: {
            accessKeyId: env('AWS_ACCESS_KEY_ID'),
            secretAccessKey: env('AWS_ACCESS_SECRET'),
          },
        },
        // 'params' should be at the same level as 's3Options'
        params: {
          Bucket: env('AWS_BUCKET'),
          // Optional: Set ACL and signed URL expiration if needed
          // ACL: env('AWS_ACL', 'public-read'),
          // signedUrlExpires: env('AWS_SIGNED_URL_EXPIRES', 15 * 60),
        },
      },
      actionOptions: {
        upload: {
          async beforeUpload(file) {
            console.log('Uploading file to AWS S3...');
            console.log('File details:', JSON.stringify(file, null, 2));
            console.log('AWS Region:', env('AWS_REGION'));
            console.log('Bucket Name:', env('AWS_BUCKET'));

            // Do not log secret access keys in production
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
});
