// path: src/api/qr/policies/only-one-qr.js
'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  const { state, response } = policyContext;
  const user = state.user;

  // 1) Must be logged in
  if (!user) {
    return response.unauthorized('You must be logged in to create a QR code.');
  }

  // 2) Define special users with higher QR limits
  const specialUsers = [
    'mjc773@gmail.com',
    'partner@musicbizqr.com',
  ];

  // Default QR limit
  let qrLimit = 1;

  // Special users get higher limit
  if (specialUsers.includes(user.email)) {
    qrLimit = 10;
  }

  // 3) Count how many QR codes this user already has
  const existing = await strapi.entityService.findMany('api::qr.qr', {
    filters: { users_permissions_user: user.id },
    pagination: { pageSize: qrLimit + 1 }, // no need to fetch more than limit
  });

  // 4) Enforce limit
  if (existing.length >= qrLimit) {
    return response.forbidden(`You may only create up to ${qrLimit} QR code(s).`);
  }

  // 5) Otherwise allow
  return true;
};
