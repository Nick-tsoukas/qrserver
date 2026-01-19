# Route Inventory Report

Generated: 2026-01-19T04:37:43.603Z

**Total Routes:** 251

## API Routes

### api::album

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/albums` | album.find | default | - |
| POST | `/api/albums` | album.create | default | - |
| GET | `/api/albums/:id` | album.findOne | default | - |
| PUT | `/api/albums/:id` | album.update | default | - |
| DELETE | `/api/albums/:id` | album.delete | default | - |

### api::analytics

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/analytics/event-devices` | analytics.eventDevices | 🔓 PUBLIC | - |
| GET | `/analytics/event-geo` | analytics.eventGeo | 🔓 PUBLIC | - |
| GET | `/analytics/event-rollups` | analytics.eventRollups | 🔓 PUBLIC | - |
| GET | `/analytics/event-sources` | analytics.eventSources | 🔓 PUBLIC | - |
| GET | `/analytics/follows` | analytics.follows | 🔓 PUBLIC | - |
| GET | `/analytics/geo` | analytics.geo | 🔓 PUBLIC | - |
| GET | `/analytics/geo-states` | analytics.geoStates | 🔓 PUBLIC | - |
| GET | `/analytics/pulse` | analytics.pulse | 🔓 PUBLIC | - |
| GET | `/analytics/push/dry-run` | analytics.pushDryRun | 🔓 PUBLIC | - |
| GET | `/analytics/qr-devices` | analytics.qrDevices | 🔓 PUBLIC | - |
| GET | `/analytics/qr-geo` | analytics.qrGeo | 🔓 PUBLIC | - |
| GET | `/analytics/qr-rollups` | analytics.qrRollups | 🔓 PUBLIC | - |
| GET | `/analytics/qr-sources` | analytics.qrSources | 🔓 PUBLIC | - |
| GET | `/analytics/rollups` | analytics.rollups | 🔓 PUBLIC | - |
| GET | `/analytics/transitions` | analytics.transitions | 🔓 PUBLIC | - |
| GET | `/image-proxy` | analytics.imageProxy | 🔓 PUBLIC | - |
| GET | `/pulse/shareables` | shareables.getShareables | 🔓 PUBLIC | - |
| POST | `/pulse/shareables/track` | shareables.trackShare | 🔓 PUBLIC | - |
| GET | `/pulse/whats-hot` | analytics.whatsHot | 🔓 PUBLIC | - |
| POST | `/push/opt-in` | analytics.pushOptIn | default | - |
| GET | `/push/opt-in/status` | analytics.pushOptInStatus | default | - |

### api::auth

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/auth/confirm-email` | email-confirmation.confirmEmail | 🔓 PUBLIC | - |

### api::band

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/bands` | band.find | 🔓 PUBLIC | - |
| POST | `/bands` | band.create | default | plugin::users-permissions.isAuthenticated, global::subscription-active, api::band.only-one-band |
| GET | `/bands/:id` | band.findOne | 🔓 PUBLIC | - |
| PUT | `/bands/:id` | band.update | default | plugin::users-permissions.isAuthenticated, global::subscription-active, api::band.owns-band |
| DELETE | `/bands/:id` | band.delete | default | plugin::users-permissions.isAuthenticated, global::subscription-active, api::band.owns-band |
| GET | `/bands/:id/live-signals` | live-signals.getLiveSignals | 🔓 PUBLIC | - |
| POST | `/bands/:id/payments/checkout` | checkout.create | 🔓 PUBLIC | - |
| POST | `/bands/:id/payments/onboard` | payments.onboard | default | plugin::users-permissions.isAuthenticated, api::band.owns-band |
| GET | `/bands/:id/payments/summary` | payments.summary | default | plugin::users-permissions.isAuthenticated, api::band.owns-band |
| GET | `/bands/slug/:slug` | band.findBySlug | 🔓 PUBLIC | - |

