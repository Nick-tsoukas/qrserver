module.exports = {
    routes: [
      {
        method: 'GET',
        path: '/test-connectivity',
        handler: 'test.testConnectivity',
        config: {
          auth: false, // Disable auth to make it easy to access for testing
        },
      },
    ],
  };
  