/* ============================================
   modals.js - Modal management and forms
   ============================================ */

const Modals = (() => {
  // ---- Toggle Group Helpers ----
  function initToggleGroups() {
    document.querySelectorAll('.toggle-group').forEach(group => {
      group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // Special: show/hide fields based on post type
          if (group.id === 'postTypeToggle') {
            updateFieldVisibility(btn.dataset.value);
          }
          // Update deposit preview when months change
          if (group.id === 'depositSelector') {
            updateDepositPreview();
          }
          // Show/hide date picker based on availability toggle
          if (group.id === 'availabilityToggle') {
            const datePicker = document.getElementById('availableFrom');
            if (datePicker) {
              if (btn.dataset.value === 'date') {
                datePicker.classList.remove('hidden');
              } else {
                datePicker.classList.add('hidden');
                datePicker.value = ''; // clear date when "Available Now" selected
              }
            }
          }
        });
      });
    });
  }

  // ---- Field Visibility by Post Type ----
  function updateFieldVisibility(postType) {
    const ownerFields = document.getElementById('ownerFields');
    const flatmateFields = document.getElementById('flatmateFields');
    const extraFields = document.getElementById('extraFields');

    if (ownerFields) ownerFields.classList.add('hidden');
    if (flatmateFields) flatmateFields.classList.add('hidden');
    if (extraFields) extraFields.classList.add('hidden');

    if (postType === 'tenant') {
      // Tenant: only BHK, Rent, Deposit, Furnishing, Society Type (already visible)
    } else if (postType === 'owner') {
      if (ownerFields) ownerFields.classList.remove('hidden');
      if (extraFields) extraFields.classList.remove('hidden');
    } else if (postType === 'flatmate') {
      if (ownerFields) ownerFields.classList.remove('hidden');
      if (flatmateFields) flatmateFields.classList.remove('hidden');
      if (extraFields) extraFields.classList.remove('hidden');
    }
  }

  // ---- Modal Open/Close ----
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function initModalCloseButtons() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        if (modalId) {
          closeModal(modalId);
          if (modalId === 'pinModal') {
            MapManager.removeTempMarker();
            clearEditMode();
          }
        }
      });
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.add('hidden');
          document.body.style.overflow = '';
          MapManager.removeTempMarker();
          clearEditMode();
        }
      });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
          m.classList.add('hidden');
        });
        clearEditMode();
        document.body.style.overflow = '';
        MapManager.removeTempMarker();
      }
    });
  }

  // ---- Indian number formatting on inputs ----
  function initCurrencyInputs() {
    const currencyInputs = ['rentInput', 'budgetPerPerson'];
    currencyInputs.forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', () => {
        const raw = input.value.replace(/[^0-9]/g, '');
        if (raw) {
          input.value = DataStore.formatIndianNumber(parseInt(raw));
        }
        // Update deposit preview when rent changes
        if (id === 'rentInput') updateDepositPreview();
      });
    });
  }

  // ---- Deposit preview (shows calculated amount) ----
  function updateDepositPreview() {
    const rentVal = DataStore.parseIndianNumber(document.getElementById('rentInput').value);
    const months = parseInt(getActiveToggleValue('depositSelector')) || 2;
    const preview = document.getElementById('depositPreview');
    if (preview && rentVal) {
      preview.textContent = `= \u20B9${DataStore.formatIndianNumber(rentVal * months)}`;
    } else if (preview) {
      preview.textContent = '';
    }
  }

  // ---- Pin Modal ----
  function openPinModal(lat, lng, postType) {
    document.getElementById('pinLat').value = lat || '';
    document.getElementById('pinLng').value = lng || '';

    // Set post type if specified (default to tenant)
    const activeType = postType || 'tenant';
    const toggle = document.getElementById('postTypeToggle');
    toggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    const targetBtn = toggle.querySelector(`[data-value="${activeType}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    updateFieldVisibility(activeType);

    openModal('pinModal');

    // If no coords, prompt to click map
    if (!lat || !lng) {
      closeModal('pinModal');
      Toast.show('Click on the map to choose a location first', 'info');
    }
  }

  function getActiveToggleValue(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return '';
    const active = group.querySelector('.toggle-btn.active');
    return active ? active.dataset.value : '';
  }

  function resetForm() {
    document.getElementById('rentInput').value = '';
    document.getElementById('notesInput').value = '';
    document.getElementById('contactInput').value = '';
    document.getElementById('floorInput').value = '';
    document.getElementById('areaInput').value = '';
    document.getElementById('availableFrom').value = '';
    document.getElementById('budgetPerPerson').value = '';
    document.getElementById('currentOccupants').value = '';
    document.getElementById('genderPref').value = 'any';
    document.getElementById('foodPref').value = 'any';
    document.getElementById('smokingPref').value = 'no';
    const depositPreview = document.getElementById('depositPreview');
    if (depositPreview) depositPreview.textContent = '';

    // Reset toggles to defaults
    const toggleDefaults = {
      postTypeToggle: 'tenant',
      bhkSelector: '1',
      depositSelector: '3',
      furnishingToggle: 'semi',
      societyToggle: 'gated',
      availabilityToggle: 'now',
      petsToggle: 'no',
      moveInToggle: 'immediately',
    };

    Object.entries(toggleDefaults).forEach(([groupId, val]) => {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      const btn = group.querySelector(`[data-value="${val}"]`);
      if (btn) btn.classList.add('active');
    });

    // Hide date picker (availability set to "now")
    const datePicker = document.getElementById('availableFrom');
    if (datePicker) datePicker.classList.add('hidden');

    // Reset field visibility to tenant mode (minimal)
    updateFieldVisibility('tenant');
    document.getElementById('pinLat').value = '';
    document.getElementById('pinLng').value = '';
  }

  function initSubmitPin() {
    const submitBtn = document.getElementById('submitPin');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async () => {
      const lat = parseFloat(document.getElementById('pinLat').value);
      const lng = parseFloat(document.getElementById('pinLng').value);
      const rent = DataStore.parseIndianNumber(document.getElementById('rentInput').value);
      const bhkVal = getActiveToggleValue('bhkSelector') || '3';
      const bhk = bhkVal === '1rk' ? '1rk' : (parseInt(bhkVal) || 3);
      const postType = getActiveToggleValue('postTypeToggle') || 'tenant';

      // Validation
      if (!lat || !lng) {
        Toast.show('Please click on the map to set a location', 'warn');
        return;
      }
      if (!rent || rent < 1000) {
        Toast.show('Please enter a valid rent amount', 'warn');
        return;
      }
      // Phone required for owner/flatmate
      if ((postType === 'owner' || postType === 'flatmate') && !document.getElementById('contactInput').value.trim()) {
        Toast.show('Phone number is required for owner & flatmate listings', 'warn');
        return;
      }

      // Deposit = months × rent
      const depositMonths = parseInt(getActiveToggleValue('depositSelector')) || 2;
      const deposit = rent * depositMonths;

      // Base pin (shared by all post types)
      const pin = {
        postType,
        bhk,
        rent,
        deposit,
        depositMonths,
        furnishing: getActiveToggleValue('furnishingToggle') || 'semi',
        society: getActiveToggleValue('societyToggle') || 'gated',
        lat,
        lng,
        neighborhood: findNearestNeighborhood(lat, lng),
        vacantSoon: false,
        notes: '',
        contact: '',
      };

      // Owner & Flatmate get extra fields
      if (postType === 'owner' || postType === 'flatmate') {
        const today = new Date().toISOString().split('T')[0];
        const availMode = getActiveToggleValue('availabilityToggle') || 'now';
        const availFrom = availMode === 'now' ? today : (document.getElementById('availableFrom').value || today);
        pin.availableFrom = availFrom;
        pin.floor = parseInt(document.getElementById('floorInput').value) || null;
        pin.area = parseInt(document.getElementById('areaInput').value) || null;
        pin.pets = getActiveToggleValue('petsToggle') || 'no';
        pin.notes = document.getElementById('notesInput').value.trim();
        pin.contact = document.getElementById('contactInput').value.trim();
        pin.vacantSoon = new Date(availFrom) > new Date() && new Date(availFrom) <= new Date(Date.now() + 30 * 86400000);
      }

      // Flatmate-specific fields
      if (postType === 'flatmate') {
        pin.budgetPerPerson = DataStore.parseIndianNumber(document.getElementById('budgetPerPerson').value);
        pin.currentOccupants = parseInt(document.getElementById('currentOccupants').value) || 0;
        pin.genderPref = document.getElementById('genderPref').value;
        pin.foodPref = document.getElementById('foodPref').value;
        pin.smokingPref = document.getElementById('smokingPref').value;
        pin.moveInTimeline = getActiveToggleValue('moveInToggle') || 'immediately';
      }

      let result;
      if (editingPinId) {
        // Update existing pin
        pin.id = editingPinId;
        result = await DataStore.updatePin(pin);
        if (result) {
          Toast.show('Pin updated!', 'success');
        } else {
          Toast.show('Failed to update pin. Try again.', 'warn');
        }
      } else {
        // Create new pin
        result = await DataStore.createPin(pin);
        if (result) {
          Toast.show('Rent pinned successfully!', 'success');
        } else {
          Toast.show('Failed to save pin. Try again.', 'warn');
        }
      }

      if (result) {
        closeModal('pinModal');
        MapManager.removeTempMarker();
        clearEditMode();
        resetForm();
        MapManager.reloadByBounds();
      }
    });
  }

  function findNearestNeighborhood(lat, lng) {
    let nearest = '';
    let minDist = Infinity;
    DataStore.NEIGHBORHOODS.forEach(n => {
      const d = Math.sqrt(Math.pow(n.lat - lat, 2) + Math.pow(n.lng - lng, 2));
      if (d < minDist) {
        minDist = d;
        nearest = n.name;
      }
    });
    return nearest;
  }

  // ---- Flat Hunt Modal ----
  function initFlatHunt() {
    const flatHuntBtn = document.getElementById('flatHuntBtn');
    const huntTenant = document.getElementById('huntTenant');
    const huntOwner = document.getElementById('huntOwner');
    const huntFlatmate = document.getElementById('huntFlatmate');

    if (flatHuntBtn) {
      flatHuntBtn.addEventListener('click', () => {
        openModal('flatHuntModal');
      });
    }

    if (huntTenant) {
      huntTenant.addEventListener('click', () => {
        closeModal('flatHuntModal');
        Toast.show('Click on the map to pin your rent', 'info');
        pendingPostType = 'tenant';
      });
    }

    if (huntOwner) {
      huntOwner.addEventListener('click', () => {
        closeModal('flatHuntModal');
        Toast.show('Click on the map to place your property pin', 'info');
        pendingPostType = 'owner';
      });
    }

    if (huntFlatmate) {
      huntFlatmate.addEventListener('click', () => {
        closeModal('flatHuntModal');
        Toast.show('Click on the map to place your flatmate pin', 'info');
        pendingPostType = 'flatmate';
      });
    }
  }

  let pendingPostType = null;

  function getPendingPostType() {
    const pt = pendingPostType;
    pendingPostType = null;
    return pt;
  }

  // ---- Welcome Modal ----
  function initWelcome() {
    const WELCOME_KEY = 'rentlist_welcomed';
    if (!localStorage.getItem(WELCOME_KEY)) {
      setTimeout(() => openModal('welcomeModal'), 600);
    }

    const closeWelcome = document.getElementById('welcomeClose');
    if (closeWelcome) {
      closeWelcome.addEventListener('click', () => {
        closeModal('welcomeModal');
        localStorage.setItem(WELCOME_KEY, '1');
      });
    }
  }

  // ---- Edit Mode ----
  let editingPinId = null;

  async function openEditModal(pinId) {
    // Find the pin from data
    const allPins = Filters.getAllPins();
    const pin = allPins.find(p => p.id === pinId);
    if (!pin) {
      // Try full fetch
      const all = await DataStore.getPins();
      const found = all.find(p => p.id === pinId);
      if (!found) { Toast.show('Pin not found', 'warn'); return; }
      return openEditModalWithPin(found);
    }
    openEditModalWithPin(pin);
  }

  function openEditModalWithPin(pin) {
    editingPinId = pin.id;

    // Close any open popup
    const map = MapManager.getMap();
    if (map) map.closePopup();

    // Set coordinates
    document.getElementById('pinLat').value = pin.lat;
    document.getElementById('pinLng').value = pin.lng;

    // Set post type
    setToggle('postTypeToggle', pin.postType || 'tenant');
    updateFieldVisibility(pin.postType || 'tenant');

    // Set BHK
    setToggle('bhkSelector', String(pin.bhk));

    // Set rent
    document.getElementById('rentInput').value = pin.rent ? DataStore.formatIndianNumber(pin.rent) : '';

    // Set deposit months
    setToggle('depositSelector', String(pin.depositMonths || 2));
    updateDepositPreview();

    // Set furnishing & society
    setToggle('furnishingToggle', pin.furnishing || 'semi');
    setToggle('societyToggle', pin.society || 'gated');

    // Owner/flatmate fields
    if (pin.postType === 'owner' || pin.postType === 'flatmate') {
      // Determine if it's "available now" or a future date
      const today = new Date().toISOString().split('T')[0];
      const isAvailNow = !pin.availableFrom || pin.availableFrom <= today;
      setToggle('availabilityToggle', isAvailNow ? 'now' : 'date');
      const dateInput = document.getElementById('availableFrom');
      if (isAvailNow) {
        dateInput.classList.add('hidden');
        dateInput.value = '';
      } else {
        dateInput.classList.remove('hidden');
        dateInput.value = pin.availableFrom;
      }
      document.getElementById('floorInput').value = pin.floor || '';
      document.getElementById('areaInput').value = pin.area || '';
      setToggle('petsToggle', pin.pets || 'no');
      document.getElementById('notesInput').value = pin.notes || '';
      document.getElementById('contactInput').value = pin.contact || '';
    }

    // Flatmate fields
    if (pin.postType === 'flatmate') {
      document.getElementById('budgetPerPerson').value = pin.budgetPerPerson ? DataStore.formatIndianNumber(pin.budgetPerPerson) : '';
      document.getElementById('currentOccupants').value = pin.currentOccupants || '';
      document.getElementById('genderPref').value = pin.genderPref || 'any';
      document.getElementById('foodPref').value = pin.foodPref || 'any';
      document.getElementById('smokingPref').value = pin.smokingPref || 'no';
      setToggle('moveInToggle', pin.moveInTimeline || 'immediately');
    }

    // Update submit button text
    const submitBtn = document.getElementById('submitPin');
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Update Pin`;

    // Update modal title
    document.querySelector('#pinModal .modal-header h2').textContent = 'Edit Your Pin';

    openModal('pinModal');
  }

  function setToggle(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    const btn = group.querySelector(`[data-value="${value}"]`);
    if (btn) btn.classList.add('active');
  }

  function getEditingPinId() {
    return editingPinId;
  }

  function clearEditMode() {
    editingPinId = null;
    const submitBtn = document.getElementById('submitPin');
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Drop Pin`;
    document.querySelector('#pinModal .modal-header h2').textContent = 'Pin Your Rent';
  }

  // ---- Init ----
  function init() {
    initToggleGroups();
    initModalCloseButtons();
    initCurrencyInputs();
    initSubmitPin();
    initFlatHunt();
    initWelcome();
  }

  return {
    init,
    openModal,
    closeModal,
    openPinModal,
    openEditModal,
    getPendingPostType,
    getEditingPinId,
    clearEditMode,
  };
})();
