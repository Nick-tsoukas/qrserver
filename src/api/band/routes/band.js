module.exports = {
    routes: [
      {
        method: "GET",
        path: "/bands",
        handler: "band.find",
        config: {
          auth: false, // Allow public access
        },
      },
      {
        method: "GET",
        path: "/bands/:id", // Fetch band by ID
        handler: "band.findById",
        config: {
          auth: false,
        },
      },
      {
        method: "GET",
        path: "/bands/slug/:slug", // Fetch band by Slug
        handler: "band.findBySlug",
        config: {
          auth: false,
        },
      },
    ],
  };
  