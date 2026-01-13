'use strict';

/**
 * MBQ Shareables V1 — Cooldown System
 * 
 * Prevents the same card type from appearing too frequently for a band.
 * Cooldown state is stored in system-kv per band + card type.
 */

// ============================================================
// COOLDOWN DEFINITIONS (V1)
// ============================================================

const COOLDOWN_HOURS = {
  CITY_CLAIM: 12,
  MOMENTUM_SURGE: 6,
  AFTER_SHOW_ENERGY: 24,
  PEAK_HOUR: 6,
  SHARE_CHAIN: 12,
  PLATFORM_PULL: 12,
  RETURNING_FANS: 24,
  ENGAGED_SESSIONS: 24,
  NEW_CITY_UNLOCKED: 48,
  MILESTONE_DROP: null, // Special: once per milestone
};

const SCORE_BYPASS_THRESHOLD = 20; // Bypass cooldown if new score is +20 higher

// ============================================================
// COOLDOWN KEY HELPERS
// ============================================================

/**
 * Generate cooldown key for a card type
 * @param {number} bandId 
 * @param {string} cardType 
 * @returns {string}
 */
function getCooldownKey(bandId, cardType) {
  return `shareable:cooldown:${bandId}:${cardType}`;
}

/**
 * Generate milestone key for tracking which milestones have been shown
 * @param {number} bandId 
 * @returns {string}
 */
function getMilestoneKey(bandId) {
  return `shareable:milestones:${bandId}`;
}

// ============================================================
// COOLDOWN STATE OPERATIONS
// ============================================================

/**
 * Get cooldown state for a band
 * @param {object} strapi 
 * @param {number} bandId 
 * @param {string} cardType 
 * @returns {Promise<{ lastEmittedAt: string|null, lastScore: number|null }>}
 */
async function getCooldownState(strapi, bandId, cardType) {
  const key = getCooldownKey(bandId, cardType);
  
  try {
    const entry = await strapi.entityService.findMany('api::system-kv.system-kv', {
      filters: { key },
      limit: 1,
    });
    
    if (entry && entry.length > 0 && entry[0].value) {
      return entry[0].value;
    }
  } catch (err) {
    strapi.log.warn(`[cooldowns] Failed to get state for ${key}:`, err.message);
  }
  
  return { lastEmittedAt: null, lastScore: null };
}

/**
 * Set cooldown state for a card
 * @param {object} strapi 
 * @param {number} bandId 
 * @param {string} cardType 
 * @param {number} score 
 * @param {string} cardId - For milestone tracking
 */
async function setCooldownState(strapi, bandId, cardType, score, cardId = null) {
  const key = getCooldownKey(bandId, cardType);
  const value = {
    lastEmittedAt: new Date().toISOString(),
    lastScore: score,
    lastCardId: cardId,
  };
  
  try {
    // Check if entry exists
    const existing = await strapi.entityService.findMany('api::system-kv.system-kv', {
      filters: { key },
      limit: 1,
    });
    
    if (existing && existing.length > 0) {
      await strapi.entityService.update('api::system-kv.system-kv', existing[0].id, {
        data: { value },
      });
    } else {
      await strapi.entityService.create('api::system-kv.system-kv', {
        data: { key, value, band: bandId },
      });
    }
  } catch (err) {
    strapi.log.warn(`[cooldowns] Failed to set state for ${key}:`, err.message);
  }
}

/**
 * Get shown milestones for a band
 * @param {object} strapi 
 * @param {number} bandId 
 * @returns {Promise<string[]>}
 */
async function getShownMilestones(strapi, bandId) {
  const key = getMilestoneKey(bandId);
  
  try {
    const entry = await strapi.entityService.findMany('api::system-kv.system-kv', {
      filters: { key },
      limit: 1,
    });
    
    if (entry && entry.length > 0 && entry[0].value) {
      return entry[0].value.milestones || [];
    }
  } catch (err) {
    strapi.log.warn(`[cooldowns] Failed to get milestones for ${key}:`, err.message);
  }
  
  return [];
}

/**
 * Mark a milestone as shown
 * @param {object} strapi 
 * @param {number} bandId 
 * @param {string} milestone 
 */