### api::band-external-account

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/band-external-accounts` | band-external-account.find | 🔓 PUBLIC | - |
| POST | `/band-external-accounts` | band-external-account.create | 🔓 PUBLIC | - |
| GET | `/band-external-accounts/:id` | band-external-account.findOne | 🔓 PUBLIC | - |
| PUT | `/band-external-accounts/:id` | band-external-account.update | 🔓 PUBLIC | - |
| DELETE | `/band-external-accounts/:id` | band-external-account.delete | 🔓 PUBLIC | - |

### api::band-external-metric

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/band-external-metrics` | band-external-metric.find | 🔓 PUBLIC | - |
| POST | `/band-external-metrics` | band-external-metric.create | 🔓 PUBLIC | - |
| GET | `/band-external-metrics/:id` | band-external-metric.findOne | 🔓 PUBLIC | - |
| PUT | `/band-external-metrics/:id` | band-external-metric.update | 🔓 PUBLIC | - |
| DELETE | `/band-external-metrics/:id` | band-external-metric.delete | 🔓 PUBLIC | - |
| GET | `/band-external-metrics/latest` | band-external-metric.latest | 🔓 PUBLIC | - |
| POST | `/band-external-metrics/upsert` | band-external-metric.upsert | 🔓 PUBLIC | - |

### api::band-insight-daily

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/band-insights-daily` | band-insight-daily.find | default | - |
| POST | `/api/band-insights-daily` | band-insight-daily.create | default | - |
| GET | `/api/band-insights-daily/:id` | band-insight-daily.findOne | default | - |
| PUT | `/api/band-insights-daily/:id` | band-insight-daily.update | default | - |
| DELETE | `/api/band-insights-daily/:id` | band-insight-daily.delete | default | - |
| GET | `/band-insights-daily/compute` | band-insight-daily.compute | 🔓 PUBLIC | - |
| GET | `/band-insights-daily/debug` | band-insight-daily.debug | 🔓 PUBLIC | - |
| GET | `/muse` | band-insight-daily.muse | 🔓 PUBLIC | - |
| GET | `/muse/backfill` | band-insight-daily.backfill | 🔓 PUBLIC | - |

### api::band-page-view

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/band-page-views` | band-page-view.find | default | - |
| POST | `/api/band-page-views` | band-page-view.create | default | - |
| GET | `/api/band-page-views/:id` | band-page-view.findOne | default | - |
| PUT | `/api/band-page-views/:id` | band-page-view.update | default | - |
| DELETE | `/api/band-page-views/:id` | band-page-view.delete | default | - |

### api::band-share

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/band-shares` | band-share.find | default | - |
| POST | `/api/band-shares` | band-share.create | default | - |
| GET | `/api/band-shares/:id` | band-share.findOne | default | - |
| PUT | `/api/band-shares/:id` | band-share.update | default | - |
| DELETE | `/api/band-shares/:id` | band-share.delete | default | - |
| POST | `/band-shares/record` | band-share.record | 🔓 PUBLIC | - |

### api::band-ui-event

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/band-ui-events` | band-ui-event.find | default | - |
| POST | `/api/band-ui-events` | band-ui-event.create | default | - |
| GET | `/api/band-ui-events/:id` | band-ui-event.findOne | default | - |
| PUT | `/api/band-ui-events/:id` | band-ui-event.update | default | - |
| DELETE | `/api/band-ui-events/:id` | band-ui-event.delete | default | - |
| POST | `/band-ui-events/track` | band-ui-event.track | default | - |

### api::event

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/events` | event.find | default | - |
| POST | `/api/events` | event.create | default | - |
| GET | `/api/events/:id` | event.findOne | default | - |
| PUT | `/api/events/:id` | event.update | default | - |
| DELETE | `/api/events/:id` | event.delete | default | - |

### api::event-page-view

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/event-page-views` | event-page-view.find | default | - |
| POST | `/api/event-page-views` | event-page-view.create | default | - |
| GET | `/api/event-page-views/:id` | event-page-view.findOne | default | - |
| PUT | `/api/event-page-views/:id` | event-page-view.update | default | - |
| DELETE | `/api/event-page-views/:id` | event-page-view.delete | default | - |
| POST | `/event-page-views/track` | event-page-view.track | 🔓 PUBLIC | - |

