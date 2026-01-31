/**
 * Main Application - Overhead Flights
 * Client-side flight tracker using OpenSky Network API
 */

const App = {
  settings: null,
  location: null,
  refreshTimer: null,
  isRunning: false,

  async init() {
    console.log('🛫 Overhead Flights initializing...');
    
    UI.init();
    this.settings = Storage.getSettings();
    
    // Check if first visit
    if (Storage.isFirstVisit()) {
      this.showSetup();
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
    
    FlightTracker.init(this.settings, location);
    
    // Update UI
    this.updateLocationSelect();
    
    // Initial fetch
    await this.refresh();
    
    // Start auto-refresh
    this.startRefresh();
    
    Storage.markVisited();
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
        return;
      }
      
      const flights = await OpenSkyClient.getStatesAroundPoint(
        this.location.lat, 
        this.location.lon, 
        this.settings.maxDistance * 2 // Fetch wider to catch approaching flights
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
      UI.renderActiveFlights(data.active);
      UI.renderHistory(data.history);
      
      UI.setStatus('success', `Updated - ${data.active.length} flights`);
      
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
    
    this.refreshTimer = setInterval(() => {
      if (!document.hidden) { // Don't fetch when tab is hidden
        this.refresh();
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
    this.isRunning = false;
  },

  /**
   * Update location dropdown
   */
  updateLocationSelect() {
    const locations = LocationManager.getSaved();
    UI.renderLocationSelect(locations, this.location);
  },

  /**
   * Populate setup saved locations
   */
  populateSetupLocations() {
    const container = document.getElementById('setup-saved-locations');
    const locations = LocationManager.getSaved();
    
    if (locations.length === 0) {
      container.innerHTML = '<p class="text-muted">No saved locations yet</p>';
      return;
    }
    
    container.innerHTML = locations.map(loc => `
      <div class="saved-location-card" data-name="${loc.name}">
        <div class="location-name">${loc.name}</div>
        <div class="location-coords">${LocationManager.formatCoords(loc.lat, loc.lon)}</div>
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
        
        const location = LocationManager.save(geocode.name, pos.lat, pos.lon);
        await this.start(location);
      } catch (err) {
        alert('Could not get location: ' + err.message);
      } finally {
        UI.setLoading(false);
      }
    });

    // Setup wizard - Manual entry
    document.getElementById('btn-manual-coords').addEventListener('click', () => {
      document.getElementById('manual-coords-form').classList.toggle('hidden');
    });

    document.getElementById('btn-save-manual').addEventListener('click', () => {
      const name = document.getElementById('manual-name').value.trim();
      const lat = document.getElementById('manual-lat').value;
      const lon = document.getElementById('manual-lon').value;
      
      const valid = LocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }
      
      if (!name) {
        alert('Please enter a name for this location');
        return;
      }
      
      const location = LocationManager.save(name, valid.lat, valid.lon);
      this.start(location);
    });

    // Setup wizard - Search
    document.getElementById('btn-search-location').addEventListener('click', async () => {
      const query = document.getElementById('search-query').value.trim();
      if (!query) return;
      
      UI.setLoading(true);
      try {
        const result = await LocationManager.geocode(query);
        const location = LocationManager.save(result.name, result.lat, result.lon);
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

    // Location switcher
    document.getElementById('location-select').addEventListener('change', (e) => {
      const value = e.target.value;
      if (!value) return;
      
      if (value === '__manage') {
        UI.openSettings(this.settings);
        document.getElementById('settings-tab').value = 'locations';
        this.switchSettingsTab('locations');
        e.target.value = '';
        return;
      }
      
      const locations = LocationManager.getSaved();
      const location = locations.find(l => l.name === value);
      if (location) {
        this.stopRefresh();
        this.start(location);
      }
    });

    // Manual refresh
    document.getElementById('btn-refresh').addEventListener('click', () => {
      this.refresh();
    });

    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => {
      UI.openSettings(this.settings);
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      UI.closeSettings();
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      this.settings = UI.getSettingsFromForm();
      Storage.saveSettings(this.settings);
      UI.closeSettings();
      this.startRefresh(); // Restart with new interval
      this.refresh();
    });

    // Settings tabs
    document.getElementById('settings-tab').addEventListener('change', (e) => {
      this.switchSettingsTab(e.target.value);
    });

    // Location management in settings
    document.getElementById('btn-add-location').addEventListener('click', () => {
      document.getElementById('new-location-form').classList.remove('hidden');
    });

    document.getElementById('btn-save-new-location').addEventListener('click', () => {
      const name = document.getElementById('new-loc-name').value.trim();
      const lat = document.getElementById('new-loc-lat').value;
      const lon = document.getElementById('new-loc-lon').value;
      
      const valid = LocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }
      
      LocationManager.save(name || 'Location', valid.lat, valid.lon);
      this.renderSettingsLocations();
      document.getElementById('new-location-form').classList.add('hidden');
      document.getElementById('new-loc-name').value = '';
      document.getElementById('new-loc-lat').value = '';
      document.getElementById('new-loc-lon').value = '';
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
      if (confirm('Clear all flight history? This cannot be undone.')) {
        FlightTracker.clearHistory();
        this.refresh();
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
   * Switch settings tab
   */
  switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    
    if (tab === 'locations') {
      this.renderSettingsLocations();
    }
  },

  /**
   * Render locations in settings
   */
  renderSettingsLocations() {
    const container = document.getElementById('settings-locations-list');
    const locations = LocationManager.getSaved();
    
    if (locations.length === 0) {
      container.innerHTML = '<p class="text-muted">No saved locations</p>';
      return;
    }
    
    container.innerHTML = locations.map(loc => `
      <div class="settings-location-item">
        <div>
          <strong>${loc.name}</strong>
          <div class="text-muted">${LocationManager.formatCoords(loc.lat, loc.lon)}</div>
        </div>
        <button class="btn btn-danger btn-small delete-location" data-name="${loc.name}">Delete</button>
      </div>
    `).join('');
    
    container.querySelectorAll('.delete-location').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.dataset.name;
        if (confirm(`Delete "${name}"?`)) {
          LocationManager.delete(name);
          this.renderSettingsLocations();
          this.updateLocationSelect();
        }
      });
    });
  }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
