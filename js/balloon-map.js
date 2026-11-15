/**
 * Balloon Map - Leaflet.js integration for showing balloon positions
 */

const BalloonMap = {
  map: null,
  markers: new Map(), // serial -> marker
  trails: new Map(), // serial -> polyline
  radiusCircle: null,
  homeMarker: null,
  observerLocation: null,
  detectionRadius: 200, // km

  /**
   * Initialize the map
   */
  init(location, radius = 200) {
    this.observerLocation = location;
    this.detectionRadius = radius;

    const container = document.getElementById('balloon-map');
    if (!container) return;

    // Clean up existing map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Create map centered on observer - zoom out more for larger balloon radius
    this.map = L.map('balloon-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([location.lat, location.lon], 8);

    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(this.map);

    // Add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Add home marker (warm orange)
    const homeIcon = L.divIcon({
      className: 'home-marker',
      html: '<div style="background: #f97316; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    this.homeMarker = L.marker([location.lat, location.lon], { icon: homeIcon })
      .addTo(this.map)
      .bindPopup('<b>Your Location</b><br>' + (location.name || 'Home'));

    // Add detection radius circle
    this.updateRadiusCircle();

    console.log('Balloon map initialized');
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

    // Convert km to meters
    const radiusMeters = this.detectionRadius * 1000;

    this.radiusCircle = L.circle([this.observerLocation.lat, this.observerLocation.lon], {
      radius: radiusMeters,
      color: '#f97316',
      weight: 2,
      opacity: 0.4,
      fillColor: '#f97316',
      fillOpacity: 0.03,
      dashArray: '8, 6'
    }).addTo(this.map);
  },

  /**
   * Update balloon markers on the map
   */
  updateBalloons(balloons) {
    if (!this.map) return;

    const currentSerials = new Set(balloons.map(b => b.serial));

    // Remove markers for balloons that are no longer present
    this.markers.forEach((marker, serial) => {
      if (!currentSerials.has(serial)) {
        this.map.removeLayer(marker);
        this.markers.delete(serial);

        if (this.trails.has(serial)) {
          this.map.removeLayer(this.trails.get(serial));
          this.trails.delete(serial);
        }
      }
    });

    // Add or update markers
    balloons.forEach(balloon => {
      this.updateBalloonMarker(balloon);
    });

    // Fit bounds if we have balloons
    if (balloons.length > 0 && this.markers.size === balloons.length) {
      this.fitBounds();
    }
  },

  /**
   * Update a single balloon marker
   */
  updateBalloonMarker(balloon) {
    const isClose = balloon.currentDistance < 50;

    // Balloon icon
    const balloonIcon = L.divIcon({
      className: 'balloon-marker',
      html: `<div style="font-size: 24px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3)); ${isClose ? 'transform: scale(1.2);' : ''}">\u{1F388}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    // Popup content
    const altDisplay = balloon.currentAltitude != null ? `${balloon.currentAltitude.toLocaleString()} m (${balloon.currentAltitudeFt?.toLocaleString() || '--'} ft)` : 'Unknown';
    const speedDisplay = balloon.currentVelH != null ? `${(balloon.currentVelH * 3.6).toFixed(1)} km/h` : 'Unknown';
    const vertDisplay = balloon.currentVelV != null ? `${balloon.currentVelV > 0 ? '+' : ''}${balloon.currentVelV.toFixed(1)} m/s` : '--';

    const popupContent = `
      <div style="min-width: 160px;">
        <b>${balloon.serial}</b><br>
        Distance: ${balloon.currentDistance.toFixed(1)} km<br>
        Altitude: ${altDisplay}<br>
        Speed: ${speedDisplay}<br>
        Vertical: ${vertDisplay}
      </div>
    `;

    if (this.markers.has(balloon.serial)) {
      const marker = this.markers.get(balloon.serial);
      marker.setLatLng([balloon.lat, balloon.lon]);
      marker.setIcon(balloonIcon);
      marker.setPopupContent(popupContent);
    } else {
      const marker = L.marker([balloon.lat, balloon.lon], { icon: balloonIcon })
        .addTo(this.map)
        .bindPopup(popupContent);
      this.markers.set(balloon.serial, marker);
    }
  },

  /**
   * Update balloon trails
   */
  updateTrails(balloonTrails) {
    if (!this.map) return;

    balloonTrails.forEach((positions, serial) => {
      if (positions.length < 2) return;

      const latlngs = positions.map(p => [p.lat, p.lon]);

      if (this.trails.has(serial)) {
        this.trails.get(serial).setLatLngs(latlngs);
      } else {
        const polyline = L.polyline(latlngs, {
          color: '#f97316',
          weight: 2,
          opacity: 0.6,
          dashArray: '4, 4'
        }).addTo(this.map);
        this.trails.set(serial, polyline);
      }
    });

    // Remove trails for balloons no longer tracked
    this.trails.forEach((polyline, serial) => {
      if (!balloonTrails.has(serial)) {
        this.map.removeLayer(polyline);
        this.trails.delete(serial);
      }
    });
  },

  /**
   * Fit map bounds to show all balloons and home
   */
  fitBounds() {
    if (!this.map || this.markers.size === 0) return;

    const bounds = L.latLngBounds([[this.observerLocation.lat, this.observerLocation.lon]]);
    this.markers.forEach(marker => {
      bounds.extend(marker.getLatLng());
    });

    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
  },

  /**
   * Clear all balloons from map
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

window.BalloonMap = BalloonMap;
