// ./src/api/test/routes/test.js

module.exports = {
  routes: [
    {
      method: 'GET',                        // HTTP method
      path: '/test-route',                   // Path to access the route
      handler: 'test.testMessage',           // Points to the controller function
      config: {
        auth: false,                         // No authentication needed for this route
      },
    },
  ],
};
