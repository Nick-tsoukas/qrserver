'use strict';

// If you still want ASCII slugs for some cases, we can keep transliteration as a fallback.
// But primary path below preserves Unicode (Thai).
const { slugify: translitSlugify } = require('transliteration');

const UID = 'api::band.band';
const MAX_LEN = 60;

// Escape a string for use inside a RegExp
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Unicode-safe sanitizer: keep letters/numbers (any script), - . _ ~
// Convert whitespace → "-", collapse dashes, trim, truncate.
const makeUnicodeSlug = (name, maxLen = MAX_LEN) => {
  if (!name || typeof name !== 'string') return null;
  let s = name
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '-')                    // spaces → dash
    .replace(/[^\p{L}\p{N}\-._~]+/gu, '-')    // keep unicode letters/digits and -._~
    .replace(/-+/g, '-')                      // collapse dashes
    .replace(/^-|-$/g, '');                   // trim edge dashes

  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-+$/g, '');
  if (!s) s = `band-${Date.now()}`;
  return s;
};

// Optional: ASCII fallback (not used unless you want to force ASCII)
// const makeAsciiSlug = (name, maxLen = MAX_LEN) => {
//   let base = translitSlugify(name || '', { lowercase: true, separator: '-', trim: true })
//     .replace(/-+/g, '-').replace(/^-|-$/g, '');
//   if (!base) base = `band-${Date.now()}`;
//   if (base.length > maxLen) base = base.slice(0, maxLen).replace(/-+$/g, '');
//   return base;
// };

// Sanitize a manually-entered slug (respect Unicode)
const sanitizeIncomingSlug = (slug, maxLen = MAX_LEN) => {
  if (!slug || typeof slug !== 'string') return null;
  let s = slug
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '-')                    // spaces → dash
    .replace(/[^\p{L}\p{N}\-._~]+/gu, '-')    // keep unicode letters/digits and -._~
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-+$/g, '');
  return s || null;
};

const ensureUniqueSlug = async (base, currentId = null) => {
  // Find existing exact + suffixed matches
  const existing = await strapi.entityService.findMany(UID, {
    filters: {
      $or: [
        { slug: base },
        { slug: { $startsWith: `${base}-` } },
      ],
    },
    fields: ['id', 'slug'],
    limit: 1000,
    publicationState: 'preview',
  });

  const conflicts = existing.filter(e => String(e.id) !== String(currentId));
  if (!conflicts.length) return base;

  const used = new Set();
  for (const e of conflicts) {
    if (e.slug === base) {
      used.add(1);
    } else {
      // Build a safe regex for Unicode base
      const rx = new RegExp(`^${escapeRegExp(base)}-(\\d+)$`, 'u');
      const m = e.slug.match(rx);
      if (m) used.add(parseInt(m[1], 10));
    }
  }
  let n = 2;
  while (used.has(n)) n++;
  return `${base}-${n}`;
};

const getExistingNameIfNeeded = async (where) => {
  if (!where?.id) return null;
  try {
    const entry = await strapi.entityService.findOne(UID, where.id, { fields: ['name'] });
    return entry?.name || null;
  } catch {
    return null;
  }
};

const setSlug = async (event) => {
  const { data, where } = event.params;
  if (!data) return;

  const currentId = where?.id ?? data?.id ?? null;

  // 1) If user provided a slug manually, sanitize & de-dupe and KEEP IT.
  if (data.slug) {
    const sanitized = sanitizeIncomingSlug(data.slug) || `band-${Date.now()}`;
    data.slug = await ensureUniqueSlug(sanitized, currentId);
    return;
  }

  // 2) Else generate from name (payload or DB)
  const name = data.name || (await getExistingNameIfNeeded(where));
  if (!name) return;

  // Unicode slug that preserves Thai (preferred)
  let base = makeUnicodeSlug(name);

  // If you ever want to fallback to ASCII only when Unicode becomes empty:
  // if (!base) base = makeAsciiSlug(name);

  data.slug = await ensureUniqueSlug(base, currentId);
};

module.exports = {
  async beforeCreate(event) { await setSlug(event); },
  async beforeUpdate(event) { await setSlug(event); },
};
