# @ overhead-flights Editor Quick Reference

> **Repo:** `overhead-flights/` → https://jackwallner.github.io/overhead-flights/

## What This Is

**Standalone client-side flight tracker.** Fetches live aircraft data directly from OpenSky API in the browser. No server needed.

**Not to be confused with:** `my-flights/` (server-fed display site)

## Quick Start

```bash
cd ~/clawd/overhead-flights
python -m http.server 8000
open http://localhost:8000
```

## File Structure

```
js/
├── app.js          ← Main entry, event handlers, settings
├── opensky.js      ← API client (rate limited)
├── tracker.js      ← Flight state, closest approach tracking
├── location.js     ← Geolocation, geocoding
├── storage.js      ← localStorage wrapper
├── map.js          ← Leaflet map
├── ui.js           ← DOM rendering
└── feature-request.js
```

## Key Code Paths

### Data Fetch
```
App.refresh() → OpenSkyClient.getStatesAroundPoint() → API
  → FlightTracker.processFlights() → UI.updateStats() + Map.update()
```

### Settings
```
Settings modal → App.saveSettings() → Storage.saveSettings()
  → App.startRefresh() (restarts timer)
```

### Location
```
Setup wizard → LocationManager → Storage.saveLocation()
  → App.start(location) → FlightMap.init() + FlightTracker.init()
```

## Common Changes

| Change | File | Function |
|--------|------|----------|
| Update refresh rate | `app.js` | `startRefresh()` or settings |
| Add new stat | `ui.js` | `updateStats()` |
| Change API params | `opensky.js` | `getStatesAroundPoint()` |
| Modify map | `map.js` | `init()`, `updateAircraft()` |
| New setting | `app.js` + `ui.js` | settings modal + save handler |

## Rate Limits

- Min 10s between API calls (hard limit in `opensky.js`)
- 400 calls/day per IP (OpenSky limit)
- Default: 90s refresh = ~960 potential calls/day
- Night pause saves ~33% of quota

## Data Stored

**localStorage keys:**
- `of_settings` - App configuration
- `of_locations` - Saved locations
- `of_active_location` - Current location name
- `of_visited` - First visit flag

## Testing

```bash
# Test API connectivity
open api-test.html

# Clear all data (browser console)
localStorage.clear()
```

## Deployment

```bash
git add .
git commit -m "Description"
git push origin main  # Auto-deploys to GitHub Pages
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| No flights loading | `api-test.html` - CORS/browser blocking? |
| Map not showing | Console for Leaflet errors |
| Settings not saving | localStorage quota exceeded? |
| "Too many requests" | Rate limit hit - wait 10s+ |

## Related Projects

- **my-flights:** `@archive/skills/my-flights/` - Server-fed display
- **Tracker service:** `@archive/skills/flight-tracker/` - Mac service that feeds my-flights
