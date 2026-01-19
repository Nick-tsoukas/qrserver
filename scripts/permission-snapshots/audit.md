# Permissions Audit Report

Generated: 2026-01-19T04:39:36.043Z

## Summary

| Role | Total Permissions | Enabled | High Risk | Medium Risk |
|------|-------------------|---------|-----------|-------------|
| Public | 91 | 91 | 15 | 2 |
| Authenticated | 132 | 132 | 0 | 12 |

## Public Role - Enabled Permissions

| Action | Risk | Reason |
|--------|------|--------|
| `plugin::users-permissions.auth.register` | 🟢 LOW | Read operation |
| `plugin::users-permissions.auth.connect` | 🟢 LOW | Read operation |
| `plugin::users-permissions.user.create` | 🔴 HIGH | Write operation exposed to public |
| `plugin::users-permissions.user.me` | 🟢 LOW | Read operation |
| `plugin::users-permissions.user.find` | 🟡 MEDIUM | User/role enumeration possible |
| `plugin::users-permissions.auth.callback` | 🟢 LOW | Read operation |
| `plugin::users-permissions.auth.sendEmailConfirmation` | 🟢 LOW | Read operation |
| `plugin::users-permissions.auth.emailConfirmation` | 🟢 LOW | Read operation |
| `plugin::users-permissions.auth.changePassword` | 🟢 LOW | Read operation |
| `plugin::users-permissions.auth.forgotPassword` | 🟢 LOW | Read operation |
| `plugin::users-permissions.auth.resetPassword` | 🟢 LOW | Read operation |
| `plugin::users-permissions.user.findOne` | 🟡 MEDIUM | User/role enumeration possible |
| `api::band.band.findOne` | 🟢 LOW | Read operation |
| `api::album.album.findOne` | 🟢 LOW | Read operation |
| `api::album.album.find` | 🟢 LOW | Read operation |
| `api::event.event.findOne` | 🟢 LOW | Read operation |
| `api::event.event.find` | 🟢 LOW | Read operation |
| `api::qr.qr.findOne` | 🟢 LOW | Read operation |
| `api::qr.qr.find` | 🟢 LOW | Read operation |
| `api::socialpage.socialpage.findOne` | 🟢 LOW | Read operation |
| `api::socialpage.socialpage.find` | 🟢 LOW | Read operation |
| `api::stream.stream.findOne` | 🟢 LOW | Read operation |
| `api::stream.stream.find` | 🟢 LOW | Read operation |
| `api::tour.tour.findOne` | 🟢 LOW | Read operation |
| `api::tour.tour.find` | 🟢 LOW | Read operation |
| `plugin::upload.content-api.find` | 🔴 HIGH | Upload exposed to public |
| `plugin::upload.content-api.findOne` | 🔴 HIGH | Upload exposed to public |
| `api::video.video.findOne` | 🟢 LOW | Read operation |
| `api::video.video.find` | 🟢 LOW | Read operation |
| `api::scan.scan.findOne` | 🟢 LOW | Read operation |
| `api::scan.scan.find` | 🟢 LOW | Read operation |
| `api::scan.scan.create` | 🔴 HIGH | Write operation exposed to public |
| `api::link-click.link-click.getBandClicks` | 🟢 LOW | Read operation |
| `api::link-click.link-click.trackClick` | 🟢 LOW | Read operation |
| `api::band.band.find` | 🟢 LOW | Read operation |
| `api::qr.qr.update` | 🔴 HIGH | Write operation exposed to public |
| `api::stripe.stripe.createCheckoutSession` | 🔴 HIGH | Write operation exposed to public |
| `api::stripe.stripe.confirmPayment` | 🟢 LOW | Read operation |
| `api::stripe.stripe.createCustomer` | 🔴 HIGH | Write operation exposed to public |
| `api::stripe.stripe.testRoute` | 🟢 LOW | Read operation |
| `api::band.band.findBySlug` | 🟢 LOW | Read operation |
| `api::scan.scan.update` | 🔴 HIGH | Write operation exposed to public |
| `api::media-play.media-play.track` | 🟢 LOW | Read operation |
| `api::media-play.media-play.findOne` | 🟢 LOW | Read operation |
| `api::media-play.media-play.find` | 🟢 LOW | Read operation |
| `api::stripe.stripe.subscriptionStatus` | 🟢 LOW | Read operation |
| `api::subscription.subscription.webhook` | 🟢 LOW | Read operation |
| `api::subscription.subscription.register` | 🟢 LOW | Read operation |
| `api::subscription.subscription.subscriptionStatus` | 🟢 LOW | Read operation |
| `api::band-page-view.band-page-view.create` | 🔴 HIGH | Write operation exposed to public |
| `api::band-page-view.band-page-view.find` | 🟢 LOW | Read operation |
| `api::band-page-view.band-page-view.findOne` | 🟢 LOW | Read operation |
| `api::event-page-view.event-page-view.find` | 🟢 LOW | Read operation |
| `api::event-page-view.event-page-view.findOne` | 🟢 LOW | Read operation |
| `api::event-page-view.event-page-view.create` | 🔴 HIGH | Write operation exposed to public |
| `api::seo-page.seo-page.find` | 🟢 LOW | Read operation |
| `api::seo-page.seo-page.findOne` | 🟢 LOW | Read operation |
| `api::stripe.stripe.confirmSocial` | 🟢 LOW | Read operation |
| `api::howtovideo.howtovideo.findOne` | 🟢 LOW | Read operation |
| `api::howtovideo.howtovideo.find` | 🟢 LOW | Read operation |
| `api::band-insight-daily.band-insight-daily.find` | 🟢 LOW | Read operation |
| `api::band-insight-daily.band-insight-daily.compute` | 🟢 LOW | Read operation |
| `api::band-insight-daily.band-insight-daily.findOne` | 🟢 LOW | Read operation |
| `api::band-insight-daily.band-insight-daily.create` | 🔴 HIGH | Write operation exposed to public |
| `api::band-insight-daily.band-insight-daily.delete` | 🔴 HIGH | Write operation exposed to public |
| `api::band-insight-daily.band-insight-daily.update` | 🔴 HIGH | Write operation exposed to public |
| `api::analytics.analytics.rollups` | 🟢 LOW | Read operation |
| `api::analytics.analytics.geo` | 🟢 LOW | Read operation |
| `api::analytics.analytics.transitions` | 🟢 LOW | Read operation |
| `api::muse.muse.run` | 🟢 LOW | Read operation |
| `api::muse.muse.backfill` | 🟢 LOW | Read operation |
| `api::band-insight-daily.band-insight-daily.debug` | 🟢 LOW | Read operation |
| `api::band-insight-daily.band-insight-daily.backfill` | 🟢 LOW | Read operation |
| `api::youtube.youtube.debugSync` | 🟢 LOW | Read operation |
| `api::youtube.youtube.disconnect` | 🟢 LOW | Read operation |
| `api::youtube.youtube.oauthInit` | 🟢 LOW | Read operation |
| `api::youtube.youtube.selectChannel` | 🟢 LOW | Read operation |
| `api::youtube.youtube.oauthCallback` | 🟢 LOW | Read operation |
| `api::youtube.youtube.purge` | 🟢 LOW | Read operation |
| `api::youtube.youtube.sync` | 🟢 LOW | Read operation |
| `api::band.payments.onboard` | 🟢 LOW | Read operation |
| `api::stripe.connect-webhook.handle` | 🟢 LOW | Read operation |
| `api::band-ui-event.band-ui-event.track` | 🟢 LOW | Read operation |
| `api::event-page-view.event-page-view.track` | 🟢 LOW | Read operation |
| `api::scan.scan.track` | 🟢 LOW | Read operation |
| `api::band-share.band-share.find` | 🟢 LOW | Read operation |
| `api::band-share.band-share.findOne` | 🟢 LOW | Read operation |
| `api::pulse-snapshot.pulse-snapshot.find` | 🟢 LOW | Read operation |
| `api::pulse-snapshot.pulse-snapshot.findOne` | 🟢 LOW | Read operation |
| `api::pulse-snapshot.pulse-snapshot.create` | 🔴 HIGH | Write operation exposed to public |
| `api::pulse-snapshot.pulse-snapshot.update` | 🔴 HIGH | Write operation exposed to public |

