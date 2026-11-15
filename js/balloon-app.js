/**
 * Main Application - Hot Air Balloon Tracker
 * Client-side balloon tracker: one SondeHub snapshot, then the live websocket feed
 * Default location: La Quinta, California
 */

const BalloonApp = {
  settings: null,
  location: null,
  expireTimer: null,
  renderTimer: null,
  isRunning: false,

  // A balloon counts as active while heard within this window (matches the snapshot window).
  ACTIVE_WINDOW_MS: 24 * 60 * 60 * 1000,

  // Default location: La Quinta, California
  DEFAULT_LOCATION: {
    name: 'La Quinta',
    lat: 33.6634,
    lon: -116.3100,
    radius: 200
  },

  async init() {
    console.log('Balloon Tracker initializing...');

    BalloonUI.init();
    this.settings = BalloonStorage.getSettings();

    const urlParams = new URLSearchParams(window.location.search);
    const forceSetup = urlParams.has('setup') || urlParams.has('change-location');

    if (forceSetup || BalloonStorage.isFirstVisit()) {
      this.showSetup();
      if (forceSetup) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else {
      const saved = BalloonLocationManager.getActive();
      if (saved) {
        await this.start(saved);
      } else {
        // Use default La Quinta location on first visit
        const location = BalloonStorage.saveLocation(
          this.DEFAULT_LOCATION.name,
          this.DEFAULT_LOCATION.lat,
          this.DEFAULT_LOCATION.lon,
          this.DEFAULT_LOCATION.radius
        );
        await this.start(location);
      }
    }

    this.bindEvents();
  },

  showSetup() {
    BalloonUI.showSetup();
    this.populateSetupLocations();
  },

  async start(location) {
    this.location = location;
    BalloonLocationManager.setActive(location);
    BalloonUI.updateLocation(location);
    BalloonUI.showMain();

    this.updateLocationUI();

    BalloonTracker.init(this.settings, location);

    // Initialize map
    setTimeout(() => {
      BalloonMap.init(location, location.radius || 200);
    }, 100);

    // One snapshot, then live updates
    await this.loadSnapshot();
    this.startLive();

    BalloonStorage.markVisited();
  },

  updateLocationUI() {
    this.renderLocationDropdown();
    this.renderLocationTabs();
  },

  renderLocationDropdown() {
    const list = document.getElementById('balloon-location-dropdown-list');
    const locations = BalloonLocationManager.getSaved();
    const currentName = this.location?.name;

    const shortName = document.getElementById('balloon-current-loc-short');
    if (shortName) {
      shortName.textContent = currentName || 'Location';
    }

    if (locations.length === 0) {
      list.innerHTML = '<button class="dropdown-item">No saved locations</button>';
      return;
    }

    list.innerHTML = locations.map(loc => `
      <button class="dropdown-item ${loc.name === currentName ? 'active' : ''}" data-location="${loc.name}">
        ${loc.name === currentName ? '\u25CF ' : ''}${loc.name}
      </button>
    `).join('');

    list.querySelectorAll('.dropdown-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.dataset.location;
        if (name && name !== currentName) {
          const location = locations.find(l => l.name === name);
          if (location) {
            this.switchLocation(location);
          }
        }
        BalloonUI.hideLocationDropdown();
      });
    });
  },

  renderLocationTabs() {
    const container = document.getElementById('balloon-location-tabs');
    const locations = BalloonLocationManager.getSaved();
    const currentName = this.location?.name;

    if (locations.length <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = locations.map(loc => `
      <button class="location-tab ${loc.name === currentName ? 'active' : ''}" data-location="${loc.name}">
        <span class="tab-icon">${loc.name === currentName ? '\u25CF' : '\u25CB'}</span>
        ${loc.name}
      </button>
    `).join('');

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

  async switchLocation(location) {
    this.stopLive();

    BalloonTracker.init(this.settings, location);
    const data = BalloonTracker.getDisplayData();

    BalloonUI.updateLocation(location);
    BalloonUI.updateStats(data.stats);
    BalloonUI.renderCurrentBalloon(null);
    BalloonUI.renderHistory(data.history, location.name);

    await this.start(location);
  },

  async loadSnapshot() {
    BalloonUI.setStatus('loading', 'Scanning for balloons...');

    try {
      const balloons = await SondeHubClient.getBalloonsNearby(
        this.location.lat,
        this.location.lon,
        this.location.radius || 200,
        this.ACTIVE_WINDOW_MS / 1000
      );
      this.render(BalloonTracker.processBalloons(balloons.filter(b => this.passesAltitude(b))));
    } catch (err) {
      console.error('Snapshot failed:', err);
      BalloonUI.showError('Failed to fetch balloons: ' + err.message);
    }
  },

  startLive() {
    this.stopLive();
    this.isRunning = true;

    SondeHubClient.connectLive({
      onFrame: balloon => this.onFrame(balloon),
      onStatus: status => this.onLiveStatus(status)
    });

    this.expireTimer = setInterval(() => {
      if (BalloonTracker.expire(this.ACTIVE_WINDOW_MS)) this.scheduleRender();
    }, 60000);
  },

  stopLive() {
    SondeHubClient.disconnectLive();
    clearInterval(this.expireTimer);
    clearTimeout(this.renderTimer);
    this.expireTimer = null;
    this.renderTimer = null;
    this.isRunning = false;
  },

  onFrame(balloon) {
    if (!this.location || !this.passesAltitude(balloon)) return;
    const distance = SondeHubClient.calculateDistanceKm(this.location.lat, this.location.lon, balloon.lat, balloon.lon);
    if (distance > (this.location.radius || 200)) return;
    if (BalloonTracker.ingest(balloon)) this.scheduleRender();
  },

  onLiveStatus(status) {
    this.liveStatus = status;
    if (status === 'live') this.render(BalloonTracker.getDisplayData());
    else if (status === 'reconnecting') BalloonUI.setStatus('loading', 'Reconnecting...');
    else BalloonUI.setStatus('error', 'Live feed unavailable, retrying');
  },

  passesAltitude(balloon) {
    return !this.settings.maxAltitude || !balloon.altitude || balloon.altitude <= this.settings.maxAltitude;
  },

  // Coalesce bursts of frames into one render per second.
  scheduleRender() {
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.render(BalloonTracker.getDisplayData());
    }, 1000);
  },

  render(data) {
    BalloonUI.updateStats(data.stats);
    BalloonUI.renderCurrentBalloon(data.active[0] || null);
    BalloonUI.renderHistory(data.history, this.location?.name);

    if (BalloonMap.map) {
      BalloonMap.updateBalloons(data.active);
      BalloonMap.updateTrails(data.trails);
    }

    if (this.liveStatus === 'live') {
      const n = data.stats.activeCount;
      BalloonUI.setStatus('success', `Live \u2013 ${n} balloon${n !== 1 ? 's' : ''}`);
    }
  },

  populateSetupLocations() {
    const container = document.getElementById('balloon-setup-saved-locations');
    const section = document.getElementById('balloon-setup-saved-section');
    const locations = BalloonLocationManager.getSaved();

    if (locations.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = locations.map(loc => `
      <div class="saved-location-card" data-name="${loc.name}">
        <div>
          <div class="location-name">${loc.name}</div>
          <div class="location-coords">${BalloonLocationManager.formatCoords(loc.lat, loc.lon)} \u2022 ${loc.radius || 200}km radius</div>
        </div>
        <button class="btn btn-primary btn-small use-location">Use</button>
      </div>
    `).join('');
  },

  bindEvents() {
    // Setup wizard - Use Default (La Quinta)
    document.getElementById('balloon-btn-use-default').addEventListener('click', async () => {
      const location = BalloonStorage.saveLocation(
        this.DEFAULT_LOCATION.name,
        this.DEFAULT_LOCATION.lat,
        this.DEFAULT_LOCATION.lon,
        this.DEFAULT_LOCATION.radius
      );
      await this.start(location);
    });

    // Setup wizard - Use My Location
    document.getElementById('balloon-btn-use-location').addEventListener('click', async () => {
      BalloonUI.setLoading(true);
      try {
        const pos = await BalloonLocationManager.getCurrentPosition();
        const geocode = await BalloonLocationManager.reverseGeocode(pos.lat, pos.lon);
        const location = BalloonStorage.saveLocation(geocode.name, pos.lat, pos.lon, 200);
        await this.start(location);
      } catch (err) {
        alert('Could not get location: ' + err.message);
      } finally {
        BalloonUI.setLoading(false);
      }
    });

    // Setup wizard - Search
    document.getElementById('balloon-btn-search-location').addEventListener('click', async () => {
      const query = document.getElementById('balloon-search-query').value.trim();
      if (!query) return;

      BalloonUI.setLoading(true);
      try {
        const result = await BalloonLocationManager.geocode(query);
        const radius = parseFloat(document.getElementById('balloon-manual-radius')?.value) || 200;
        const location = BalloonStorage.saveLocation(result.name, result.lat, result.lon, radius);
        await this.start(location);
      } catch (err) {
        alert('Search failed: ' + err.message);
      } finally {
        BalloonUI.setLoading(false);
      }
    });

    // Setup wizard - Manual entry toggle
    document.getElementById('balloon-btn-manual-coords').addEventListener('click', () => {
      document.getElementById('balloon-manual-coords-form').classList.toggle('hidden');
    });

    // Setup wizard - Save manual coords
    document.getElementById('balloon-btn-save-manual').addEventListener('click', () => {
      const name = document.getElementById('balloon-manual-name').value.trim();
      const lat = document.getElementById('balloon-manual-lat').value;
      const lon = document.getElementById('balloon-manual-lon').value;
      const radius = document.getElementById('balloon-manual-radius').value;

      const valid = BalloonLocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }

      if (!name) {
        alert('Please enter a name for this location');
        return;
      }

      const location = BalloonStorage.saveLocation(name, valid.lat, valid.lon, radius);
      this.start(location);
    });

    // Setup wizard - Use saved location
    document.getElementById('balloon-setup-saved-locations').addEventListener('click', (e) => {
      if (e.target.classList.contains('use-location')) {
        const name = e.target.closest('.saved-location-card').dataset.name;
        const locations = BalloonLocationManager.getSaved();
        const location = locations.find(l => l.name === name);
        if (location) this.start(location);
      }
    });

    // Location dropdown
    document.getElementById('balloon-btn-location-dropdown').addEventListener('click', (e) => {
      e.stopPropagation();
      BalloonUI.toggleLocationDropdown();
    });

    document.getElementById('balloon-btn-add-new-location').addEventListener('click', () => {
      BalloonUI.hideLocationDropdown();
      this.stopLive();
      this.showSetup();
    });

    // Settings dropdown
    document.getElementById('balloon-btn-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      BalloonUI.toggleSettingsDropdown();
    });

    document.addEventListener('click', () => {
      BalloonUI.hideSettingsDropdown();
      BalloonUI.hideLocationDropdown();
    });

    // Settings dropdown items
    document.querySelectorAll('#balloon-settings-dropdown .dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = e.target.dataset.settings;
        BalloonUI.hideSettingsDropdown();
        BalloonUI.openSettings(this.settings, this.location, tab);
        if (tab === 'location') {
          this.renderSettingsLocations();
        }
      });
    });

    document.getElementById('balloon-btn-close-settings').addEventListener('click', () => {
      BalloonUI.closeSettings();
    });

    document.getElementById('balloon-btn-close-settings-x').addEventListener('click', () => {
      BalloonUI.closeSettings();
    });

    document.getElementById('balloon-btn-save-settings').addEventListener('click', () => {
      const formData = BalloonUI.getSettingsFromForm();

      this.settings.maxAltitude = formData.maxAltitude;

      if (this.location && formData.radius !== this.location.radius) {
        this.location.radius = formData.radius;
        BalloonStorage.updateLocationRadius(this.location.name, formData.radius);
        BalloonTracker.setRadius(formData.radius);
        BalloonMap.setRadius(formData.radius);
        BalloonUI.updateLocation(this.location);
      }

      BalloonStorage.saveSettings(this.settings);
      BalloonUI.closeSettings();
      this.render(BalloonTracker.getDisplayData());
    });

    // Location management in settings
    document.getElementById('balloon-btn-add-location').addEventListener('click', () => {
      document.getElementById('balloon-new-location-form').classList.remove('hidden');
    });

    document.getElementById('balloon-btn-save-new-location').addEventListener('click', () => {
      const name = document.getElementById('balloon-new-loc-name').value.trim();
      const lat = document.getElementById('balloon-new-loc-lat').value;
      const lon = document.getElementById('balloon-new-loc-lon').value;
      const radius = document.getElementById('balloon-new-loc-radius').value;

      const valid = BalloonLocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }

      BalloonStorage.saveLocation(name || 'Location', valid.lat, valid.lon, radius);
      this.renderSettingsLocations();
      document.getElementById('balloon-new-location-form').classList.add('hidden');
      document.getElementById('balloon-new-loc-name').value = '';
      document.getElementById('balloon-new-loc-lat').value = '';
      document.getElementById('balloon-new-loc-lon').value = '';
      document.getElementById('balloon-new-loc-radius').value = '200';
    });

    // Change location button in settings
    document.getElementById('balloon-btn-change-location').addEventListener('click', () => {
      BalloonUI.closeSettings();
      BalloonUI.openChangeLocationModal();
    });

    // Change Location Modal
    document.getElementById('balloon-btn-close-change-loc').addEventListener('click', () => {
      BalloonUI.closeChangeLocationModal();
    });

    document.getElementById('balloon-btn-close-change-loc-x').addEventListener('click', () => {
      BalloonUI.closeChangeLocationModal();
    });

    document.getElementById('balloon-btn-change-use-location').addEventListener('click', async () => {
      BalloonUI.setLoading(true);
      try {
        const pos = await BalloonLocationManager.getCurrentPosition();
        const geocode = await BalloonLocationManager.reverseGeocode(pos.lat, pos.lon);
        const location = BalloonStorage.saveLocation(geocode.name, pos.lat, pos.lon, 200);
        BalloonUI.closeChangeLocationModal();
        this.stopLive();
        await this.start(location);
      } catch (err) {
        alert('Could not get location: ' + err.message);
      } finally {
        BalloonUI.setLoading(false);
      }
    });

    document.getElementById('balloon-btn-change-search').addEventListener('click', async () => {
      const query = document.getElementById('balloon-change-search-query').value.trim();
      if (!query) return;

      BalloonUI.setLoading(true);
      try {
        const result = await BalloonLocationManager.geocode(query);
        const location = BalloonStorage.saveLocation(result.name, result.lat, result.lon, 200);
        BalloonUI.closeChangeLocationModal();
        this.stopLive();
        await this.start(location);
      } catch (err) {
        alert('Search failed: ' + err.message);
      } finally {
        BalloonUI.setLoading(false);
      }
    });

    document.getElementById('balloon-btn-change-save').addEventListener('click', () => {
      const name = document.getElementById('balloon-change-loc-name').value.trim();
      const lat = document.getElementById('balloon-change-loc-lat').value;
      const lon = document.getElementById('balloon-change-loc-lon').value;
      const radius = document.getElementById('balloon-change-loc-radius').value;

      const valid = BalloonLocationManager.validateCoords(lat, lon);
      if (!valid.valid) {
        alert(valid.error);
        return;
      }

      if (!name) {
        alert('Please enter a name for this location');
        return;
      }

      const location = BalloonStorage.saveLocation(name, valid.lat, valid.lon, radius);
      BalloonUI.closeChangeLocationModal();
      this.stopLive();
      this.start(location);
    });

    // Export/Import
    document.getElementById('balloon-btn-export').addEventListener('click', () => {
      const data = BalloonStorage.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balloon-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('balloon-btn-import').addEventListener('click', () => {
      document.getElementById('balloon-import-file').click();
    });

    document.getElementById('balloon-import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          BalloonStorage.importData(data);
          alert('Data imported successfully!');
          location.reload();
        } catch (err) {
          alert('Failed to import: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('balloon-btn-clear-history').addEventListener('click', () => {
      if (confirm('Clear balloon history for all locations? This cannot be undone.')) {
        BalloonTracker.clearHistory(true);
        this.render(BalloonTracker.getDisplayData());
      }
    });
  },

  renderSettingsLocations() {
    const container = document.getElementById('balloon-settings-locations-list');
    const currentLocEl = document.getElementById('balloon-settings-current-location');
    const locations = BalloonLocationManager.getSaved();

    if (this.location) {
      currentLocEl.innerHTML = `
        <div>
          <strong>${this.location.name}</strong>
          <div class="text-muted">${BalloonLocationManager.formatCoords(this.location.lat, this.location.lon)} \u2022 ${this.location.radius || 200}km radius</div>
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
          <div class="text-muted">${BalloonLocationManager.formatCoords(loc.lat, loc.lon)} \u2022 ${loc.radius || 200}km radius</div>
        </div>
        <div>
          <button class="btn btn-small switch-location" data-name="${loc.name}" ${loc.name === this.location?.name ? 'disabled' : ''}>
            ${loc.name === this.location?.name ? 'Active' : 'Switch'}
          </button>
          <button class="btn btn-danger btn-small delete-location" data-name="${loc.name}">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.switch-location').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.dataset.name;
        const location = locations.find(l => l.name === name);
        if (location) {
          this.stopLive();
          this.start(location);
          BalloonUI.closeSettings();
        }
      });
    });

    container.querySelectorAll('.delete-location').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.dataset.name;
        if (confirm(`Delete "${name}"?`)) {
          BalloonLocationManager.delete(name);
          this.renderSettingsLocations();
          if (this.location?.name === name) {
            this.showSetup();
          }
        }
      });
    });
  }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  BalloonApp.init();
});
