# Permission Plan

Generated: 2026-01-19T04:39:45.836Z

## Legend

- **KEEP**: Permission is safe and should remain as-is
- **REMOVE**: Permission should be disabled (safe to auto-apply)
- **REVIEW**: Needs manual review before changing

## Summary

| Role | Safe Removals | Needs Review |
|------|---------------|---------------|
| Public | 16 | 56 |
| Authenticated | 1 | 91 |

## Public Role

### 🔴 REMOVE (Safe to disable)

| Action | Risk | Reason |
|--------|------|--------|
| `plugin::users-permissions.user.create` | HIGH | Create operation should not be public |
| `plugin::users-permissions.user.find` | HIGH | User/role enumeration risk |
| `plugin::users-permissions.user.findOne` | HIGH | User/role enumeration risk |
| `plugin::upload.content-api.find` | HIGH | Upload should not be public |
| `plugin::upload.content-api.findOne` | HIGH | Upload should not be public |
| `api::qr.qr.update` | HIGH | Update operation should not be public |
| `api::stripe.stripe.createCheckoutSession` | HIGH | Create operation should not be public |
| `api::stripe.stripe.createCustomer` | HIGH | Create operation should not be public |
| `api::scan.scan.update` | HIGH | Update operation should not be public |
| `api::band-page-view.band-page-view.create` | HIGH | Create operation should not be public |
| `api::event-page-view.event-page-view.create` | HIGH | Create operation should not be public |
| `api::band-insight-daily.band-insight-daily.create` | HIGH | Create operation should not be public |
| `api::band-insight-daily.band-insight-daily.delete` | HIGH | Delete operation should not be public |
| `api::band-insight-daily.band-insight-daily.update` | HIGH | Update operation should not be public |
| `api::pulse-snapshot.pulse-snapshot.create` | HIGH | Create operation should not be public |
| `api::pulse-snapshot.pulse-snapshot.update` | HIGH | Update operation should not be public |

### 🟡 REVIEW (Needs manual decision)

| Action | Risk | Reason |
|--------|------|--------|
| `plugin::users-permissions.user.me` | MEDIUM | Unknown action - needs manual review |
| `plugin::users-permissions.auth.changePassword` | MEDIUM | Unknown action - needs manual review |
| `api::album.album.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::album.album.find` | MEDIUM | Read operation - verify if content should be public |
| `api::qr.qr.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::qr.qr.find` | MEDIUM | Read operation - verify if content should be public |
| `api::socialpage.socialpage.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::socialpage.socialpage.find` | MEDIUM | Read operation - verify if content should be public |
| `api::stream.stream.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::stream.stream.find` | MEDIUM | Read operation - verify if content should be public |
| `api::tour.tour.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::tour.tour.find` | MEDIUM | Read operation - verify if content should be public |
| `api::video.video.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::video.video.find` | MEDIUM | Read operation - verify if content should be public |
| `api::scan.scan.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::scan.scan.find` | MEDIUM | Read operation - verify if content should be public |
| `api::link-click.link-click.getBandClicks` | MEDIUM | Unknown action - needs manual review |
| `api::link-click.link-click.trackClick` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.stripe.confirmPayment` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.stripe.testRoute` | MEDIUM | Unknown action - needs manual review |
| `api::band.band.findBySlug` | MEDIUM | Read operation - verify if content should be public |
| `api::media-play.media-play.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::media-play.media-play.find` | MEDIUM | Read operation - verify if content should be public |
| `api::stripe.stripe.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| `api::subscription.subscription.webhook` | MEDIUM | Unknown action - needs manual review |
| `api::subscription.subscription.register` | MEDIUM | Unknown action - needs manual review |
| `api::subscription.subscription.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| `api::band-page-view.band-page-view.find` | MEDIUM | Read operation - verify if content should be public |
| `api::band-page-view.band-page-view.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::event-page-view.event-page-view.find` | MEDIUM | Read operation - verify if content should be public |
| `api::event-page-view.event-page-view.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::stripe.stripe.confirmSocial` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.find` | MEDIUM | Read operation - verify if content should be public |
| `api::band-insight-daily.band-insight-daily.compute` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::analytics.analytics.rollups` | MEDIUM | Unknown action - needs manual review |
| `api::analytics.analytics.geo` | MEDIUM | Unknown action - needs manual review |
| `api::analytics.analytics.transitions` | MEDIUM | Unknown action - needs manual review |
| `api::muse.muse.run` | MEDIUM | Unknown action - needs manual review |
| `api::muse.muse.backfill` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.debug` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.backfill` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.debugSync` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.disconnect` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.oauthInit` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.selectChannel` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.oauthCallback` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.purge` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.sync` | MEDIUM | Unknown action - needs manual review |
| `api::band.payments.onboard` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.connect-webhook.handle` | MEDIUM | Unknown action - needs manual review |
| `api::scan.scan.track` | MEDIUM | Unknown action - needs manual review |
| `api::band-share.band-share.find` | MEDIUM | Read operation - verify if content should be public |
| `api::band-share.band-share.findOne` | MEDIUM | Read operation - verify if content should be public |
| `api::pulse-snapshot.pulse-snapshot.find` | MEDIUM | Read operation - verify if content should be public |
| `api::pulse-snapshot.pulse-snapshot.findOne` | MEDIUM | Read operation - verify if content should be public |

