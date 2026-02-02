/**
 * Main Application - Overhead Flights
 * Client-side flight tracker using OpenSky Network API
 */

const App = {
  settings: null,
  location: null,
  refreshTimer: null,
  countdownTimer: null,
  isRunning: false,
  nextRefreshTime: null,

  async init() {
    console.log('🛫 Overhead Flights initializing...');
    
    UI.init();
    this.settings = Storage.getSettings();
    
    // Check URL parameters for forcing setup view
    const urlParams = new URLSearchParams(window.location.search);
    const forceSetup = urlParams.has('setup') || urlParams.has('change-location');
    
    // Check if first visit or forced setup
    if (forceSetup || Storage.isFirstVisit()) {
      this.showSetup();
      // Clear the URL parameter without reloading
      if (forceSetup) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else {
      const saved = LocationManager.getActive();
      if (saved) {
        await this.start(saved);
      } else {
        this.showSetup();
      }
    }

    this.bindEvents();
  },

  /**
   * Show setup wizard
   */
  showSetup() {
    UI.showSetup();
    this.populateSetupLocations();
  },

  /**
   * Start the app with a location
   */
  async start(location) {
    this.location = location;
    LocationManager.setActive(location);
    UI.updateLocation(location);
    UI.showMain();
    
    // Update refresh display
    const refreshDisplay = document.getElementById('refresh-interval-display');
    if (refreshDisplay) {
      refreshDisplay.textContent = this.settings.refreshInterval;
    }
    
    // Update location dropdown and tabs
    this.updateLocationUI();
    
    FlightTracker.init(this.settings, location);
    
    // Initialize map
    setTimeout(() => {
      FlightMap.init(location, location.radius || 5);
    }, 100);
    
    // Initial fetch
    await this.refresh();
    
    // Start auto-refresh
    this.startRefresh();
    
    Storage.markVisited();
  },

  /**
   * Update location dropdown and tabs
   */
  updateLocationUI() {
    this.renderLocationDropdown();
    this.renderLocationTabs();
  },

  /**
   * Render location dropdown list
   */
  renderLocationDropdown() {
    const list = document.getElementById('location-dropdown-list');
    const locations = LocationManager.getSaved();
    const currentName = this.location?.name;
    
    // Update dropdown button text
    const shortName = document.getElementById('current-loc-short');
    if (shortName) {
      shortName.textContent = currentName || 'Location';
    }
    
    if (locations.length === 0) {
      list.innerHTML = '<button class="dropdown-item">No saved locations</button>';
      return;
    }
    
    list.innerHTML = locations.map(loc => `
      <button class="dropdown-item ${loc.name === currentName ? 'active' : ''}" data-location="${loc.name}">
        ${loc.name === currentName ? '● ' : ''}${loc.name}
      </button>
    `).join('');
    
    // Bind click handlers
    list.querySelectorAll('.dropdown-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.dataset.location;
        if (name && name !== currentName) {
          const location = locations.find(l => l.name === name);
          if (location) {
            this.switchLocation(location);
          }
        }
        UI.hideLocationDropdown();
      });
    });
  },

  /**
   * Render location tabs
   */
  renderLocationTabs() {
    const container = document.getElementById('location-tabs');
    const locations = LocationManager.getSaved();
    const currentName = this.location?.name;
    
    if (locations.length <= 1) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = locations.map(loc => `
      <button class="location-tab ${loc.name === currentName ? 'active' : ''}" data-location="${loc.name}">
        <span class="tab-icon">${loc.name === currentName ? '●' : '○'}</span>
        ${loc.name}
      </button>
    `).join('');
    
    // Bind click handlers
    container.querySelectorAll('.location-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.closest('.location-tab').dataset.location;
        if (name && name !== currentName) {
          const location = locations.find(l => l.name === name);
          if (location) {
            this.switchLocation(location);
          }
        }
      });
    });
  },

  /**
   * Switch to a different location
   */
  async switchLocation(location) {
    this.stopRefresh();
    await this.start(location);
  },

  /**
   * Fetch fresh data from OpenSky
   */
  async refresh() {
    UI.setStatus('loading', 'Fetching flights...');
    
    try {
      // Check night pause
      if (FlightTracker.isNightTime()) {
        UI.setStatus('paused', 'Night mode - paused until ' + this.settings.nightEnd);
        UI.setCountdownPaused(true);
        return;
      }
      UI.setCountdownPaused(false);
      
      const radius = this.location.radius || 5;
      const flights = await OpenSkyClient.getStatesAroundPoint(
        this.location.lat, 
        this.location.lon, 
        radius * 2 // Fetch wider to catch approaching flights
      );
      
      // Filter by altitude
      const filtered = flights.filter(f => 
        !f.onGround && 
        (!f.altitude || f.altitude <= this.settings.maxAltitude)
      );
      
      // Process and track
      const data = FlightTracker.processFlights(filtered);
      
      // Update UI
      UI.updateStats(data.stats);
      UI.renderCurrentFlight(data.active[0] || null);
      UI.renderHistory(data.history, this.location?.name);
      
      // Update map
      if (FlightMap.map) {
        FlightMap.updateAircraft(data.active);
        FlightMap.updateTrails(data.trails);
      }
      
      UI.setStatus('success', `Updated - ${data.stats.activeCount} flights`);
      
    } catch (err) {
      console.error('Refresh failed:', err);
      UI.showError('Failed to fetch flights: ' + err.message);
    }
  },

  /**
   * Start auto-refresh timer
   */
  startRefresh() {
    this.stopRefresh();
    this.isRunning = true;
    
    const interval = Math.max(this.settings.refreshInterval, 10) * 1000;
    this.nextRefreshTime = Date.now() + interval;
    
    // Start UI countdown
    UI.startCountdown(this.settings.refreshInterval);
    
    this.refreshTimer = setInterval(() => {
      if (!document.hidden) { // Don't fetch when tab is hidden
        this.refresh();
        this.nextRefreshTime = Date.now() + interval;
      }
    }, interval);
    
    console.log(`Auto-refresh started: ${interval/1000}s interval`);
  },

  /**
   * Stop auto-refresh
   */
  stopRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    UI.stopCountdown();
    this.isRunning = false;
  },

  /**
   * Populate setup saved locations
   */
  populateSetupLocations() {
    const container = document.getElementById('setup-saved-locations');
    const section = document.getElementById('setup-saved-section');
    const locations = LocationManager.getSaved();
    
    if (locations.length === 0) {
      section.classList.add('hidden');
      return;
    }
    
    section.classList.remove('hidden');
    container.innerHTML = locations.map(loc => `
      <div class="saved-location-card" data-name="${loc.name}">
        <div>
          <div class="location-name">${loc.name}</div>
          <div class="location-coords">${LocationManager.formatCoords(loc.lat, loc.lon)} • ${loc.radius || 5}NM radius</div>
        </div>
        <button class="btn btn-primary btn-small use-location">Use</button>
      </div>
    `).join('');
  },

  /**
   * Bind all event handlers
   */
  bindEvents() {
    // Setup wizard - Use My Location
    document.getElementById('btn-use-location').addEventListener('click', async () => {
      UI.setLoading(true);
      try {
        const pos = await LocationManager.getCurrentPosition();
        const geocode = await LocationManager.reverseGeocode(pos.lat, pos.lon);
        const radius = parseFloat(document.getElementById('manual-radius')?.value) || 5;
        
        const location = Storage.saveLocation(geocode.name, pos.lat, pos.lon, radius);
        await this.start(location);
      } catch (err) {
        alert('Could not get location: ' + err.message);
      } finally {
        UI.setLoading(false);
      }
    });

    // Setup wizard - Manual entry toggle
    document.getElementById('btn-manual-coords').addEventListener('click', () => {
      document.getElementById('manual-coords-form').classList.toggle('hidden');
    });

    // Setup wizard - Save manual coords
    document.getElementById('btn-save-manual').addEventListener('click', () => {
      const name = document.getElementById('manual-name').value.trim();
      const lat = document.getElementById('manual-lat').value;
      const lon = document.getElementById('manual-lon').value;
      const radius = document.getElementById('manual-radius').value;
      
      const valid = LocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }
      
      if (!name) {
        alert('Please enter a name for this location');
        return;
      }
      
      const location = Storage.saveLocation(name, valid.lat, valid.lon, radius);
      this.start(location);
    });

    // Setup wizard - Search
    document.getElementById('btn-search-location').addEventListener('click', async () => {
      const query = document.getElementById('search-query').value.trim();
      if (!query) return;
      
      UI.setLoading(true);
      try {
        const result = await LocationManager.geocode(query);
        const radius = parseFloat(document.getElementById('manual-radius')?.value) || 5;
        const location = Storage.saveLocation(result.name, result.lat, result.lon, radius);
        await this.start(location);
      } catch (err) {
        alert('Search failed: ' + err.message);
      } finally {
        UI.setLoading(false);
      }
    });

    // Setup wizard - Use saved location
    document.getElementById('setup-saved-locations').addEventListener('click', (e) => {
      if (e.target.classList.contains('use-location')) {
        const name = e.target.closest('.saved-location-card').dataset.name;
        const locations = LocationManager.getSaved();
        const location = locations.find(l => l.name === name);
        if (location) this.start(location);
      }
    });

    // Manual refresh
    document.getElementById('btn-refresh').addEventListener('click', () => {
      this.refresh();
    });

    // Location dropdown
    document.getElementById('btn-location-dropdown').addEventListener('click', (e) => {
      e.stopPropagation();
      UI.toggleLocationDropdown();
    });
    
    // Add new location from dropdown
    document.getElementById('btn-add-new-location').addEventListener('click', () => {
      UI.hideLocationDropdown();
      this.stopRefresh();
      this.showSetup();
    });

    // Settings dropdown
    document.getElementById('btn-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      UI.toggleSettingsDropdown();
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      UI.hideSettingsDropdown();
      UI.hideLocationDropdown();
    });

    // Settings dropdown items
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = e.target.dataset.settings;
        UI.hideSettingsDropdown();
        UI.openSettings(this.settings, this.location, tab);
        if (tab === 'location') {
          this.renderSettingsLocations();
        }
      });
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      UI.closeSettings();
    });

    document.getElementById('btn-close-settings-x').addEventListener('click', () => {
      UI.closeSettings();
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      const formData = UI.getSettingsFromForm();
      
      // Update settings
      this.settings.refreshInterval = formData.refreshInterval;
      this.settings.maxAltitude = formData.maxAltitude;
      this.settings.nightPause = formData.nightPause;
      this.settings.nightStart = formData.nightStart;
      this.settings.nightEnd = formData.nightEnd;
      
      // Update location radius if changed
      if (this.location && formData.radius !== this.location.radius) {
        this.location.radius = formData.radius;
        Storage.updateLocationRadius(this.location.name, formData.radius);
        FlightTracker.setRadius(formData.radius);
        FlightMap.setRadius(formData.radius);
        UI.updateLocation(this.location);
      }
      
      Storage.saveSettings(this.settings);
      UI.closeSettings();
      this.startRefresh(); // Restart with new interval
      this.refresh();
    });



    // Location management in settings
    document.getElementById('btn-add-location').addEventListener('click', () => {
      document.getElementById('new-location-form').classList.remove('hidden');
    });

    document.getElementById('btn-save-new-location').addEventListener('click', () => {
      const name = document.getElementById('new-loc-name').value.trim();
      const lat = document.getElementById('new-loc-lat').value;
      const lon = document.getElementById('new-loc-lon').value;
      const radius = document.getElementById('new-loc-radius').value;
      
      const valid = LocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }
      
      Storage.saveLocation(name || 'Location', valid.lat, valid.lon, radius);
      this.renderSettingsLocations();
      document.getElementById('new-location-form').classList.add('hidden');
      document.getElementById('new-loc-name').value = '';
      document.getElementById('new-loc-lat').value = '';
      document.getElementById('new-loc-lon').value = '';
      document.getElementById('new-loc-radius').value = '5';
    });

    // Change location button in settings
    document.getElementById('btn-change-location').addEventListener('click', () => {
      UI.closeSettings();
      UI.openChangeLocationModal();
    });

    // Change Location Modal events
    document.getElementById('btn-close-change-loc').addEventListener('click', () => {
      UI.closeChangeLocationModal();
    });

    document.getElementById('btn-close-change-loc-x').addEventListener('click', () => {
      UI.closeChangeLocationModal();
    });

    document.getElementById('btn-change-use-location').addEventListener('click', async () => {
      UI.setLoading(true);
      try {
        const pos = await LocationManager.getCurrentPosition();
        const geocode = await LocationManager.reverseGeocode(pos.lat, pos.lon);
        const location = Storage.saveLocation(geocode.name, pos.lat, pos.lon, 5);
        UI.closeChangeLocationModal();
        this.stopRefresh();
        await this.start(location);
      } catch (err) {
        alert('Could not get location: ' + err.message);
      } finally {
        UI.setLoading(false);
      }
    });

    document.getElementById('btn-change-search').addEventListener('click', async () => {
      const query = document.getElementById('change-search-query').value.trim();
      if (!query) return;
      
      UI.setLoading(true);
      try {
        const result = await LocationManager.geocode(query);
        const location = Storage.saveLocation(result.name, result.lat, result.lon, 5);
        UI.closeChangeLocationModal();
        this.stopRefresh();
        await this.start(location);
      } catch (err) {
        alert('Search failed: ' + err.message);
      } finally {
        UI.setLoading(false);
      }
    });

    document.getElementById('btn-change-save').addEventListener('click', () => {
      const name = document.getElementById('change-loc-name').value.trim();
      const lat = document.getElementById('change-loc-lat').value;
      const lon = document.getElementById('change-loc-lon').value;
      const radius = document.getElementById('change-loc-radius').value;
      
      const valid = LocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }
      
      if (!name) {
        alert('Please enter a name for this location');
        return;
      }
      
      const location = Storage.saveLocation(name, valid.lat, valid.lon, radius);
      UI.closeChangeLocationModal();
      this.stopRefresh();
      this.start(location);
    });

    // Export/Import
    document.getElementById('btn-export').addEventListener('click', () => {
      const data = Storage.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overhead-flights-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          Storage.importData(data);
          alert('Data imported successfully!');
          location.reload();
        } catch (err) {
          alert('Failed to import: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-clear-history').addEventListener('click', () => {
      if (confirm('Clear flight history for all locations? This cannot be undone.')) {
        FlightTracker.clearHistory(true); // true = clear all locations
        this.refresh();
      }
    });

    // Backfill data
    document.getElementById('btn-backfill').addEventListener('click', async () => {
      const btn = document.getElementById('btn-backfill');
      const status = document.getElementById('backfill-status');
      
      btn.disabled = true;
      status.textContent = 'Scanning wider area...';
      UI.setLoading(true);
      
      try {
        // Temporarily expand radius to catch recent flights
        const expandedRadius = Math.min((this.location.radius || 5) * 3, 50); // Up to 3x radius, max 50NM
        const flights = await OpenSkyClient.getStatesAroundPoint(
          this.location.lat,
          this.location.lon,
          expandedRadius
        );
        
        // Filter for flights that were seen recently (within last hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentFlights = flights.filter(f => f.lastContact && f.lastContact >= oneHourAgo);
        
        // Process them through the tracker
        const filtered = recentFlights.filter(f => 
          !f.onGround && 
          (!f.altitude || f.altitude <= this.settings.maxAltitude)
        );
        
        const data = FlightTracker.processFlights(filtered);
        
        // Update UI
        UI.updateStats(data.stats);
        UI.renderCurrentFlight(data.active[0] || null);
        UI.renderHistory(data.history, this.location?.name);
        
        status.textContent = `Found ${recentFlights.length} recent flights, ${data.stats.activeCount} currently in range`;
        setTimeout(() => { status.textContent = ''; }, 5000);
      } catch (err) {
        console.error('Backfill failed:', err);
        status.textContent = 'Backfill failed: ' + err.message;
      } finally {
        btn.disabled = false;
        UI.setLoading(false);
      }
    });

    // Visibility change - pause/resume
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isRunning) {
        this.refresh();
      }
    });
  },

  /**
   * Render locations in settings
   */
  renderSettingsLocations() {
    const container = document.getElementById('settings-locations-list');
    const currentLocEl = document.getElementById('settings-current-location');
    const locations = LocationManager.getSaved();
    
    // Update current location display
    if (this.location) {
      currentLocEl.innerHTML = `
        <div>
          <strong>${this.location.name}</strong>
          <div class="text-muted">${LocationManager.formatCoords(this.location.lat, this.location.lon)} • ${this.location.radius || 5}NM radius</div>
        </div>
      `;
    }
    
    if (locations.length === 0) {
      container.innerHTML = '<p class="text-muted">No saved locations</p>';
      return;
    }
    
    container.innerHTML = locations.map(loc => `
      <div class="settings-location-item">
        <div>
          <strong>${loc.name}</strong>
          <div class="text-muted">${LocationManager.formatCoords(loc.lat, loc.lon)} • ${loc.radius || 5}NM radius</div>
        </div>
        <div>
          <button class="btn btn-small switch-location" data-name="${loc.name}" ${loc.name === this.location?.name ? 'disabled' : ''}>
            ${loc.name === this.location?.name ? 'Active' : 'Switch'}
          </button>
          <button class="btn btn-danger btn-small delete-location" data-name="${loc.name}">Delete</button>
        </div>
      </div>
    `).join('');
    
    // Bind switch buttons
    container.querySelectorAll('.switch-location').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.dataset.name;
        const location = locations.find(l => l.name === name);
        if (location) {
          this.stopRefresh();
          this.start(location);
          UI.closeSettings();
        }
      });
    });
    
    // Bind delete buttons
    container.querySelectorAll('.delete-location').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.dataset.name;
        if (confirm(`Delete "${name}"?`)) {
          LocationManager.delete(name);
          this.renderSettingsLocations();
          if (this.location?.name === name) {
            // If we deleted the active location, go to setup
            this.showSetup();
          }
        }
      });
    });
  }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
