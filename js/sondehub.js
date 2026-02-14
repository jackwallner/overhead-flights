/**
 * SondeHub Amateur API Client
 * Free, open API for tracking amateur high-altitude balloons
 * https://github.com/projecthorus/sondehub-infra/wiki/API-(Beta)
 */

const SondeHubClient = {
  BASE_URL: 'https://api.v2.sondehub.org',

  // Rate limiting - SondeHub asks not to poll too frequently
  lastCall: 0,
  minInterval: 15000, // 15 seconds minimum between calls

  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastCall = Date.now();
  },

  /**
   * Get latest amateur balloon payloads near a location
   * @param {number} lat - Center latitude
   * @param {number} lon - Center longitude
   * @param {number} radiusKm - Radius in kilometers
   * @param {number} lastSeconds - How far back to look (default 24 hours)
   * @returns {Promise<Array>} Array of balloon objects
   */
  async getBalloonsNearby(lat, lon, radiusKm = 200, lastSeconds = 86400) {
    await this.rateLimit();

    const url = `${this.BASE_URL}/amateur?lat=${lat}&lon=${lon}&distance=${radiusKm * 1000}&last=${lastSeconds}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = await response.json();
    return this.parseBalloons(data);
  },

  /**
   * Get telemetry history for a specific balloon
   * @param {string} payloadCallsign - The payload callsign/serial
   * @param {number} lastSeconds - How far back (default 6 hours)
   * @returns {Promise<Array>} Array of telemetry points
   */
  async getBalloonTelemetry(payloadCallsign, lastSeconds = 21600) {
    await this.rateLimit();

    const url = `${this.BASE_URL}/amateur/telemetry/${encodeURIComponent(payloadCallsign)}?last=${lastSeconds}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = await response.json();
    return this.parseTelemetryHistory(data);
  },

  /**
   * Parse SondeHub amateur balloon data into friendly format
   * The API returns a dictionary keyed by payload callsign
   */
  parseBalloons(data) {
    if (!data || typeof data !== 'object') return [];

    const balloons = [];

    // Data can be keyed by payload callsign
    for (const [key, entry] of Object.entries(data)) {
      // Entry may be a single object or the latest telemetry
      const balloon = this.parseEntry(key, entry);
      if (balloon) balloons.push(balloon);
    }

    return balloons;
  },

  /**
   * Parse a single balloon entry
   */
  parseEntry(key, entry) {
    if (!entry) return null;

    // Handle case where entry is an array of telemetry points
    const latest = Array.isArray(entry) ? entry[entry.length - 1] : entry;
    if (!latest) return null;

    const lat = parseFloat(latest.lat);
    const lon = parseFloat(latest.lon);
    if (isNaN(lat) || isNaN(lon)) return null;

    return {
      serial: latest.payload_callsign || key,
      datetime: latest.datetime || latest.time_received,
      lat,
      lon,
      altitude: latest.alt !== undefined ? Math.round(parseFloat(latest.alt)) : null, // meters
      altitudeFt: latest.alt !== undefined ? Math.round(parseFloat(latest.alt) * 3.28084) : null, // feet
      velH: latest.vel_h !== undefined ? parseFloat(latest.vel_h) : null, // horizontal velocity m/s
      velV: latest.vel_v !== undefined ? parseFloat(latest.vel_v) : null, // vertical velocity m/s
      heading: latest.heading !== undefined ? Math.round(parseFloat(latest.heading)) : null,
      frequency: latest.frequency || null,
      uploaderCallsign: latest.uploader_callsign || null,
      manufacturer: latest.manufacturer || null,
      type: latest.type || null,
      burstTimer: latest.burst_timer || null,
      raw: latest
    };
  },

  /**
   * Parse telemetry history for a single balloon
   */
  parseTelemetryHistory(data) {
    if (!data) return [];

    // Data might be an array or a dict of timestamps
    if (Array.isArray(data)) {
      return data.map(entry => ({
        datetime: entry.datetime,
        lat: parseFloat(entry.lat),
        lon: parseFloat(entry.lon),
        altitude: entry.alt !== undefined ? Math.round(parseFloat(entry.alt)) : null,
        velH: entry.vel_h !== undefined ? parseFloat(entry.vel_h) : null,
        velV: entry.vel_v !== undefined ? parseFloat(entry.vel_v) : null,
        heading: entry.heading !== undefined ? Math.round(parseFloat(entry.heading)) : null
      })).filter(e => !isNaN(e.lat) && !isNaN(e.lon));
    }

    // Dict format - flatten
    const points = [];
    for (const [, entries] of Object.entries(data)) {
      if (typeof entries === 'object' && !Array.isArray(entries)) {
        for (const [, entry] of Object.entries(entries)) {
          if (entry && entry.lat !== undefined) {
            points.push({
              datetime: entry.datetime,
              lat: parseFloat(entry.lat),
              lon: parseFloat(entry.lon),
              altitude: entry.alt !== undefined ? Math.round(parseFloat(entry.alt)) : null,
              velH: entry.vel_h !== undefined ? parseFloat(entry.vel_h) : null,
              velV: entry.vel_v !== undefined ? parseFloat(entry.vel_v) : null,
              heading: entry.heading !== undefined ? Math.round(parseFloat(entry.heading)) : null
            });
          }
        }
      }
    }

    return points.filter(e => !isNaN(e.lat) && !isNaN(e.lon))
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  },

  /**
   * Calculate distance between two coordinates in kilometers
   */
  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const toRad = deg => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  /**
   * Calculate bearing from point 1 to point 2
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * (Math.PI / 180);
    const toDeg = rad => (rad * 180 / Math.PI + 360) % 360;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

    return toDeg(Math.atan2(y, x));
  },

  /**
   * Get direction label from bearing
   */
  getDirection(bearing) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  },

  /**
   * Get SondeHub tracker URL for a balloon
   */
  getTrackerUrl(payloadCallsign) {
    if (!payloadCallsign) return null;
    return `https://amateur.sondehub.org/#!mt=roadmap&mz=9&qm=6_hours&q=${encodeURIComponent(payloadCallsign)}`;
  }
};

window.SondeHubClient = SondeHubClient;
