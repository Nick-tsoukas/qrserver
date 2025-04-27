// Strapi v4 – qr lifecycles
"use strict";

const { ApplicationError } = require("@strapi/utils").errors;

module.exports = {
  /**
   * Block creation if the user already owns a QR.
   */
  async beforeCreate(event) {
    const { data } = event.params;

    // The logged‑in user is supplied automatically in REST calls:
    //  data.users_permissions_user.connect.id  (numeric user ID)
    const userId =
      data?.users_permissions_user?.connect?.id ||
      data?.users_permissions_user; // adjust if you use a different field

    if (!userId) return; // safety

    const count = await strapi.entityService.count("api::qr.qr", {
      filters: { users_permissions_user: userId },
    });

    if (count >= 1)
      throw new ApplicationError("You can only create one QR code.");
  },
};
