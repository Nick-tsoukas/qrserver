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
  }) {
    const existing = await this.findExternalAccount(bandId, provider);

    const data = {
      band: bandId,
      provider,
      accessToken,
      refreshToken,
      channelId: channelId || null,
      channelTitle: channelTitle || null,
      raw: raw || null,
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
async syncYoutubeForBand({ bandId, accessToken, refreshToken, channelId }) {
  try {
    if (!bandId) {
      strapi.log.warn('[youtube.sync] missing bandId');
      return null;
    }

    strapi.log.info('[youtube.sync] starting for band %s', bandId);
    strapi.log.info('[youtube.sync] incoming channelId=%s', channelId);
    strapi.log.info(
      '[youtube.sync] hasAccessToken=%s hasRefreshToken=%s',
      !!accessToken,
      !!refreshToken
    );

    if (!accessToken && !refreshToken) {
      strapi.log.error('[youtube.sync] no tokens at all');
      return null;
    }

    let tokenToUse = accessToken;
    if (!tokenToUse && refreshToken) {
      strapi.log.info('[youtube.sync] no accessToken; trying refresh');
      const refreshed = await this.refreshAccessToken(refreshToken);
      strapi.log.info('[youtube.sync] refresh result', refreshed);

      if (!refreshed || !refreshed.access_token) {
        strapi.log.error(
          '[youtube.sync] refresh failed or missing access_token',
          refreshed
        );
        return null;
      }

      tokenToUse = refreshed.access_token;

      await this.upsertExternalAccount({
        bandId,
        provider: 'youtube',
        accessToken: tokenToUse,
        refreshToken,
        channelId,
        channelTitle: null,
        raw: null,
        expiresAt: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : null,
      });
      strapi.log.info('[youtube.sync] token refreshed & account updated');
    }

    strapi.log.info(
      '[youtube.sync] fetching channel info for %s',
      channelId || 'mine'
    );

    let channel = null;
    if (channelId) {
      channel = await this.fetchChannelById(tokenToUse, channelId);
      strapi.log.info(
        '[youtube.sync] fetchChannelById returned %s',
        channel ? 'ok' : 'null'
      );
    }

    if (!channel) {
      strapi.log.info('[youtube.sync] fallback: fetchChannels mine=true');
      const channels = await this.fetchChannels(tokenToUse);
      strapi.log.info(
        '[youtube.sync] fetched %d channels',
        channels.length || 0
      );
      if (!channels.length) {
        strapi.log.error(
          '[youtube.sync] no channels for token (401 or bad scope?)'
        );
        return null;
      }
      channel = channels[0];
    }

    const today = DateTime.utc().toISODate();
    strapi.log.info(
      '[youtube.sync] writing band-external-metric for %s (%s)',
      bandId,
      today
    );

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
          syncedAt: new Date().toISOString(),
        },
      }
    );

    strapi.log.info(
      '[youtube.sync] metric written successfully for band %s',
      bandId
    );

    return {
      views: Number(channel?.statistics?.viewCount || 0),
      subs: Number(channel?.statistics?.subscriberCount || 0),
      watchTime: 0,
      topVideo: null,
    };
  } catch (err) {
    strapi.log.error('[youtube.syncYoutubeForBand] exception', err);
    return null;
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
