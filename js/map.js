/* ============================================
   map.js - Leaflet map setup and pin rendering
   ============================================ */

const MapManager = (() => {
  let map = null;
  let markerCluster = null;
  let markers = [];
  let tempMarker = null;

  // Security: escape user input before rendering in HTML
  function esc(str) {
    if (!str && str !== 0) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function getCityCenter() {
    const city = DataStore.getCityData();
    return city ? city.center : [12.9716, 77.5946];
  }
  function getCityZoom() {
    const city = DataStore.getCityData();
    return city ? city.zoom : 12;
  }

  // Pin colors (warm/light scheme)
  const PIN_COLORS = {
    gated: '#0F766E',       // teal for gated
    independent: '#D97706', // amber for independent
    vacantSoon: '#059669',  // green for vacant
    flatmate: '#7C3AED',    // purple for flatmate
  };

  // Simple icon for temp marker (the red drop pin before form submit)
  function createTempIcon(color, size = 28) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${size}" height="${Math.round(size * 1.3)}">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" opacity="0.9"/>
        <circle cx="12" cy="11" r="5" fill="rgba(255,255,255,0.9)"/>
        <circle cx="12" cy="11" r="3" fill="${color}"/>
      </svg>`;
    return L.divIcon({
      html: svg,
      className: 'custom-pin',
      iconSize: [size, Math.round(size * 1.3)],
      iconAnchor: [size / 2, Math.round(size * 1.3)],
      popupAnchor: [0, -Math.round(size * 1.1)],
    });
  }

  function getPinColor(pin) {
    if (pin.postType === 'flatmate') return PIN_COLORS.flatmate;
    if (pin.postType === 'owner' && pin.vacantSoon) return PIN_COLORS.vacantSoon;
    if (pin.society === 'gated') return PIN_COLORS.gated;
    return PIN_COLORS.independent;
  }

  // Rich label-style marker showing BHK, rent, and status tag
  function createLabelIcon(pin) {
    const color = getPinColor(pin);
    const bhkLabel = pin.bhk === '1rk' ? '1RK' : (pin.bhk >= 5 ? '5+BHK' : `${pin.bhk}BHK`);
    const rentK = pin.rent >= 100000
      ? `${(pin.rent / 100000).toFixed(1)}L`
      : `${Math.round(pin.rent / 1000)}K`;

    // Status tags
    let tag = '';
    const isMine = DataStore.isMyPin(pin.id);

    if (isMine) {
      tag += `<div class="pin-tag pin-tag-mine">Your Pin</div>`;
    }

    if (pin.postType === 'flatmate') {
      tag += `<div class="pin-tag pin-tag-flatmate">FLATMATE</div>`;
    } else if (pin.postType === 'owner') {
      if (pin.vacantSoon) {
        tag += `<div class="pin-tag pin-tag-vacant">AVAILABLE</div>`;
      } else if (pin.availableFrom) {
        const d = new Date(pin.availableFrom);
        if (d <= new Date()) {
          tag += `<div class="pin-tag pin-tag-vacant">AVAILABLE</div>`;
        }
      }
    }

    // Dim pins that have been reported (1 report = slight dim, 2 = heavy dim)
    const reports = pin.reports || 0;
    const dimClass = reports >= 2 ? 'pin-reported-2' : reports >= 1 ? 'pin-reported-1' : '';

    const html = `
      <div class="pin-label ${dimClass}" style="--pin-color: ${color}">
        ${tag}
        <div class="pin-label-body">
          <span class="pin-label-bhk">${bhkLabel}</span>
          <span class="pin-label-sep">&middot;</span>
          <span class="pin-label-rent">${rentK}</span>
        </div>
        <div class="pin-label-arrow"></div>
      </div>`;

    // Count tags to offset popup correctly
    const tagCount = (tag.match(/pin-tag/g) || []).length;
    const popupOffset = -40 - (tagCount * 18);
    return L.divIcon({
      html: html,
      className: 'pin-label-wrapper',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, popupOffset],
    });
  }

  function buildPopupHTML(pin) {
    const rent = DataStore.formatIndianNumber(pin.rent);
    const bhkLabel = pin.bhk === '1rk' ? '1RK' : (pin.bhk >= 5 ? '5+ BHK' : `${pin.bhk} BHK`);
    const furnLabel = { unfurnished: 'Unfurnished', semi: 'Semi-furnished', fully: 'Fully furnished' }[pin.furnishing] || '';
    const societyLabel = pin.society === 'gated' ? 'Gated' : 'Independent';
    const typeLabels = { tenant: 'Rental', owner: 'Owner Listing', flatmate: 'Flatmate Seeking' };
    const typeLabel = typeLabels[pin.postType] || 'Rental';
    const isMine = DataStore.isMyPin(pin.id);

    let html = `<div class="pin-popup">`;
    if (isMine) {
      html += `<div class="popup-mine-badge">Your Pin</div>`;
    }
    if ((pin.reports || 0) >= 1 && !isMine) {
      html += `<div class="popup-flagged-badge">${pin.reports >= 2 ? 'Flagged by multiple users' : 'Flagged as suspicious'}</div>`;
    }
    html += `<h4>${bhkLabel} ${typeLabel}</h4>`;
    html += `<div class="popup-rent">\u20B9${rent}/mo</div>`;
    html += `<div class="popup-meta">`;
    html += `<span class="popup-tag">${societyLabel}</span>`;
    html += `<span class="popup-tag">${furnLabel}</span>`;
    if (pin.area) html += `<span class="popup-tag">${pin.area} sq ft</span>`;
    if (pin.floor) html += `<span class="popup-tag">Floor ${pin.floor}</span>`;
    if (pin.pets === 'yes') html += `<span class="popup-tag">Pets OK</span>`;
    html += `</div>`;

    if (pin.deposit) {
      const monthsLabel = pin.depositMonths ? `${pin.depositMonths} month${pin.depositMonths > 1 ? 's' : ''}` : '';
      html += `<div style="font-size:12px;color:#57534E;margin-bottom:4px;">Deposit: \u20B9${DataStore.formatIndianNumber(pin.deposit)}${monthsLabel ? ` (${monthsLabel})` : ''}</div>`;
    }
    if (pin.availableFrom) {
      const d = new Date(pin.availableFrom);
      const today = new Date();
      const label = d <= today ? 'Available now' : `From ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      html += `<div style="font-size:12px;color:#059669;">${label}</div>`;
    }

    if (pin.postType === 'flatmate') {
      html += `<div class="popup-flatmate-info">`;
      if (pin.budgetPerPerson) html += `<span>Budget/person: \u20B9${DataStore.formatIndianNumber(pin.budgetPerPerson)}</span>`;
      if (pin.currentOccupants !== undefined) html += `<span>Current occupants: ${esc(pin.currentOccupants)}</span>`;
      if (pin.genderPref && pin.genderPref !== 'any') html += `<span>Gender pref: ${esc(pin.genderPref)}</span>`;
      if (pin.foodPref && pin.foodPref !== 'any') html += `<span>Food: ${esc(pin.foodPref)}</span>`;
      if (pin.moveInTimeline) {
        const tl = { immediately: 'Immediately', '1month': 'Within 1 month', '3months': 'Within 3 months' }[pin.moveInTimeline] || esc(pin.moveInTimeline);
        html += `<span>Move-in: ${tl}</span>`;
      }
      html += `</div>`;
    }

    // Show phone publicly for owner & flatmate
    if ((pin.postType === 'owner' || pin.postType === 'flatmate') && pin.contact) {
      html += `<div class="popup-contact"><a href="tel:${esc(pin.contact)}" style="color:#0F766E;text-decoration:none;font-size:13px;font-weight:500;">\u260E ${esc(pin.contact)}</a></div>`;
    }

    // Expiry notice for owner/flatmate
    if ((pin.postType === 'owner' || pin.postType === 'flatmate') && pin.createdAt) {
      const created = new Date(pin.createdAt);
      const expires = new Date(created.getTime() + 15 * 86400000);
      const daysLeft = Math.max(0, Math.ceil((expires - new Date()) / 86400000));
      if (daysLeft <= 3) {
        html += `<div style="font-size:11px;color:#ef4444;margin-top:4px;">Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</div>`;
      } else {
        html += `<div style="font-size:11px;color:#A8A29E;margin-top:4px;">Expires in ${daysLeft} days</div>`;
      }
    }

    if (pin.notes) {
      html += `<div class="popup-notes">${esc(pin.notes)}</div>`;
    }

    if (pin.neighborhood) {
      html += `<div style="font-size:11px;color:#A8A29E;margin-top:4px;">${esc(pin.neighborhood)}</div>`;
    }

    // Edit/Delete for own pins
    if (isMine) {
      const safeId = esc(pin.id);
      html += `<div class="popup-actions">`;
      html += `<button class="popup-btn popup-btn-edit" onclick="Modals.openEditModal('${safeId}')">Edit</button>`;
      html += `<button class="popup-btn popup-btn-delete" onclick="MapManager.handleDeletePin('${safeId}')">Delete</button>`;
      html += `</div>`;
    }

    // Share & Report row (always visible)
    const cityName = (DataStore.getCityData() || {}).name || 'India';
    const shareText = encodeURIComponent(`${bhkLabel} ${typeLabel} at \u20B9${rent}/mo in ${pin.neighborhood || cityName} - Check it out on rentlist!`);
    const shareUrl = encodeURIComponent(`${window.location.origin}${window.location.pathname}?lat=${pin.lat}&lng=${pin.lng}`);
    const alreadyReported = DataStore.hasReported(pin.id);
    const safeReportId = esc(pin.id);
    html += `<div class="popup-share-row">`;
    html += `<button class="popup-icon-btn" onclick="MapManager.copyPinLink('${pin.lat}','${pin.lng}')" title="Copy link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>`;
    html += `<button class="popup-icon-btn popup-icon-wa" onclick="window.open('https://wa.me/?text=${shareText}%20${shareUrl}','_blank')" title="Share on WhatsApp"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.467A11.932 11.932 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.17 0-4.207-.676-5.871-1.823l-.42-.281-2.744.87.884-2.682-.309-.452A9.708 9.708 0 0 1 2.25 12c0-5.385 4.365-9.75 9.75-9.75S21.75 6.615 21.75 12s-4.365 9.75-9.75 9.75z"/></svg></button>`;
    if (!isMine) {
      html += `<button class="popup-icon-btn popup-icon-report ${alreadyReported ? 'reported' : ''}" onclick="MapManager.handleReportPin('${safeReportId}')" title="${alreadyReported ? 'Already reported' : 'Report this pin'}" ${alreadyReported ? 'disabled' : ''}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg></button>`;
    }
    html += `</div>`;

    html += `</div>`;
    return html;
  }

  // Copy pin link to clipboard
  function copyPinLink(lat, lng) {
    const url = `${window.location.origin}${window.location.pathname}?lat=${lat}&lng=${lng}`;
    navigator.clipboard.writeText(url).then(() => {
      Toast.show('Link copied to clipboard!', 'success');
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      Toast.show('Link copied!', 'success');
    });
  }

  // Handle report from popup
  async function handleReportPin(id) {
    const result = await DataStore.reportPin(id);
    if (!result) {
      Toast.show('Failed to report pin', 'warn');
      return;
    }
    if (result.alreadyReported) {
      Toast.show('You have already reported this pin', 'info');
      return;
    }
    if (result.removed) {
      Toast.show('Pin removed due to multiple reports', 'success');
      map.closePopup();
      debouncedLoadByBounds();
      return;
    }
    Toast.show('Pin reported. Thank you.', 'success');
    map.closePopup();
  }

  // Handle delete from popup
  async function handleDeletePin(id) {
    if (!confirm('Delete this pin? This cannot be undone.')) return;
    const result = await DataStore.deletePin(id);
    if (result) {
      Toast.show('Pin deleted', 'success');
      map.closePopup();
      debouncedLoadByBounds();
    } else {
      Toast.show('Failed to delete pin', 'warn');
    }
  }

  // Debounce helper — prevents excessive API calls on every tiny pan/zoom
  let _boundsTimer = null;
  function debouncedLoadByBounds() {
    clearTimeout(_boundsTimer);
    _boundsTimer = setTimeout(async () => {
      const bounds = getViewportBounds();
      if (!bounds) return;
      const pins = await DataStore.getPinsByBounds(bounds);
      Filters.setAllPins(pins);
      const filtered = DataStore.filterPins(pins, Filters.getCurrentFilters());
      renderPins(filtered);
    }, 300);
  }

  function getViewportBounds() {
    if (!map) return null;
    const b = map.getBounds();
    return {
      south: b.getSouth(),
      north: b.getNorth(),
      west: b.getWest(),
      east: b.getEast(),
    };
  }

  function init() {
    map = L.map('map', {
      center: getCityCenter(),
      zoom: getCityZoom(),
      zoomControl: true,
      attributionControl: true,
    });

    // Light warm tiles (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Marker cluster
    markerCluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count > 20) size = 'large';
        else if (count > 10) size = 'medium';
        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster marker-cluster-${size}`,
          iconSize: L.point(40, 40),
        });
      },
    });
    map.addLayer(markerCluster);

    // Click on map to drop pin
    map.on('click', (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      // Remove old temp marker
      if (tempMarker) {
        map.removeLayer(tempMarker);
      }

      // Add temp marker
      tempMarker = L.marker([lat, lng], {
        icon: createTempIcon('#ef4444', 32),
        zIndexOffset: 1000,
      }).addTo(map);

      // Open pin modal
      Modals.openPinModal(lat, lng);
    });

    // Reload pins when user pans or zooms the map
    map.on('moveend', debouncedLoadByBounds);

    return map;
  }

  function renderPins(pins) {
    markerCluster.clearLayers();
    markers = [];

    pins.forEach(pin => {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: createLabelIcon(pin),
      });

      marker.bindPopup(buildPopupHTML(pin), {
        maxWidth: 280,
        minWidth: 200,
        closeButton: true,
      });

      marker.pinData = pin;
      markers.push(marker);
      markerCluster.addLayer(marker);
    });

    // Update count
    const countEl = document.getElementById('pinCountNumber');
    if (countEl) countEl.textContent = pins.length;
  }

  function flyTo(lat, lng, zoom = 15) {
    if (map) {
      map.flyTo([lat, lng], zoom, { duration: 1.2 });
    }
  }

  function locateUser() {
    if (!navigator.geolocation) {
      Toast.show('Geolocation not supported by your browser', 'warn');
      return;
    }
    map.locate({ setView: true, maxZoom: 15 });
    map.once('locationfound', (e) => {
      Toast.show('Location found!', 'success');
      L.circle(e.latlng, {
        radius: e.accuracy / 2,
        color: '#0F766E',
        fillColor: '#0F766E',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map);
    });
    map.once('locationerror', () => {
      Toast.show('Could not get your location', 'warn');
    });
  }

  function removeTempMarker() {
    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
  }

  function setCityView() {
    if (map) {
      map.setView(getCityCenter(), getCityZoom());
    }
  }

  function getMap() { return map; }

  return {
    init,
    renderPins,
    flyTo,
    locateUser,
    removeTempMarker,
    getMap,
    getViewportBounds,
    reloadByBounds: debouncedLoadByBounds,
    handleDeletePin,
    handleReportPin,
    copyPinLink,
    setCityView,
  };
})();
