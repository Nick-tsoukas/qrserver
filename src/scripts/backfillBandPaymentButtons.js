"use strict";

const defaultButtons = require("../../config/paymentButtons.default"); 
// NOTE: this path is from /src/scripts to /config
// If your config is elsewhere, adjust accordingly.

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

module.exports = async ({ strapi }) => {
  const pageSize = 100;
  let page = 1;
  let updated = 0;

  while (true) {
    const bands = await strapi.entityService.findMany("api::band.band", {
      fields: ["id", "paymentButtons", "paymentsEnabled", "stripeAccountId", "stripeOnboardingComplete"],
      pagination: { page, pageSize },
      publicationState: "preview",
    });

    if (!bands || bands.length === 0) break;

    for (const band of bands) {
      const patch = {};

      // default fields if missing/null
      if (band.paymentsEnabled == null) patch.paymentsEnabled = false;
      if (band.stripeOnboardingComplete == null) patch.stripeOnboardingComplete = false;
      if (band.stripeAccountId === undefined) patch.stripeAccountId = null;

      // seed/merge paymentButtons
      const existing = band.paymentButtons;
      const nextButtons = Array.isArray(existing) ? mergeButtons(existing) : defaultButtons;

      const needsButtons =
        !Array.isArray(existing) || JSON.stringify(existing) !== JSON.stringify(nextButtons);

      if (needsButtons) patch.paymentButtons = nextButtons;

      if (Object.keys(patch).length) {
        await strapi.entityService.update("api::band.band", band.id, { data: patch });
        updated++;
      }
    }

    page++;
  }

  strapi.log.info(`✅ Backfill complete. Bands updated: ${updated}`);
};
