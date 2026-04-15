/* ============================================
   app.js - Main application initialization
   ============================================ */

// ---- Toast Notifications ----
const Toast = (() => {
  function show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '\u2713',
      info: '\u2139',
      warn: '\u26A0',
    };

    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '16px';
    iconSpan.textContent = icons[type] || icons.info;
    toast.appendChild(iconSpan);
    toast.appendChild(document.createTextNode(' ' + message));
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return { show };
})();

// ---- Main App ----
const App = (() => {
  async function init() {
    // 1. Init data store
    DataStore.init();

    // 2. Init map
    MapManager.init();

    // 3. Init filters and search
    Filters.init();

    // 4. Init modals
    Modals.init();

    // 5. Load pins within current viewport (bandwidth optimization)
    const bounds = MapManager.getViewportBounds();
    const pins = bounds
      ? await DataStore.getPinsByBounds(bounds)
      : await DataStore.getPins();
    Filters.setAllPins(pins);
    MapManager.renderPins(pins);

    // 6. Wire up buttons & city selector
    wireUpButtons();
    wireCitySelector();

    // 7. Override map click to respect pending post type from Flat Hunt
    overrideMapClick();

    console.log('[App] rentlist initialized with', pins.length, 'pins');
  }

  function wireCitySelector() {
    const container = document.getElementById('citySelector');
    const btn = document.getElementById('citySelectorBtn');
    const dropdown = document.getElementById('cityDropdown');
    const label = document.getElementById('citySelectorLabel');
    if (!container || !btn || !dropdown || !label) return;

    const currentCity = DataStore.getCurrentCity();

    // Set initial label and active state
    const initialOption = dropdown.querySelector(`[data-value="${currentCity}"]`);
    if (initialOption) {
      label.textContent = initialOption.textContent;
      initialOption.classList.add('active');
    }

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('hidden');
      if (isOpen) {
        dropdown.classList.add('hidden');
        container.classList.remove('open');
      } else {
        dropdown.classList.remove('hidden');
        container.classList.add('open');
      }
    });

    // Close on outside click
    document.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      container.classList.remove('open');
    });

    // Prevent dropdown clicks from closing
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    // Handle option click
    dropdown.querySelectorAll('.city-option').forEach(option => {
      option.addEventListener('click', async () => {
        const cityKey = option.dataset.value;

        // Update active state
        dropdown.querySelectorAll('.city-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        label.textContent = option.textContent;

        // Close dropdown
        dropdown.classList.add('hidden');
        container.classList.remove('open');

        // Switch city
        DataStore.switchCity(cityKey);
        MapManager.setCityView();

        // Reload pins for new city
        const bounds = MapManager.getViewportBounds();
        const pins = bounds
          ? await DataStore.getPinsByBounds(bounds)
          : await DataStore.getPins();
        Filters.setAllPins(pins);
        Filters.clearAllFilters();
        MapManager.renderPins(pins);

        const cityName = (DataStore.getCityData() || {}).name || cityKey;
        Toast.show(`Switched to ${cityName}`, 'info');

        // Update search placeholder
        updateSearchPlaceholder();
      });
    });

    // Set initial placeholder
    updateSearchPlaceholder();
  }

  function updateSearchPlaceholder() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      const hoods = DataStore.getNeighborhoods();
      const examples = hoods.slice(0, 3).map(h => h.name).join(', ');
      searchInput.placeholder = `Search ${examples}...`;
    }
  }

  function wireUpButtons() {
    // Pin Your Rent button
    const pinRentBtn = document.getElementById('pinRentBtn');
    if (pinRentBtn) {
      pinRentBtn.addEventListener('click', () => {
        Toast.show('Click anywhere on the map to drop your pin', 'info');
      });
    }

    // Locate Me
    const locateMeBtn = document.getElementById('locateMeBtn');
    if (locateMeBtn) {
      locateMeBtn.addEventListener('click', () => {
        MapManager.locateUser();
      });
    }

    // Share on WhatsApp
    const shareBtn = document.getElementById('shareWhatsAppBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const url = window.location.href;
        const text = `Check out rentlist - see real rents and find listings! ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      });
    }
  }

  function overrideMapClick() {
    const map = MapManager.getMap();
    if (!map) return;

    // The map click handler in map.js calls Modals.openPinModal
    // We need to inject the pending post type from Flat Hunt
    const origOpenPinModal = Modals.openPinModal;
    Modals.openPinModal = (lat, lng) => {
      const pendingType = Modals.getPendingPostType();
      origOpenPinModal(lat, lng, pendingType);
    };
  }

  return { init };
})();

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