## Authenticated Role - Enabled Permissions

| Action | Risk | Reason |
|--------|------|--------|
| `plugin::users-permissions.auth.register` | 🟢 LOW |  |
| `plugin::users-permissions.auth.connect` | 🟢 LOW |  |
| `plugin::users-permissions.auth.callback` | 🟢 LOW |  |
| `plugin::users-permissions.auth.changePassword` | 🟢 LOW |  |
| `plugin::users-permissions.auth.emailConfirmation` | 🟢 LOW |  |
| `plugin::users-permissions.auth.resetPassword` | 🟢 LOW |  |
| `plugin::users-permissions.auth.forgotPassword` | 🟢 LOW |  |
| `plugin::users-permissions.user.me` | 🟢 LOW |  |
| `plugin::users-permissions.user.update` | 🟢 LOW |  |
| `api::album.album.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::album.album.findOne` | 🟢 LOW |  |
| `api::album.album.create` | 🟢 LOW |  |
| `api::album.album.find` | 🟢 LOW |  |
| `api::album.album.update` | 🟢 LOW |  |
| `api::band.band.findOne` | 🟢 LOW |  |
| `api::event.event.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::event.event.findOne` | 🟢 LOW |  |
| `api::event.event.create` | 🟢 LOW |  |
| `api::event.event.find` | 🟢 LOW |  |
| `api::event.event.update` | 🟢 LOW |  |
| `api::qr.qr.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::qr.qr.findOne` | 🟢 LOW |  |
| `api::qr.qr.create` | 🟢 LOW |  |
| `api::qr.qr.find` | 🟢 LOW |  |
| `api::qr.qr.update` | 🟢 LOW |  |
| `api::socialpage.socialpage.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::socialpage.socialpage.findOne` | 🟢 LOW |  |
| `api::socialpage.socialpage.create` | 🟢 LOW |  |
| `api::socialpage.socialpage.find` | 🟢 LOW |  |
| `api::socialpage.socialpage.update` | 🟢 LOW |  |
| `api::stream.stream.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::stream.stream.findOne` | 🟢 LOW |  |
| `api::stream.stream.create` | 🟢 LOW |  |
| `api::stream.stream.find` | 🟢 LOW |  |
| `api::stream.stream.update` | 🟢 LOW |  |
| `api::tour.tour.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::tour.tour.findOne` | 🟢 LOW |  |
| `api::tour.tour.create` | 🟢 LOW |  |
| `api::tour.tour.find` | 🟢 LOW |  |
| `api::tour.tour.update` | 🟢 LOW |  |
| `plugin::upload.content-api.find` | 🟢 LOW |  |
| `plugin::upload.content-api.upload` | 🟢 LOW |  |
| `plugin::upload.content-api.destroy` | 🟢 LOW |  |
| `plugin::upload.content-api.findOne` | 🟢 LOW |  |
| `plugin::users-permissions.user.find` | 🟡 MEDIUM | User/role enumeration - usually should be restricted |
| `api::video.video.findOne` | 🟢 LOW |  |
| `api::video.video.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::video.video.create` | 🟢 LOW |  |
| `api::video.video.find` | 🟢 LOW |  |
| `api::video.video.update` | 🟢 LOW |  |
| `api::scan.scan.findOne` | 🟢 LOW |  |
| `api::scan.scan.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::scan.scan.create` | 🟢 LOW |  |
| `api::scan.scan.find` | 🟢 LOW |  |
| `api::scan.scan.update` | 🟢 LOW |  |
| `api::link-click.link-click.getBandClicks` | 🟢 LOW |  |
| `api::link-click.link-click.trackClick` | 🟢 LOW |  |
| `api::band.band.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::band.band.create` | 🟢 LOW |  |
| `api::band.band.find` | 🟢 LOW |  |
| `api::band.band.update` | 🟢 LOW |  |
| `api::band.band.findBySlug` | 🟢 LOW |  |
| `api::stripe.stripe.confirmPayment` | 🟢 LOW |  |
| `api::stripe.stripe.createCheckoutSession` | 🟢 LOW |  |
| `api::stripe.stripe.testRoute` | 🟢 LOW |  |
| `api::stripe.stripe.createCustomer` | 🟢 LOW |  |
| `api::auth.email-confirmation.confirmEmail` | 🟢 LOW |  |
| `api::media-play.media-play.track` | 🟢 LOW |  |
| `api::media-play.media-play.findOne` | 🟢 LOW |  |
| `api::media-play.media-play.find` | 🟢 LOW |  |
| `api::stripe.stripe.subscriptionStatus` | 🟢 LOW |  |
| `api::stripe.stripe.getBillingInfo` | 🟢 LOW |  |
| `api::stripe.stripe.createBillingPortalSession` | 🟢 LOW |  |
| `api::subscription.subscription.register` | 🟢 LOW |  |
| `api::subscription.subscription.webhook` | 🟢 LOW |  |
| `api::subscription.subscription.subscriptionStatus` | 🟢 LOW |  |
| `api::subscription.subscription.createBillingPortalSession` | 🟢 LOW |  |
| `api::band-page-view.band-page-view.create` | 🟢 LOW |  |
| `api::band-page-view.band-page-view.find` | 🟢 LOW |  |
| `api::band-page-view.band-page-view.findOne` | 🟢 LOW |  |
| `api::event-page-view.event-page-view.findOne` | 🟢 LOW |  |
| `api::event-page-view.event-page-view.find` | 🟢 LOW |  |
| `api::event-page-view.event-page-view.create` | 🟢 LOW |  |
| `api::stripe.stripe.confirmSocial` | 🟢 LOW |  |
| `api::howtovideo.howtovideo.find` | 🟢 LOW |  |
| `api::howtovideo.howtovideo.findOne` | 🟢 LOW |  |
| `api::howtovideo.howtovideo.create` | 🟢 LOW |  |
| `api::howtovideo.howtovideo.update` | 🟢 LOW |  |
| `api::howtovideo.howtovideo.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::band-insight-daily.band-insight-daily.find` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.create` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.compute` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.findOne` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.update` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.muse` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.delete` | 🟡 MEDIUM | Delete operation - verify ownership checks exist |
| `api::analytics.analytics.rollups` | 🟢 LOW |  |
| `api::analytics.analytics.geo` | 🟢 LOW |  |
| `api::analytics.analytics.transitions` | 🟢 LOW |  |
| `api::muse.muse.run` | 🟢 LOW |  |
| `api::muse.muse.backfill` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.backfill` | 🟢 LOW |  |
| `api::band-insight-daily.band-insight-daily.debug` | 🟢 LOW |  |
| `api::muse.muse.aggregate` | 🟢 LOW |  |
| `api::band-external-account.band-external-account.find` | 🟢 LOW |  |
| `api::band-external-account.band-external-account.findOne` | 🟢 LOW |  |
| `api::band-external-account.band-external-account.update` | 🟢 LOW |  |
| `api::band-external-account.band-external-account.create` | 🟢 LOW |  |
| `api::band-external-metric.band-external-metric.create` | 🟢 LOW |  |
| `api::band-external-metric.band-external-metric.find` | 🟢 LOW |  |
| `api::band-external-metric.band-external-metric.findOne` | 🟢 LOW |  |
| `api::band-external-metric.band-external-metric.update` | 🟢 LOW |  |
| `api::youtube.youtube.debugSync` | 🟢 LOW |  |
| `api::youtube.youtube.disconnect` | 🟢 LOW |  |
| `api::youtube.youtube.oauthInit` | 🟢 LOW |  |
| `api::youtube.youtube.selectChannel` | 🟢 LOW |  |
| `api::youtube.youtube.oauthCallback` | 🟢 LOW |  |
| `api::youtube.youtube.purge` | 🟢 LOW |  |
| `api::youtube.youtube.sync` | 🟢 LOW |  |
| `api::youtube.youtube.debug` | 🟢 LOW |  |
| `api::band.payments.onboard` | 🟢 LOW |  |
| `api::band.payments.summary` | 🟢 LOW |  |
| `api::event-page-view.event-page-view.track` | 🟢 LOW |  |
| `api::support-moment.support-moment.create` | 🟢 LOW |  |
| `api::support-moment.support-moment.findOne` | 🟢 LOW |  |
| `api::support-moment.support-moment.update` | 🟢 LOW |  |
| `api::support-moment.support-moment.summary` | 🟢 LOW |  |
| `api::support-moment.support-moment.find` | 🟢 LOW |  |
| `api::band.checkout.create` | 🟢 LOW |  |
| `api::band-external-metric.band-external-metric.latest` | 🟢 LOW |  |
| `api::band-external-metric.band-external-metric.upsert` | 🟢 LOW |  |
| `api::band-ui-event.band-ui-event.track` | 🟢 LOW |  |
