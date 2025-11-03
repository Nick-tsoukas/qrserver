"use strict";

module.exports = {
  routes: [
    // run muse for one band / one day
    {
      method: "POST",
      path: "/muse/run",
      handler: "muse.run",
      config: { auth: false },
    },

    // optional backfill
    {
      method: "POST",
      path: "/muse/backfill",
      handler: "muse.backfill",
      config: { auth: false },
    },

    // aggregate for UI (Nuxt analytics page calls this)
    {
      method: "GET",
      path: "/muse/aggregate",
      handler: "muse.aggregate",
      config: { auth: false },
    },
  ],
};
