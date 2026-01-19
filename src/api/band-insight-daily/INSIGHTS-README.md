# MBQ Muse Insights System — ELITE v2

> Comprehensive documentation for the Muse Insights analytics engine
> **Version:** ELITE v2 (Recompute on Every Request)

## Overview

The Muse Insights system provides AI-powered analytics insights for bands on the MBQ platform. It analyzes traffic patterns, engagement metrics, geographic data, and tour schedules to generate actionable recommendations.

**Key Features:**
- **Always Recomputes** — Every dashboard view triggers fresh computation (no stale cache)
- **Rollups + Today Partial** — Uses pre-aggregated rollups for speed, merges live "today" data for freshness
- **Elite Thresholds** — Insights must be EARNED (higher volume requirements)
- **Max 7 Insights** — Ranked by impact score, deduplicated by category
- **Graceful Degradation** — Returns "insufficient data" insight when data is missing

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Nuxt)                         │
├─────────────────────────────────────────────────────────────────┤
│  components/analytics/InsightsPanel.vue                         │
│  - Fetches from /api/muse/insights                              │
│  - Groups by severity, sorts by confidence                      │
│  - Expandable "why" sections                                    │
│  - Action buttons                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Strapi)                         │
├─────────────────────────────────────────────────────────────────┤
│  Route: GET /api/muse/insights?bandId=X                         │
│  Controller: band-insight-daily.insightsV2                      │
│  Service: band-insight-daily.generateInsightsV2                 │
│  Engine: insights-engine.js                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Sources                             │
├─────────────────────────────────────────────────────────────────┤
│  - band-insight-daily (aggregated daily metrics)                │
│  - events (for tour state insights)                             │
│  - band-share (for share chain insights)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Insight Shape (ELITE v2)

Every insight follows this structure:

```javascript
{
  key: 'traffic_momentum_week',      // Unique identifier
  category: 'growth',                // growth|engagement|cities|platforms|share|tour|audience|source
  title: 'Traffic Growing',          // Short headline
  summary: 'Your page traffic is up 25% this week.',  // One-liner
  severity: 'good',                  // critical | warning | good | info
  confidence: 75,                    // 0-100 (how sure we are)
  window: '7d',                      // Time period analyzed (7d|30d|24h|72h)
  why: [                             // Explanations
    'This week: 150 page views',
    'Last week: 120 page views',
    'Change: +25%'
  ],
  metrics: {                         // Raw data for debugging
    pv7: 150,
    pvPrev7: 120,
    weekDelta: 25
  },
  recommendedActions: [              // What to do about it
    { label: 'Capitalize with a post', type: 'primary' },
    { label: 'Check traffic sources', route: '/analytics/{bandId}', type: 'secondary' }
  ]
}
```

### Categories

| Category | Description |
|----------|-------------|
| `growth` | Traffic momentum, volume changes |
| `engagement` | Click-through, plays, interaction quality |
| `cities` | Geographic spikes, new cities |
| `platforms` | Platform dominance (Spotify, IG, etc.) |
| `share` | Fan sharing activity |
| `tour` | Pre-show and post-show windows |
| `audience` | Device mix, audience composition |
| `source` | Traffic source shifts |

## Severity Levels

| Severity | Icon | When to Use |
|----------|------|-------------|
| `critical` | 🔴 | Needs immediate attention (show day, major drop) |
| `warning` | 🟡 | Should address soon (engagement declining) |
| `good` | 🟢 | Positive signal (growth, high engagement) |
| `info` | 💡 | Neutral information (top city, platform stats) |

## Current Analyzers (ELITE v2)

### 1. Traffic Momentum (`analyzeTrafficMomentum`)
- Compares 7-day traffic to previous 7 days
- **ELITE:** Requires baseline >= 50 views (was 5)
- Only triggers on >15% change
- Confidence increases with traffic volume

### 2. Engagement Quality (`analyzeEngagement`)
- Measures (clicks + plays) / views
- **ELITE:** Uses 7d smoothing to avoid single-day noise
- **ELITE:** Requires >= 30 views (was 10)
- High engagement (>40%): `good` severity
- Low engagement (<15% with 50+ views): `warning` severity

### 3. City Spike (`analyzeCitySpike`)
- Detects cities with >100% growth or new cities
- **ELITE:** Ignores city="Unknown"
- **ELITE:** Requires >= 10 views (was 5)
- Suggests geo-targeting

