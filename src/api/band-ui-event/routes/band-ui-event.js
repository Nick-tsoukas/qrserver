module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/band-ui-events/track',
      handler: 'band-ui-event.track',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
