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

  // Locations (now with radius per location)
  getLocations() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.LOCATIONS)) || [];
    } catch {
      return [];
    }
  },

  saveLocation(name, lat, lon, radius = 5) {
    const locations = this.getLocations();
    const existing = locations.findIndex(l => l.name === name);
    const location = { name, lat, lon, radius: parseFloat(radius) || 5, created: Date.now() };
    
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
      location.radius = parseFloat(radius) || 5;
      localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(locations));
    }
    return location;
  },

  // Settings (maxDistance removed - now per-location)
  getSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(this.KEYS.SETTINGS));
      if (settings) {
        // Migrate old settings - remove maxDistance from global
        delete settings.maxDistance;
        return settings;
      }
      return this.defaultSettings();
    } catch {
      return this.defaultSettings();
    }
  },

  defaultSettings() {
    return {
      refreshInterval: 90, // seconds
      nightPause: false, // disabled by default
      nightStart: '22:00',
      nightEnd: '06:00',
      maxAltitude: 10000, // feet
      units: 'nautical', // or 'metric', 'imperial'
      activeLocation: null
    };
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Flight History (persisted, per-location)
  getHistory(locationName = null) {
    try {
      const history = JSON.parse(localStorage.getItem(this.KEYS.HISTORY)) || [];
      // Clean old entries (> 7 days)
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      let filtered = history.filter(f => f.lastSeen > cutoff);
      
      // Filter by location if specified - ONLY show flights for this exact location
      if (locationName) {
        filtered = filtered.filter(f => f.locationName === locationName);
      }
      
      return filtered;
    } catch {
      return [];
    }
  },

  addToHistory(flight, locationName) {
    const history = this.getHistory(); // Get all history (no filter)
    
    // Look for existing flight at this location within 1 hour
    const existing = history.findIndex(f => 
      f.icao === flight.icao && 
      f.locationName === locationName &&
      Math.abs(f.lastSeen - flight.lastSeen) < 3600000
    );
    
    const flightWithLocation = { ...flight, locationName };
    
    if (existing >= 0) {
      history[existing] = { ...history[existing], ...flightWithLocation };
    } else {
      history.push(flightWithLocation);
    }
    
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
  },

  clearHistory(locationName = null) {
    if (locationName) {
      // Clear only history for specific location
      const history = this.getHistory();
      const filtered = history.filter(f => f.locationName !== locationName);
      localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(filtered));
    } else {
      // Clear all history
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

  // Clear all
  clearAll() {
    Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem(this.KEYS.SESSION);
  }
};

// Expose globally
window.Storage = Storage;
