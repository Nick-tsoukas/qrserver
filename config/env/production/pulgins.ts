module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        // Optional: baseUrl if you're using a CDN or custom domain
        baseUrl: env('CDN_URL'), // Optional: Custom CDN URL
        rootPath: env('CDN_ROOT_PATH'), // Optional: Custom CDN root path
        s3Options: {
          credentials: {
            accessKeyId: env('AWS_ACCESS_KEY_ID'),
            secretAccessKey: env('AWS_ACCESS_SECRET'),
          },
          region: env('AWS_REGION'),
          params: {
            Bucket: env('AWS_BUCKET'),
            ACL: env('AWS_ACL', 'public-read'), // Set to 'private' for signed URLs
            signedUrlExpires: env('AWS_SIGNED_URL_EXPIRES', 15 * 60), // Expiration for signed URLs (15 mins default)
          },
        },
      },
      actionOptions: {
        upload: {},  // Actions to be performed during upload
        uploadStream: {}, // Actions during uploadStream (used for streaming)
        delete: {},  // Actions during delete
      },
    },
  },
});