### 4. Platform Pull (`analyzePlatformPull`)
- Identifies dominant platform (>50% of clicks)
- **ELITE:** Requires >= 10 clicks
- Helps bands know where fans want to go

### 5. Share Chain (`analyzeShareChain`)
- Detects when content is being shared
- **ELITE:** Requires >= 5 shares (was 3)

### 6. Tour State (`analyzeTourState`)
- **Pre-show (72h)**: Push QR placements, announce show
- **Post-show (72h)**: Publish recap, shareable moment
- Show day = `critical` severity
- 1 day before = `warning` severity

### 7. Mobile Audience (`analyzeMobileAudience`)
- Flags when >75% of traffic is mobile
- **ELITE:** Requires >= 30 total visitors
- Uses 7d aggregate for stability

### 8. Source Shift (`analyzeSourceShift`) — NEW
- Detects when traffic source mix changes significantly
- Triggers on >15% share change with >= 10 visits
- Suggests "double down on winning channel"

## Adding a New Insight

### 1. Create the analyzer function in `insights-engine.js`:

```javascript
function analyzeNewThing({ last7, prev7, today }) {
  const insights = [];
  
  // Your logic here
  const metric = sum(last7, r => r.someField);
  
  if (metric > THRESHOLD) {
    insights.push(createInsight({
      key: 'new_thing_detected',
      title: 'New Thing Happening',
      summary: `Something interesting: ${metric} units.`,
      severity: SEVERITY.GOOD,
      confidence: Math.min(90, 50 + metric / 10),
      why: [
        `Metric value: ${metric}`,
        'Additional context here',
      ],
      recommendedActions: [
        { label: 'Do something', route: null, type: 'suggestion' },
      ],
      dataWindow: '7d',
      metricsSnapshot: { metric },
    }));
  }
  
  return insights;
}
```

### 2. Add to the analyzers array in `generateInsights()`:

```javascript
const analyzers = [
  () => analyzeTrafficMomentum({ last7, prev7, today, yesterday }),
  () => analyzeEngagement({ last7, today }),
  // ... existing analyzers
  () => analyzeNewThing({ last7, prev7, today }),  // Add here
];
```

### 3. Export if needed for testing:

```javascript
module.exports = {
  // ... existing exports
  analyzeNewThing,
};
```

## Thresholds & Tuning (ELITE v2)

Key thresholds are defined inline in each analyzer. ELITE thresholds are higher to reduce noise:

| Analyzer | Threshold | ELITE Minimum | Purpose |
|----------|-----------|---------------|---------|
| Traffic Momentum | 15% change | 50 views baseline | Avoid reporting minor fluctuations |
| Engagement | 40% good / 15% low | 30 views (50 for warning) | Need enough data |
| City Spike | 100% growth | 10 views, ignore "Unknown" | Avoid noise from 1-2 visits |
| Platform Pull | 50% share | 10 clicks | Only report clear dominance |
| Share Chain | — | 5 shares | Meaningful sharing activity |
| Tour State | 72h window | — | Pre/post show opportunities |
| Mobile | 75% mobile | 30 visitors | Clear mobile-first audience |
| Source Shift | 15% share change | 10 visits from source | Meaningful channel shift |

## Confidence Scoring

Confidence is calculated based on:
1. **Data volume** - More data = higher confidence
2. **Signal strength** - Bigger changes = higher confidence
3. **Data freshness** - Recent data preferred

Formula pattern:
```javascript
const confidence = Math.min(95, baseConfidence + dataVolume / scale);
```

## API Reference

### GET /api/muse/insights

**Query Parameters:**
- `bandId` (required): Band ID
- `days` (optional): Days of data to analyze (default: 30)

**Response (ELITE v2):**
```json
{
  "ok": true,
  "bandId": 123,
  "count": 3,
  "insights": [
    {
      "key": "traffic_momentum_week",
      "category": "growth",
      "title": "Traffic Growing",
      "summary": "Your page traffic is up 25% this week.",
      "severity": "good",
      "confidence": 75,
      "window": "7d",
      "why": ["This week: 150 views", "Last week: 120 views"],
      "metrics": { "pv7": 150, "pvPrev7": 120, "weekDelta": 25 },
      "recommendedActions": [
        { "label": "Capitalize with a post", "type": "primary" }
      ]
    }
  ],
  "computedAt": "2026-01-19T04:45:00.000Z",
  "dataSourcesUsed": ["rollups", "raw_today_partial"],
  "rollupLastDateUsed": "2026-01-18"
}
```

