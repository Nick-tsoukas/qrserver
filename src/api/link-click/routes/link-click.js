module.exports = {
    routes: [
      {
        method: "POST",
        path: "/link-clicks/track",
        handler: "link-click.trackClick",
        config: {
          policies: [],
          middlewares: [],
        },
      },
      {
        method: "GET",
        path: "/link-clicks/band/:bandId",
        handler: "link-click.getBandClicks",
        config: {
          policies: [],
          middlewares: [],
        },
      },
    ],
  };
  