// ./src/api/test/controllers/test.js

module.exports = {
  async testMessage(ctx) {
    // Send a simple "Hello, world!" response
    ctx.send({
      message: 'Hello, world!',
    });
  },
};
