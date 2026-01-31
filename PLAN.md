# Overhead Flights - Public Flight Tracker

## Project Overview

A client-side flight tracker that shows aircraft flying overhead any location. Built as a pure static site for GitHub Pages - no backend required.

## API Research Results

### Tested APIs

| API | CORS | Auth Required | Free Tier | Rate Limits | Verdict |
|-----|------|---------------|-----------|-------------|---------|
| **OpenSky Network** | ✅ Yes | No | 400 credits/day | 10s resolution | **PRIMARY** |
| AirLabs | ✅ Yes | Yes | 1,000 req/month | Unknown | Backup option |
| Aviation Edge | ✅ Yes | Yes | Limited | Unknown | Backup option |
| ADSBexchange | ❓ Unknown | Yes (paid) | None | N/A | Not viable |
| FlightRadar24 | ❌ No | N/A | N/A | N/A | Blocks browser requests |

### Recommended: OpenSky Network

**Why:**
- ✅ CORS enabled (works in browser)
- ✅ No API key required
- ✅ Free tier sufficient (400 calls/day = 1 call every 3.6 minutes)
- ✅ Real-time bounding box queries
- ✅ Stable, academic-backed service

**Limitations:**
- 400 API credits/day for anonymous users
- 10-second time resolution (can't get sub-10s data)
- No historical data beyond 1 hour (for anonymous)
- Bounding box queries only (no radius search)

**API Endpoint:**
```
GET https://opensky-network.org/api/states/all?lamin={minLat}&lamax={maxLat}&lomin={minLon}&lomax={maxLon}
```

**Response Format:**
```json
{
  "time": 1704067200,
  "states": [
    ["icao24", "callsign", "origin_country", "time_position", "last_contact",
     "longitude", "latitude", "baro_altitude", "on_ground", "velocity",
     "true_track", "vertical_rate", "sensors", "geo_altitude", "squawk",
     "spi", "position_source", "category"]
  ]
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Pages (Static)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ index.html  │  │   app.js    │  │      localStorage       │  │
│  │  (SPA UI)   │◄─┤  (logic)    │◄─┤  - saved locations      │  │
│  └─────────────┘  └──────┬──────┘  │  - flight history       │  │
│                          │         │  - settings             │  │
│                          ▼         └─────────────────────────┘  │
│                   ┌─────────────┐                                │
│                   │ OpenSky API │                                │
│                   │ (CORS ✅)   │                                │
│                   └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
overhead-flights/
├── index.html              # Single-page app UI
├── css/
│   └── styles.css          # Matching your private site's theme
├── js/
│   ├── app.js              # Main application controller
│   ├── opensky-client.js   # OpenSky API wrapper
│   ├── location-manager.js # Saved locations, geocoding
│   ├── flight-tracker.js   # Track closest approach logic
│   ├── storage.js          # localStorage persistence
│   └── ui-components.js    # Render flight cards, table
├── api-test.html           # API testing tool (already created)
└── README.md               # User documentation
```

## Features

### 1. Location Setup (First Visit)
- Welcome modal asking for location
- Input: Latitude/Longitude with validation
- "Use My Location" button (geolocation API)
- Geocoding: Type address → get coordinates (optional, using Nominatim)
- Save as named location (e.g., "Home", "Work")

### 2. Saved Locations
- Store multiple named locations in localStorage
- Quick-switch dropdown
- Edit/delete locations
- Default location setting

### 3. Flight Display
- **Current Overhead**: Cards showing flights currently in detection zone
- **History Table**: All flights seen today with closest approach
- **Statistics**: Total flights, closest flight, busiest time, etc.

### 4. Detection Zone
- Configurable radius (default: 5 miles)
- Visual indicator on map (if we add one) or text display
- Altitude filter (optional)

### 5. Closest Approach Tracking
Since we can't poll continuously (rate limits), we'll:
- Poll every 30 seconds (within 400/day limit = ~12 hrs of tracking)
- Interpolate closest approach from discrete samples
- Store: flight ID, callsign, registration, closest distance, timestamp, altitude, heading

### 6. Data Persistence
- Flight history stored in localStorage
- Auto-cleanup: Keep last 7 days (configurable)
- Export to JSON
- Import from JSON (backup/restore)

### 7. Auto-Refresh
- Configurable interval (30-300 seconds)
- Pause when tab hidden (visibility API)
- Smart refresh: Pause overnight (configurable hours)

## UI Design

Matching your private site's dark theme:
- Background: #0f0f1a
- Card backgrounds: #1a1a2e
- Accent: #4fc3f7 (cyan)
- Success: #81c784 (green)
- Warning: #ffb74d (orange)
- Error: #e57373 (red)

### Layout
```
┌─────────────────────────────────────────────┐
│  🛫 Overhead Flights          [Location ▼]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  📍 Currently Overhead (3 flights)  │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐           │   │
│  │  │ DAL1│ │ SWA2│ │ AAL3│           │   │
│  │  │12kft│ │ 8kft│ │25kft│           │   │
│  │  │ 2.1 │ │ 3.4 │ │ 5.2 │ mi away   │   │
│  │  └─────┘ └─────┘ └─────┘           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  📊 Today's Flights (23 total)      │   │
│  │  [Table: Time | Flight | From | To  │   │
│  │   | Altitude | Closest | Route]     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Refresh: 30s] [Export] [Settings ⚙️]      │
└─────────────────────────────────────────────┘
```

## Data Model

### Saved Location
```javascript
{
  id: "uuid",
  name: "Home",
  lat: 45.6272,
  lon: -122.6730,
  radiusMiles: 5,
  createdAt: "2025-01-30T16:00:00Z"
}
```

### Flight Record
```javascript
{
  icao24: "a1b2c3",
  callsign: "DAL123  ",
  originCountry: "United States",
  firstSeen: "2025-01-30T16:00:00Z",
  lastSeen: "2025-01-30T16:05:00Z",
  closestApproach: {
    distanceMiles: 1.23,
    timestamp: "2025-01-30T16:02:30Z",
    altitude: 12000,
    latitude: 45.628,
    longitude: -122.674,
    heading: 245
  },
  positions: [  // Sampled positions during tracking
    { time, lat, lon, alt, dist }
  ]
}
```

## Rate Limit Management

**Budget: 400 API credits/day**

Strategy:
- 1 credit = 1 API call
- Default refresh: 60 seconds = 1,440 calls/day ❌
- Optimized: 90 seconds = 960 calls/day ❌
- Conservative: 120 seconds (2 min) = 720 calls/day ❌
- Overnight pause (10PM-6AM): 120s during day = 480 calls/day ✅

**Smart Scheduling:**
- Active hours: Refresh every 90s
- Quiet hours (10PM-6AM): Pause or 5-minute intervals
- No flights detected: Back off to 3 minutes
- Tab hidden: Pause refresh

## Implementation Phases

### Phase 1: Core (MVP)
- [ ] Basic HTML/CSS layout
- [ ] OpenSky API client
- [ ] Location input with geolocation
- [ ] Display current flights as cards
- [ ] Simple history table
- [ ] localStorage persistence

### Phase 2: Polish
- [ ] Saved locations manager
- [ ] Closest approach calculation
- [ ] Auto-refresh with rate limit management
- [ ] Export/import JSON
- [ ] Settings panel

### Phase 3: Enhancements
- [ ] Geocoding (address → coordinates)
- [ ] Map visualization (Leaflet/OpenLayers)
- [ ] Flight detail view
- [ ] Statistics dashboard
- [ ] PWA support (offline indicator)

## Open Questions

1. **Distance calculation**: Haversine formula (sufficient for small distances)
2. **Geocoding**: Use Nominatim (free, rate limited) or skip for MVP
3. **Map**: Add in Phase 2 or 3? Leaflet is lightweight.
4. **Time display**: Local time or UTC?

## Next Steps

1. ✅ API test file created (`api-test.html`)
2. Build MVP Phase 1
3. Test rate limits with real usage
4. Iterate based on usage

---

*Ready to proceed with implementation?*
