// path: src/api/qr/policies/owns-qr.js
'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  const { state, response, params } = policyContext;
  const user = state.user;
  const qrId = params.id;

  if (!user) {
    return response.unauthorized('You must be logged in.');
  }

  if (!qrId) {
    return response.badRequest('Missing QR ID');
  }

  // Fetch the QR and populate its user relation
  const qr = await strapi.entityService.findOne('api::qr.qr', qrId, {
    populate: ['users_permissions_user'],
  });

  strapi.log.debug(`[owns-qr] QR ${qrId}: owner=${qr?.users_permissions_user?.id}, user=${user.id}`);

  if (!qr) {
    return response.notFound('QR not found.');
  }

  // Compare the owner ID
  if (String(qr.users_permissions_user?.id) !== String(user.id)) {
    strapi.log.debug(`[owns-qr] DENIED: QR owner ${qr.users_permissions_user?.id} !== user ${user.id}`);
    return response.forbidden('You do not have permission to modify this QR.');
  }

  return true;
};
