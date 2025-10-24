import type { Lifecycle } from '@strapi/strapi';

const normalizeDate = (value?: string | Date) => {
  if (!value) return null;
  const d = new Date(value);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ensureDefaults = (data: any) => {
  if (!Array.isArray(data.topCities)) data.topCities = [];
  if (typeof data.pageViews !== 'number') data.pageViews = 0;
  if (typeof data.uniqueIps !== 'number') data.uniqueIps = 0;
  if (typeof data.linkClicks !== 'number') data.linkClicks = 0;
  if (typeof data.songPlays !== 'number') data.songPlays = 0;
  if (typeof data.videoPlays !== 'number') data.videoPlays = 0;
  if (typeof data.growthPct !== 'number') data.growthPct = 0;
  if (typeof data.deviceDesktop !== 'number') data.deviceDesktop = 0;
  if (typeof data.deviceMobile !== 'number') data.deviceMobile = 0;
  if (typeof data.deviceTablet !== 'number') data.deviceTablet = 0;
};

const setKeyIfMissing = (data: any) => {
  // key := `${bandId}:${YYYY-MM-DD}`
  if (!data.key && data.band && data.date) {
    const bandId = typeof data.band === 'object' ? (data.band.id ?? data.band) : data.band;
    if (bandId && data.date) data.key = `${bandId}:${data.date}`;
  }
};

export default {
  beforeCreate(event) {
    const { data } = event.params;
    data.date = normalizeDate(data.date) ?? normalizeDate(new Date());
    ensureDefaults(data);
    setKeyIfMissing(data);
    data.lastUpdated = new Date().toISOString();
  },
  beforeUpdate(event) {
    const { data } = event.params;
    if (data.date) data.date = normalizeDate(data.date);
    ensureDefaults(data);
    setKeyIfMissing(data);
    data.lastUpdated = new Date().toISOString();
  },
} as unknown as Lifecycle;
