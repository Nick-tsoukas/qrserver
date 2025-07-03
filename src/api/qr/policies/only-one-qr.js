// path: src/api/qr/policies/only-one-qr.js
'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  const { state, response } = policyContext;
  const user = state.user;

  // 1) Must be logged in
  if (!user) {
    return response.unauthorized('You must be logged in to create a QR code.');
  }

  // 2) Count how many QR records this user already has
  //    We only need up to 3, so limit pageSize to 3
  const existing = await strapi.entityService.findMany('api::qr.qr', {
    filters: { users_permissions_user: user.id },
    pagination: { pageSize: 1 }, // fetch at most 3
  });

  // 3) If user already has 3 or more, block creation
  if (existing.length >= 1) {
    return response.forbidden('You can only create up to 3 QR codes.');
  }

  // 4) Otherwise allow
  return true;
};
