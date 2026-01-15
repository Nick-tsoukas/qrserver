// path: src/api/band/controllers/live-signals.js
'use strict';

/**
 * Live Signals Controller
 * Provides real-time analytics data for the Smart Link Live Surface feature
 * 
 * Response shape:
 * {
 *   recentSupport: { amount, timestamp } | null,
 *   topCity: { name, isNew, count } | null,
 *   activitySpike: { multiplier, timestamp } | null,
 *   topLink: { platform, clicks } | null,
 * }
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::band.band', ({ strapi }) => ({
  async getLiveSignals(ctx) {
    const { id } = ctx.params;
    const bandId = parseInt(id, 10);

    if (!bandId || isNaN(bandId)) {
      return ctx.badRequest('Invalid band ID');
    }

    try {
      // Time windows
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);

      // Initialize response
      const response = {
        recentSupport: null,
        topCity: null,
        activitySpike: null,
        topLink: null,
      };

      // 1. Recent Support - check support_moments for recent payments
      try {
        const recentSupport = await strapi.db.query('api::support-moment.support-moment').findOne({
          where: {
            band: bandId,
            createdAt: { $gte: twentyFourHoursAgo.toISOString() },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (recentSupport) {
          response.recentSupport = {
            amount: recentSupport.amount || null,
            timestamp: new Date(recentSupport.createdAt).getTime(),
            isRecent: new Date(recentSupport.createdAt) >= twoHoursAgo,
          };
        }
      } catch (err) {
        strapi.log.warn('[live-signals] Error fetching recent support:', err.message);
      }

      // 2. Top City - aggregate from band_page_views
      try {
        const cityViews = await strapi.db.query('api::band-page-view.band-page-view').findMany({
          where: {
            band: bandId,
            createdAt: { $gte: twentyFourHoursAgo.toISOString() },
            city: { $notNull: true },
          },
          select: ['city', 'region'],
        });

        if (cityViews.length > 0) {
          // Count by city
          const cityCounts = {};
          cityViews.forEach(view => {
            const key = view.city;
            if (key) {
              cityCounts[key] = (cityCounts[key] || 0) + 1;
            }
          });

          // Find top city
          const topCityName = Object.keys(cityCounts).reduce((a, b) => 
            cityCounts[a] > cityCounts[b] ? a : b
          , null);

          if (topCityName) {
            // Check if this city is "new" (first appearance in last 7 days)
            const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const olderViews = await strapi.db.query('api::band-page-view.band-page-view').findMany({
              where: {
                band: bandId,
                city: topCityName,
                createdAt: { $lt: sevenDaysAgo.toISOString() },
              },
              limit: 1,
            });

            response.topCity = {
              name: topCityName,
              isNew: olderViews.length === 0,
              count: cityCounts[topCityName],
            };
          }
        }
      } catch (err) {
        strapi.log.warn('[live-signals] Error fetching top city:', err.message);
      }

      // 3. Activity Spike - compare recent 30min to baseline
      try {
        const recentViews = await strapi.db.query('api::band-page-view.band-page-view').count({
          where: {
            band: bandId,
            createdAt: { $gte: thirtyMinutesAgo.toISOString() },
          },
        });

        // Get baseline (average 30min window over last 24h)
        const totalViews24h = await strapi.db.query('api::band-page-view.band-page-view').count({
          where: {
            band: bandId,
            createdAt: { $gte: twentyFourHoursAgo.toISOString() },
          },
        });

        const baseline30min = totalViews24h / 48; // 48 thirty-minute windows in 24h

        if (baseline30min > 0 && recentViews >= 2) {
          const multiplier = recentViews / baseline30min;
          if (multiplier >= 2) {
            response.activitySpike = {
              multiplier: Math.round(multiplier * 10) / 10,
              timestamp: now,
            };
          }
        }
      } catch (err) {
        strapi.log.warn('[live-signals] Error calculating activity spike:', err.message);
      }

      // 4. Top Link - aggregate from link_clicks
      try {
        const linkClicks = await strapi.db.query('api::link-click.link-click').findMany({
          where: {
            band: bandId,
            createdAt: { $gte: twentyFourHoursAgo.toISOString() },
            platform: { $notNull: true },
          },
          select: ['platform'],
        });

        if (linkClicks.length > 0) {
          // Count by platform
          const platformCounts = {};
          linkClicks.forEach(click => {
            const platform = click.platform;
            if (platform) {
              platformCounts[platform] = (platformCounts[platform] || 0) + 1;
            }
          });

          // Find top platform
          const topPlatform = Object.keys(platformCounts).reduce((a, b) => 
            platformCounts[a] > platformCounts[b] ? a : b
          , null);

          if (topPlatform) {
            response.topLink = {
              platform: formatPlatformName(topPlatform),
              clicks: platformCounts[topPlatform],
            };
          }
        }
      } catch (err) {
        strapi.log.warn('[live-signals] Error fetching top link:', err.message);
      }

      return response;
    } catch (err) {
      strapi.log.error('[live-signals] Unexpected error:', err);
      return ctx.internalServerError('Failed to fetch live signals');
    }
  },
}));

/**
 * Format platform name for display
 */
function formatPlatformName(platform) {
  const names = {
    spotify: 'Spotify',
    appleMusic: 'Apple Music',
    youtube: 'YouTube',
    soundcloud: 'SoundCloud',
    bandcamp: 'Bandcamp',
    deezer: 'Deezer',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'X',
  };
  return names[platform] || platform;
}
