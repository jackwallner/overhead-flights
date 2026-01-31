/**
 * Flight Map - Leaflet.js integration for showing aircraft positions
 */

const FlightMap = {
  map: null,
  markers: new Map(), // icao -> marker
  trails: new Map(), // icao -> polyline
  radiusCircle: null,
  homeMarker: null,
  observerLocation: null,
  detectionRadius: 5,

  /**
   * Initialize the map
   */
  init(location, radius = 5) {
    this.observerLocation = location;
    this.detectionRadius = radius;

    const container = document.getElementById('flight-map');
    if (!container) return;

    // Clean up existing map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Create map centered on observer
    this.map = L.map('flight-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([location.lat, location.lon], 10);

    // Add clean tile layer (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(this.map);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Add home marker
    const homeIcon = L.divIcon({
      className: 'home-marker',
      html: '<div style="background: #f59e0b; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    this.homeMarker = L.marker([location.lat, location.lon], { icon: homeIcon })
      .addTo(this.map)
      .bindPopup('<b>Your Location</b><br>' + (location.name || 'Home'));

    // Add detection radius circle
    this.updateRadiusCircle();

    console.log('Flight map initialized');
  },

  /**
   * Update the detection radius
   */
  setRadius(radius) {
    this.detectionRadius = radius;
    this.updateRadiusCircle();
  },

  /**
   * Update or create the radius circle
   */
  updateRadiusCircle() {
    if (!this.map) return;

    if (this.radiusCircle) {
      this.map.removeLayer(this.radiusCircle);
    }

    // Convert NM to meters (1 NM = 1852 meters)
    const radiusMeters = this.detectionRadius * 1852;

    this.radiusCircle = L.circle([this.observerLocation.lat, this.observerLocation.lon], {
      radius: radiusMeters,
      color: '#3b82f6',
      weight: 2,
      opacity: 0.5,
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      dashArray: '8, 6'
    }).addTo(this.map);
  },

  /**
   * Update aircraft markers on the map
   */
  updateAircraft(flights) {
    if (!this.map) return;

    const currentIcaos = new Set(flights.map(f => f.icao));

    // Remove markers for aircraft that are no longer present
    this.markers.forEach((marker, icao) => {
      if (!currentIcaos.has(icao)) {
        this.map.removeLayer(marker);
        this.markers.delete(icao);

        // Also remove trail
        if (this.trails.has(icao)) {
          this.map.removeLayer(this.trails.get(icao));
          this.trails.delete(icao);
        }
      }
    });

    // Add or update markers for current aircraft
    flights.forEach(flight => {
      this.updateAircraftMarker(flight);
    });

    // Fit bounds if we have aircraft and this is the first update
    if (flights.length > 0 && this.markers.size === flights.length) {
      this.fitBounds();
    }
  },

  /**
   * Update a single aircraft marker
   */
  updateAircraftMarker(flight) {
    const heading = flight.currentHeading || 0;
    const isClosest = flight.currentDistance < 1;

    // Create plane icon with rotation
    const planeIcon = L.divIcon({
      className: 'plane-marker',
      html: `<div style="font-size: 20px; transform: rotate(${heading}deg); transform-origin: center; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">${isClosest ? '✈️' : '✈️'}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    // Build popup content
    const popupContent = `
      <div style="min-width: 150px;">
        <b>${flight.callsign || 'Unknown'}</b><br>
        ICAO: ${flight.icao}<br>
        Distance: ${flight.currentDistance.toFixed(1)} NM<br>
        Altitude: ${flight.currentAltitude ? flight.currentAltitude.toLocaleString() + ' ft' : 'Unknown'}<br>
        Speed: ${flight.currentSpeed ? flight.currentSpeed + ' kts' : 'Unknown'}<br>
        Heading: ${heading}°
      </div>
    `;

    if (this.markers.has(flight.icao)) {
      // Update existing marker
      const marker = this.markers.get(flight.icao);
      marker.setLatLng([flight.lat, flight.lon]);
      marker.setIcon(planeIcon);
      marker.setPopupContent(popupContent);
    } else {
      // Create new marker
      const marker = L.marker([flight.lat, flight.lon], { icon: planeIcon })
        .addTo(this.map)
        .bindPopup(popupContent);
      this.markers.set(flight.icao, marker);
    }
  },

  /**
   * Update flight trails (path history)
   */
  updateTrails(flightTrails) {
    if (!this.map) return;

    flightTrails.forEach((positions, icao) => {
      if (positions.length < 2) return;

      const latlngs = positions.map(p => [p.lat, p.lon]);

      if (this.trails.has(icao)) {
        this.trails.get(icao).setLatLngs(latlngs);
      } else {
        const polyline = L.polyline(latlngs, {
          color: '#3b82f6',
          weight: 2,
          opacity: 0.6,
          dashArray: '4, 4'
        }).addTo(this.map);
        this.trails.set(icao, polyline);
      }
    });

    // Remove trails for aircraft no longer tracked
    this.trails.forEach((polyline, icao) => {
      if (!flightTrails.has(icao)) {
        this.map.removeLayer(polyline);
        this.trails.delete(icao);
      }
    });
  },

  /**
   * Fit map bounds to show all aircraft and home
   */
  fitBounds() {
    if (!this.map || this.markers.size === 0) return;

    const bounds = L.latLngBounds([[this.observerLocation.lat, this.observerLocation.lon]]);
    this.markers.forEach(marker => {
      bounds.extend(marker.getLatLng());
    });

    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  },

  /**
   * Clear all aircraft from map
   */
  clear() {
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers.clear();

    this.trails.forEach(polyline => this.map.removeLayer(polyline));
    this.trails.clear();
  },

  /**
   * Destroy the map
   */
  destroy() {
    this.clear();
    if (this.radiusCircle) {
      this.map.removeLayer(this.radiusCircle);
      this.radiusCircle = null;
    }
    if (this.homeMarker) {
      this.map.removeLayer(this.homeMarker);
      this.homeMarker = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
};

// Expose globally
window.FlightMap = FlightMap;