async function markMilestoneShown(strapi, bandId, milestone) {
  const key = getMilestoneKey(bandId);
  
  try {
    const existing = await strapi.entityService.findMany('api::system-kv.system-kv', {
      filters: { key },
      limit: 1,
    });
    
    const currentMilestones = existing?.[0]?.value?.milestones || [];
    if (!currentMilestones.includes(milestone)) {
      currentMilestones.push(milestone);
    }
    
    const value = { milestones: currentMilestones, updatedAt: new Date().toISOString() };
    
    if (existing && existing.length > 0) {
      await strapi.entityService.update('api::system-kv.system-kv', existing[0].id, {
        data: { value },
      });
    } else {
      await strapi.entityService.create('api::system-kv.system-kv', {
        data: { key, value, band: bandId },
      });
    }
  } catch (err) {
    strapi.log.warn(`[cooldowns] Failed to mark milestone ${milestone}:`, err.message);
  }
}

// ============================================================
// COOLDOWN CHECK
// ============================================================

/**
 * Check if a card is on cooldown
 * @param {object} strapi 
 * @param {number} bandId 
 * @param {object} card - { type, score, context }
 * @returns {Promise<{ onCooldown: boolean, reason: string|null, bypass: boolean }>}
 */
async function checkCooldown(strapi, bandId, card) {
  const { type, score, context } = card;
  
  // Special handling for MILESTONE_DROP
  if (type === 'MILESTONE_DROP') {
    const milestone = context?.milestone;
    if (!milestone) {
      return { onCooldown: false, reason: null, bypass: false };
    }
    
    const shownMilestones = await getShownMilestones(strapi, bandId);
    if (shownMilestones.includes(milestone)) {
      return { 
        onCooldown: true, 
        reason: `Milestone ${milestone} already shown`, 
        bypass: false 
      };
    }
    return { onCooldown: false, reason: null, bypass: false };
  }
  
  // Standard cooldown check
  const cooldownHours = COOLDOWN_HOURS[type];
  if (!cooldownHours) {
    return { onCooldown: false, reason: null, bypass: false };
  }
  
  const state = await getCooldownState(strapi, bandId, type);
  
  if (!state.lastEmittedAt) {
    return { onCooldown: false, reason: null, bypass: false };
  }
  
  const lastEmitted = new Date(state.lastEmittedAt);
  const now = new Date();
  const hoursSince = (now - lastEmitted) / (1000 * 60 * 60);
  
  if (hoursSince >= cooldownHours) {
    return { onCooldown: false, reason: null, bypass: false };
  }
  
  // Check for score bypass
  const scoreDiff = score - (state.lastScore || 0);
  if (scoreDiff >= SCORE_BYPASS_THRESHOLD) {
    return { 
      onCooldown: false, 
      reason: null, 
      bypass: true,
      bypassReason: `Score +${scoreDiff} bypasses cooldown`,
    };
  }
  
  return { 
    onCooldown: true, 
    reason: `${type} on cooldown (${Math.round(cooldownHours - hoursSince)}h remaining)`,
    bypass: false,
  };
}

/**
 * Apply cooldowns to a list of cards
 * Returns filtered cards with cooldown debug info
 * @param {object} strapi 
 * @param {number} bandId 
 * @param {object[]} cards 
 * @returns {Promise<{ cards: object[], cooldownInfo: object[] }>}
 */
async function applyCooldowns(strapi, bandId, cards) {
  const result = [];
  const cooldownInfo = [];
  
  for (const card of cards) {
    const check = await checkCooldown(strapi, bandId, card);
    
    cooldownInfo.push({
      cardId: card.id,
      type: card.type,
      score: card.score,
      ...check,
    });
    
    if (!check.onCooldown) {
      result.push(card);
    }
  }
  
  return { cards: result, cooldownInfo };
}

/**
 * Record that cards were emitted (update cooldown state)
 * Call this AFTER cards are returned to the client
 * @param {object} strapi 
 * @param {number} bandId 
 * @param {object[]} emittedCards 
 */
async function recordEmittedCards(strapi, bandId, emittedCards) {
  for (const card of emittedCards) {
    if (card.type === 'MILESTONE_DROP' && card.context?.milestone) {
      await markMilestoneShown(strapi, bandId, card.context.milestone);
    } else {
      await setCooldownState(strapi, bandId, card.type, card.score, card.id);
    }
  }
}

module.exports = {
  COOLDOWN_HOURS,
  SCORE_BYPASS_THRESHOLD,
  checkCooldown,
  applyCooldowns,
  recordEmittedCards,
  getCooldownState,
  setCooldownState,
  getShownMilestones,
  markMilestoneShown,
};