### api::fan-moment

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/fan-moments` | fan-moment.find | default | - |
| POST | `/api/fan-moments` | fan-moment.create | default | - |
| GET | `/api/fan-moments/:id` | fan-moment.findOne | default | - |
| PUT | `/api/fan-moments/:id` | fan-moment.update | default | - |
| DELETE | `/api/fan-moments/:id` | fan-moment.delete | default | - |
| GET | `/fan-moments/active` | fan-moment.active | 🔓 PUBLIC | - |
| GET | `/fan-moments/auto-active` | fan-moment.autoActive | 🔓 PUBLIC | - |
| POST | `/fan-moments/earn` | fan-moment.earn | 🔓 PUBLIC | - |
| POST | `/fan-moments/evaluate-auto` | fan-moment.evaluateAuto | 🔓 PUBLIC | - |
| POST | `/fan-moments/evaluate-recap` | fan-moment.evaluateRecap | 🔓 PUBLIC | - |
| GET | `/fan-moments/recap-active` | fan-moment.recapActive | 🔓 PUBLIC | - |
| POST | `/fan-moments/shared` | fan-moment.shared | 🔓 PUBLIC | - |
| GET | `/fan-moments/system-status` | fan-moment.systemStatus | 🔓 PUBLIC | - |

### api::funtest

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/funtests` | funtest.find | default | - |
| POST | `/api/funtests` | funtest.create | default | - |
| GET | `/api/funtests/:id` | funtest.findOne | default | - |
| PUT | `/api/funtests/:id` | funtest.update | default | - |
| DELETE | `/api/funtests/:id` | funtest.delete | default | - |

### api::howtovideo

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/howtovideos` | howtovideo.find | default | - |
| POST | `/api/howtovideos` | howtovideo.create | default | - |
| GET | `/api/howtovideos/:id` | howtovideo.findOne | default | - |
| PUT | `/api/howtovideos/:id` | howtovideo.update | default | - |
| DELETE | `/api/howtovideos/:id` | howtovideo.delete | default | - |

### api::image-proxy

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/image-proxies` | image-proxy.find | default | - |
| POST | `/api/image-proxies` | image-proxy.create | default | - |
| GET | `/api/image-proxies/:id` | image-proxy.findOne | default | - |
| PUT | `/api/image-proxies/:id` | image-proxy.update | default | - |
| DELETE | `/api/image-proxies/:id` | image-proxy.delete | default | - |
| GET | `/image-proxy` | image-proxy.proxy | 🔓 PUBLIC | - |

### api::link-click

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/link-clicks` | link-click.find | default | - |
| POST | `/api/link-clicks` | link-click.create | default | - |
| GET | `/api/link-clicks/:id` | link-click.findOne | default | - |
| PUT | `/api/link-clicks/:id` | link-click.update | default | - |
| DELETE | `/api/link-clicks/:id` | link-click.delete | default | - |
| GET | `/link-clicks/band/:bandId` | link-click.getBandClicks | default | - |
| POST | `/link-clicks/track` | link-click.trackClick | default | - |

### api::media-play

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| POST | `/api/media-plays` | media-play.create | default | - |
| PUT | `/api/media-plays/:id` | media-play.update | default | - |
| DELETE | `/api/media-plays/:id` | media-play.delete | default | - |
| GET | `/media-plays` | api::media-play.media-play.find | default | - |
| GET | `/media-plays/:id` | api::media-play.media-play.findOne | default | - |
| POST | `/media-plays/track` | media-play.track | default | - |
| POST | `/media-plays/track` | api::media-play.media-play.track | default | - |

### api::merch-concierge

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| POST | `/merch-concierge/create-checkout` | merch-concierge.createCheckout | 🔓 PUBLIC | - |
| GET | `/merch-concierge/order/:orderCode` | merch-concierge.getOrder | 🔓 PUBLIC | - |

### api::merch-order

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/merch-orders` | merch-order.find | default | - |
| POST | `/api/merch-orders` | merch-order.create | default | - |
| GET | `/api/merch-orders/:id` | merch-order.findOne | default | - |
| PUT | `/api/merch-orders/:id` | merch-order.update | default | - |
| DELETE | `/api/merch-orders/:id` | merch-order.delete | default | - |

