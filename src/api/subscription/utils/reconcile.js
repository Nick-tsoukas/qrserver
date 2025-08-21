// src/api/subscription/utils/reconcile.js
module.exports = {
    async reconcileUserFields(strapi, userId, nextData) {
      // Only touch fields we know exist in your user model
      const fields = ['subscriptionStatus', 'plan', 'trialEndsAt', 'gracePeriodStart']
      const current = await strapi.entityService.findOne(
        'plugin::users-permissions.user', userId, { fields }
      )
  
      const diff = {}
      if ('subscriptionStatus' in nextData && current.subscriptionStatus !== nextData.subscriptionStatus) {
        diff.subscriptionStatus = nextData.subscriptionStatus
      }
      if ('plan' in nextData && current.plan !== nextData.plan) {
        diff.plan = nextData.plan
      }
      if ('trialEndsAt' in nextData) {
        const sameTrial = String(current.trialEndsAt || '') === String(nextData.trialEndsAt || '')
        if (!sameTrial) diff.trialEndsAt = nextData.trialEndsAt
      }
      if ('gracePeriodStart' in nextData) {
        const sameGrace = String(current.gracePeriodStart || '') === String(nextData.gracePeriodStart || '')
        if (!sameGrace) diff.gracePeriodStart = nextData.gracePeriodStart
      }
  
      if (Object.keys(diff).length) {
        await strapi.entityService.update('plugin::users-permissions.user', userId, { data: diff })
      }
    }
  }
  