// Custom route for updating users - uses secret header for auth
module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/user-admin/:id',
      handler: 'user-admin.update',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/user-admin/by-email/:email',
      handler: 'user-admin.findByEmail',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/user-admin/register',
      handler: 'user-admin.register',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
