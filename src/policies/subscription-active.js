// path: src/policies/subscription-active.js
module.exports = (policyContext, config, { strapi }) => {
  const { state, response } = policyContext;
  const user = state.user;

  if (!user) {
    return response.unauthorized('You must be logged in.');
  }

  // read the subscriptionStatus off the user
  const subscriptionStatus = user.subscriptionStatus;

  // Allow if active or trial
  if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
    return response.forbidden(
      'Your subscription must be active or in trial to use this feature.'
    );
  }

  // all good
  return true;
};
