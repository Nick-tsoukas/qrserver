// path: src/api/qr/policies/only-one-qr.js
'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  // return true;

  const { state, response } = policyContext;
  const user = state.user;

  // Must be logged in
  if (!user) {
    return response.unauthorized('You must be logged in to create a QR code.');
  }

  // Check if the user already has a QR
  const existing = await strapi.entityService.findMany('api::qr.qr', {
    filters: { users_permissions_user: user.id },
    limit: 1,
  });

  if (existing.length > 0) {
    return response.forbidden('You can only create one QR code.');
  }

  // All good
  return true;
};
