/**
 * Flight Tracker - Manages flight tracking, closest approach calculation, and history
 */

const FlightTracker = {
  // Current session tracking
  activeFlights: new Map(), // icao -> flight tracking data
  settings: null,
  observerLocation: null,
  currentRadius: 5, // Current detection radius in NM

  init(settings, location) {
    this.settings = settings;
    this.observerLocation = location;
    this.currentRadius = location.radius || 5;
    this.activeFlights = new Map();
    
    // Load persisted session data
    const session = Storage.getSession();
    if (session.activeFlights && session.observerLocation?.name === location.name) {
      this.activeFlights = new Map(Object.entries(session.activeFlights));
    }
  },

  /**
   * Update radius (called when user changes it in settings)
   */
  setRadius(radius) {
    this.currentRadius = parseFloat(radius) || 5;
    if (this.observerLocation) {
      this.observerLocation.radius = this.currentRadius;
    }
  },

  /**
   * Process new flight data from API
   */
  processFlights(flights) {
    const now = Date.now();
    const currentIcaos = new Set(flights.map(f => f.icao));
    
    // Process each flight
    flights.forEach(flight => {
      this.trackFlight(flight, now);
    });
    
    // Check for departed flights
    this.activeFlights.forEach((data, icao) => {
      if (!currentIcaos.has(icao)) {
        this.finalizeFlight(icao, now);
      }
    });
    
    // Save session
    this.saveSession();
    
    return this.getDisplayData();
  },

  /**
   * Track a single flight's position and calculate closest approach
   */
  trackFlight(flight, timestamp) {
    const { lat, lon } = this.observerLocation;
    const distance = OpenSkyClient.calculateDistance(lat, lon, flight.lat, flight.lon);
    const bearing = OpenSkyClient.calculateBearing(lat, lon, flight.lat, flight.lon);
    const direction = OpenSkyClient.getDirection(bearing);
    
    let tracking = this.activeFlights.get(flight.icao);
    
    if (!tracking) {
      // New flight
      tracking = {
        icao: flight.icao,
        callsign: flight.callsign,
        country: flight.country,
        firstSeen: timestamp,
        positions: [],
        closestDistance: distance,
        closestBearing: bearing,
        closestDirection: direction,
        closestAltitude: flight.altitude
      };
    }
    
    // Add position (limit to last 20 to save memory)
    tracking.positions.push({
      lat: flight.lat,
      lon: flight.lon,
      altitude: flight.altitude,
      speed: flight.speed,
      heading: flight.heading,
      distance,
      bearing,
      timestamp
    });
    
    // Keep only last 20 positions for trail
    if (tracking.positions.length > 20) {
      tracking.positions = tracking.positions.slice(-20);
    }
    
    // Update closest approach
    if (distance < tracking.closestDistance) {
      tracking.closestDistance = distance;
      tracking.closestBearing = bearing;
      tracking.closestDirection = direction;
      tracking.closestAltitude = flight.altitude;
      tracking.closestTime = timestamp;
    }
    
    // Update current state
    tracking.currentDistance = distance;
    tracking.currentBearing = bearing;
    tracking.currentDirection = direction;
    tracking.currentAltitude = flight.altitude;
    tracking.currentSpeed = flight.speed;
    tracking.currentHeading = flight.heading;
    tracking.lastSeen = timestamp;
    tracking.onGround = flight.onGround;
    
    // Store lat/lon for map display
    tracking.lat = flight.lat;
    tracking.lon = flight.lon;
    
    this.activeFlights.set(flight.icao, tracking);
  },

  /**
   * Finalize a flight that has left the detection zone
   */
  finalizeFlight(icao, timestamp) {
    const tracking = this.activeFlights.get(icao);
    if (!tracking) return;
    
    // Only save if it came within the detection radius
    if (tracking.closestDistance <= this.currentRadius) {
      const flightRecord = {
        icao: tracking.icao,
        callsign: tracking.callsign,
        country: tracking.country,
        firstSeen: tracking.firstSeen,
        lastSeen: timestamp,
        closestDistance: tracking.closestDistance,
        closestDirection: tracking.closestDirection,
        closestAltitude: tracking.closestAltitude,
        duration: timestamp - tracking.firstSeen
      };
      
      Storage.addToHistory(flightRecord);
    }
    
    this.activeFlights.delete(icao);
  },

  /**
   * Get data for display
   */
  getDisplayData() {
    const now = Date.now();
    
    // Filter active flights to only show those within current radius
    const activeInRange = Array.from(this.activeFlights.values())
      .filter(f => f.currentDistance <= this.currentRadius)
      .sort((a, b) => a.currentDistance - b.currentDistance);
    
    // Get all history but filter for display
    const history = Storage.getHistory()
      .filter(f => f.closestDistance <= this.currentRadius)
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 50); // Limit to last 50
    
    // Build flight trails for map
    const trails = new Map();
    this.activeFlights.forEach((flight, icao) => {
      if (flight.positions && flight.positions.length > 0) {
        trails.set(icao, flight.positions.map(p => ({
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
      stats: this.calculateStats(activeInRange, history)
    };
  },

  /**
   * Calculate statistics
   */
  calculateStats(active, history) {
    const today = new Date().toDateString();
    const todayFlights = history.filter(f => new Date(f.lastSeen).toDateString() === today);
    
    return {
      activeCount: active.length,
      todayCount: todayFlights.length,
      totalCount: history.length,
      closestToday: todayFlights.length > 0 
        ? Math.min(...todayFlights.map(f => f.closestDistance)).toFixed(1)
        : null,
      avgAltitude: active.length > 0
        ? Math.round(active.reduce((sum, f) => sum + (f.currentAltitude || 0), 0) / active.length)
        : null
    };
  },

  /**
   * Save current session to storage
   */
  saveSession() {
    const sessionData = {
      activeFlights: Object.fromEntries(this.activeFlights),
      observerLocation: this.observerLocation,
      savedAt: Date.now()
    };
    Storage.saveSession(sessionData);
  },

  /**
   * Check if it's nighttime (should pause)
   */
  isNightTime() {
    if (!this.settings.nightPause) return false;
    
    const now = new Date();
    const [startH, startM] = this.settings.nightStart.split(':').map(Number);
    const [endH, endM] = this.settings.nightEnd.split(':').map(Number);
    
    const start = new Date(now);
    start.setHours(startH, startM, 0, 0);
    
    const end = new Date(now);
    end.setHours(endH, endM, 0, 0);
    
    // Handle crossing midnight
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    return now >= start && now < end;
  },

  /**
   * Clear all history
   */
  clearHistory() {
    Storage.clearHistory();
    this.activeFlights.clear();
    this.saveSession();
  }
};

// Expose globally
window.FlightTracker = FlightTracker;
