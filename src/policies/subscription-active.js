// path: src/policies/subscription-active.js
module.exports = (policyContext, config, { strapi }) => {
  const { state, response } = policyContext;
  const user = state.user;

  if (!user) {
    return response.unauthorized('You must be logged in.');
  }

  const { subscriptionStatus, gracePeriodStart } = user;

  // always allow active or trialing
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    return true;
  }

  // allow up to 3 days past due
  if (subscriptionStatus === 'pastDue') {
    if (!gracePeriodStart) {
      return response.forbidden('Payment is past due. Please pay to continue.');
    }
    const now = Date.now();
    const graceStart = new Date(gracePeriodStart).getTime();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    if (now - graceStart <= THREE_DAYS) {
      return true;
    } else {
      return response.forbidden(
        'Your 3-day grace period has ended. Please pay to resume access.'
      );
    }
  }

  // all other statuses (canceled, incomplete, etc.) get blocked
  return response.forbidden(
    'Your subscription is not active. Please subscribe to use this feature.'
  );
};
