/**
 * Balloon Location Manager - Handles geolocation and saved locations for balloon tracker
 */

const BalloonLocationManager = {
  /**
   * Get current position using browser geolocation
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        err => reject(new Error(`Geolocation failed: ${err.message}`)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  },

  /**
   * Geocode a location name to coordinates using OpenStreetMap Nominatim
   */
  async geocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BalloonTracker/1.0' }
    });

    if (!response.ok) throw new Error('Geocoding failed');

    const results = await response.json();
    if (!results.length) throw new Error('Location not found');

    return {
      name: results[0].display_name.split(',')[0],
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon),
      fullName: results[0].display_name
    };
  },

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BalloonTracker/1.0' }
    });

    if (!response.ok) throw new Error('Reverse geocoding failed');

    const result = await response.json();
    return {
      name: result.address?.city || result.address?.town || result.address?.village || 'Unknown',
      fullName: result.display_name
    };
  },

  /**
   * Validate coordinates
   */
  validateCoords(lat, lon) {
    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);

    if (isNaN(numLat) || isNaN(numLon)) return { valid: false, error: 'Invalid coordinates' };
    if (numLat < -90 || numLat > 90) return { valid: false, error: 'Latitude must be -90 to 90' };
    if (numLon < -180 || numLon > 180) return { valid: false, error: 'Longitude must be -180 to 180' };

    return { valid: true, lat: numLat, lon: numLon };
  },

  /**
   * Format coordinates for display
   */
  formatCoords(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}${latDir}, ${Math.abs(lon).toFixed(4)}${lonDir}`;
  },

  /**
   * Get all saved locations
   */
  getSaved() {
    return BalloonStorage.getLocations();
  },

  /**
   * Save a location
   */
  save(name, lat, lon, radius = 200) {
    return BalloonStorage.saveLocation(name, lat, lon, radius);
  },

  /**
   * Delete a saved location
   */
  delete(name) {
    BalloonStorage.deleteLocation(name);
  },

  /**
   * Get or set active location
   */
  getActive() {
    const settings = BalloonStorage.getSettings();
    if (settings.activeLocation) {
      return settings.activeLocation;
    }
    const saved = this.getSaved();
    return saved[0] || null;
  },

  setActive(location) {
    const settings = BalloonStorage.getSettings();
    settings.activeLocation = location;
    BalloonStorage.saveSettings(settings);
  }
};

window.BalloonLocationManager = BalloonLocationManager;
