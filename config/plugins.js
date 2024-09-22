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
          // Add more detailed logging before the upload
          async beforeUpload(file) {
            console.log('Uploading file to AWS S3...');
            console.log('File details:', file);
            console.log('AWS Access Key ID:', env('AWS_ACCESS_KEY_ID'));
            console.log('AWS Secret Access Key:', env('AWS_ACCESS_SECRET'));  // You may want to remove this in production
            console.log('AWS Region:', env('AWS_REGION'));
            console.log('Bucket Name:', env('AWS_BUCKET'));
          },
          // Add detailed logging after the upload
          async afterUpload(file, { data }) {
            console.log('S3 Upload Response:', data);
            console.log('Uploaded file details:', file);
          },
        },
        uploadStream: {},
        delete: {},
      },
    },
  },
});
