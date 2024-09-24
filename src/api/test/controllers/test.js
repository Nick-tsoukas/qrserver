const { S3Client } = require('@aws-sdk/client-s3');

module.exports = {
  async testConnectivity(ctx) {
    try {
      // Create an S3 client using the same credentials and region as in Strapi
      const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Make sure this env var is correctly named
        },
      });

      // Try listing the buckets to check connectivity
      const data = await s3Client.send(new ListBucketsCommand({}));
      ctx.send({
        message: 'AWS S3 connectivity test successful.',
        data: data.Buckets,
      });
    } catch (error) {
      console.error('Connectivity test error:', error);
      ctx.send({
        error: 'AWS S3 connectivity test failed.',
        details: error.message,
      });
    }
  },
};
