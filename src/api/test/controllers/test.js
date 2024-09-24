// ./src/api/test/controllers/test.js

module.exports = {
    async testConnectivity(ctx) {
      ctx.send({
        message: 'Test route is working!',
      });
    },
  };