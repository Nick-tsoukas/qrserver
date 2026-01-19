# Permission Changes Report

Applied: 2026-01-19T04:41:01.521Z

## Changes Applied

| Role | Action | Status |
|------|--------|--------|
| public | `plugin::users-permissions.user.create` | ✅ disabled |
| public | `plugin::users-permissions.user.find` | ✅ disabled |
| public | `plugin::users-permissions.user.findOne` | ✅ disabled |
| public | `plugin::upload.content-api.find` | ✅ disabled |
| public | `plugin::upload.content-api.findOne` | ✅ disabled |
| public | `api::qr.qr.update` | ✅ disabled |
| public | `api::stripe.stripe.createCheckoutSession` | ✅ disabled |
| public | `api::stripe.stripe.createCustomer` | ✅ disabled |
| public | `api::scan.scan.update` | ✅ disabled |
| public | `api::band-page-view.band-page-view.create` | ✅ disabled |
| public | `api::event-page-view.event-page-view.create` | ✅ disabled |
| public | `api::band-insight-daily.band-insight-daily.create` | ✅ disabled |
| public | `api::band-insight-daily.band-insight-daily.delete` | ✅ disabled |
| public | `api::band-insight-daily.band-insight-daily.update` | ✅ disabled |
| public | `api::pulse-snapshot.pulse-snapshot.create` | ✅ disabled |
| public | `api::pulse-snapshot.pulse-snapshot.update` | ✅ disabled |
| authenticated | `plugin::users-permissions.user.find` | ✅ disabled |

## Remaining REVIEW Items (147)

These permissions need manual review:

