# Overhead Flights - Architecture

> **Live Site:** https://jackwallner.github.io/overhead-flights/  
> **This Repo:** `~/clawd/overhead-flights/` (moving to standalone)  
> **Status:** ✅ Production-ready GitHub Pages site

## Important Distinction

This is a **standalone client-side flight tracker**. It is NOT the same as `my-flights/`.

| Project | Type | Data Source | Hosting | Server Required |
|---------|------|-------------|---------|-----------------|
| `overhead-flights/` | Client-side only | OpenSky API (browser) | GitHub Pages | ❌ No |
| `my-flights/` | Server-fed | FlightRadar24 (Mac service) | GitHub Pages | ✅ Yes |

## Overview

Pure static site that fetches flight data directly from OpenSky Network API in the browser. No server required.

```
┌─────────────────┐         ┌─────────────────┐
│  OpenSky API    │◀────────│  Browser JS     │
│  (CORS-enabled) │         │  (overhead-flights)
└─────────────────┘         └─────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │  Leaflet Map    │
                            │  localStorage   │
                            └─────────────────┘
```

## File Structure

```
overhead-flights/
├── index.html              # Main app shell
├── api-test.html           # API connectivity test
├── README.md               # User-facing docs
├── ARCHITECTURE.md         # This file
├── js/
│   ├── app.js             # Main app logic, event handlers
│   ├── opensky.js         # OpenSky API client
│   ├── tracker.js         # Flight tracking/state management
│   ├── location.js        # Geolocation, geocoding
│   ├── storage.js         # localStorage wrapper
│   ├── map.js             # Leaflet map initialization
│   ├── ui.js              # UI rendering helpers
│   └── feature-request.js # Feedback form logic
└── css/
    └── feature-request.css
```

## Key Components

### OpenSkyClient (`js/opensky.js`)
- Fetches flight data from `opensky-network.org/api/states/all`
- Rate limited: 10s between calls, 400 calls/day
- Converts metric to imperial (m→ft, m/s→knots)
- Calculates distance/bearing between coordinates

### FlightTracker (`js/tracker.js`)
- Maintains flight history in memory
- Tracks closest approach for each flight
- Filters by altitude, distance
- Night mode pausing (configurable hours)

### App (`js/app.js`)
- Initialization and event binding
- Auto-refresh loop (default 90s)
- Settings management
- Import/export functionality

### Storage (`js/storage.js`)
- localStorage wrapper
- Location management (save multiple locations)
- Settings persistence
- Data export/import (JSON)

## Data Flow

```
User Location → OpenSky API → Filter by radius/altitude 
     → Track closest approach → Update UI + Map → localStorage
```

## Configuration

Stored in `localStorage`:

```javascript
{
  refreshInterval: 90,      // seconds (min 10)
  maxAltitude: 10000,       // feet
  nightPause: true,         // pause overnight
  nightStart: "22:00",
  nightEnd: "06:00"
}
```

## Locations

Multiple saved locations supported:

```javascript
{
  name: "Home",
  lat: 45.6252,
  lon: -122.5281,
  radius: 5  // nautical miles
}
```

## Rate Limits

- **Anonymous access:** 400 API calls/day
- **Smart refresh:** 90s default = ~960 calls/day max (if 24/7)
- **Night pause:** Reduces usage (10PM-6AM = 8 hours saved)
- **Tab hidden:** Pauses fetch when not visible

## Deployment

Just push to GitHub Pages:

```bash
cd ~/clawd/overhead-flights
git add .
git commit -m "Update..."
git push origin main
```

## Related

- **my-flights:** https://github.com/jackwallner/my-flights (server-fed display)
- **flight-tracker-service:** https://github.com/jackwallner/flight-tracker-service (feeds my-flights)
