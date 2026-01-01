'use strict';

// If you still want ASCII slugs for some cases, we can keep transliteration as a fallback.
// But primary path below preserves Unicode (Thai).
const { slugify: translitSlugify } = require('transliteration');

const UID = 'api::band.band';
const MAX_LEN = 60;

// Escape a string for use inside a RegExp
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Canonical sanitizer: keep letters/numbers (any script).
// Convert whitespace/punctuation → "" (no hyphens), trim, truncate.
const makeUnicodeSlug = (name, maxLen = MAX_LEN) => {
  if (!name || typeof name !== 'string') return null;
  let s = name
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '')                     // spaces → nothing
    .replace(/[^\p{L}\p{N}]+/gu, '');         // keep unicode letters/digits only

  if (s.length > maxLen) s = s.slice(0, maxLen);
  if (!s) s = `band${Date.now()}`;
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

// Sanitize a manually-entered slug (respect Unicode, no hyphens)
const sanitizeIncomingSlug = (slug, maxLen = MAX_LEN) => {
  if (!slug || typeof slug !== 'string') return null;
  let s = slug
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s || null;
};

const ensureUniqueSlug = async (base, currentId = null) => {
  // Find existing exact + suffixed matches
  const existing = await strapi.entityService.findMany(UID, {
    filters: {
      $or: [
        { slug: base },
        { slug: { $startsWith: `${base}` } },
      ],
    },
    fields: ['id', 'slug'],
    limit: 1000,
    publicationState: 'preview',
  });

  const conflicts = existing
    .filter((e) => String(e.id) !== String(currentId))
    // Only treat true suffix collisions as conflicts.
    // e.g. base, base2, base-2 are conflicts. baseXYZ is NOT.
    .filter((e) => {
      const s = String(e.slug || '');
      if (s === base) return true;
      const rx = new RegExp(`^${escapeRegExp(base)}(?:-(\\d+)|(\\d+))$`, 'u');
      return rx.test(s);
    });
  if (!conflicts.length) return base;

  const used = new Set();
  for (const e of conflicts) {
    if (e.slug === base) {
      used.add(1);
    } else {
      const rest = String(e.slug || '').slice(base.length);
      // Support both legacy "base-2" and canonical "base2"
      const m1 = rest.match(/^-(\d+)$/u);
      const m2 = rest.match(/^(\d+)$/u);
      if (m1) used.add(parseInt(m1[1], 10));
      if (m2) used.add(parseInt(m2[1], 10));
    }
  }
  let n = 2;
  while (used.has(n)) n++;
  return `${base}${n}`;
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
    const sanitized = sanitizeIncomingSlug(data.slug) || `band${Date.now()}`;
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


// @ts-ignore
const defaultButtons = require("../../../../../config/paymentButtons.default");
// Ensures all canonical buttons exist, without overwriting customizations.
function mergeButtons(existing = []) {
  const safe = Array.isArray(existing) ? existing : [];
  const byKey = new Map(safe.filter(Boolean).map((b) => [b.key, b]));

  const merged = defaultButtons.map((d) => ({
    ...d,
    ...(byKey.get(d.key) || {}),
  }));

  const extras = safe.filter(
    (b) => b?.key && !defaultButtons.some((d) => d.key === b.key)
  );

  return [...merged, ...extras];
}



module.exports = {
  async beforeCreate(event) {
    // 1) slug
    await setSlug(event);

    // 2) payments defaults
    const data = event.params.data;

    if (!("paymentsEnabled" in data)) data.paymentsEnabled = false;
    if (!("stripeOnboardingComplete" in data)) data.stripeOnboardingComplete = false;
    if (!("stripeAccountId" in data)) data.stripeAccountId = null;

    if (!Array.isArray(data.paymentButtons)) {
      data.paymentButtons = defaultButtons;
    } else {
      data.paymentButtons = mergeButtons(data.paymentButtons);
    }
  },

  async beforeUpdate(event) {
    // 1) slug
    // IMPORTANT: never regenerate slug on arbitrary edits.
    // Only sanitize/update slug when the slug field is explicitly provided.
    const data = event.params.data;
    if (data && Object.prototype.hasOwnProperty.call(data, 'slug')) {
      await setSlug(event);
    }

    // 2) payments normalization (only when paymentButtons is being updated)
    // (reuse data from above)

    if (data && "paymentButtons" in data) {
      if (!Array.isArray(data.paymentButtons)) {
        data.paymentButtons = defaultButtons;
      } else {
        data.paymentButtons = mergeButtons(data.paymentButtons);
      }
    }
  },
};

