/**
 * Balloon UI Manager - Handles rendering and DOM manipulation for balloon tracker
 */

const BalloonUI = {
  elements: {},
  countdownTimer: null,
  countdownValue: 0,

  /**
   * Get SondeHub tracker URL for a balloon
   */
  getSondeHubUrl(serial) {
    return SondeHubClient.getTrackerUrl(serial);
  },

  /**
   * Render serial as link if valid
   */
  renderSerialLink(serial, className = '') {
    const url = this.getSondeHubUrl(serial);
    const displayText = serial || 'Unknown';

    if (url) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="balloon-link ${className}" title="View on SondeHub Tracker">${displayText}</a>`;
    }
    return `<span class="${className}">${displayText}</span>`;
  },

  init() {
    this.elements = {
      // Sections
      setupWizard: document.getElementById('balloon-setup-wizard'),
      mainApp: document.getElementById('balloon-main-app'),

      // Location
      locationName: document.getElementById('balloon-location-name'),
      detectionRadius: document.getElementById('balloon-detection-radius'),

      // Stats
      activeCount: document.getElementById('balloon-active-count'),
      todayCount: document.getElementById('balloon-today-count'),
      closestToday: document.getElementById('balloon-closest-today'),
      avgAltitude: document.getElementById('balloon-avg-altitude'),
      lastUpdate: document.getElementById('balloon-last-update'),
      refreshIntervalDisplay: document.getElementById('balloon-refresh-interval-display'),

      // Balloon display
      currentBalloonCard: document.getElementById('current-balloon-card'),
      balloonHistory: document.getElementById('balloon-history'),

      // Status
      statusIndicator: document.getElementById('balloon-status-indicator'),
      statusText: document.getElementById('balloon-status-text'),

      // Settings
      settingsModal: document.getElementById('balloon-settings-modal'),
      refreshInterval: document.getElementById('balloon-setting-refresh'),
      maxAltitude: document.getElementById('balloon-setting-altitude'),
      settingRadius: document.getElementById('balloon-setting-radius'),
      nextUpdateCountdown: document.getElementById('balloon-next-update-countdown'),
      settingsDropdown: document.getElementById('balloon-settings-dropdown')
    };
  },

  showSetup() {
    this.elements.setupWizard.classList.remove('hidden');
    this.elements.mainApp.classList.add('hidden');
  },

  showMain() {
    this.elements.setupWizard.classList.add('hidden');
    this.elements.mainApp.classList.remove('hidden');
  },

  updateLocation(location) {
    this.elements.locationName.textContent = location.name || 'Current Location';
    this.elements.detectionRadius.textContent = location.radius || 200;

    const historyLocationEl = document.getElementById('balloon-history-location-name');
    if (historyLocationEl) {
      historyLocationEl.textContent = location.name ? `\u2022 ${location.name}` : '';
    }
  },

  updateStats(stats) {
    this.elements.activeCount.textContent = stats.activeCount;
    this.elements.todayCount.textContent = stats.todayCount;
    this.elements.closestToday.textContent = stats.closestToday ? `${stats.closestToday} km` : '--';
    this.elements.avgAltitude.textContent = stats.avgAltitude ? `${stats.avgAltitude.toLocaleString()} m` : '--';
    this.elements.lastUpdate.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  /**
   * Render current closest balloon (hero section)
   */
  renderCurrentBalloon(balloon) {
    const card = this.elements.currentBalloonCard;

    if (!balloon) {
      card.className = 'current-balloon';
      card.innerHTML = `
        <div class="waiting-state">
          <div class="radar">
            <div class="radar-sweep"></div>
          </div>
          <p>Scanning for balloons...</p>
          <p style="font-size: 13px; margin-top: 8px;">Updates every <span id="balloon-refresh-interval-display">${this.elements.refreshIntervalDisplay?.textContent || '120'}</span> seconds</p>
        </div>
      `;
      return;
    }

    const isNearby = balloon.currentDistance < 50;
    card.className = `current-balloon ${isNearby ? 'nearby' : 'detected'}`;

    const altitudeM = balloon.currentAltitude != null ? `${balloon.currentAltitude.toLocaleString()} m` : 'Unknown';
    const altitudeFt = balloon.currentAltitudeFt != null ? `${balloon.currentAltitudeFt.toLocaleString()} ft` : '';
    const speedKmh = balloon.currentVelH != null ? `${(balloon.currentVelH * 3.6).toFixed(1)} km/h` : 'Unknown';
    const vertRate = balloon.currentVelV != null ? `${balloon.currentVelV > 0 ? '+' : ''}${balloon.currentVelV.toFixed(1)} m/s` : '--';
    const serialLink = this.renderSerialLink(balloon.serial, 'current-balloon-link');

    card.innerHTML = `
      <div class="flight-header">
        <div class="flight-main">
          <div class="balloon-icon-hero">\u{1F388}</div>
          <div class="flight-title">
            <h2>${serialLink}</h2>
            <div class="flight-meta">
              <span class="aircraft-type">${balloon.type || balloon.manufacturer || 'Amateur Balloon'}</span>
              ${balloon.frequency ? `<span class="freq-badge">${balloon.frequency} MHz</span>` : ''}
            </div>
          </div>
        </div>
        <div class="status-badge ${isNearby ? 'tracking' : 'waiting'}">
          ${isNearby ? '<span class="pulse"></span> Nearby' : `${balloon.currentDistance.toFixed(0)} km away`}
        </div>
      </div>
      <div class="flight-stats">
        <div class="flight-stat">
          <div class="flight-stat-value ${balloon.currentDistance < 100 ? 'close' : ''}">${balloon.currentDistance.toFixed(0)}</div>
          <div class="flight-stat-label">Distance (km)</div>
        </div>
        <div class="flight-stat">
          <div class="flight-stat-value">${balloon.currentDirection}</div>
          <div class="flight-stat-label">Direction</div>
        </div>
        <div class="flight-stat">
          <div class="flight-stat-value">${altitudeM}</div>
          <div class="flight-stat-label">Altitude${altitudeFt ? ` (${altitudeFt})` : ''}</div>
        </div>
        <div class="flight-stat">
          <div class="flight-stat-value">${speedKmh}</div>
          <div class="flight-stat-label">Speed</div>
        </div>
        <div class="flight-stat">
          <div class="flight-stat-value">${vertRate}</div>
          <div class="flight-stat-label">Vert Rate</div>
        </div>
      </div>
    `;
  },

  /**
   * Render balloon history table
   */
  renderHistory(balloons, locationName) {
    if (balloons.length === 0) {
      const locationText = locationName ? ` near ${locationName}` : '';
      this.elements.balloonHistory.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">
            \u{1F388} No balloons detected yet${locationText}
          </td>
        </tr>
      `;
      return;
    }

    this.elements.balloonHistory.innerHTML = balloons.map(b => {
      const isActive = b.isActive;
      const time = isActive
        ? '<span class="active-badge">\u25CF Now</span>'
        : new Date(b.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const serialLink = this.renderSerialLink(b.serial, 'balloon-serial');
      const trackerLink = this.getSondeHubUrl(b.serial)
        ? `<a href="${this.getSondeHubUrl(b.serial)}" target="_blank" rel="noopener noreferrer" class="history-link" title="View on SondeHub">\u{1F4CA} Track</a>`
        : '<span class="history-link disabled">\u2014</span>';

      const distanceDisplay = isActive && b.currentDistance
        ? `<span class="distance-active">${b.currentDistance.toFixed(0)} km</span>`
        : `${b.closestDistance.toFixed(0)} km`;

      const altDisplay = b.closestAltitude != null
        ? `${b.closestAltitude.toLocaleString()} m`
        : '--';

      return `
        <tr class="${isActive ? 'balloon-active' : ''}">
          <td>
            <div class="flight-cell">
              <div class="balloon-icon-small">\u{1F388}</div>
              <div class="flight-info">
                ${serialLink}
                <span class="flight-route">${b.type || b.manufacturer || 'Balloon'}${b.frequency ? ` \u2022 ${b.frequency} MHz` : ''}</span>
              </div>
            </div>
          </td>
          <td class="col-distance">${distanceDisplay}</td>
          <td class="col-altitude">${altDisplay}</td>
          <td class="col-time">${time}</td>
          <td class="col-history">${trackerLink}</td>
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

  showError(message) {
    this.setStatus('error', message);
    setTimeout(() => this.setStatus('idle', 'Ready'), 5000);
  },

  /**
   * Settings modal
   */
  openSettings(settings, location, tab = 'general') {
    this.elements.refreshInterval.value = settings.refreshInterval;
    this.elements.maxAltitude.value = settings.maxAltitude;

    if (location) {
      this.elements.settingRadius.value = location.radius || 200;
    }

    document.getElementById('balloon-settings-tab').value = tab;
    this.switchSettingsTab(tab);
    document.getElementById('balloon-settings-modal').classList.remove('hidden');
  },

  closeSettings() {
    document.getElementById('balloon-settings-modal').classList.add('hidden');
  },

  getSettingsFromForm() {
    return {
      refreshInterval: parseInt(this.elements.refreshInterval.value, 10),
      maxAltitude: parseInt(this.elements.maxAltitude.value, 10),
      radius: parseFloat(this.elements.settingRadius.value) || 200
    };
  },

  setLoading(loading) {
    document.body.classList.toggle('loading', loading);
  },

  switchSettingsTab(tab) {
    document.querySelectorAll('.balloon-settings-tab').forEach(el => el.classList.add('hidden'));
    const tabEl = document.getElementById(`balloon-tab-${tab}`);
    if (tabEl) tabEl.classList.remove('hidden');
    document.getElementById('balloon-settings-tab').value = tab;
  },

  toggleSettingsDropdown() {
    this.elements.settingsDropdown.classList.toggle('hidden');
  },

  hideSettingsDropdown() {
    this.elements.settingsDropdown.classList.add('hidden');
  },

  toggleLocationDropdown() {
    const dropdown = document.getElementById('balloon-location-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('hidden');
    }
  },

  hideLocationDropdown() {
    const dropdown = document.getElementById('balloon-location-dropdown');
    if (dropdown) {
      dropdown.classList.add('hidden');
    }
  },

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

  openChangeLocationModal() {
    document.getElementById('balloon-change-location-modal').classList.remove('hidden');
  },

  closeChangeLocationModal() {
    document.getElementById('balloon-change-location-modal').classList.add('hidden');
  }
};

window.BalloonUI = BalloonUI;
