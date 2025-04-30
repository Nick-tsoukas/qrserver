// path: src/api/band/policies/only-one-band.js
'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  const { state, response } = policyContext;
  const user = state.user;

  // Not logged in
  if (!user) {
    return response.unauthorized('You must be logged in.');
  }

  // Count how many bands this user already has
  const bands = await strapi.entityService.findMany('api::band.band', {
    filters: { users_permissions_user: { id: user.id } },
    publicationState: 'live',
  });

  if (bands.length >= 1) {
    return response.forbidden('You may only create one band.');
  }

  // Allowed to proceed
  return true;
};
