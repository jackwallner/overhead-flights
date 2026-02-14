/**
 * Balloon Storage Manager - Handles all localStorage operations for balloon tracker
 * Keys use 'hab_' prefix to stay independent from the flight tracker
 */

const BalloonStorage = {
  KEYS: {
    LOCATIONS: 'hab_locations',
    SETTINGS: 'hab_settings',
    HISTORY: 'hab_history',
    SESSION: 'hab_session',
    FIRST_VISIT: 'hab_first_visit'
  },

  // Locations
  getLocations() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.LOCATIONS)) || [];
    } catch {
      return [];
    }
  },

  saveLocation(name, lat, lon, radius = 200) {
    const locations = this.getLocations();
    const existing = locations.findIndex(l => l.name === name);
    const location = { name, lat, lon, radius: parseFloat(radius) || 200, created: Date.now() };

    if (existing >= 0) {
      locations[existing] = location;
    } else {
      locations.push(location);
    }

    localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(locations));
    return location;
  },

  deleteLocation(name) {
    const locations = this.getLocations().filter(l => l.name !== name);
    localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(locations));
  },

  updateLocationRadius(name, radius) {
    const locations = this.getLocations();
    const location = locations.find(l => l.name === name);
    if (location) {
      location.radius = parseFloat(radius) || 200;
      localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(locations));
    }
    return location;
  },

  // Settings
  getSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(this.KEYS.SETTINGS));
      if (settings) return settings;
      return this.defaultSettings();
    } catch {
      return this.defaultSettings();
    }
  },

  defaultSettings() {
    return {
      refreshInterval: 120, // seconds (SondeHub asks not to poll too frequently)
      maxAltitude: 40000, // meters - balloons go very high
      activeLocation: null
    };
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Balloon History (persisted, per-location)
  getHistory(locationName = null) {
    try {
      const history = JSON.parse(localStorage.getItem(this.KEYS.HISTORY)) || [];
      // Clean old entries (> 7 days)
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      let filtered = history.filter(f => f.lastSeen > cutoff);

      if (locationName) {
        filtered = filtered.filter(f => f.locationName === locationName);
      }

      return filtered;
    } catch {
      return [];
    }
  },

  addToHistory(balloon, locationName) {
    const history = this.getHistory();

    const existing = history.findIndex(f =>
      f.serial === balloon.serial &&
      f.locationName === locationName &&
      Math.abs(f.lastSeen - balloon.lastSeen) < 3600000
    );

    const balloonWithLocation = { ...balloon, locationName };

    if (existing >= 0) {
      history[existing] = { ...history[existing], ...balloonWithLocation };
    } else {
      history.push(balloonWithLocation);
    }

    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
  },

  clearHistory(locationName = null) {
    if (locationName) {
      const history = this.getHistory();
      const filtered = history.filter(f => f.locationName !== locationName);
      localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(filtered));
    } else {
      localStorage.removeItem(this.KEYS.HISTORY);
    }
  },

  // Current Session (temporary)
  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(this.KEYS.SESSION)) || {};
    } catch {
      return {};
    }
  },

  saveSession(data) {
    sessionStorage.setItem(this.KEYS.SESSION, JSON.stringify(data));
  },

  // First Visit
  isFirstVisit() {
    return !localStorage.getItem(this.KEYS.FIRST_VISIT);
  },

  markVisited() {
    localStorage.setItem(this.KEYS.FIRST_VISIT, Date.now().toString());
  },

  // Export/Import
  exportData() {
    return {
      locations: this.getLocations(),
      settings: this.getSettings(),
      history: this.getHistory(),
      exported: new Date().toISOString()
    };
  },

  importData(data) {
    if (data.locations) localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(data.locations));
    if (data.settings) localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(data.settings));
    if (data.history) localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(data.history));
  },

  clearAll() {
    Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem(this.KEYS.SESSION);
  }
};

window.BalloonStorage = BalloonStorage;
