export default ({ env }) => ({
    upload: {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          accessKeyId: env('AWS_ACCESS_KEY_ID'),  // AWS Access Key from env
          secretAccessKey: env('AWS_ACCESS_SECRET'),  // AWS Secret Access Key from env
          region: env('AWS_REGION'),  // AWS Region from env
          params: {
            Bucket: env('AWS_BUCKET'),  // S3 Bucket Name from env
          },
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    },
  });