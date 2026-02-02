/**
 * UI Manager - Handles rendering and DOM manipulation
 */

const UI = {
  elements: {},
  countdownTimer: null,
  countdownValue: 0,

  /**
   * Get FlightAware URL for a callsign
   */
  getFlightAwareUrl(callsign) {
    if (!callsign || callsign.trim().length < 3 || callsign === 'Unknown') {
      return null;
    }
    return `https://www.flightaware.com/live/flight/${encodeURIComponent(callsign.trim())}`;
  },

  /**
   * Render callsign as link if valid, otherwise plain text
   */
  renderCallsignLink(callsign, className = '') {
    const url = this.getFlightAwareUrl(callsign);
    const displayText = callsign || 'Unknown';
    
    if (url) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="flight-link ${className}" title="View flight history on FlightAware">${displayText}</a>`;
    }
    return `<span class="${className}">${displayText}</span>`;
  },

  init() {
    // Cache DOM elements
    this.elements = {
      // Sections
      setupWizard: document.getElementById('setup-wizard'),
      mainApp: document.getElementById('main-app'),
      
      // Location
      locationName: document.getElementById('location-name'),
      detectionRadius: document.getElementById('detection-radius'),
      
      // Stats
      activeCount: document.getElementById('active-count'),
      todayCount: document.getElementById('today-count'),
      closestToday: document.getElementById('closest-today'),
      avgAltitude: document.getElementById('avg-altitude'),
      lastUpdate: document.getElementById('last-update'),
      refreshIntervalDisplay: document.getElementById('refresh-interval-display'),
      
      // Flight display
      currentFlightCard: document.getElementById('current-flight-card'),
      flightHistory: document.getElementById('flight-history'),
      
      // Status
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      
      // Settings
      settingsModal: document.getElementById('settings-modal'),
      refreshInterval: document.getElementById('setting-refresh'),
      maxAltitude: document.getElementById('setting-altitude'),
      nightPause: document.getElementById('setting-night-pause'),
      nightStart: document.getElementById('setting-night-start'),
      nightEnd: document.getElementById('setting-night-end'),
      settingRadius: document.getElementById('setting-radius'),
      nextUpdateCountdown: document.getElementById('next-update-countdown'),
      settingsDropdown: document.getElementById('settings-dropdown')
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
    this.elements.detectionRadius.textContent = location.radius || 5;
    
    // Update flight history header with location name
    const historyLocationEl = document.getElementById('history-location-name');
    if (historyLocationEl) {
      historyLocationEl.textContent = location.name ? `• ${location.name}` : '';
    }
  },

  /**
   * Update statistics
   */
  updateStats(stats) {
    this.elements.activeCount.textContent = stats.activeCount;
    this.elements.todayCount.textContent = stats.todayCount;
    this.elements.closestToday.textContent = stats.closestToday || '--';
    this.elements.avgAltitude.textContent = stats.avgAltitude ? `${stats.avgAltitude.toLocaleString()} ft` : '--';
    this.elements.lastUpdate.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  /**
   * Render current closest flight (hero section)
   */
  renderCurrentFlight(flight) {
    const card = this.elements.currentFlightCard;
    
    if (!flight) {
      card.className = 'current-flight';
      card.innerHTML = `
        <div class="waiting-state">
          <div class="radar">
            <div class="radar-sweep"></div>
          </div>
          <p>No aircraft currently in range</p>
          <p style="font-size: 13px; margin-top: 8px;">Updates every <span id="refresh-interval-display">${this.elements.refreshIntervalDisplay?.textContent || '90'}</span> seconds</p>
        </div>
      `;
      return;
    }

    const isOverhead = flight.currentDistance < 1;
    card.className = `current-flight ${isOverhead ? 'overhead' : 'detected'}`;

    const altitude = flight.currentAltitude ? `${flight.currentAltitude.toLocaleString()} ft` : 'Unknown';
    const speed = flight.currentSpeed ? `${flight.currentSpeed} kts` : 'Unknown';
    const heading = flight.currentHeading || 0;
    const flightType = this.getFlightType(flight.callsign, flight.category);
    const callsignLink = this.renderCallsignLink(flight.callsign, 'current-flight-link');
    
    card.innerHTML = `
      <div class="flight-header">
        <div class="flight-main">
          <div class="flight-icon" style="transform: rotate(${heading}deg)">✈️</div>
          <div class="flight-title">
            <h2>${callsignLink}</h2>
            <div class="flight-meta">
              <span class="aircraft-type">${flight.icao}</span>
              <span class="flight-type-badge type-${flightType.toLowerCase()}">${flightType}</span>
            </div>
          </div>
        </div>
        <div class="status-badge ${isOverhead ? 'tracking' : 'waiting'}">
          ${isOverhead ? '<span class="pulse"></span> Overhead' : `${flight.currentDistance.toFixed(1)} NM away`}
        </div>
      </div>
      <div class="flight-stats">
        <div class="flight-stat">
          <div class="flight-stat-value ${flight.currentDistance < 2 ? 'close' : ''}">${flight.currentDistance.toFixed(1)}</div>
          <div class="flight-stat-label">Distance (NM)</div>
        </div>
        <div class="flight-stat">
          <div class="flight-stat-value">${flight.currentDirection}</div>
          <div class="flight-stat-label">Direction</div>
        </div>
        <div class="flight-stat">
          <div class="flight-stat-value">${altitude}</div>
          <div class="flight-stat-label">Altitude</div>
        </div>
        <div class="flight-stat">
          <div class="flight-stat-value">${speed}</div>
          <div class="flight-stat-label">Speed</div>
        </div>
      </div>
    `;
    
    // Don't overwrite the map section - it's outside this card
  },

  /**
   * Determine flight type based on callsign and category
   */
  getFlightType(callsign, category) {
    if (!callsign) return 'Private';
    
    const cs = callsign.trim().toUpperCase();
    
    // US-registered civil aircraft (N-number) - Private/General Aviation
    if (/^N[0-9]{1,5}[A-Z]{0,2}$/.test(cs)) return 'Private';
    
    // Canadian civil aircraft (C-Gxxx, C-Fxxx)
    if (/^C-[FG][A-Z0-9]{4}$/.test(cs)) return 'Private';
    
    // UK/Other civilian registrations starting with single letter (G-ABCD, D-ABCD, etc)
    if (/^[A-Z]-[A-Z]{4}$/.test(cs)) return 'Private';
    
    // Short callsigns (less than 3 chars) are typically private/military
    if (cs.length < 3) return 'Private';
    
    // Cargo airline prefixes
    const cargoPrefixes = ['FDX', 'UPS', 'DHL', 'ABX', 'ATI', 'GTI', 'CWC', 'CLX', 'NCA', 'PAC', 'QTR', 'CKS', 'ABW', 'BOX', 'BCS', 'ASL'];
    if (cargoPrefixes.some(prefix => cs.startsWith(prefix))) return 'Cargo';
    
    // Light aircraft categories (OpenSky: 1=Light, 2=Small, 6=High performance, 7=Rotorcraft, etc)
    if ([1, 2, 6, 7, 8, 9, 10, 11, 13].includes(category)) return 'Private';
    
    // Commercial flights typically have 3-4 letter airline code + numbers (e.g., "AAL1234", "UAL12")
    // Check if it matches commercial airline pattern
    if (/^[A-Z]{3}\d{1,4}$/.test(cs) || /^[A-Z]{2}\d{1,4}$/.test(cs)) return 'Commercial';
    
    // Default to private for anything else that doesn't look commercial
    // (e.g., single letter + numbers like "N297PL" which doesn't match N-number pattern above due to letter suffix)
    if (/^[A-Z]\d/.test(cs) && cs.length < 7) return 'Private';
    
    return 'Commercial';
  },

  /**
   * Render flight history table
   */
  renderHistory(flights, locationName) {
    if (flights.length === 0) {
      const locationText = locationName ? ` at ${locationName}` : '';
      this.elements.flightHistory.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">
            📡 No flights detected yet${locationText}
          </td>
        </tr>
      `;
      return;
    }

    this.elements.flightHistory.innerHTML = flights.map(f => {
      const flightType = this.getFlightType(f.callsign, f.category);
      const isActive = f.isActive;
      const time = isActive 
        ? '<span class="active-badge">● Now</span>'
        : new Date(f.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' PT';
      const callsignLink = this.renderCallsignLink(f.callsign, 'flight-number');
      const historyLink = this.getFlightAwareUrl(f.callsign) 
        ? `<a href="${this.getFlightAwareUrl(f.callsign)}" target="_blank" rel="noopener noreferrer" class="history-link" title="View on FlightAware">📊 History</a>`
        : '<span class="history-link disabled">—</span>';
      
      // For active flights, show current distance; for history, show closest
      const distanceDisplay = isActive && f.currentDistance 
        ? `<span class="distance-active">${f.currentDistance.toFixed(1)} NM</span>`
        : `${f.closestDistance.toFixed(1)} NM`;
      
      return `
        <tr class="${isActive ? 'flight-active' : ''}">
          <td>
            <div class="flight-cell">
              <div class="flight-icon-small flight-type-${flightType.toLowerCase()}">✈️</div>
              <div class="flight-info">
                ${callsignLink}
                <span class="flight-route">${f.icao} • ${f.country}</span>
              </div>
            </div>
          </td>
          <td><span class="flight-type-badge type-${flightType.toLowerCase()}">${flightType}</span></td>
          <td class="col-distance">${distanceDisplay}</td>
          <td class="col-altitude">${f.closestAltitude ? f.closestAltitude.toLocaleString() + ' ft' : '--'}</td>
          <td>--</td>
          <td class="col-time">${time}</td>
          <td class="col-history">${historyLink}</td>
        </tr>
      `;
    }).join('');
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
  openSettings(settings, location, tab = 'general') {
    this.elements.refreshInterval.value = settings.refreshInterval;
    this.elements.maxAltitude.value = settings.maxAltitude;
    this.elements.nightPause.checked = settings.nightPause;
    this.elements.nightStart.value = settings.nightStart;
    this.elements.nightEnd.value = settings.nightEnd;
    
    if (location) {
      this.elements.settingRadius.value = location.radius || 5;
    }
    
    // Set and show the requested tab
    document.getElementById('settings-tab').value = tab;
    this.switchSettingsTab(tab);
    
    document.getElementById('settings-modal').classList.remove('hidden');
  },

  closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  },

  getSettingsFromForm() {
    return {
      refreshInterval: parseInt(this.elements.refreshInterval.value, 10),
      maxAltitude: parseInt(this.elements.maxAltitude.value, 10),
      nightPause: this.elements.nightPause.checked,
      nightStart: this.elements.nightStart.value,
      nightEnd: this.elements.nightEnd.value,
      radius: parseFloat(this.elements.settingRadius.value) || 5
    };
  },

  /**
   * Toggle loading state
   */
  setLoading(loading) {
    document.body.classList.toggle('loading', loading);
  },

  /**
   * Switch settings tab
   */
  switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(el => el.classList.add('hidden'));
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.remove('hidden');
    document.getElementById('settings-tab').value = tab;
  },

  /**
   * Toggle settings dropdown
   */
  toggleSettingsDropdown() {
    this.elements.settingsDropdown.classList.toggle('hidden');
  },

  hideSettingsDropdown() {
    this.elements.settingsDropdown.classList.add('hidden');
  },

  /**
   * Start countdown timer for next update
   */
  startCountdown(intervalSeconds) {
    this.stopCountdown();
    this.countdownValue = intervalSeconds;
    this.updateCountdownDisplay();
    
    this.countdownTimer = setInterval(() => {
      this.countdownValue--;
      if (this.countdownValue < 0) {
        this.countdownValue = intervalSeconds;
      }
      this.updateCountdownDisplay();
    }, 1000);
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  updateCountdownDisplay() {
    if (this.elements.nextUpdateCountdown) {
      this.elements.nextUpdateCountdown.textContent = this.countdownValue;
    }
  },

  setCountdownPaused(paused) {
    if (this.elements.nextUpdateCountdown) {
      this.elements.nextUpdateCountdown.classList.toggle('paused', paused);
    }
  },

  /**
   * Open change location modal
   */
  openChangeLocationModal() {
    document.getElementById('change-location-modal').classList.remove('hidden');
  },

  closeChangeLocationModal() {
    document.getElementById('change-location-modal').classList.add('hidden');
  }
};

// Expose globally
window.UI = UI;
