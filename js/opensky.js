/**
 * OpenSky Network API Client
 * CORS-enabled, no API key required for anonymous access
 * Rate limit: 400 credits/day for anonymous users
 */

const OpenSkyClient = {
  BASE_URL: 'https://opensky-network.org/api',
  
  // Rate limiting
  lastCall: 0,
  minInterval: 10000, // 10 seconds between calls per OpenSky terms
  
  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastCall = Date.now();
  },

  /**
   * Get all states (flights) within a bounding box
   * @param {Object} bounds - { lamin, lomin, lamax, lomax } in degrees
   * @returns {Promise<Array>} Array of flight states
   */
  async getStates(bounds = null) {
    await this.rateLimit();
    
    let url = `${this.BASE_URL}/states/all`;
    if (bounds) {
      url += `?lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    
    const data = await response.json();
    return this.parseStates(data);
  },

  /**
   * Get states around a specific point with radius
   * @param {number} lat - Center latitude
   * @param {number} lon - Center longitude  
   * @param {number} radiusNm - Radius in nautical miles
   */
  async getStatesAroundPoint(lat, lon, radiusNm = 10) {
    // Convert nautical miles to degrees (approximate)
    const radiusDeg = radiusNm / 60; // 1 degree = 60 NM
    
    const bounds = {
      lamin: lat - radiusDeg,
      lomin: lon - radiusDeg,
      lamax: lat + radiusDeg,
      lomax: lon + radiusDeg
    };
    
    const flights = await this.getStates(bounds);
    
    // Filter by actual distance
    return flights.filter(f => {
      const dist = this.calculateDistance(lat, lon, f.lat, f.lon);
      return dist <= radiusNm;
    });
  },

  /**
   * Parse OpenSky state vectors into friendly format
   * OpenSky returns: [icao24, callsign, origin_country, time_position, last_contact,
   *                   longitude, latitude, baro_altitude, on_ground, velocity, 
   *                   true_track, vertical_rate, sensors, geo_altitude, squawk, 
   *                   spi, position_source, category]
   */
  parseStates(data) {
    if (!data || !data.states) return [];
    
    return data.states.map(state => ({
      icao: state[0]?.trim() || 'Unknown',
      callsign: state[1]?.trim() || 'Unknown',
      country: state[2],
      lastContact: state[4] * 1000, // Convert to ms
      lon: state[5],
      lat: state[6],
      altitude: state[7] !== null ? Math.round(state[7] * 3.28084) : null, // m to ft
      onGround: state[8],
      speed: state[9] !== null ? Math.round(state[9] * 1.94384) : null, // m/s to knots
      heading: state[10] !== null ? Math.round(state[10]) : null,
      verticalRate: state[11], // m/s
      squawk: state[14],
      category: state[17]
    })).filter(f => f.lat && f.lon); // Must have position
  },

  /**
   * Calculate distance between two coordinates in nautical miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in nautical miles
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
   * Get direction label from bearing (N, NE, E, etc.)
   */
  getDirection(bearing) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  },

  /**
   * Check API status and remaining credits
   */
  async checkStatus() {
    // OpenSky doesn't have a status endpoint, but we can do a minimal request
    try {
      const start = Date.now();
      await fetch(`${this.BASE_URL}/states/all?limit=1`);
      return { ok: true, latency: Date.now() - start };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
};

// Expose globally
window.OpenSkyClient = OpenSkyClient;
