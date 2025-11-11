"use strict";

const qs = require("querystring");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YT_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true; // be safe: force refresh if we don’t know
  const expMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const margin = 2 * 60 * 1000; // 2 min early refresh
  return expMs <= (nowMs + margin);
};


module.exports = {



  // GET /api/youtube/oauth/init?bandId=5
  async oauthInit(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      if (!bandId) return ctx.badRequest("bandId required");

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return ctx.badRequest("Google OAuth not configured");
      }

      const nonce = Math.random().toString(36).slice(2, 10);
      const state = `mbqr|band:${bandId}|nonce:${nonce}`;

      const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        qs.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          access_type: "offline",
          scope: YT_SCOPE,
          include_granted_scopes: "true",
          state,
          prompt: "consent",
        });

      ctx.body = { ok: true, authUrl };
    } catch (err) {
      strapi.log.error("[youtube.oauthInit]", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // POST /api/youtube/oauth/callback
  async oauthCallback(ctx) {
    const { code, state } = ctx.request.body || {};
    if (!code || !state) return ctx.badRequest("code and state required");

    const bandIdMatch = String(state).match(/band:(\d+)/);
    const bandId = bandIdMatch ? Number(bandIdMatch[1]) : null;
    if (!bandId) return ctx.badRequest("bandId missing in state");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return ctx.badRequest("Google OAuth not configured");
    }

    try {
      // 1) exchange code → tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: qs.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      strapi.log.debug("[youtube.oauthCallback] tokenData:", tokenData);

      if (!tokenRes.ok || tokenData.error) {
        strapi.log.error("[youtube.oauthCallback] token error", tokenData);
        ctx.body = {
          ok: false,
          provider: "youtube",
          connected: false,
          reason: "token-exchange-failed",
          details: tokenData,
        };
        return;
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;
      const expiresIn = tokenData.expires_in || null;
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

      const youtubeService = strapi.service("api::youtube.youtube");

      // 2) get channels with this access token
      const channels = await youtubeService.fetchChannels(accessToken);

      // store even if no channels, so we don’t lose tokens
      if (!channels || !channels.length) {
        await youtubeService.upsertExternalAccount({
          bandId,
          provider: "youtube",
          accessToken,
          refreshToken,
          channelId: null,
          channelTitle: null,
          raw: { channels: [] },
          expiresAt,
        });

        ctx.body = {
          ok: true,
          provider: "youtube",
          connected: false,
          bandId,
          reason: "no-channels",
        };
        return;
      }

      // exactly 1 channel → bind + sync now
      // 3) one channel → bind + heavy sync
      if (channels.length === 1) {
        const ch = channels[0];

        await youtubeService.upsertExternalAccount({
          bandId,
          provider: "youtube",
          accessToken,
          refreshToken,
          channelId: ch.id,
          channelTitle: ch.snippet?.title || null,
          raw: { channels },
          expiresAt,
        });

        const normalized = await youtubeService.heavySyncForBand({
          bandId,
          accessToken,
          refreshToken,
          channelId: ch.id,
        });

        ctx.body = {
          ok: true,
          provider: "youtube",
          connected: true,
          bandId,
          metrics: normalized || null,
        };
        return;
      }

      // many channels → let FE choose
      await youtubeService.upsertExternalAccount({
        bandId,
        provider: "youtube",
        accessToken,
        refreshToken,
        channelId: null,
        channelTitle: null,
        raw: { channels },
        expiresAt,
      });

      ctx.body = {
        ok: true,
        provider: "youtube",
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
      strapi.log.error("[youtube.oauthCallback] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // POST /api/youtube/select-channel
  async selectChannel(ctx) {
    const { bandId, channelId } = ctx.request.body || {};
    if (!bandId || !channelId)
      return ctx.badRequest("bandId and channelId required");

    try {
      const youtubeService = strapi.service("api::youtube.youtube");
      const account = await youtubeService.findExternalAccount(
        bandId,
        "youtube"
      );

      if (!account) {
        return ctx.badRequest("Youtube account not found for this band");
      }

      await youtubeService.upsertExternalAccount({
        bandId,
        provider: "youtube",
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        channelId,
        channelTitle: null,
        raw: account.raw || null,
        expiresAt: account.expiresAt || null,
      });

      const normalized = await youtubeService.syncYoutubeForBand({
        bandId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        channelId,
      });

      ctx.body = {
        ok: true,
        provider: "youtube",
        connected: true,
        bandId,
        metrics: normalized || null,
      };
    } catch (err) {
      strapi.log.error("[youtube.selectChannel] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

// controller
async debugRefresh(ctx) {
  const bandId = Number(ctx.query.bandId);
  if (!bandId) return ctx.badRequest('bandId required');

  const youtubeService = strapi.service('api::youtube.youtube');
  const account = await youtubeService.findExternalAccount(bandId, 'youtube');
  if (!account?.refreshToken) {
    ctx.body = { ok: false, reason: 'no-refresh-token' };
    return;
  }
  const out = await youtubeService.refreshAccessToken(account.refreshToken);
  ctx.body = { ok: !!out?.access_token, raw: out };
},
// POST or GET /api/youtube/sync?bandId=5
async sync(ctx) {
  
  const bandId = Number(ctx.request.body?.bandId) || Number(ctx.query.bandId);
  
  if (!bandId) return ctx.badRequest("bandId required");
    strapi.log.info("[youtube.sync] >>> NEW SYNC HANDLER HIT <<< bandId=%s", bandId);


  try {
    const youtubeService = strapi.service("api::youtube.youtube");
    const account = await youtubeService.findExternalAccount(bandId, "youtube");

    if (!account) {
      ctx.body = {
        ok: false,
        provider: "youtube",
        bandId,
        reason: "not-connected",
      };
      return;
    }

    if (!account.refreshToken) {
      ctx.body = {
        ok: false,
        provider: "youtube",
        bandId,
        reason: "no-refresh-token",
      };
      return;
    }

    // Decide which token to use, SAME as debugSync:
    let accessTokenToUse = account.accessToken;
    if (isTokenExpired(account.expiresAt)) {
      strapi.log.info(
        "[youtube.sync] access token expired for band %s, forcing refresh via service",
        bandId
      );
      accessTokenToUse = null; // triggers refresh inside syncYoutubeForBand
    }

    const normalized = await youtubeService.syncYoutubeForBand({
      bandId,
      accessToken: accessTokenToUse,
      refreshToken: account.refreshToken,
      channelId: account.channelId,
    });

    if (!normalized) {
      ctx.body = {
        ok: false,
        provider: "youtube",
        bandId,
        reason: "sync-failed",
      };
      return;
    }

    ctx.body = {
      ok: true,
      provider: "youtube",
      bandId,
      metrics: normalized,
    };
  } catch (err) {
    strapi.log.error("[youtube.sync] error", err);
    ctx.status = 500;
    ctx.body = { ok: false, error: err.message };
  }
},




// POST or GET /api/youtube/sync





  // GET /api/youtube/debug?bandId=5
  async debug(ctx) {
    const bandId = Number(ctx.query.bandId);
    if (!bandId) return ctx.badRequest("bandId required");

    const youtubeService = strapi.service("api::youtube.youtube");
    const account = await youtubeService.findExternalAccount(bandId, "youtube");

    ctx.body = {
      ok: true,
      bandId,
      account: account
        ? {
            id: account.id,
            provider: account.provider,
            channelId: account.channelId,
            channelTitle: account.channelTitle,
            hasAccessToken: !!account.accessToken,
            hasRefreshToken: !!account.refreshToken,
            expiresAt: account.expiresAt || null,
          }
        : null,
    };
  },

  // GET /api/youtube/debug/sync?bandId=5
// GET /api/youtube/debug/sync?bandId=5
async debugSync(ctx) {
  const bandId = Number(ctx.query.bandId);
  if (!bandId) return ctx.badRequest("bandId required");

  const youtubeService = strapi.service("api::youtube.youtube");
  const account = await youtubeService.findExternalAccount(bandId, "youtube");

  if (!account) {
    ctx.body = {
      ok: false,
      reason: "no-account",
    };
    return;
  }

  let accessTokenToUse = account.accessToken;
  if (isTokenExpired(account.expiresAt)) {
    strapi.log.info(
      "[youtube.debugSync] access token expired for band %s, using refreshToken",
      bandId
    );
    accessTokenToUse = null;
  }

  const out = await youtubeService.syncYoutubeForBand({
    bandId,
    accessToken: accessTokenToUse,
    refreshToken: account.refreshToken,
    channelId: account.channelId,
  });

  ctx.body = {
    ok: !!out,
    bandId,
    data: out,
  };
},


  // GET /api/youtube/debug/metrics?bandId=5
  async debugMetrics(ctx) {
    const bandId = Number(ctx.query.bandId);
    if (!bandId) return ctx.badRequest("bandId required");

    const metrics = await strapi.entityService.findMany(
      "api::band-external-metric.band-external-metric",
      {
        filters: { band: { id: bandId }, provider: "youtube" },
        sort: { date: "desc" },
        limit: 5,
      }
    );

    ctx.body = {
      ok: true,
      bandId,
      count: metrics.length,
      metrics,
    };
  },

  // POST /api/youtube/purge
  async purge(ctx) {
    const { bandId } = ctx.request.body || {};
    if (!bandId) return ctx.badRequest("bandId required");

    try {
      const youtubeService = strapi.service("api::youtube.youtube");

      const removedAccount = await youtubeService.removeExternalAccount(
        bandId,
        "youtube"
      );

      const metrics = await strapi.entityService.findMany(
        "api::band-external-metric.band-external-metric",
        {
          filters: { band: { id: bandId }, provider: "youtube" },
          limit: 500,
        }
      );

      let deletedMetrics = 0;
      for (const m of metrics) {
        await strapi.entityService.delete(
          "api::band-external-metric.band-external-metric",
          m.id
        );
        deletedMetrics++;
      }

      ctx.body = {
        ok: true,
        bandId,
        removedAccount,
        deletedMetrics,
      };
    } catch (err) {
      strapi.log.error("[youtube.purge] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // POST /api/youtube/disconnect
  async disconnect(ctx) {
    const { bandId } = ctx.request.body || {};
    if (!bandId) return ctx.badRequest("bandId required");

    try {
      const youtubeService = strapi.service("api::youtube.youtube");
      const removed = await youtubeService.removeExternalAccount(
        bandId,
        "youtube"
      );

      ctx.body = {
        ok: true,
        provider: "youtube",
        bandId,
        removed,
      };
    } catch (err) {
      strapi.log.error("[youtube.disconnect] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },
};
