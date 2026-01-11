"use strict";

const qs = require("querystring");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YT_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

// ---------- helpers ----------
const mask = (s) => (s ? `${s.slice(0, 6)}...${s.slice(-6)}` : null);

const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true; // unknown => force refresh
  const expMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const margin = 2 * 60 * 1000; // refresh within 2 minutes of expiry
  return expMs <= nowMs + margin;
};

const handleBandGuardError = (ctx, err) => {
  const msg = String(err?.message || "");
  if (msg === "bandId required") {
    ctx.status = 400;
    ctx.body = { ok: false, error: "bandId required" };
    return true;
  }
  if (msg.startsWith("band-not-found:")) {
    const id = msg.split(":")[1] || "";
    ctx.status = 404;
    ctx.body = {
      ok: false,
      error: `Band ${id} not found in this environment`,
    };
    return true;
  }
  return false;
};

module.exports = {
  // GET /api/youtube/oauth/init?bandId=5
  async oauthInit(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      if (!bandId) return ctx.badRequest("bandId required");

      try {
        const youtubeService = strapi.service("api::youtube.youtube");
        await youtubeService.assertBandExists(bandId);
      } catch (e) {
        if (handleBandGuardError(ctx, e)) return;
        throw e;
      }

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

  // GET /api/youtube/debug/env
  async debugEnv(ctx) {
    try {
      const cid = process.env.GOOGLE_CLIENT_ID || "";
      const secret = process.env.GOOGLE_CLIENT_SECRET || "";
      const redir = process.env.GOOGLE_REDIRECT_URI || "";

      ctx.body = {
        ok: true,
        google: {
          clientId: mask(cid),
          clientSecret: secret ? "***" : null,
          redirectUri: redir || null,
        },
      };
    } catch (err) {
      strapi.log.error("[youtube.debugEnv]", err);
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

    const youtubeService = strapi.service("api::youtube.youtube");
    try {
      await youtubeService.assertBandExists(bandId);
    } catch (e) {
      if (handleBandGuardError(ctx, e)) return;
      throw e;
    }

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

      // 2) get channels with this access token
      const channels = await youtubeService.fetchChannels(accessToken);

      // Store account immediately so we don’t lose tokens, even if no channels
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
          providerClientId: clientId, // stamp minting client id
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

      // Exactly one channel → bind + heavy sync now
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
          providerClientId: clientId, // stamp minting client id
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

      // Many channels → let FE choose
      await youtubeService.upsertExternalAccount({
        bandId,
        provider: "youtube",
        accessToken,
        refreshToken,
        channelId: null,
        channelTitle: null,
        raw: { channels },
        expiresAt,
        providerClientId: clientId, // stamp minting client id
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
    if (!bandId || !channelId) return ctx.badRequest("bandId and channelId required");

    try {
      const youtubeService = strapi.service("api::youtube.youtube");
      try {
        await youtubeService.assertBandExists(bandId);
      } catch (e) {
        if (handleBandGuardError(ctx, e)) return;
        throw e;
      }
      const account = await youtubeService.findExternalAccount(bandId, "youtube");

      if (!account) return ctx.badRequest("Youtube account not found for this band");

      // 🔍 BIG-PICTURE SANITY LOG

      await youtubeService.upsertExternalAccount({
        bandId,
        provider: "youtube",
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        channelId,
        channelTitle: null,
        raw: account.raw || null,
        expiresAt: account.expiresAt || null,
        providerClientId: account?.raw?.providerClientId || null, // preserve minting client id
      });

      const normalized = await youtubeService.heavySyncForBand({
        bandId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        channelId,
      });

      if (!normalized || normalized.ok === false) {
        ctx.body = {
          ok: false,
          provider: "youtube",
          connected: true,
          bandId,
          reason: normalized?.reason || "sync-failed",
          details: normalized?.details || null,
        };
        return;
      }

      ctx.body = {
        ok: true,
        provider: "youtube",
        connected: true,
        bandId,
        metrics: normalized.metrics || normalized || null,
      };
    } catch (err) {
      strapi.log.error("[youtube.selectChannel] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // controller: add this
async debugTokenInfo(ctx) {
  const bandId = Number(ctx.query.bandId);
  if (!bandId) return ctx.badRequest("bandId required");

  const youtubeService = strapi.service("api::youtube.youtube");
  const account = await youtubeService.findExternalAccount(bandId, "youtube");
  if (!account?.accessToken) {
    ctx.body = { ok: false, reason: "no-access-token" };
    return;
  }

  // Google tokeninfo endpoint: returns scopes, audience, expiry, etc.
  const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(account.accessToken)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    ctx.body = {
      ok: res.ok,
      status: res.status,
      tokeninfo: json, // includes 'scope' (space-delimited), 'aud', 'expires_in'
      needScope: "https://www.googleapis.com/auth/youtube.readonly",
    };
  } catch (e) {
    ctx.body = { ok: false, error: e.message };
  }
},

// controller: add this
async debugChannels(ctx) {
  const bandId = Number(ctx.query.bandId);
  if (!bandId) return ctx.badRequest("bandId required");

  const youtubeService = strapi.service("api::youtube.youtube");
  const account = await youtubeService.findExternalAccount(bandId, "youtube");
  if (!account?.accessToken) {
    ctx.body = { ok: false, reason: "no-access-token" };
    return;
  }

  const url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true&maxResults=5";
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    const json = await res.json();
    ctx.body = {
      ok: res.ok,
      status: res.status,
      body: json,
      hint: "If status=401 and error=insufficientPermissions, your token lacks youtube.readonly or wrong project.",
    };
  } catch (e) {
    ctx.body = { ok: false, error: e.message };
  }
},

  // GET /api/youtube/debug/refresh?bandId=5
  async debugRefresh(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      if (!bandId) return ctx.badRequest("bandId required");

      const youtubeService = strapi.service("api::youtube.youtube");
      const account = await youtubeService.findExternalAccount(bandId, "youtube");
      if (!account?.refreshToken) {
        ctx.body = { ok: false, reason: "no-refresh-token" };
        return;
      }
      const out = await youtubeService.refreshAccessToken(account.refreshToken);
      ctx.body = { ok: !!out?.access_token, raw: out };
    } catch (err) {
      strapi.log.error("[youtube.debugRefresh] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // GET or POST /api/youtube/sync?bandId=5
  async sync(ctx) {
    const bandId =
      Number(ctx.request.body?.bandId) || Number(ctx.query.bandId);
    if (!bandId) return ctx.badRequest("bandId required");

    try {
      const youtubeService = strapi.service("api::youtube.youtube");
      try {
        await youtubeService.assertBandExists(bandId);
      } catch (e) {
        if (handleBandGuardError(ctx, e)) return;
        throw e;
      }
      const account = await youtubeService.findExternalAccount(bandId, "youtube");

       strapi.log.info(
      '[youtube.sync] band=' + bandId + ' account=' +
      JSON.stringify({
        hasAccount: !!account,
        hasRefreshToken: !!(account && account.refreshToken),
        expiresAt: account?.expiresAt || null,
        providerClientId: account?.raw?.providerClientId || null,
      })
    );

      if (!account) {
        ctx.body = { ok: false, provider: "youtube", bandId, reason: "not-connected" };
        return;
      }

      if (!account.refreshToken) {
        ctx.body = { ok: false, provider: "youtube", bandId, reason: "no-refresh-token" };
        return;
      }

      // --- Ensure valid access token (controller performs refresh explicitly) ---
      let accessTokenToUse = account.accessToken;

      if (!accessTokenToUse || isTokenExpired(account.expiresAt)) {
        const refreshed = await youtubeService.refreshAccessToken(account.refreshToken);

        if (!refreshed || !refreshed.access_token) {
          ctx.body = {
            ok: false,
            provider: "youtube",
            bandId,
            reason: "refresh-failed",
            details: refreshed || null, // e.g. { error:"invalid_grant", error_description:"..." }
          };
          return;
        }

        accessTokenToUse = refreshed.access_token;

        await youtubeService.upsertExternalAccount({
          bandId,
          provider: "youtube",
          accessToken: accessTokenToUse,
          refreshToken: account.refreshToken,
          channelId: account.channelId || null,
          channelTitle: account.channelTitle || null,
          raw: account.raw || null,
          expiresAt: refreshed.expires_in
            ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
            : null,
          providerClientId: account?.raw?.providerClientId || null, // preserve minting client id
        });
      }

      // --- Heavy sync (refresh channel + recent uploads + playlists) ---
      const out = await youtubeService.heavySyncForBand({
        bandId,
        accessToken: accessTokenToUse,
        refreshToken: account.refreshToken,
        channelId: account.channelId || null,
      });

      if (!out || out.ok === false) {
        ctx.body = {
          ok: false,
          provider: "youtube",
          bandId,
          reason: out?.reason || "sync-failed",
          details: out?.details || null,
        };
        return;
      }

      ctx.body = {
        ok: true,
        provider: "youtube",
        bandId,
        metrics: out.metrics || out,
      };
    } catch (err) {
      strapi.log.error("[youtube.sync] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // GET /api/youtube/debug?bandId=5
 // GET /api/youtube/debug?bandId=5
async debug(ctx) {
  try {
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
            mintedByClientId: account.raw?.providerClientId || null,

            // ✅ ADD THESE FOUR LINES
            accessTokenLength: account.accessToken
              ? account.accessToken.length
              : 0,
            refreshTokenLength: account.refreshToken
              ? account.refreshToken.length
              : 0,
            rawAccessTokenStart: account.accessToken
              ? account.accessToken.slice(0, 10)
              : null,
            rawRefreshTokenStart: account.refreshToken
              ? account.refreshToken.slice(0, 10)
              : null,
          }
        : null,
    };
  } catch (err) {
    strapi.log.error("[youtube.debug] error", err);
    ctx.status = 500;
    ctx.body = { ok: false, error: err.message };
  }
},


  // GET /api/youtube/debug/sync?bandId=5
  async debugSync(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      if (!bandId) return ctx.badRequest("bandId required");

      const youtubeService = strapi.service("api::youtube.youtube");
      const account = await youtubeService.findExternalAccount(bandId, "youtube");

      if (!account) {
        ctx.body = { ok: false, reason: "no-account" };
        return;
      }

      let accessTokenToUse = account.accessToken;
      if (isTokenExpired(account.expiresAt)) {
        strapi.log.info(
          "[youtube.debugSync] access token expired for band %s",
          bandId
        );
        accessTokenToUse = null; // will force the service to fail (we use sync() normally)
      }

      const out = await youtubeService.syncYoutubeForBand({
        bandId,
        accessToken: accessTokenToUse,
        channelId: account.channelId,
      });

      ctx.body = { ok: !!out && out.ok !== false, bandId, data: out };
    } catch (err) {
      strapi.log.error("[youtube.debugSync] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // GET /api/youtube/debug/metrics?bandId=5
  async debugMetrics(ctx) {
    try {
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

      ctx.body = { ok: true, bandId, count: metrics.length, metrics };
    } catch (err) {
      strapi.log.error("[youtube.debugMetrics] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // POST /api/youtube/purge  { bandId }
  async purge(ctx) {
    const { bandId } = ctx.request.body || {};
    if (!bandId) return ctx.badRequest("bandId required");

    try {
      const youtubeService = strapi.service("api::youtube.youtube");
      try {
        await youtubeService.assertBandExists(bandId);
      } catch (e) {
        if (handleBandGuardError(ctx, e)) return;
        throw e;
      }

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

      ctx.body = { ok: true, bandId, removedAccount, deletedMetrics };
    } catch (err) {
      strapi.log.error("[youtube.purge] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },

  // POST /api/youtube/disconnect { bandId }
  async disconnect(ctx) {
    const { bandId } = ctx.request.body || {};
    if (!bandId) return ctx.badRequest("bandId required");

    try {
      const youtubeService = strapi.service("api::youtube.youtube");
      try {
        await youtubeService.assertBandExists(bandId);
      } catch (e) {
        if (handleBandGuardError(ctx, e)) return;
        throw e;
      }
      const removed = await youtubeService.removeExternalAccount(bandId, "youtube");

      ctx.body = { ok: true, provider: "youtube", bandId, removed };
    } catch (err) {
      strapi.log.error("[youtube.disconnect] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },
};