### api::muse

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/muse/aggregate` | muse.aggregate | 🔓 PUBLIC | - |
| POST | `/muse/backfill` | muse.backfill | 🔓 PUBLIC | - |
| POST | `/muse/run` | muse.run | 🔓 PUBLIC | - |

### api::notification

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| POST | `/api/notifications` | notification.create | default | - |
| GET | `/api/notifications/:id` | notification.findOne | default | - |
| PUT | `/api/notifications/:id` | notification.update | default | - |
| DELETE | `/api/notifications/:id` | notification.delete | default | - |
| GET | `/notifications` | notification.find | default | - |
| POST | `/notifications/:id/read` | notification.markRead | default | - |
| GET | `/notifications/unread-count` | notification.unreadCount | default | - |

### api::pulse-snapshot

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/pulse-snapshots` | pulse-snapshot.find | default | - |
| POST | `/api/pulse-snapshots` | pulse-snapshot.create | default | - |
| GET | `/api/pulse-snapshots/:id` | pulse-snapshot.findOne | default | - |
| PUT | `/api/pulse-snapshots/:id` | pulse-snapshot.update | default | - |
| DELETE | `/api/pulse-snapshots/:id` | pulse-snapshot.delete | default | - |

### api::push-device

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/push-devices` | push-device.find | default | - |
| POST | `/api/push-devices` | push-device.create | default | - |
| GET | `/api/push-devices/:id` | push-device.findOne | default | - |
| PUT | `/api/push-devices/:id` | push-device.update | default | - |
| DELETE | `/api/push-devices/:id` | push-device.delete | default | - |

### api::qr

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/qrs` | qr.find | default | - |
| POST | `/qrs` | qr.create | default | plugin::users-permissions.isAuthenticated, global::subscription-active, api::qr.only-one-qr |
| GET | `/qrs/:id` | qr.findOne | default | plugin::users-permissions.isAuthenticated, api::qr.can-view-qr |
| PUT | `/qrs/:id` | qr.update | default | plugin::users-permissions.isAuthenticated, global::subscription-active, api::qr.owns-qr |
| DELETE | `/qrs/:id` | qr.delete | default | plugin::users-permissions.isAuthenticated, global::subscription-active, api::qr.owns-qr |

### api::scan

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/scans` | scan.find | default | - |
| POST | `/api/scans` | scan.create | default | - |
| GET | `/api/scans/:id` | scan.findOne | default | - |
| PUT | `/api/scans/:id` | scan.update | default | - |
| DELETE | `/api/scans/:id` | scan.delete | default | - |
| POST | `/scans/backfill` | scan.backfill | 🔓 PUBLIC | - |
| POST | `/scans/track` | scan.track | 🔓 PUBLIC | - |

### api::seo-page

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/seo-pages` | seo-page.find | default | - |
| POST | `/api/seo-pages` | seo-page.create | default | - |
| GET | `/api/seo-pages/:id` | seo-page.findOne | default | - |
| PUT | `/api/seo-pages/:id` | seo-page.update | default | - |
| DELETE | `/api/seo-pages/:id` | seo-page.delete | default | - |

### api::socialpage

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/socialpages` | socialpage.find | default | - |
| POST | `/api/socialpages` | socialpage.create | default | - |
| GET | `/api/socialpages/:id` | socialpage.findOne | default | - |
| PUT | `/api/socialpages/:id` | socialpage.update | default | - |
| DELETE | `/api/socialpages/:id` | socialpage.delete | default | - |

### api::stream

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/streams` | stream.find | default | - |
| POST | `/api/streams` | stream.create | default | - |
| GET | `/api/streams/:id` | stream.findOne | default | - |
| PUT | `/api/streams/:id` | stream.update | default | - |
| DELETE | `/api/streams/:id` | stream.delete | default | - |

