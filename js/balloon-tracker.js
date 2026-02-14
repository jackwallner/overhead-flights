/**
 * Balloon Tracker - Manages balloon tracking, closest approach calculation, and history
 */

const BalloonTracker = {
  activeBalloons: new Map(), // serial -> balloon tracking data
  settings: null,
  observerLocation: null,
  currentRadius: 200, // Current detection radius in km

  init(settings, location) {
    this.settings = settings;
    this.observerLocation = location;
    this.currentRadius = location.radius || 200;
    this.activeBalloons = new Map();

    // Load persisted session data
    const session = BalloonStorage.getSession();
    if (session.activeBalloons && session.observerLocation?.name === location.name) {
      this.activeBalloons = new Map(Object.entries(session.activeBalloons));
    }
  },

  /**
   * Update radius
   */
  setRadius(radius) {
    this.currentRadius = parseFloat(radius) || 200;
    if (this.observerLocation) {
      this.observerLocation.radius = this.currentRadius;
    }
  },

  /**
   * Process new balloon data from API
   */
  processBalloons(balloons) {
    const now = Date.now();
    const currentSerials = new Set(balloons.map(b => b.serial));

    // Process each balloon
    balloons.forEach(balloon => {
      this.trackBalloon(balloon, now);
    });

    // Check for departed balloons
    this.activeBalloons.forEach((data, serial) => {
      if (!currentSerials.has(serial)) {
        this.finalizeBalloon(serial, now);
      }
    });

    // Save session
    this.saveSession();

    return this.getDisplayData();
  },

  /**
   * Track a single balloon's position and calculate closest approach
   */
  trackBalloon(balloon, timestamp) {
    const { lat, lon } = this.observerLocation;
    const distance = SondeHubClient.calculateDistanceKm(lat, lon, balloon.lat, balloon.lon);
    const bearing = SondeHubClient.calculateBearing(lat, lon, balloon.lat, balloon.lon);
    const direction = SondeHubClient.getDirection(bearing);

    let tracking = this.activeBalloons.get(balloon.serial);

    if (!tracking) {
      tracking = {
        serial: balloon.serial,
        type: balloon.type,
        manufacturer: balloon.manufacturer,
        frequency: balloon.frequency,
        firstSeen: timestamp,
        positions: [],
        closestDistance: distance,
        closestBearing: bearing,
        closestDirection: direction,
        closestAltitude: balloon.altitude,
        closestAltitudeFt: balloon.altitudeFt
      };
    }

    // Add position
    tracking.positions.push({
      lat: balloon.lat,
      lon: balloon.lon,
      altitude: balloon.altitude,
      altitudeFt: balloon.altitudeFt,
      velH: balloon.velH,
      velV: balloon.velV,
      heading: balloon.heading,
      distance,
      bearing,
      timestamp
    });

    // Keep only last 30 positions for trail (balloons move slower, more trail)
    if (tracking.positions.length > 30) {
      tracking.positions = tracking.positions.slice(-30);
    }

    // Update closest approach
    if (distance < tracking.closestDistance) {
      tracking.closestDistance = distance;
      tracking.closestBearing = bearing;
      tracking.closestDirection = direction;
      tracking.closestAltitude = balloon.altitude;
      tracking.closestAltitudeFt = balloon.altitudeFt;
      tracking.closestTime = timestamp;
    }

    // Update current state
    tracking.currentDistance = distance;
    tracking.currentBearing = bearing;
    tracking.currentDirection = direction;
    tracking.currentAltitude = balloon.altitude;
    tracking.currentAltitudeFt = balloon.altitudeFt;
    tracking.currentVelH = balloon.velH;
    tracking.currentVelV = balloon.velV;
    tracking.currentHeading = balloon.heading;
    tracking.lastSeen = timestamp;

    // Store lat/lon for map display
    tracking.lat = balloon.lat;
    tracking.lon = balloon.lon;

    this.activeBalloons.set(balloon.serial, tracking);
  },

  /**
   * Finalize a balloon that has left the detection zone
   */
  finalizeBalloon(serial, timestamp) {
    const tracking = this.activeBalloons.get(serial);
    if (!tracking) return;

    // Save if it came within the detection radius
    if (tracking.closestDistance <= this.currentRadius) {
      const balloonRecord = {
        serial: tracking.serial,
        type: tracking.type,
        manufacturer: tracking.manufacturer,
        frequency: tracking.frequency,
        firstSeen: tracking.firstSeen,
        lastSeen: timestamp,
        closestDistance: tracking.closestDistance,
        closestDirection: tracking.closestDirection,
        closestAltitude: tracking.closestAltitude,
        closestAltitudeFt: tracking.closestAltitudeFt,
        duration: timestamp - tracking.firstSeen
      };

      const locationName = this.observerLocation?.name || 'Unknown';
      BalloonStorage.addToHistory(balloonRecord, locationName);
    }

    this.activeBalloons.delete(serial);
  },

  /**
   * Get data for display
   */
  getDisplayData() {
    const currentLocationName = this.observerLocation?.name;

    // Filter active balloons to those within radius
    const activeInRange = Array.from(this.activeBalloons.values())
      .filter(b => b.currentDistance <= this.currentRadius)
      .sort((a, b) => a.currentDistance - b.currentDistance);

    // Get history for current location
    const savedHistory = BalloonStorage.getHistory(currentLocationName)
      .filter(b => b.closestDistance <= this.currentRadius)
      .sort((a, b) => b.lastSeen - a.lastSeen);

    // Include active balloons in history
    const activeAsHistory = activeInRange.map(b => ({
      serial: b.serial,
      type: b.type,
      manufacturer: b.manufacturer,
      frequency: b.frequency,
      firstSeen: b.firstSeen,
      lastSeen: b.lastSeen,
      closestDistance: b.closestDistance,
      closestDirection: b.closestDirection,
      closestAltitude: b.closestAltitude,
      closestAltitudeFt: b.closestAltitudeFt,
      currentDistance: b.currentDistance,
      isActive: true
    }));

    const history = [...activeAsHistory, ...savedHistory].slice(0, 50);

    // Build balloon trails for map
    const trails = new Map();
    this.activeBalloons.forEach((balloon, serial) => {
      if (balloon.positions && balloon.positions.length > 0) {
        trails.set(serial, balloon.positions.map(p => ({
          lat: p.lat,
          lon: p.lon,
          timestamp: p.timestamp
        })));
      }
    });

    return {
      active: activeInRange,
      history,
      trails,
      stats: this.calculateStats(activeInRange, savedHistory)
    };
  },

  /**
   * Calculate statistics
   */
  calculateStats(active, history) {
    const today = new Date().toDateString();
    const todayBalloons = history.filter(b =>
      new Date(b.lastSeen).toDateString() === today
    );

    return {
      activeCount: active.length,
      todayCount: todayBalloons.length,
      totalCount: history.length,
      closestToday: todayBalloons.length > 0
        ? Math.min(...todayBalloons.map(b => b.closestDistance)).toFixed(0)
        : null,
      avgAltitude: active.length > 0
        ? Math.round(active.reduce((sum, b) => sum + (b.currentAltitude || 0), 0) / active.length)
        : null,
      maxAltitude: active.length > 0
        ? Math.max(...active.map(b => b.currentAltitude || 0))
        : null
    };
  },

  /**
   * Save current session to storage
   */
  saveSession() {
    const sessionData = {
      activeBalloons: Object.fromEntries(this.activeBalloons),
      observerLocation: this.observerLocation,
      savedAt: Date.now()
    };
    BalloonStorage.saveSession(sessionData);
  },

  /**
   * Clear history
   */
  clearHistory(clearAll = false) {
    if (clearAll) {
      BalloonStorage.clearHistory();
    } else {
      const locationName = this.observerLocation?.name;
      if (locationName) {
        BalloonStorage.clearHistory(locationName);
      }
    }
    this.activeBalloons.clear();
    this.saveSession();
  }
};

window.BalloonTracker = BalloonTracker;