### 🟢 KEEP

| Action | Reason |
|--------|--------|
| `plugin::users-permissions.auth.register` | Required for authentication flow |
| `plugin::users-permissions.auth.connect` | Required for authentication flow |
| `plugin::users-permissions.auth.callback` | Required for authentication flow |
| `plugin::users-permissions.auth.sendEmailConfirmation` | Required for authentication flow |
| `plugin::users-permissions.auth.emailConfirmation` | Required for authentication flow |
| `plugin::users-permissions.auth.forgotPassword` | Required for authentication flow |
| `plugin::users-permissions.auth.resetPassword` | Required for authentication flow |
| `api::band.band.findOne` | Required for public band/event/article pages |
| `api::event.event.findOne` | Required for public band/event/article pages |
| `api::event.event.find` | Required for public band/event/article pages |
| `api::scan.scan.create` | Analytics tracking endpoint - needs rate limiting |
| `api::band.band.find` | Required for public band/event/article pages |
| `api::media-play.media-play.track` | Analytics tracking endpoint - needs rate limiting |
| `api::seo-page.seo-page.find` | Required for public band/event/article pages |
| `api::seo-page.seo-page.findOne` | Required for public band/event/article pages |
| `api::howtovideo.howtovideo.findOne` | Required for public band/event/article pages |
| `api::howtovideo.howtovideo.find` | Required for public band/event/article pages |
| `api::band-ui-event.band-ui-event.track` | Analytics tracking endpoint - needs rate limiting |
| `api::event-page-view.event-page-view.track` | Analytics tracking endpoint - needs rate limiting |

## Authenticated Role

### 🔴 REMOVE (Safe to disable)

| Action | Risk | Reason |
|--------|------|--------|
| `plugin::users-permissions.user.find` | HIGH | User enumeration - not needed for normal users |

### 🟡 REVIEW (Needs manual decision)

