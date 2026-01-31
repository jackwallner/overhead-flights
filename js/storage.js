/**
 * Storage Manager - Handles all localStorage operations
 * Keys: locations, settings, flightHistory, currentSession
 */

const Storage = {
  KEYS: {
    LOCATIONS: 'of_locations',
    SETTINGS: 'of_settings',
    HISTORY: 'of_history',
    SESSION: 'of_session',
    FIRST_VISIT: 'of_first_visit'
  },

  // Locations
  getLocations() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.LOCATIONS)) || [];
    } catch {
      return [];
    }
  },

  saveLocation(name, lat, lon) {
    const locations = this.getLocations();
    const existing = locations.findIndex(l => l.name === name);
    const location = { name, lat, lon, created: Date.now() };
    
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

  // Settings
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.SETTINGS)) || this.defaultSettings();
    } catch {
      return this.defaultSettings();
    }
  },

  defaultSettings() {
    return {
      refreshInterval: 90, // seconds
      nightPause: true,
      nightStart: '22:00',
      nightEnd: '06:00',
      maxDistance: 5, // nautical miles
      maxAltitude: 10000, // feet
      units: 'nautical', // or 'metric', 'imperial'
      activeLocation: null
    };
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Flight History (persisted)
  getHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(this.KEYS.HISTORY)) || [];
      // Clean old entries (> 7 days)
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return history.filter(f => f.lastSeen > cutoff);
    } catch {
      return [];
    }
  },

  addToHistory(flight) {
    const history = this.getHistory();
    const existing = history.findIndex(f => f.icao === flight.icao && 
      Math.abs(f.lastSeen - flight.lastSeen) < 3600000); // Within 1 hour
    
    if (existing >= 0) {
      history[existing] = { ...history[existing], ...flight };
    } else {
      history.push(flight);
    }
    
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
  },

  clearHistory() {
    localStorage.removeItem(this.KEYS.HISTORY);
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

  // Clear all
  clearAll() {
    Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem(this.KEYS.SESSION);
  }
};

// Expose globally
window.Storage = Storage;
