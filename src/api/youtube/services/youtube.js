'use strict';

const { DateTime } = require('luxon');
const qs = require('querystring');

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

module.exports = () => ({
  /**
   * Find existing external account for band/provider
   */
  async findExternalAccount(bandId, provider) {
    const rows = await strapi.entityService.findMany(
      'api::band-external-account.band-external-account',
      {
        filters: { band: bandId, provider },
        limit: 1,
      }
    );
    return rows && rows.length ? rows[0] : null;
  },

  /**
   * Create or update external account
   */
async upsertExternalAccount({
  bandId,
  provider,
  accessToken,
  refreshToken,
  channelId,
  channelTitle,
  raw,
  expiresAt,
  providerClientId, // <— NEW: the client that minted these tokens
}) {
  const existing = await this.findExternalAccount(bandId, provider);

  // keep whatever raw was passed, but also stamp providerClientId inside
  const rawMerged = raw || {};
  if (providerClientId) {
    rawMerged.providerClientId = providerClientId; // <-- stored in raw (no schema change)
  }

  const data = {
    band: bandId,
    provider,
    accessToken,
    refreshToken,
    channelId: channelId || null,
    channelTitle: channelTitle || null,
    raw: rawMerged,
    syncedAt: new Date().toISOString(),
    expiresAt: expiresAt || null,
  };

  if (existing) {
    return await strapi.entityService.update(
      'api::band-external-account.band-external-account',
      existing.id,
      { data }
    );
  }

  return await strapi.entityService.create(
    'api::band-external-account.band-external-account',
    { data }
  );
},



  /**
   * refresh access token with refresh_token
   */
 async refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    const errJson = { error: 'missing-refresh-token' };
    strapi.log.error('[youtube.refreshAccessToken] missing refreshToken', errJson);
    return errJson;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const errJson = { error: 'missing-google-env' };
    strapi.log.error('[youtube.refreshAccessToken] google env missing', errJson);
    return errJson;
  }

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: qs.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      // This will include things like `invalid_grant`, `invalid_client`, etc.
      strapi.log.error('[youtube.refreshAccessToken] error response', json);
      return json; // return error payload instead of null
    }

    return json; // { access_token, expires_in, ... }
  } catch (err) {
    const errJson = { error: 'network-error', message: err.message };
    strapi.log.error('[youtube.refreshAccessToken] network error', err);
    return errJson;
  }
},


  /**
   * channels?mine=true
   */
  async fetchChannels(accessToken) {
    const url = `${YT_API_BASE}/channels?${qs.stringify({
      part: 'snippet,statistics,contentDetails',
      mine: 'true',
      maxResults: 50,
    })}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      strapi.log.error(
        '[youtube.fetchChannels] error',
        res.status,
        json?.error || json
      );
      return [];
    }

    return json.items || [];
  },

  /**
   * channels?id=XXXX
   */
  async fetchChannelById(accessToken, channelId) {
    const url = `${YT_API_BASE}/channels?${qs.stringify({
      part: 'snippet,statistics,contentDetails',
      id: channelId,
      maxResults: 1,
    })}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = await res.json();
    if (!res.ok || !json.items || !json.items.length) {
      strapi.log.error('[youtube.fetchChannelById] error', json);
      return null;
    }
    return json.items[0];
  },

  /**
   * playlistItems for uploads playlist
   * grabs first 20
   */
  async fetchUploadsVideos(accessToken, uploadsPlaylistId, max = 20) {
    if (!uploadsPlaylistId) return [];

    const url = `${YT_API_BASE}/playlistItems?${qs.stringify({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: max,
    })}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = await res.json();
    if (!res.ok) {
      strapi.log.error('[youtube.fetchUploadsVideos] error', json);
      return [];
    }

    return json.items || [];
  },

  /**
   * videos?part=...&id=...
   * get stats for multiple videos (up to 50 ids)
   */
  async fetchVideosStats(accessToken, videoIds = []) {
    if (!videoIds.length) return [];

    const url = `${YT_API_BASE}/videos?${qs.stringify({
      part: 'snippet,statistics,contentDetails',
      id: videoIds.join(','),
      maxResults: videoIds.length,
    })}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = await res.json();
    if (!res.ok) {
      strapi.log.error('[youtube.fetchVideosStats] error', json);
      return [];
    }

    return json.items || [];
  },

  /**
   * playlists for channel
   */
  async fetchPlaylists(accessToken, channelId, max = 25) {
    const url = `${YT_API_BASE}/playlists?${qs.stringify({
      part: 'snippet,contentDetails',
      channelId,
      maxResults: max,
    })}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = await res.json();
    if (!res.ok) {
      strapi.log.error('[youtube.fetchPlaylists] error', json);
      return [];
    }

    return json.items || [];
  },

  /**
   * HEAVY SYNC — use this right after OAuth (we know token is good)
   * creates 2–3 rows in band-external-metric
   */
  async heavySyncForBand({ bandId, accessToken, refreshToken, channelId }) {
    if (!bandId || !accessToken) return null;

    // 1) get channel (by id if we have it, otherwise mine=true)
    let channel = null;
    if (channelId) {
      channel = await this.fetchChannelById(accessToken, channelId);
    }
    if (!channel) {
      const channels = await this.fetchChannels(accessToken);
      if (!channels.length) {
        strapi.log.error('[youtube.heavySyncForBand] no channels for token');
        return null;
      }
      channel = channels[0];
      channelId = channel.id;
    }

    // 2) uploads (first 20)
    const uploadsPlaylistId =
      channel?.contentDetails?.relatedPlaylists?.uploads || null;

    const uploadsItems = uploadsPlaylistId
      ? await this.fetchUploadsVideos(accessToken, uploadsPlaylistId, 20)
      : [];

    const videoIds = uploadsItems
      .map((it) => it?.contentDetails?.videoId)
      .filter(Boolean);

    const videoStats = videoIds.length
      ? await this.fetchVideosStats(accessToken, videoIds)
      : [];

    // 3) playlists
    const playlists = await this.fetchPlaylists(accessToken, channelId, 25);

    // 4) now store 2–3 rows

    const today = DateTime.utc().toISODate();
    const nowISO = new Date().toISOString();

    // 4a) channel row
    await strapi.entityService.create(
      'api::band-external-metric.band-external-metric',
      {
        data: {
          band: bandId,
          provider: 'youtube',
          kind: 'channel',
          date: today,
          metricDate: channel?.snippet?.publishedAt || null,
          normalizedData: {
            title: channel?.snippet?.title || null,
            views: Number(channel?.statistics?.viewCount || 0),
            subs: Number(channel?.statistics?.subscriberCount || 0),
            videos: Number(channel?.statistics?.videoCount || 0),
          },
          raw: channel,
          syncedAt: nowISO,
        },
      }
    );

    // 4b) videos row
    await strapi.entityService.create(
      'api::band-external-metric.band-external-metric',
      {
        data: {
          band: bandId,
          provider: 'youtube',
          kind: 'videos',
          date: today,
          normalizedData: {
            count: videoStats.length || uploadsItems.length || 0,
            latestVideoId: uploadsItems[0]?.contentDetails?.videoId || null,
            latestPublishedAt: uploadsItems[0]?.snippet?.publishedAt || null,
          },
          raw: {
            uploadsPlaylistId,
            uploadsItems,
            videoStats,
          },
          syncedAt: nowISO,
        },
      }
    );

    // 4c) playlists row (only if we have some)
    if (playlists && playlists.length) {
      await strapi.entityService.create(
        'api::band-external-metric.band-external-metric',
        {
          data: {
            band: bandId,
            provider: 'youtube',
            kind: 'playlists',
            date: today,
            normalizedData: {
              count: playlists.length,
            },
            raw: playlists,
            syncedAt: nowISO,
          },
        }
      );
    }

    return {
      views: Number(channel?.statistics?.viewCount || 0),
      subs: Number(channel?.statistics?.subscriberCount || 0),
      watchTime: 0,
      topVideo: uploadsItems[0]
        ? {
            title: uploadsItems[0]?.snippet?.title || null,
            videoId: uploadsItems[0]?.contentDetails?.videoId || null,
            publishedAt: uploadsItems[0]?.snippet?.publishedAt || null,
            // we might have stats for it
            views: videoStats[0]?.statistics?.viewCount
              ? Number(videoStats[0].statistics.viewCount)
              : null,
          }
        : null,
    };
  },


/**
 * LIGHT sync — used by /api/youtube/sync
 * (just tries to refresh + get channel again)
 */
// REPLACE the whole syncYoutubeForBand in the service
async syncYoutubeForBand({ bandId, accessToken, channelId }) {
  try {
    if (!bandId) return { ok: false, reason: "missing-bandId" };
    if (!accessToken) return { ok: false, reason: "missing-access-token" };

    strapi.log.info("[youtube.sync] starting (no-refresh mode) band=%s", bandId);

    // Try channelId first, then fallback to mine=true
    let channel = null;
    if (channelId) {
      channel = await this.fetchChannelById(accessToken, channelId);
    }
    if (!channel) {
      const channels = await this.fetchChannels(accessToken);
      if (!channels || !channels.length) {
        // most likely 401 or wrong scope
        return { ok: false, reason: "channel-unauthorized", details: { hint: "401/scope or no channels" } };
      }
      channel = channels[0];
    }

    const today = DateTime.utc().toISODate();
    const nowISO = new Date().toISOString();

    await strapi.entityService.create("api::band-external-metric.band-external-metric", {
      data: {
        band: bandId,
        provider: "youtube",
        kind: "channel",
        date: today,
        metricDate: channel?.snippet?.publishedAt || null,
        normalizedData: {
          title: channel?.snippet?.title || null,
          views: Number(channel?.statistics?.viewCount || 0),
          subs: Number(channel?.statistics?.subscriberCount || 0),
          videos: Number(channel?.statistics?.videoCount || 0),
        },
        raw: channel,
        syncedAt: nowISO,
      },
    });

    return {
      ok: true,
      metrics: {
        views: Number(channel?.statistics?.viewCount || 0),
        subs: Number(channel?.statistics?.subscriberCount || 0),
        watchTime: 0,
        topVideo: null,
      },
    };
  } catch (err) {
    strapi.log.error("[youtube.syncYoutubeForBand] exception", err);
    return { ok: false, reason: "exception", details: { message: err.message } };
  }
},





  /**
   * remove account (used in purge/disconnect)
   */
  async removeExternalAccount(bandId, provider) {
    const rows = await strapi.entityService.findMany(
      'api::band-external-account.band-external-account',
      {
        filters: { band: bandId, provider },
        limit: 200,
      }
    );

    let deleted = 0;
    for (const r of rows) {
      await strapi.entityService.delete(
        'api::band-external-account.band-external-account',
        r.id
      );
      deleted++;
    }
    return { deleted };
  },
});
