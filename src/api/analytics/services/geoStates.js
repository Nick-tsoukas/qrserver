'use strict';

const { DateTime } = require('luxon');

// US State name to code lookup (all 50 states + DC)
const STATE_NAME_TO_CODE = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY',
  'district of columbia': 'DC',
  'washington dc': 'DC',
  'washington d.c.': 'DC',
  'd.c.': 'DC',
  'dc': 'DC',
};

// Valid state codes set for quick validation
const VALID_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

/**
 * Normalize region string to US state code
 * @param {string} region - Region from Cloudflare (e.g., "Illinois" or "IL")
 * @returns {string|null} - Two-letter state code or null if not mappable
 */
function normalizeState(region) {
  if (!region || typeof region !== 'string') return null;
  
  const trimmed = region.trim();
  if (!trimmed) return null;
  
  // If already a 2-letter code
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    return VALID_STATE_CODES.has(upper) ? upper : null;
  }
  
  // Try full name lookup
  const lower = trimmed.toLowerCase();
  const code = STATE_NAME_TO_CODE[lower];
  return code || null;
}

/**
 * Check if country is US (case-insensitive)
 */
function isUSCountry(country) {
  if (!country || typeof country !== 'string') return false;
  const upper = country.trim().toUpperCase();
  return upper === 'US' || upper === 'USA' || upper === 'UNITED STATES';
}

/**
 * Parse range string to days
 */
function parseRangeDays(range) {
  const match = String(range || '30d').match(/^(\d+)d$/i);
  return match ? parseInt(match[1], 10) : 30;
}

/**
 * Get the appropriate UID and timestamp field for entity type and metric
 */
function getEntityConfig(entityType, metric) {
  // Only include metrics where the underlying model has region/country fields
  const configs = {
    band: {
      views: { uid: 'api::band-page-view.band-page-view', tsField: 'timestamp', fkField: 'band' },
      qrScans: { uid: 'api::scan.scan', tsField: 'timestamp', fkField: 'band' },
      // linkClicks and follows don't have region/country fields
    },
    event: {
      views: { uid: 'api::event-page-view.event-page-view', tsField: 'timestamp', fkField: 'event' },
      qrScans: { uid: 'api::scan.scan', tsField: 'timestamp', fkField: 'event' },
    },
    qr: {
      qrScans: { uid: 'api::scan.scan', tsField: 'timestamp', fkField: 'qr' },
    },
  };
  
  return configs[entityType]?.[metric] || null;
}

/**
 * Fetch geo state counts for a given entity
 */
async function fetchGeoStateCounts(strapi, { entityType, entityId, range, metric }) {
  const config = getEntityConfig(entityType, metric);
  if (!config) {
    return { error: `Invalid metric "${metric}" for entityType "${entityType}"` };
  }
  
  const days = parseRangeDays(range);
  const fromDate = DateTime.utc().minus({ days }).startOf('day').toISO();
  
  // Build filters
  const filters = {
    [config.fkField]: entityId,
    [config.tsField]: { $gte: fromDate },
  };
  
  // Add event type filter for follows
  if (config.eventType) {
    filters.eventType = config.eventType;
  }
  
  // Fetch all matching records with region/country
  const records = await strapi.entityService.findMany(config.uid, {
    filters,
    fields: ['region', 'country'],
    limit: -1, // Get all
  });
  
  // Aggregate by state
  const stateCounts = {};
  let total = 0;
  
  for (const record of records) {
    // Only include US records
    if (!isUSCountry(record.country)) continue;
    
    const stateCode = normalizeState(record.region);
    if (!stateCode) continue;
    
    stateCounts[stateCode] = (stateCounts[stateCode] || 0) + 1;
    total++;
  }
  
  // Convert to sorted array
  const states = Object.entries(stateCounts)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);
  
  const max = states.length > 0 ? states[0].count : 0;
  
  return {
    ok: true,
    entityType,
    entityId,
    range,
    metric,
    total,
    max,
    states,
  };
}

module.exports = {
  normalizeState,
  isUSCountry,
  parseRangeDays,
  getEntityConfig,
  fetchGeoStateCounts,
  VALID_STATE_CODES,
};
