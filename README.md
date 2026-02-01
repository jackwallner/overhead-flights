# Overhead Flights ✈️

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue?logo=github)](https://jackwallner.github.io/overhead-flights/)
[![OpenSky API](https://img.shields.io/badge/API-OpenSky-blue)](https://opensky-network.org/)

> A client-side flight tracker that shows aircraft flying overhead any location. Built as a pure static site for GitHub Pages - **no backend required**.

**Live Site:** https://jackwallner.github.io/overhead-flights/

![Screenshot](docs/screenshot.png)

## Features

- 📍 **Location-based tracking** - Enter coordinates or use geolocation
- 💾 **Saved locations** - Store multiple locations (Home, Work, etc.)
- ✈️ **Real-time flights** - See what's flying overhead right now
- 📊 **Flight history** - Track closest approaches throughout the day
- 🗺️ **Interactive map** - View aircraft positions on Leaflet map
- 🔒 **Privacy-first** - All data stored locally in your browser
- 📱 **Mobile-friendly** - Works on desktop and mobile

## Quick Start

### Use the Live Site

Just visit https://jackwallner.github.io/overhead-flights/ and:

1. Click "Use My Current Location" or enter coordinates manually
2. Set your detection radius (0.5 - 50 nautical miles)
3. Watch for aircraft!

### Run Locally

```bash
# Clone
git clone https://github.com/jackwallner/overhead-flights.git
cd overhead-flights

# Serve locally
python -m http.server 8000

# Open http://localhost:8000
```

## How It Works

This app uses the [OpenSky Network API](https://opensky-network.org/) to fetch real-time aircraft data directly from your browser:

```
┌─────────────────┐         ┌─────────────────┐
│  OpenSky API    │◀────────│  Your Browser   │
│  (CORS-enabled) │         │  (overhead-flights)
└─────────────────┘         └─────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │  Leaflet Map    │
                            │  localStorage   │
                            └─────────────────┘
```

### Rate Limits

- **Free tier:** 400 API calls/day (anonymous access)
- **Smart refresh:** 90s default interval = ~960 calls/day max
- **Night pause:** Reduces usage (10PM-6AM = 8 hours saved)
- **Tab visibility:** Pauses when tab is hidden

## Configuration

All settings are stored in your browser's localStorage:

| Setting | Default | Description |
|---------|---------|-------------|
| Refresh Interval | 90s | Seconds between API calls (min: 10) |
| Max Altitude | 10000 ft | Filter aircraft above this altitude |
| Detection Radius | 5 NM | How far to search for flights |
| Night Pause | On | Pause updates overnight |
| Night Hours | 22:00-06:00 | When to pause |

### Multiple Locations

Save multiple locations and switch between them:

1. Click "📍 Change Location"
2. Add a new location (Home, Work, Vacation spot, etc.)
3. Each location has its own saved coordinates and radius

## Development

```bash
# Test API CORS locally
open api-test.html

# Serve locally
python -m http.server 8000

# Open http://localhost:8000
```

### File Structure

```
overhead-flights/
├── index.html              # Main app shell
├── api-test.html           # API connectivity test
├── css/
│   └── feature-request.css
├── js/
│   ├── app.js             # Main app logic
│   ├── opensky.js         # OpenSky API client
│   ├── tracker.js         # Flight tracking/state
│   ├── location.js        # Geolocation, geocoding
│   ├── storage.js         # localStorage wrapper
│   ├── map.js             # Leaflet map
│   ├── ui.js              # UI rendering
│   └── feature-request.js
└── README.md
```

## API Test

Visit [api-test.html](https://jackwallner.github.io/overhead-flights/api-test.html) to verify flight APIs work from your location.

## Comparison: overhead-flights vs my-flights

| Feature | overhead-flights | my-flights |
|---------|------------------|------------|
| **Data source** | OpenSky API (live) | FlightRadar24 (via service) |
| **Server needed** | ❌ No | ✅ Yes (Mac service) |
| **Setup difficulty** | Easy | Medium |
| **AWTRIX display** | ❌ No | ✅ Yes |
| **Flight history** | Session only | ✅ Persistent |
| **Closest approach** | Real-time tracking | Pre-calculated |
| **Multiple locations** | ✅ Yes | ❌ No |
| **Aircraft database** | Basic | 520k records |

### Which should I use?

**Use overhead-flights if:**
- You want something quick and simple
- You don't want to run a server
- You need multiple saved locations
- You're okay with basic aircraft info

**Use [my-flights](https://github.com/jackwallner/my-flights) if:**
- You want an AWTRIX clock display
- You want persistent flight history
- You want detailed aircraft information
- You have a Mac to run the service

## Tech Stack

- Vanilla JavaScript (ES6+, no frameworks)
- [OpenSky Network API](https://opensky-network.org/)
- [Leaflet](https://leafletjs.com/) for maps
- [Nominatim](https://nominatim.org/) for geocoding
- localStorage for persistence
- GitHub Pages hosting

## Troubleshooting

### No flights showing

1. Check your coordinates are correct
2. Try increasing the detection radius
3. OpenSky API may be temporarily unavailable
4. Check browser console for CORS errors

### "API Error" message

- OpenSky API may be rate limiting (wait a few minutes)
- Try accessing from a different network
- Check [api-test.html](https://jackwallner.github.io/overhead-flights/api-test.html)

### Map not loading

- Check internet connection
- Leaflet CDN may be blocked by your network
- Try disabling browser extensions

## Related Projects

- **[my-flights](https://github.com/jackwallner/my-flights)** - Server-fed flight tracker with AWTRIX display
- **[flight-tracker-service](https://github.com/jackwallner/flight-tracker-service)** - The Mac service that feeds my-flights

## Contributing

Pull requests welcome! This is a simple static site - no build process needed.

## License

MIT
