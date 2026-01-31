# Overhead Flights

A client-side flight tracker that shows aircraft flying overhead any location. Built as a pure static site for GitHub Pages - no backend required.

**Live Site:** https://jackwallner.github.io/overhead-flights/

## Features

- 📍 **Location-based tracking** - Enter coordinates or use geolocation
- 💾 **Saved locations** - Store multiple locations (Home, Work, etc.)
- ✈️ **Real-time flights** - See what's flying overhead right now
- 📊 **Flight history** - Track closest approaches throughout the day
- 🔒 **Privacy-first** - All data stored locally in your browser

## How It Works

This app uses the [OpenSky Network API](https://opensky-network.org/) to fetch real-time aircraft data directly from your browser. No server, no tracking, no accounts needed.

### Rate Limits

- Free tier: 400 API calls/day (anonymous)
- Smart refresh: 90s during active hours, pauses overnight
- Stays within limits while providing real-time updates

## Development

```bash
# Test API CORS locally
open api-test.html

# Serve locally for development
python -m http.server 8000
```

## API Test

Visit [api-test.html](https://jackwallner.github.io/overhead-flights/api-test.html) to verify flight APIs work from your location.

## Tech Stack

- Vanilla JavaScript (no frameworks)
- OpenSky Network API
- localStorage for persistence
- GitHub Pages hosting

## License

MIT
