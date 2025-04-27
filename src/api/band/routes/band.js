module.exports = {
  routes: [
    {
      method: "GET",
      path: "/bands",
      handler: "band.find",
      config: {
        auth: false, // Public access
      },
    },
    {
      method: "GET",
      path: "/bands/:id", 
      handler: "band.findById",
      config: {
        auth: false, // Public access
      },
    },
    {
      method: "GET",
      path: "/bands/slug/:slug", 
      handler: "band.findBySlug",
      config: {
        auth: false, // Public access
      },
    },
    {
      method: "POST",
      path: "/bands",
      handler: "band.create",  // Create band controller
      config: {
        auth: { scope: [] }, // Requires authentication with no specific roles or permissions (public if empty)
      },
    },
    {
      method: "PUT",
      path: "/bands/:id", 
      handler: "band.update",  // Update band controller
      config: {
        auth: { scope: [] }, // Requires authentication with no specific roles or permissions (public if empty)
      },
    },
    {
      method: "DELETE",
      path: "/bands/:id",
      handler: "band.delete",
    },
  ],
};
