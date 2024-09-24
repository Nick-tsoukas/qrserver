// Correct CommonJS import for AWS SDK v3 in Strapi
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

module.exports = {
  async testConnectivity(ctx) {
    try {
      // Initialize the S3 client using your credentials and region
      const s3Client = new S3Client({
        region: process.env.AWS_REGION, // Ensure the region is properly set in your env vars
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,  // AWS Access Key ID
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,  // AWS Secret Key
        },
      });

      // Create a new ListBucketsCommand with no additional input (optional)
      const command = new ListBucketsCommand({});

      // Send the command to list buckets
      const data = await s3Client.send(command);

      // Respond with the list of buckets
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
