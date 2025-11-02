'use strict';

const { DateTime } = require('luxon');

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const YT_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const qs = require('querystring'); // node builtin

module.exports = {
  /**
   * GET /api/youtube/oauth/init?bandId=5
   * Builds the Google OAuth URL and returns it to Nuxt.
   */
  async oauthInit(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      if (!bandId) return ctx.badRequest('bandId required');

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return ctx.badRequest('Google OAuth not configured');
      }

      // state: we include bandId + a nonce for safety
      const nonce = Math.random().toString(36).slice(2, 10);
      const state = `mbqr|band:${bandId}|nonce:${nonce}`;

      const params = {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        access_type: 'offline', // to try to get refresh_token
        scope: YT_SCOPE,
        include_granted_scopes: 'true',
        state,
        prompt: 'consent', // ensures we get refresh_token on first run
      };

      const authUrl = `${GOOGLE_AUTH_BASE}?${qs.stringify(params)}`;

      ctx.body = {
        ok: true,
        authUrl,
      };
    } catch (err) {
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  /**
   * POST /api/youtube/oauth/callback
   * body: { code, state }
   * 1. exchange code for tokens
   * 2. fetch YT channels for this account
   * 3. if 1 channel -> save it & sync now
   * 4. if many -> save tokens, return list to FE
   */
  async oauthCallback(ctx) {
    const { code, state } = ctx.request.body || {};
    if (!code || !state) return ctx.badRequest('code and state required');

    // parse bandId from state like: mbqr|band:5|nonce:abc
    const bandIdMatch = String(state).match(/band:(\d+)/);
    const bandId = bandIdMatch ? Number(bandIdMatch[1]) : null;
    if (!bandId) return ctx.badRequest('bandId missing in state');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return ctx.badRequest('Google OAuth not configured');
    }

    try {
      // 1) exchange code -> tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: qs.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error) {
        strapi.log.error('[youtube.oauthCallback] token error', tokenData);
        ctx.body = {
          ok: false,
          provider: 'youtube',
          connected: false,
          reason: 'token-exchange-failed',
          details: tokenData,
        };
        return;
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;
      const expiresIn = tokenData.expires_in || null;

      // 2) fetch channels for this Google account
      const youtubeService = strapi.service('api::youtube.youtube');

      const channels = await youtubeService.fetchChannels(accessToken);

      if (!channels || !channels.length) {
        // store the account anyway (no channel yet), so we don't lose tokens
        await youtubeService.upsertExternalAccount({
          bandId,
          provider: 'youtube',
          accessToken,
          refreshToken,
          channelId: null,
          channelTitle: null,
          raw: { channels: [] },
        });

        ctx.body = {
          ok: true,
          provider: 'youtube',
          connected: false,
          bandId,
          reason: 'no-channels',
        };
        return;
      }

      // if exactly one channel -> bind it and sync now
      if (channels.length === 1) {
        const ch = channels[0];

        // save account
        await youtubeService.upsertExternalAccount({
          bandId,
          provider: 'youtube',
          accessToken,
          refreshToken,
          channelId: ch.id,
          channelTitle: ch.snippet?.title || null,
          raw: { channels },
        });

        // run 2/3-call sync right now
        const normalized = await youtubeService.syncYoutubeForBand({
          bandId,
          accessToken,
          refreshToken,
          channelId: ch.id,
        });

        ctx.body = {
          ok: true,
          provider: 'youtube',
          connected: true,
          bandId,
          metrics: normalized || null,
        };
        return;
      }

      // if many channels -> let FE choose
      // store tokens but no channelId yet
      await youtubeService.upsertExternalAccount({
        bandId,
        provider: 'youtube',
        accessToken,
        refreshToken,
        channelId: null,
        channelTitle: null,
        raw: { channels },
      });

      // send list back
      ctx.body = {
        ok: true,
        provider: 'youtube',
        connected: false,
        needsChannelSelection: true,
        bandId,
        channels: channels.map((c) => ({
          id: c.id,
          title: c.snippet?.title,
          thumbnails: c.snippet?.thumbnails || null,
        })),
      };
    } catch (err) {
      strapi.log.error('[youtube.oauthCallback] error', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  /**
   * POST /api/youtube/select-channel
   * body: { bandId, channelId }
   * User had multiple channels -> they picked one.
   * We update the account and run sync.
   */
  async selectChannel(ctx) {
    const { bandId, channelId } = ctx.request.body || {};
    if (!bandId || !channelId) return ctx.badRequest('bandId and channelId required');

    try {
      const youtubeService = strapi.service('api::youtube.youtube');

      // get the account we saved at callback time
      const account = await youtubeService.findExternalAccount(bandId, 'youtube');
      if (!account) {
        return ctx.badRequest('Youtube account not found for this band');
      }

      // update with chosen channel
      await youtubeService.upsertExternalAccount({
        bandId,
        provider: 'youtube',
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        channelId,
        channelTitle: null,
        raw: account.raw || null,
      });

      // now run sync
      const normalized = await youtubeService.syncYoutubeForBand({
        bandId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        channelId,
      });

      ctx.body = {
        ok: true,
        provider: 'youtube',
        connected: true,
        bandId,
        metrics: normalized || null,
      };
    } catch (err) {
      strapi.log.error('[youtube.selectChannel] error', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  /**
   * POST /api/youtube/sync
   * body: { bandId }
   * force re-fetch (like manual "Sync now" button on dashboard)
   */
  async sync(ctx) {
    const { bandId } = ctx.request.body || {};
    if (!bandId) return ctx.badRequest('bandId required');

    try {
      const youtubeService = strapi.service('api::youtube.youtube');
      const account = await youtubeService.findExternalAccount(bandId, 'youtube');

      if (!account || !account.accessToken) {
        ctx.body = {
          ok: false,
          reason: 'not-connected',
        };
        return;
      }

      const normalized = await youtubeService.syncYoutubeForBand({
        bandId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        channelId: account.channelId,
      });

      ctx.body = {
        ok: true,
        provider: 'youtube',
        bandId,
        metrics: normalized || null,
      };
    } catch (err) {
      strapi.log.error('[youtube.sync] error', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },
};
