// src/api/band/content-types/band/lifecycles.js
'use strict';

const { slugify: translitSlugify } = require('transliteration');

/**
 * Generate a URL-safe, romanized slug from a name.
 * - Romanizes non-Latin (Thai, etc.)
 * - Lowercase, dash-separated
 * - Truncates to maxLen (default 60)
 * - Provides a fallback if empty
 */
const makeBaseSlug = (name, maxLen = 60) => {
  if (!name || typeof name !== 'string') return null;

  // Romanize & slugify (e.g., spaces -> "-", lowercase)
  let base = translitSlugify(name, {
    lowercase: true,
    separator: '-',          // use dashes
    trim: true,
  });

  // Remove duplicate dashes
  base = (base || '').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Truncate
  if (base.length > maxLen) base = base.slice(0, maxLen).replace(/-+$/g, '');

  // Fallback if transliteration produced nothing
  if (!base) base = `band-${Date.now()}`;

  return base;
};

/**
 * Ensure uniqueness by appending -2, -3, ... if needed.
 */
const ensureUniqueSlug = async (uid, base, currentId = null) => {
  // Find existing slugs starting with base (or base-<number>)
  const existing = await strapi.entityService.findMany(uid, {
    filters: {
      $or: [
        { slug: base },
        { slug: { $startsWith: `${base}-` } },
      ],
    },
    fields: ['id', 'slug'],
    limit: 1000, // practical cap
    publicationState: 'preview', // include drafts just in case
  });

  // If no conflicts or only conflict is self
  const conflicts = existing.filter(e => String(e.id) !== String(currentId));
  if (conflicts.length === 0) return base;

  // Collect used suffix numbers
  const used = new Set();
  for (const e of conflicts) {
    if (e.slug === base) {
      used.add(1);
    } else {
      const m = e.slug.match(new RegExp(`^${base}-(\\d+)$`));
      if (m) used.add(parseInt(m[1], 10));
    }
  }

  // Find the smallest available suffix >= 2 (we treat exact base as -1 internally)
  let n = 2;
  while (used.has(n)) n++;
  return `${base}-${n}`;
};

const setSlug = async (event) => {
  const uid = 'api::band.band';
  const { data, where } = event.params;

  // Prefer name from incoming update; if missing on update, do nothing
  if (!data || !data.name) return;

  // Create base slug
  const base = makeBaseSlug(data.name);

  // Determine current entity id (needed to avoid colliding with self on update)
  let currentId = null;
  try {
    if (where && where.id) {
      currentId = where.id;
    } else if (event.params?.data?.id) {
      currentId = event.params.data.id;
    }
  } catch (_) { /* noop */ }

  // Ensure uniqueness
  const unique = await ensureUniqueSlug(uid, base, currentId);
  data.slug = unique;
};

module.exports = {
  async beforeCreate(event) {
    await setSlug(event);
  },
  async beforeUpdate(event) {
    await setSlug(event);
  },
};
