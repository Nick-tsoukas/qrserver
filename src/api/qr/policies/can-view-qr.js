'use strict';

// Allow viewing a QR if you own it, or if it is explicitly shared with your account.
// This is used to support read-only shared access (view/download/analytics) without granting edit/delete.
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

  const qr = await strapi.entityService.findOne('api::qr.qr', qrId, {
    populate: ['users_permissions_user'],
  });

  if (!qr) {
    return response.notFound('QR not found.');
  }

  // Owner can always view
  if (String(qr.users_permissions_user?.id) === String(user.id)) {
    return true;
  }

  // Explicit read-only share list (team access)
  const sharedViewEmails = ['info@rocksnaps.com', 'novamusic@aol.com'];
  const sharedQrIds = ['46'];

  const userEmail = String(user.email || '').toLowerCase();
  if (sharedViewEmails.includes(userEmail) && sharedQrIds.includes(String(qrId))) {
    return true;
  }

  return response.forbidden('You do not have permission to view this QR.');
};
