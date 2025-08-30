// path: src/api/band/policies/only-one-band.js
'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  const { state, response } = policyContext;
  const user = state.user;

  // Not logged in
  if (!user) {
    return response.unauthorized('You must be logged in.');
  }

  // Special users with higher limits
  const specialUsers = [
    'mjc773@gmail.com',
    'partner@musicbizqr.com',
  ];

  // Default band limit
  let bandLimit = 1;

  // Give special users a higher limit
  if (specialUsers.includes(user.email)) {
    bandLimit = 10;
  }

  // Count how many bands this user already has
  const bands = await strapi.entityService.findMany('api::band.band', {
    filters: { users_permissions_user: { id: user.id } },
    publicationState: 'live',
  });

  if (bands.length >= bandLimit) {
    return response.forbidden(`You may only create up to ${bandLimit} band(s).`);
  }

  // Allowed to proceed
  return true;
};
