/**
 * UI Manager - Handles rendering and DOM manipulation
 */

const UI = {
  elements: {},

  init() {
    // Cache DOM elements
    this.elements = {
      // Sections
      setupWizard: document.getElementById('setup-wizard'),
      mainApp: document.getElementById('main-app'),
      
      // Location
      locationName: document.getElementById('location-name'),
      locationCoords: document.getElementById('location-coords'),
      locationSelect: document.getElementById('location-select'),
      savedLocations: document.getElementById('saved-locations'),
      
      // Stats
      activeCount: document.getElementById('active-count'),
      todayCount: document.getElementById('today-count'),
      closestToday: document.getElementById('closest-today'),
      avgAltitude: document.getElementById('avg-altitude'),
      lastUpdate: document.getElementById('last-update'),
      
      // Flight lists
      currentFlight: document.getElementById('current-flight'),
      activeFlights: document.getElementById('active-flights'),
      flightHistory: document.getElementById('flight-history'),
      
      // Status
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      
      // Settings
      settingsModal: document.getElementById('settings-modal'),
      refreshInterval: document.getElementById('setting-refresh'),
      maxDistance: document.getElementById('setting-distance'),
      maxAltitude: document.getElementById('setting-altitude'),
      nightPause: document.getElementById('setting-night-pause'),
      nightStart: document.getElementById('setting-night-start'),
      nightEnd: document.getElementById('setting-night-end')
    };
  },

  /**
   * Show/hide setup wizard
   */
  showSetup() {
    this.elements.setupWizard.classList.remove('hidden');
    this.elements.mainApp.classList.add('hidden');
  },

  showMain() {
    this.elements.setupWizard.classList.add('hidden');
    this.elements.mainApp.classList.remove('hidden');
  },

  /**
   * Update location display
   */
  updateLocation(location) {
    this.elements.locationName.textContent = location.name || 'Current Location';
    this.elements.locationCoords.textContent = LocationManager.formatCoords(location.lat, location.lon);
  },

  /**
   * Render saved locations dropdown
   */
  renderLocationSelect(locations, active) {
    const select = this.elements.locationSelect;
    select.innerHTML = '<option value="">Switch location...</option>';
    
    locations.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc.name;
      option.textContent = loc.name;
      option.selected = active && loc.name === active.name;
      select.appendChild(option);
    });
    
    // Add manage option
    const manage = document.createElement('option');
    manage.value = '__manage';
    manage.textContent = '⚙️ Manage locations...';
    select.appendChild(manage);
  },

  /**
   * Update statistics
   */
  updateStats(stats) {
    this.elements.activeCount.textContent = stats.activeCount;
    this.elements.todayCount.textContent = stats.todayCount;
    this.elements.closestToday.textContent = stats.closestToday ? `${stats.closestToday} NM` : '--';
    this.elements.avgAltitude.textContent = stats.avgAltitude ? `${stats.avgAltitude.toLocaleString()} ft` : '--';
    this.elements.lastUpdate.textContent = new Date().toLocaleTimeString();
  },

  /**
   * Render current closest flight (hero section)
   */
  renderCurrentFlight(flight) {
    if (!flight) {
      this.elements.currentFlight.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✈️</div>
          <p>No aircraft currently overhead</p>
          <p class="empty-sub">Waiting for flights within range...</p>
        </div>
      `;
      return;
    }

    const altitude = flight.currentAltitude ? `${flight.currentAltitude.toLocaleString()} ft` : 'Unknown';
    const speed = flight.currentSpeed ? `${flight.currentSpeed} kts` : 'Unknown';
    const heading = flight.currentHeading || 0;
    
    this.elements.currentFlight.innerHTML = `
      <div class="flight-hero">
        <div class="flight-hero-main">
          <div class="flight-icon" style="transform: rotate(${heading}deg)">✈️</div>
          <div class="flight-primary">
            <div class="flight-callsign">${flight.callsign}</div>
            <div class="flight-icao">${flight.icao}</div>
          </div>
        </div>
        <div class="flight-hero-details">
          <div class="detail">
            <span class="detail-value">${flight.currentDistance.toFixed(1)}</span>
            <span class="detail-unit">NM</span>
            <span class="detail-label">Distance</span>
          </div>
          <div class="detail">
            <span class="detail-value">${flight.currentDirection}</span>
            <span class="detail-label">Direction</span>
          </div>
          <div class="detail">
            <span class="detail-value">${altitude}</span>
            <span class="detail-label">Altitude</span>
          </div>
          <div class="detail">
            <span class="detail-value">${speed}</span>
            <span class="detail-label">Speed</span>
          </div>
        </div>
        <div class="flight-meta">
          <span class="country">${flight.country}</span>
          <span class="tracking-time">Tracking for ${this.formatDuration(Date.now() - flight.firstSeen)}</span>
        </div>
      </div>
    `;
  },

  /**
   * Render active flights list
   */
  renderActiveFlights(flights) {
    if (flights.length === 0) {
      this.elements.activeFlights.innerHTML = '<p class="empty-list">No active flights in range</p>';
      return;
    }

    this.elements.activeFlights.innerHTML = flights.slice(1).map(f => `
      <div class="flight-row" data-icao="${f.icao}">
        <span class="row-callsign">${f.callsign}</span>
        <span class="row-distance">${f.currentDistance.toFixed(1)} NM</span>
        <span class="row-direction">${f.currentDirection}</span>
        <span class="row-altitude">${f.currentAltitude ? f.currentAltitude.toLocaleString() + ' ft' : '--'}</span>
        <span class="row-country">${f.country}</span>
      </div>
    `).join('');
  },

  /**
   * Render flight history table
   */
  renderHistory(flights) {
    if (flights.length === 0) {
      this.elements.flightHistory.innerHTML = `
        <tr><td colspan="6" class="empty-table">No flights recorded yet</td></tr>
      `;
      return;
    }

    this.elements.flightHistory.innerHTML = flights.map(f => `
      <tr>
        <td class="col-time">${new Date(f.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
        <td class="col-callsign">${f.callsign}</td>
        <td class="col-icao">${f.icao}</td>
        <td class="col-closest">${f.closestDistance.toFixed(1)} NM ${f.closestDirection}</td>
        <td class="col-altitude">${f.closestAltitude ? f.closestAltitude.toLocaleString() + ' ft' : '--'}</td>
        <td class="col-country">${f.country}</td>
      </tr>
    `).join('');
  },

  /**
   * Update status indicator
   */
  setStatus(status, message) {
    const indicator = this.elements.statusIndicator;
    const text = this.elements.statusText;
    
    indicator.className = 'status-indicator ' + status;
    text.textContent = message || status;
  },

  /**
   * Show error message
   */
  showError(message) {
    this.setStatus('error', message);
    setTimeout(() => this.setStatus('idle', 'Ready'), 5000);
  },

  /**
   * Format duration in ms to readable string
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  },

  /**
   * Format timestamp to time string
   */
  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * Settings modal
   */
  openSettings(settings) {
    this.elements.refreshInterval.value = settings.refreshInterval;
    this.elements.maxDistance.value = settings.maxDistance;
    this.elements.maxAltitude.value = settings.maxAltitude;
    this.elements.nightPause.checked = settings.nightPause;
    this.elements.nightStart.value = settings.nightStart;
    this.elements.nightEnd.value = settings.nightEnd;
    
    this.elements.settingsModal.classList.remove('hidden');
  },

  closeSettings() {
    this.elements.settingsModal.classList.add('hidden');
  },

  getSettingsFromForm() {
    return {
      refreshInterval: parseInt(this.elements.refreshInterval.value, 10),
      maxDistance: parseFloat(this.elements.maxDistance.value),
      maxAltitude: parseInt(this.elements.maxAltitude.value, 10),
      nightPause: this.elements.nightPause.checked,
      nightStart: this.elements.nightStart.value,
      nightEnd: this.elements.nightEnd.value
    };
  },

  /**
   * Toggle loading state
   */
  setLoading(loading) {
    document.body.classList.toggle('loading', loading);
  }
};

// Expose globally
window.UI = UI;
