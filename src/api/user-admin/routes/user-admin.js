// Custom route for updating users via API token
module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/user-admin/:id',
      handler: 'user-admin.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/user-admin/by-email/:email',
      handler: 'user-admin.findByEmail',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