### api::stripe

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/stripe/billing` | stripe.getBillingInfo | {"scope":[]} | - |
| POST | `/stripe/confirm-payment` | stripe.confirmPayment | default | - |
| POST | `/stripe/confirm-social` | stripe.confirmSocial | 🔓 PUBLIC | - |
| POST | `/stripe/connect/webhook` | connect-webhook.handle | 🔓 PUBLIC | - |
| POST | `/stripe/create-billing-portal-session` | stripe.createBillingPortalSession | {"enabled":true} | - |
| POST | `/stripe/create-checkout-session` | stripe.createCheckoutSession | default | - |
| POST | `/stripe/create-customer` | stripe.createCustomer | default | - |
| GET | `/stripe/subscription-status` | stripe.subscriptionStatus | {"enabled":true} | - |
| GET | `/stripe/test` | stripe.testRoute | default | - |

### api::subscription

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| POST | `/stripe/create-billing-portal-session` | api::subscription.subscription.createBillingPortalSession | {"scope":[]} | - |
| POST | `/stripe/register` | api::subscription.subscription.register | 🔓 PUBLIC | - |
| GET | `/stripe/subscription-status` | api::subscription.subscription.subscriptionStatus | {"scope":[]} | - |
| POST | `/stripe/webhook` | api::subscription.subscription.webhook | 🔓 PUBLIC | - |
| POST | `/webhooks/stripe` | api::subscription.subscription.webhook | 🔓 PUBLIC | - |

### api::support-moment

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/support-moments` | support-moment.find | default | - |
| POST | `/api/support-moments` | support-moment.create | default | - |
| GET | `/api/support-moments/:id` | support-moment.findOne | default | - |
| PUT | `/api/support-moments/:id` | support-moment.update | default | - |
| DELETE | `/api/support-moments/:id` | support-moment.delete | default | - |
| GET | `/support-moments/:id/summary` | support-moment.summary | 🔓 PUBLIC | - |

### api::system-kv

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/system-kvs` | system-kv.find | default | - |
| POST | `/api/system-kvs` | system-kv.create | default | - |
| GET | `/api/system-kvs/:id` | system-kv.findOne | default | - |
| PUT | `/api/system-kvs/:id` | system-kv.update | default | - |
| DELETE | `/api/system-kvs/:id` | system-kv.delete | default | - |

### api::test-email

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/test-email` | test-email.send | 🔓 PUBLIC | - |

### api::tour

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/tours` | tour.find | default | - |
| POST | `/api/tours` | tour.create | default | - |
| GET | `/api/tours/:id` | tour.findOne | default | - |
| PUT | `/api/tours/:id` | tour.update | default | - |
| DELETE | `/api/tours/:id` | tour.delete | default | - |

### api::video

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/videos` | video.find | default | - |
| POST | `/api/videos` | video.create | default | - |
| GET | `/api/videos/:id` | video.findOne | default | - |
| PUT | `/api/videos/:id` | video.update | default | - |
| DELETE | `/api/videos/:id` | video.delete | default | - |

