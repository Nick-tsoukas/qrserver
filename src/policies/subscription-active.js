// path: src/policies/subscription-active.js
module.exports = (policyContext, config, { strapi }) => {
  const { state, response } = policyContext;
  const user = state.user;

  if (!user) {
    return response.unauthorized('You must be logged in.');
  }

  // 1) Free accounts always allowed
  if (user.free === true) {
    return true;
  }

  const { subscriptionStatus, gracePeriodStart, cancelAt } = user;
  const now = Date.now();

  // 2) Active or trialing
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    return true;
  }

  // 3) Past due: up to 3-day grace period
  if (subscriptionStatus === 'pastDue') {
    if (!gracePeriodStart) {
      return response.forbidden('Payment is past due. Please pay to continue.');
    }
    const graceStart = new Date(gracePeriodStart).getTime();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    if (now - graceStart <= THREE_DAYS) {
      return true;
    }
    return response.forbidden(
      'Your 3-day grace period has ended. Please pay to resume access.'
    );
  }

  // 4) Canceling: still within paid period
  if (subscriptionStatus === 'canceling') {
    if (!cancelAt) {
      return response.forbidden('Your subscription is canceling. Please renew to continue.');
    }
    const cancelTime = new Date(cancelAt).getTime();
    if (now <= cancelTime) {
      return true;
    }
    return response.forbidden(
      'Your subscription has ended. Please renew to regain access.'
    );
  }

  // 5) All other statuses blocked
  return response.forbidden(
    'Your subscription is not active. Please subscribe to use this feature.'
  );
};
