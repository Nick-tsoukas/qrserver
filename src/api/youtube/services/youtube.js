'use strict';

const { DateTime } = require('luxon');
const qs = require('querystring');

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

module.exports = () => ({
  /**
   * Find existing external account for band/provider
   */
  async findExternalAccount(bandId, provider) {
    const rows = await strapi.entityService.findMany('api::band-external-account.band-external-account', {
      filters: {
        band: bandId,
        provider,
      },
      limit: 1,
    });
    return rows && rows.length ? rows[0] : null;
  },

  /**
   * Create or update external account
   */
  async upsertExternalAccount({ bandId, provider, accessToken, refreshToken, channelId, channelTitle, raw }) {
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
    };

    if (existing) {
      return await strapi.entityService.update(
        'api::band-external-account.band-external-account',
        existing.id,
        { data }
      );
    }

    return await strapi.entityService.create('api::band-external-account.band-external-account', {
      data,
    });
  },

  /**
   * Call YouTube to get channels for this accessToken
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
      strapi.log.error('[youtube.fetchChannels] error', json);
      return [];
    }

    return json.items || [];
  },

  /**
   * Internal: fetch latest upload (playlistItems) for the uploads playlist
   */
  async fetchLatestUpload(accessToken, uploadsPlaylistId) {
    if (!uploadsPlaylistId) return null;

    const url = `${YT_API_BASE}/playlistItems?${qs.stringify({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 1,
    })}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      strapi.log.error('[youtube.fetchLatestUpload] error', json);
      return null;
    }

    const item = (json.items && json.items[0]) || null;
    return item;
  },

  /**
   * Internal: fetch video stats for 1 video
   */
  async fetchVideoStats(accessToken, videoId) {
    if (!videoId) return null;

    const url = `${YT_API_BASE}/videos?${qs.stringify({
      part: 'statistics,snippet',
      id: videoId,
      maxResults: 1,
    })}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      strapi.log.error('[youtube.fetchVideoStats] error', json);
      return null;
    }

    const item = (json.items && json.items[0]) || null;
    return item;
  },

  /**
   * Main sync:
   * - fetch channel (we already have channelId, but we also need uploads playlist)
   * - fetch latest upload
   * - fetch video stats
   * - normalize
   * - upsert into band-external-metric
   */
  async syncYoutubeForBand({ bandId, accessToken, refreshToken, channelId }) {
    try {
      if (!bandId || !accessToken) return null;

      // 1) get channel by id or by mine=true
      // since we have channelId, we can fetch channel directly:
      const channelUrl = `${YT_API_BASE}/channels?${qs.stringify({
        part: 'snippet,statistics,contentDetails',
        id: channelId,
        maxResults: 1,
      })}`;

      const chRes = await fetch(channelUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const chJson = await chRes.json();

      if (!chRes.ok || !chJson.items || !chJson.items.length) {
        // if direct fetch fails, try mine=true as a fallback
        const channels = await this.fetchChannels(accessToken);
        if (!channels.length) return null;
        // pick the one that matches channelId, or first
        const ch = channels.find((c) => c.id === channelId) || channels[0];
        return await this._normalizeAndUpsert(bandId, accessToken, ch);
      }

      const channel = chJson.items[0];
      return await this._normalizeAndUpsert(bandId, accessToken, channel);
    } catch (err) {
      strapi.log.error('[youtube.syncYoutubeForBand] error', err);
      return null;
    }
  },

  /**
   * helper: normalize channel + maybe latest upload + video stats
   */
  async _normalizeAndUpsert(bandId, accessToken, channelObj) {
    // channel-level stats
    const uploadsPlaylistId =
      channelObj?.contentDetails?.relatedPlaylists?.uploads || null;

    // call #2: latest upload
    let latest = null;
    if (uploadsPlaylistId) {
      latest = await this.fetchLatestUpload(accessToken, uploadsPlaylistId);
    }

    // call #3: video stats
    let videoStats = null;
    let topVideo = null;

    if (latest?.contentDetails?.videoId) {
      videoStats = await this.fetchVideoStats(
        accessToken,
        latest.contentDetails.videoId
      );

      const viewCount = videoStats?.statistics?.viewCount
        ? Number(videoStats.statistics.viewCount)
        : null;

      topVideo = {
        title: latest?.snippet?.title || videoStats?.snippet?.title || null,
        views: viewCount,
        videoId: latest.contentDetails.videoId,
        publishedAt: latest?.snippet?.publishedAt || null,
      };
    }

    const normalized = {
      views: channelObj?.statistics?.viewCount
        ? Number(channelObj.statistics.viewCount)
        : 0,
      subs: channelObj?.statistics?.subscriberCount
        ? Number(channelObj.statistics.subscriberCount)
        : 0,
      watchTime: 0, // placeholder for later YouTube Analytics
      topVideo: topVideo || null,
    };

    // upsert into band-external-metric using your existing structure
    await strapi.entityService.create('api::band-external-metric.band-external-metric', {
      data: {
        band: bandId,
        provider: 'youtube',
        date: DateTime.utc().toISODate(),
        normalizedData: normalized,
        raw: channelObj, // optional
        syncedAt: new Date().toISOString(),
      },
    });

    return normalized;
  },
});
