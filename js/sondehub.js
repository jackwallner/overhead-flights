/**
 * SondeHub Amateur client
 * Snapshot: https://github.com/projecthorus/sondehub-infra/wiki/API-(Beta)
 * Live: MQTT over websockets at wss://ws-reader.v2.sondehub.org/, topic amateur/#
 */

const SondeHubClient = {
  BASE_URL: 'https://api.v2.sondehub.org',
  LIVE_URL: 'wss://ws-reader.v2.sondehub.org/',
  liveClient: null,
  retryTimer: null,

  /**
   * One-off snapshot of recent payloads near a location. Called once when a
   * location starts; live updates come from the websocket feed, never polling.
   */
  async getBalloonsNearby(lat, lon, radiusKm = 200, lastSeconds = 86400) {
    const url = `${this.BASE_URL}/amateur?lat=${lat}&lon=${lon}&distance=${radiusKm * 1000}&last=${lastSeconds}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = await response.json();
    return this.parseBalloons(data);
  },

  /**
   * Subscribe to the SondeHub live MQTT feed (amateur/#) over websockets.
   * onFrame(balloon) fires per telemetry frame; onStatus('live'|'reconnecting'|'error').
   */
  connectLive({ onFrame, onStatus }) {
    this.disconnectLive();

    const clientId = 'overhead-balloons-' + Math.floor(Math.random() * 1e10);
    const client = new Paho.Client(this.LIVE_URL, clientId);
    this.liveClient = client;

    client.onMessageArrived = (message) => {
      let frame;
      try {
        frame = JSON.parse(message.payloadString);
      } catch {
        return;
      }
      const balloon = this.parseEntry(message.destinationName.split('/')[1], frame);
      if (balloon) onFrame(balloon);
    };

    // Fires on the first connect and after every automatic reconnect.
    client.onConnected = () => {
      client.subscribe('amateur/#');
      onStatus('live');
    };

    client.onConnectionLost = (response) => {
      if (response.errorCode !== 0) onStatus('reconnecting');
    };

    client.connect({
      reconnect: true,
      onFailure: () => {
        onStatus('error');
        // Paho only auto-reconnects after a successful connect, so retry the first one.
        this.retryTimer = setTimeout(() => this.connectLive({ onFrame, onStatus }), 30000);
      }
    });
  },

  disconnectLive() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (!this.liveClient) return;
    const client = this.liveClient;
    this.liveClient = null;
    client.onConnectionLost = () => {};
    client.onMessageArrived = () => {};
    try {
      client.disconnect();
    } catch {
      // Not connected yet.
    }
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
