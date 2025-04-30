// path: src/api/band/policies/owns-band.js
'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  const { params, state } = policyContext;
  const bandId = params.id;
  const userId = state.user?.id;

  if (!userId) {
    return policyContext.unauthorized('You must be logged in.');
  }

  // Fetch the band AND populate its users_permissions_user relation
  const band = await strapi.entityService.findOne(
    'api::band.band',
    bandId,
    { populate: ['users_permissions_user'] }
  );

  if (!band) {
    return policyContext.notFound('Band not found.');
  }

  // Compare the related user’s ID
  if (band.users_permissions_user?.id !== userId) {
    return policyContext.forbidden('You do not own this band.');
  }

  // All good
  return true;
};