**Response Metadata:**
| Field | Description |
|-------|-------------|
| `computedAt` | ISO timestamp when insights were computed (always fresh) |
| `dataSourcesUsed` | Array: `["rollups"]` or `["rollups", "raw_today_partial"]` |
| `rollupLastDateUsed` | Date of most recent rollup used |

### Recompute Behavior

**Every request recomputes insights.** There is no caching.

**Data sources:**
1. **Rollups (primary)** — Pre-aggregated `band-insight-daily` records (fast)
2. **Today Partial (optional)** — Raw events from last 24h if today not in rollups

**Raw event caps (safety):**
- Max 5,000 rows per event type
- If cap exceeded, today partial is skipped
- Response metadata indicates which sources were used

## Frontend Component

### InsightsPanel.vue

**Props:**
- `bandId` (required): Band ID
- `autoLoad` (default: true): Auto-fetch on mount

**Events:**
- `@action`: Emitted when user clicks an action button
- `@loaded`: Emitted when insights are loaded

**Exposed Methods:**
- `refresh()`: Re-fetch insights
- `fetchInsights()`: Fetch insights

## Future Improvements

### Planned Insights
- [ ] **Follower growth** - Track platform follower changes
- [ ] **Merch opportunity** - Detect high engagement + no merch clicks
- [ ] **Event proximity** - "You have a show in X city, traffic is up there"
- [ ] **Seasonal patterns** - Compare to same period last year
- [ ] **Competitor comparison** - Compare to similar bands (if data available)

### Technical Improvements
- [ ] **Caching** - Cache insights for 15-30 minutes
- [ ] **Background generation** - Pre-compute during cron job
- [ ] **A/B testing** - Test different insight wordings
- [ ] **Feedback loop** - Track which insights users act on
- [ ] **AI enhancement** - Use LLM for natural language summaries

### UI Improvements
- [ ] **Insight history** - Show past insights
- [ ] **Dismiss/snooze** - Let users hide insights
- [ ] **Priority inbox** - Show most important first
- [ ] **Push notifications** - Alert on critical insights

## Testing

### Manual Testing
```bash
# Fetch insights for a band
curl "http://localhost:1337/api/muse/insights?bandId=1"
```

### Unit Testing (TODO)
```javascript
const { analyzeTrafficMomentum } = require('./insights-engine');

describe('analyzeTrafficMomentum', () => {
  it('should detect growth', () => {
    const insights = analyzeTrafficMomentum({
      last7: [{ pageViews: 100 }, { pageViews: 100 }],
      prev7: [{ pageViews: 50 }, { pageViews: 50 }],
    });
    expect(insights[0].severity).toBe('good');
  });
});
```

## Files

| File | Purpose |
|------|---------|
| `services/insights-engine.js` | Core insight generation logic |
| `services/band-insight-daily.js` | Service layer, data fetching |
| `controllers/band-insight-daily.js` | API controller |
| `routes/band-insight-daily-custom.js` | Route definitions |
| `qr/components/analytics/InsightsPanel.vue` | Frontend component |

## Changelog

### v2.1.0 ELITE (2026-01-19)
- **Always recompute** — No caching, fresh on every request
- **Rollups + Today Partial** — Fast rollups with optional live data merge
- **Elite thresholds** — Higher minimums to reduce noise
- **New insight shape** — Added `category`, `window`, `metrics` fields
- **Impact ranking** — Insights ranked by `severityWeight * confidence`
- **Category deduplication** — Max 1 insight per category (except tour)
- **Max 7 insights** — Capped output to avoid overwhelm
- **New analyzer: Source Shift** — Detects traffic source mix changes
- **Graceful degradation** — Returns "insufficient data" when needed
- **Response metadata** — `computedAt`, `dataSourcesUsed`, `rollupLastDateUsed`

### v2.0.0 (2026-01-19)
- Complete rewrite with new insight shape
- Added confidence scores
- Added "why" explanations
- Added recommended actions
- Added 5 new insight types
- New InsightsPanel UI component
