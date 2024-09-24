// ~/strapi-aws-s3/backend/config/plugins.js

module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        accessKeyId: env('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env('AWS_ACCESS_SECRET'),
        region: env('AWS_REGION'),
        params: {
          ACL: env('AWS_ACL', 'public-read'),
          signedUrlExpires: env('AWS_SIGNED_URL_EXPIRES', 15 * 60),
          Bucket: env('AWS_BUCKET'),
        },
      },
      actionOptions: {
        upload: {
          async beforeUpload(file) {
            console.log('Uploading file to AWS S3...');
            console.log('File details:', JSON.stringify(file, null, 2));
            console.log('AWS Access Key ID:', env('AWS_ACCESS_KEY_ID'));
            console.log('AWS Region:', env('AWS_REGION'));
            console.log('Bucket Name:', env('AWS_BUCKET'));

            // Don't log secret access keys in production
            if (process.env.NODE_ENV !== 'production') {
              console.log('AWS Secret Access Key:', env('AWS_ACCESS_SECRET'));
            }
          },
          async afterUpload(file, { data }) {
            console.log('S3 Upload Response:', data);
            console.log('Uploaded file details:', JSON.stringify(file, null, 2));
          },
          async onError(error) {
            console.error('Upload failed:', error.message);
            console.error('Full error stack:', JSON.stringify(error, null, 2));
          },
        },
        uploadStream: {
          async beforeUploadStream(file) {
            console.log('Uploading file stream to AWS S3...');
            console.log('File stream details:', JSON.stringify(file, null, 2));
          },
        },
        delete: {
          async beforeDelete(file) {
            console.log('Deleting file from AWS S3...');
            console.log('File to delete:', JSON.stringify(file, null, 2));
          },
        },
      },
    },
  },
});