| Action | Risk | Reason |
|--------|------|--------|
| `plugin::users-permissions.auth.register` | MEDIUM | Unknown action - needs manual review |
| `plugin::users-permissions.auth.connect` | MEDIUM | Unknown action - needs manual review |
| `plugin::users-permissions.auth.callback` | MEDIUM | Unknown action - needs manual review |
| `plugin::users-permissions.auth.emailConfirmation` | MEDIUM | Unknown action - needs manual review |
| `plugin::users-permissions.auth.resetPassword` | MEDIUM | Unknown action - needs manual review |
| `plugin::users-permissions.auth.forgotPassword` | MEDIUM | Unknown action - needs manual review |
| `api::album.album.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::album.album.create` | MEDIUM | Create operation - verify validation exists |
| `api::album.album.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::event.event.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::event.event.create` | MEDIUM | Create operation - verify validation exists |
| `api::event.event.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::qr.qr.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::qr.qr.create` | MEDIUM | Create operation - verify validation exists |
| `api::qr.qr.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::socialpage.socialpage.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::socialpage.socialpage.create` | MEDIUM | Create operation - verify validation exists |
| `api::socialpage.socialpage.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::stream.stream.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::stream.stream.create` | MEDIUM | Create operation - verify validation exists |
| `api::stream.stream.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::tour.tour.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::tour.tour.create` | MEDIUM | Create operation - verify validation exists |
| `api::tour.tour.update` | MEDIUM | Update operation - verify ownership check exists |
| `plugin::upload.content-api.upload` | MEDIUM | Unknown action - needs manual review |
| `plugin::upload.content-api.destroy` | MEDIUM | Unknown action - needs manual review |
| `api::video.video.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::video.video.create` | MEDIUM | Create operation - verify validation exists |
| `api::video.video.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::scan.scan.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::scan.scan.create` | MEDIUM | Create operation - verify validation exists |
| `api::scan.scan.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::link-click.link-click.getBandClicks` | MEDIUM | Unknown action - needs manual review |
| `api::link-click.link-click.trackClick` | MEDIUM | Unknown action - needs manual review |
| `api::band.band.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::band.band.create` | MEDIUM | Create operation - verify validation exists |
| `api::band.band.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::stripe.stripe.confirmPayment` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.stripe.createCheckoutSession` | MEDIUM | Create operation - verify validation exists |
| `api::stripe.stripe.testRoute` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.stripe.createCustomer` | MEDIUM | Create operation - verify validation exists |
| `api::auth.email-confirmation.confirmEmail` | MEDIUM | Unknown action - needs manual review |
| `api::media-play.media-play.track` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.stripe.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.stripe.getBillingInfo` | MEDIUM | Unknown action - needs manual review |
| `api::stripe.stripe.createBillingPortalSession` | MEDIUM | Create operation - verify validation exists |
| `api::subscription.subscription.register` | MEDIUM | Unknown action - needs manual review |
| `api::subscription.subscription.webhook` | MEDIUM | Unknown action - needs manual review |
| `api::subscription.subscription.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| `api::subscription.subscription.createBillingPortalSession` | MEDIUM | Create operation - verify validation exists |
| `api::band-page-view.band-page-view.create` | MEDIUM | Create operation - verify validation exists |
| `api::event-page-view.event-page-view.create` | MEDIUM | Create operation - verify validation exists |
| `api::stripe.stripe.confirmSocial` | MEDIUM | Unknown action - needs manual review |
| `api::howtovideo.howtovideo.create` | MEDIUM | Create operation - verify validation exists |
| `api::howtovideo.howtovideo.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::howtovideo.howtovideo.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::band-insight-daily.band-insight-daily.create` | MEDIUM | Create operation - verify validation exists |
| `api::band-insight-daily.band-insight-daily.compute` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::band-insight-daily.band-insight-daily.muse` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.delete` | MEDIUM | Delete operation - verify ownership check exists |
| `api::analytics.analytics.rollups` | MEDIUM | Unknown action - needs manual review |
| `api::analytics.analytics.geo` | MEDIUM | Unknown action - needs manual review |
| `api::analytics.analytics.transitions` | MEDIUM | Unknown action - needs manual review |
| `api::muse.muse.run` | MEDIUM | Unknown action - needs manual review |
| `api::muse.muse.backfill` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.backfill` | MEDIUM | Unknown action - needs manual review |
| `api::band-insight-daily.band-insight-daily.debug` | MEDIUM | Unknown action - needs manual review |
| `api::muse.muse.aggregate` | MEDIUM | Unknown action - needs manual review |
| `api::band-external-account.band-external-account.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::band-external-account.band-external-account.create` | MEDIUM | Create operation - verify validation exists |
| `api::band-external-metric.band-external-metric.create` | MEDIUM | Create operation - verify validation exists |
| `api::band-external-metric.band-external-metric.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::youtube.youtube.debugSync` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.disconnect` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.oauthInit` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.selectChannel` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.oauthCallback` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.purge` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.sync` | MEDIUM | Unknown action - needs manual review |
| `api::youtube.youtube.debug` | MEDIUM | Unknown action - needs manual review |
| `api::band.payments.onboard` | MEDIUM | Unknown action - needs manual review |
| `api::band.payments.summary` | MEDIUM | Unknown action - needs manual review |
| `api::event-page-view.event-page-view.track` | MEDIUM | Unknown action - needs manual review |
| `api::support-moment.support-moment.create` | MEDIUM | Create operation - verify validation exists |
| `api::support-moment.support-moment.update` | MEDIUM | Update operation - verify ownership check exists |
| `api::support-moment.support-moment.summary` | MEDIUM | Unknown action - needs manual review |
| `api::band.checkout.create` | MEDIUM | Create operation - verify validation exists |
| `api::band-external-metric.band-external-metric.latest` | MEDIUM | Unknown action - needs manual review |
| `api::band-external-metric.band-external-metric.upsert` | MEDIUM | Unknown action - needs manual review |
| `api::band-ui-event.band-ui-event.track` | MEDIUM | Unknown action - needs manual review |

### 🟢 KEEP

| Action | Reason |
|--------|--------|
| `plugin::users-permissions.auth.changePassword` | Required for user account management |
| `plugin::users-permissions.user.me` | Required for user account management |
| `plugin::users-permissions.user.update` | Required for user account management |
| `api::album.album.findOne` | Read operation for authenticated users |
| `api::album.album.find` | Read operation for authenticated users |
| `api::band.band.findOne` | Read operation for authenticated users |
| `api::event.event.findOne` | Read operation for authenticated users |
| `api::event.event.find` | Read operation for authenticated users |
| `api::qr.qr.findOne` | Read operation for authenticated users |
| `api::qr.qr.find` | Read operation for authenticated users |
| `api::socialpage.socialpage.findOne` | Read operation for authenticated users |
| `api::socialpage.socialpage.find` | Read operation for authenticated users |
| `api::stream.stream.findOne` | Read operation for authenticated users |
| `api::stream.stream.find` | Read operation for authenticated users |
| `api::tour.tour.findOne` | Read operation for authenticated users |
| `api::tour.tour.find` | Read operation for authenticated users |
| `plugin::upload.content-api.find` | Read operation for authenticated users |
| `plugin::upload.content-api.findOne` | Read operation for authenticated users |
| `api::video.video.findOne` | Read operation for authenticated users |
| `api::video.video.find` | Read operation for authenticated users |
| `api::scan.scan.findOne` | Read operation for authenticated users |
| `api::scan.scan.find` | Read operation for authenticated users |
| `api::band.band.find` | Read operation for authenticated users |
| `api::band.band.findBySlug` | Read operation for authenticated users |
| `api::media-play.media-play.findOne` | Read operation for authenticated users |
| `api::media-play.media-play.find` | Read operation for authenticated users |
| `api::band-page-view.band-page-view.find` | Read operation for authenticated users |
| `api::band-page-view.band-page-view.findOne` | Read operation for authenticated users |
| `api::event-page-view.event-page-view.findOne` | Read operation for authenticated users |
| `api::event-page-view.event-page-view.find` | Read operation for authenticated users |
| `api::howtovideo.howtovideo.find` | Read operation for authenticated users |
| `api::howtovideo.howtovideo.findOne` | Read operation for authenticated users |
| `api::band-insight-daily.band-insight-daily.find` | Read operation for authenticated users |
| `api::band-insight-daily.band-insight-daily.findOne` | Read operation for authenticated users |
| `api::band-external-account.band-external-account.find` | Read operation for authenticated users |
| `api::band-external-account.band-external-account.findOne` | Read operation for authenticated users |
| `api::band-external-metric.band-external-metric.find` | Read operation for authenticated users |
| `api::band-external-metric.band-external-metric.findOne` | Read operation for authenticated users |
| `api::support-moment.support-moment.findOne` | Read operation for authenticated users |
| `api::support-moment.support-moment.find` | Read operation for authenticated users |
