# MBQ Muse Insights System

> AI-powered analytics insights for bands. Generates actionable, trustworthy insights from fan engagement data.

## Overview

The Muse Insights system analyzes band analytics data and generates structured insights with:
- **Severity levels** (critical, warning, good, info)
- **Confidence scores** (0-100%)
- **Explanations** ("why we think this")
- **Recommended actions** (suggestions + navigation links)

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

## Insight Shape

Every insight follows this structure:

```javascript
{
  key: 'traffic_momentum_week',      // Unique identifier
  title: 'Traffic Growing',          // Short headline
  summary: 'Your page traffic is up 25% this week.',  // One-liner
  severity: 'good',                  // critical | warning | good | info
  confidence: 75,                    // 0-100 (how sure we are)
  why: [                             // Explanations
    'This week: 150 page views',
    'Last week: 120 page views',
    'Change: +25%'
  ],
  recommendedActions: [              // What to do about it
    { label: 'Capitalize with a post', route: null, type: 'suggestion' },
    { label: 'Check traffic sources', route: '/analytics/{bandId}', type: 'navigate' }
  ],
  dataWindow: '7d',                  // Time period analyzed
  metricsSnapshot: {                 // Raw data for debugging
    pv7: 150,
    pvPrev7: 120,
    weekDelta: 25
  },
  generatedAt: '2026-01-19T04:45:00.000Z'
}
```

## Severity Levels

| Severity | Icon | When to Use |
|----------|------|-------------|
| `critical` | 🔴 | Needs immediate attention (show day, major drop) |
| `warning` | 🟡 | Should address soon (engagement declining) |
| `good` | 🟢 | Positive signal (growth, high engagement) |
| `info` | 💡 | Neutral information (top city, platform stats) |

## Current Analyzers

### 1. Traffic Momentum (`analyzeTrafficMomentum`)
- Compares 7-day traffic to previous 7 days
- Only triggers on >15% change
- Confidence increases with traffic volume

### 2. Engagement Quality (`analyzeEngagement`)
- Measures (clicks + plays) / views
- High engagement (>40%): `good` severity
- Low engagement (<15% with 30+ views): `warning` severity

### 3. City Spike (`analyzeCitySpike`)
- Detects cities with >100% growth
- Or new cities with 10+ views
- Suggests geo-targeting

### 4. Platform Pull (`analyzePlatformPull`)
- Identifies dominant platform (>50% of clicks)
- Helps bands know where fans want to go

### 5. Share Chain (`analyzeShareChain`)
- Detects when content is being shared
- Triggers on 5+ shares/week or 50%+ growth

### 6. Tour State (`analyzeTourState`)
- **Pre-show**: 0-7 days before event
- **Post-show**: 1-3 days after event
- Suggests timely actions

### 7. Mobile Audience (`analyzeMobileAudience`)
- Flags when >75% of traffic is mobile
- Suggests mobile optimization

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

## Thresholds & Tuning

Key thresholds are defined inline in each analyzer. To reduce noise:

| Analyzer | Threshold | Purpose |
|----------|-----------|---------|
| Traffic Momentum | 15% change | Avoid reporting minor fluctuations |
| Engagement | 10+ views minimum | Need enough data |
| City Spike | 5+ views minimum | Avoid noise from 1-2 visits |
| Platform Pull | 50% share | Only report clear dominance |
| Share Chain | 5+ shares | Meaningful sharing activity |
| Mobile | 75% mobile | Clear mobile-first audience |

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

**Response:**
```json
{
  "ok": true,
  "bandId": 123,
  "count": 3,
  "insights": [
    { /* insight object */ },
    { /* insight object */ },
    { /* insight object */ }
  ],
  "generatedAt": "2026-01-19T04:45:00.000Z"
}
```

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

### v2.0.0 (2026-01-19)
- Complete rewrite with new insight shape
- Added confidence scores
- Added "why" explanations
- Added recommended actions
- Added 5 new insight types
- New InsightsPanel UI component