| Role | Action | Risk | Reason |
|------|--------|------|--------|
| public | `plugin::users-permissions.user.me` | MEDIUM | Unknown action - needs manual review |
| public | `plugin::users-permissions.auth.changePassword` | MEDIUM | Unknown action - needs manual review |
| public | `api::album.album.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::album.album.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::qr.qr.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::qr.qr.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::socialpage.socialpage.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::socialpage.socialpage.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::stream.stream.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::stream.stream.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::tour.tour.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::tour.tour.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::video.video.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::video.video.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::scan.scan.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::scan.scan.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::link-click.link-click.getBandClicks` | MEDIUM | Unknown action - needs manual review |
| public | `api::link-click.link-click.trackClick` | MEDIUM | Unknown action - needs manual review |
| public | `api::stripe.stripe.confirmPayment` | MEDIUM | Unknown action - needs manual review |
| public | `api::stripe.stripe.testRoute` | MEDIUM | Unknown action - needs manual review |
| public | `api::band.band.findBySlug` | MEDIUM | Read operation - verify if content should be public |
| public | `api::media-play.media-play.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::media-play.media-play.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::stripe.stripe.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| public | `api::subscription.subscription.webhook` | MEDIUM | Unknown action - needs manual review |
| public | `api::subscription.subscription.register` | MEDIUM | Unknown action - needs manual review |
| public | `api::subscription.subscription.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| public | `api::band-page-view.band-page-view.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::band-page-view.band-page-view.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::event-page-view.event-page-view.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::event-page-view.event-page-view.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::stripe.stripe.confirmSocial` | MEDIUM | Unknown action - needs manual review |
| public | `api::band-insight-daily.band-insight-daily.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::band-insight-daily.band-insight-daily.compute` | MEDIUM | Unknown action - needs manual review |
| public | `api::band-insight-daily.band-insight-daily.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::analytics.analytics.rollups` | MEDIUM | Unknown action - needs manual review |
| public | `api::analytics.analytics.geo` | MEDIUM | Unknown action - needs manual review |
| public | `api::analytics.analytics.transitions` | MEDIUM | Unknown action - needs manual review |
| public | `api::muse.muse.run` | MEDIUM | Unknown action - needs manual review |
| public | `api::muse.muse.backfill` | MEDIUM | Unknown action - needs manual review |
| public | `api::band-insight-daily.band-insight-daily.debug` | MEDIUM | Unknown action - needs manual review |
| public | `api::band-insight-daily.band-insight-daily.backfill` | MEDIUM | Unknown action - needs manual review |
| public | `api::youtube.youtube.debugSync` | MEDIUM | Unknown action - needs manual review |
| public | `api::youtube.youtube.disconnect` | MEDIUM | Unknown action - needs manual review |
| public | `api::youtube.youtube.oauthInit` | MEDIUM | Unknown action - needs manual review |
| public | `api::youtube.youtube.selectChannel` | MEDIUM | Unknown action - needs manual review |
| public | `api::youtube.youtube.oauthCallback` | MEDIUM | Unknown action - needs manual review |
| public | `api::youtube.youtube.purge` | MEDIUM | Unknown action - needs manual review |
| public | `api::youtube.youtube.sync` | MEDIUM | Unknown action - needs manual review |
| public | `api::band.payments.onboard` | MEDIUM | Unknown action - needs manual review |
| public | `api::stripe.connect-webhook.handle` | MEDIUM | Unknown action - needs manual review |
| public | `api::scan.scan.track` | MEDIUM | Unknown action - needs manual review |
| public | `api::band-share.band-share.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::band-share.band-share.findOne` | MEDIUM | Read operation - verify if content should be public |
| public | `api::pulse-snapshot.pulse-snapshot.find` | MEDIUM | Read operation - verify if content should be public |
| public | `api::pulse-snapshot.pulse-snapshot.findOne` | MEDIUM | Read operation - verify if content should be public |
| authenticated | `plugin::users-permissions.auth.register` | MEDIUM | Unknown action - needs manual review |
| authenticated | `plugin::users-permissions.auth.connect` | MEDIUM | Unknown action - needs manual review |
| authenticated | `plugin::users-permissions.auth.callback` | MEDIUM | Unknown action - needs manual review |
| authenticated | `plugin::users-permissions.auth.emailConfirmation` | MEDIUM | Unknown action - needs manual review |
| authenticated | `plugin::users-permissions.auth.resetPassword` | MEDIUM | Unknown action - needs manual review |
| authenticated | `plugin::users-permissions.auth.forgotPassword` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::album.album.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::album.album.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::album.album.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::event.event.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::event.event.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::event.event.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::qr.qr.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::qr.qr.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::qr.qr.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::socialpage.socialpage.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::socialpage.socialpage.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::socialpage.socialpage.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::stream.stream.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::stream.stream.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::stream.stream.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::tour.tour.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::tour.tour.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::tour.tour.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `plugin::upload.content-api.upload` | MEDIUM | Unknown action - needs manual review |
| authenticated | `plugin::upload.content-api.destroy` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::video.video.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::video.video.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::video.video.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::scan.scan.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::scan.scan.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::scan.scan.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::link-click.link-click.getBandClicks` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::link-click.link-click.trackClick` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band.band.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::band.band.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::band.band.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::stripe.stripe.confirmPayment` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::stripe.stripe.createCheckoutSession` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::stripe.stripe.testRoute` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::stripe.stripe.createCustomer` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::auth.email-confirmation.confirmEmail` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::media-play.media-play.track` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::stripe.stripe.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::stripe.stripe.getBillingInfo` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::stripe.stripe.createBillingPortalSession` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::subscription.subscription.register` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::subscription.subscription.webhook` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::subscription.subscription.subscriptionStatus` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::subscription.subscription.createBillingPortalSession` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::band-page-view.band-page-view.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::event-page-view.event-page-view.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::stripe.stripe.confirmSocial` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::howtovideo.howtovideo.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::howtovideo.howtovideo.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::howtovideo.howtovideo.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::band-insight-daily.band-insight-daily.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::band-insight-daily.band-insight-daily.compute` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band-insight-daily.band-insight-daily.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::band-insight-daily.band-insight-daily.muse` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band-insight-daily.band-insight-daily.delete` | MEDIUM | Delete operation - verify ownership check exists |
| authenticated | `api::analytics.analytics.rollups` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::analytics.analytics.geo` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::analytics.analytics.transitions` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::muse.muse.run` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::muse.muse.backfill` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band-insight-daily.band-insight-daily.backfill` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band-insight-daily.band-insight-daily.debug` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::muse.muse.aggregate` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band-external-account.band-external-account.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::band-external-account.band-external-account.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::band-external-metric.band-external-metric.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::band-external-metric.band-external-metric.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::youtube.youtube.debugSync` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::youtube.youtube.disconnect` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::youtube.youtube.oauthInit` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::youtube.youtube.selectChannel` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::youtube.youtube.oauthCallback` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::youtube.youtube.purge` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::youtube.youtube.sync` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::youtube.youtube.debug` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band.payments.onboard` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band.payments.summary` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::event-page-view.event-page-view.track` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::support-moment.support-moment.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::support-moment.support-moment.update` | MEDIUM | Update operation - verify ownership check exists |
| authenticated | `api::support-moment.support-moment.summary` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band.checkout.create` | MEDIUM | Create operation - verify validation exists |
| authenticated | `api::band-external-metric.band-external-metric.latest` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band-external-metric.band-external-metric.upsert` | MEDIUM | Unknown action - needs manual review |
| authenticated | `api::band-ui-event.band-ui-event.track` | MEDIUM | Unknown action - needs manual review |

## How to Revert

To revert these changes, restore from before.json or use Strapi admin panel.