### api::youtube

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/youtube/debug` | youtube.debug | 🔓 PUBLIC | - |
| GET | `/youtube/debug/channels` | youtube.debugChannels | 🔓 PUBLIC | - |
| GET | `/youtube/debug/env` | youtube.debugEnv | 🔓 PUBLIC | - |
| GET | `/youtube/debug/refresh` | youtube.debugRefresh | 🔓 PUBLIC | - |
| GET | `/youtube/debug/sync` | youtube.debugSync | 🔓 PUBLIC | - |
| GET | `/youtube/debug/tokeninfo` | youtube.debugTokenInfo | 🔓 PUBLIC | - |
| POST | `/youtube/disconnect` | youtube.disconnect | 🔓 PUBLIC | - |
| POST | `/youtube/oauth/callback` | youtube.oauthCallback | 🔓 PUBLIC | - |
| GET | `/youtube/oauth/init` | youtube.oauthInit | 🔓 PUBLIC | - |
| POST | `/youtube/purge` | youtube.purge | 🔓 PUBLIC | - |
| POST | `/youtube/select-channel` | youtube.selectChannel | 🔓 PUBLIC | - |
| POST | `/youtube/sync` | youtube.sync | 🔓 PUBLIC | - |
| GET | `/youtube/sync` | youtube.sync | 🔓 PUBLIC | - |

## Plugin Routes

### plugin::upload

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| POST | `/api/upload` | content-api.upload | default | - |
| GET | `/api/upload/files` | content-api.find | default | - |
| GET | `/api/upload/files/:id` | content-api.findOne | default | - |
| DELETE | `/api/upload/files/:id` | content-api.destroy | default | - |

### plugin::users-permissions

| Method | Path | Handler | Auth Config | Policies |
|--------|------|---------|-------------|----------|
| GET | `/api/auth/:provider/callback` | auth.callback | default | - |
| POST | `/api/auth/change-password` | auth.changePassword | default | - |
| GET | `/api/auth/email-confirmation` | auth.emailConfirmation | default | - |
| POST | `/api/auth/forgot-password` | auth.forgotPassword | default | - |
| POST | `/api/auth/local` | auth.callback | default | - |
| POST | `/api/auth/local/register` | auth.register | default | - |
| POST | `/api/auth/reset-password` | auth.resetPassword | default | - |
| POST | `/api/auth/send-email-confirmation` | auth.sendEmailConfirmation | default | - |
| GET | `/api/users` | user.find | default | - |
| GET | `/api/users-permissions/roles` | role.find | default | - |
| GET | `/api/users-permissions/roles/:id` | role.findOne | default | - |
| GET | `/api/users/:id` | user.findOne | default | - |
| PUT | `/api/users/:id` | user.update | default | - |
| DELETE | `/api/users/:id` | user.destroy | default | - |
| GET | `/api/users/me` | user.me | default | - |

## Content Types

| UID | Singular | Plural | Kind | Draft & Publish |
|-----|----------|--------|------|------------------|
| api::album.album | album | albums | collectionType | true |
| api::band.band | band | bands | collectionType | false |
| api::band-external-account.band-external-account | band-external-account | band-external-accounts | collectionType | false |
| api::band-external-metric.band-external-metric | band-external-metric | band-external-metrics | collectionType | false |
| api::band-insight-daily.band-insight-daily | band-insight-daily | band-insights-daily | collectionType | false |
| api::band-page-view.band-page-view | band-page-view | band-page-views | collectionType | false |
| api::band-share.band-share | band-share | band-shares | collectionType | false |
| api::band-ui-event.band-ui-event | band-ui-event | band-ui-events | collectionType | false |
| api::event.event | event | events | collectionType | false |
| api::event-page-view.event-page-view | event-page-view | event-page-views | collectionType | false |
| api::fan-moment.fan-moment | fan-moment | fan-moments | collectionType | false |
| api::funtest.funtest | funtest | funtests | collectionType | true |
| api::howtovideo.howtovideo | howtovideo | howtovideos | collectionType | true |
| api::image-proxy.image-proxy | image-proxy | image-proxies | singleType | false |
| api::link-click.link-click | link-click | link-clicks | collectionType | true |
| api::media-play.media-play | media-play | media-plays | collectionType | false |
| api::merch-order.merch-order | merch-order | merch-orders | collectionType | false |
| api::notification.notification | notification | notifications | collectionType | false |
| api::pulse-snapshot.pulse-snapshot | pulse-snapshot | pulse-snapshots | collectionType | false |
| api::push-device.push-device | push-device | push-devices | collectionType | false |
| api::qr.qr | qr | qrs | collectionType | false |
| api::scan.scan | scan | scans | collectionType | false |
| api::seo-page.seo-page | seo-page | seo-pages | collectionType | true |
| api::socialpage.socialpage | socialpage | socialpages | collectionType | true |
| api::stream.stream | stream | streams | collectionType | true |
| api::support-moment.support-moment | support-moment | support-moments | collectionType | true |
| api::system-kv.system-kv | system-kv | system-kvs | collectionType | false |
| api::tour.tour | tour | tours | collectionType | true |
| api::video.video | video | videos | collectionType | true |
