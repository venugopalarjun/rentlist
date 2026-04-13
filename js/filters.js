/* ============================================
   filters.js - Search and filter functionality
   ============================================ */

const Filters = (() => {
  let currentFilters = {};
  let allPins = [];

  // ---- Search: aliases for common abbreviations ----
  const ALIASES = {
    // Bangalore
    'ec': 'Electronic City', 'ecity': 'Electronic City',
    'btm': 'BTM Layout', 'hsr': 'HSR Layout',
    'jp': 'JP Nagar', 'jpn': 'JP Nagar',
    'kr': 'KR Puram', 'mg': 'MG Road',
    'hal': 'HAL', 'rt': 'RT Nagar',
    'bsk': 'Banashankari', 'bnk': 'Banashankari',
    'indira': 'Indiranagar', 'indo': 'Indiranagar',
    'kora': 'Koramangala', 'krm': 'Koramangala',
    'mara': 'Marathahalli', 'mrh': 'Marathahalli',
    'wf': 'Whitefield', 'ypr': 'Yeshwanthpur',
    'malli': 'Malleshwaram', 'mlr': 'Malleshwaram',
    'jaya': 'Jayanagar', 'jnr': 'Jayanagar',
    'basav': 'Basavanagudi', 'bgr': 'Bannerghatta Road',
    'srp': 'Sarjapur Road', 'sarj': 'Sarjapur Road',
    'bell': 'Bellandur', 'dom': 'Domlur',
    // Mumbai
    'bkc': 'BKC', 'bandra': 'Bandra West',
    'andheri': 'Andheri West', 'powai': 'Powai',
    'lower parel': 'Lower Parel', 'lp': 'Lower Parel',
    'worli': 'Worli', 'dadar': 'Dadar',
    'goregaon': 'Goregaon East', 'malad': 'Malad West',
    'juhu': 'Juhu', 'versova': 'Versova',
    // Delhi
    'cr park': 'CR Park', 'crp': 'CR Park',
    'gk': 'Greater Kailash', 'hkv': 'Hauz Khas Village',
    'hk': 'Hauz Khas Village', 'cp': 'Connaught Place',
    'dwarka': 'Dwarka', 'noida': 'Noida Sector 62',
    'rk': 'RK Puram', 'vasant': 'Vasant Kunj',
    'saket': 'Saket', 'lajpat': 'Lajpat Nagar',
    // Hyderabad
    'hitec': 'HITEC City', 'hitech': 'HITEC City',
    'gachi': 'Gachibowli', 'madh': 'Madhapur',
    'kondapur': 'Kondapur', 'jubilee': 'Jubilee Hills',
    'banjara': 'Banjara Hills', 'ameerpet': 'Ameerpet',
    // Chennai
    'omr': 'OMR (IT Corridor)', 'ecr': 'ECR',
    'tnagar': 'T. Nagar', 'adyar': 'Adyar',
    'anna nagar': 'Anna Nagar', 'velachery': 'Velachery',
    'tambaram': 'Tambaram', 'porur': 'Porur',
    // Pune
    'kp': 'Koregaon Park', 'krp': 'Koregaon Park',
    'hinjewadi': 'Hinjewadi', 'viman': 'Viman Nagar',
    'sb': 'SB Road', 'fc': 'FC Road',
    'kothrud': 'Kothrud', 'baner': 'Baner',
    'wakad': 'Wakad', 'hadapsar': 'Hadapsar',
  };

  // Count pins near a neighborhood
  function countPinsNear(hood, pins) {
    if (!pins || pins.length === 0) return 0;
    const RADIUS = 0.012; // ~1.3 km
    return pins.filter(p =>
      Math.abs(p.lat - hood.lat) < RADIUS && Math.abs(p.lng - hood.lng) < RADIUS
    ).length;
  }

  // Fuzzy match: handles typos by checking if all chars appear in order
  function fuzzyMatch(text, query) {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    // First try direct includes (best match)
    if (t.includes(q)) return 2;
    // Then try word-start matching (e.g. "kor" matches "Koramangala")
    const words = t.split(/\s+/);
    if (words.some(w => w.startsWith(q))) return 1.5;
    // Then try fuzzy: all chars in order
    let ti = 0;
    for (let qi = 0; qi < q.length; qi++) {
      while (ti < t.length && t[ti] !== q[qi]) ti++;
      if (ti >= t.length) return 0;
      ti++;
    }
    return 1;
  }

  // ---- Search Autocomplete ----
  function initSearch() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchDropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const val = input.value.trim().toLowerCase();
      if (val.length < 1) {
        dropdown.classList.add('hidden');
        return;
      }
      const neighborhoods = DataStore.getNeighborhoods();

      // Check alias first
      const aliasTarget = ALIASES[val];

      // Score each neighborhood
      let scored = neighborhoods.map(n => {
        let score = 0;
        // Alias match = top priority
        if (aliasTarget && n.name.toLowerCase() === aliasTarget.toLowerCase()) {
          score = 10;
        } else {
          score = fuzzyMatch(n.name, val);
        }
        return { ...n, score };
      }).filter(n => n.score > 0);

      // Sort by score (highest first), then alphabetically
      scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      scored = scored.slice(0, 10);

      if (scored.length === 0) {
        dropdown.innerHTML = '<div class="search-empty">No neighborhoods found</div>';
        dropdown.classList.remove('hidden');
        return;
      }

      dropdown.innerHTML = scored.map((n, i) => {
        const pinCount = countPinsNear(n, allPins);
        const countLabel = pinCount > 0 ? `<span class="search-count">${pinCount} pin${pinCount !== 1 ? 's' : ''}</span>` : '';
        return `<div class="search-item" data-idx="${i}" data-lat="${n.lat}" data-lng="${n.lng}" data-name="${n.name}">${highlightMatch(n.name, aliasTarget ? '' : val)}${countLabel}</div>`;
      }).join('');
      dropdown.classList.remove('hidden');

      dropdown.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          const lat = parseFloat(item.dataset.lat);
          const lng = parseFloat(item.dataset.lng);
          const name = item.dataset.name;
          input.value = name;
          dropdown.classList.add('hidden');
          MapManager.flyTo(lat, lng, 15);
          Toast.show(`Showing ${name}`, 'info');
        });
      });
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 1) {
        input.dispatchEvent(new Event('input'));
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        dropdown.classList.add('hidden');
      }
    });

    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.search-item');
      if (items.length === 0) return;

      const active = dropdown.querySelector('.search-item.active');
      let idx = -1;
      if (active) idx = Array.from(items).indexOf(active);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (active) active.classList.remove('active');
        idx = (idx + 1) % items.length;
        items[idx].classList.add('active');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (active) active.classList.remove('active');
        idx = idx <= 0 ? items.length - 1 : idx - 1;
        items[idx].classList.add('active');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active) {
          active.click();
        } else if (items.length > 0) {
          items[0].click();
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
        input.blur();
      }
    });
  }

  function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return text.slice(0, idx) + '<strong>' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
  }

  // ---- Quick Filter Bar (synced with panel) ----
  function initQuickFilters() {
    const bar = document.getElementById('quickFilters');
    if (!bar) return;

    bar.querySelectorAll('.qf-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');

        // Sync to panel checkbox
        const group = chip.dataset.qf; // 'bhk' or 'postType'
        const value = chip.dataset.value;
        const isActive = chip.classList.contains('active');

        const panelCheckbox = document.querySelector(
          `input[name="${group}"][value="${value}"]`
        );
        if (panelCheckbox) panelCheckbox.checked = isActive;

        // Auto-apply filters immediately
        applyCurrentFilters();
      });
    });
  }

  // Sync panel checkboxes → quick filter chips (called when panel Apply is clicked)
  function syncPanelToQuickFilters() {
    // Sync BHK
    document.querySelectorAll('.qf-chip[data-qf="bhk"]').forEach(chip => {
      const cb = document.querySelector(`input[name="bhk"][value="${chip.dataset.value}"]`);
      if (cb) chip.classList.toggle('active', cb.checked);
    });
    // Sync Post Type
    document.querySelectorAll('.qf-chip[data-qf="postType"]').forEach(chip => {
      const cb = document.querySelector(`input[name="postType"][value="${chip.dataset.value}"]`);
      if (cb) chip.classList.toggle('active', cb.checked);
    });
  }

  // ---- Filter Panel ----
  function initFilterPanel() {
    const panel = document.getElementById('filterPanel');
    const toggleBtn = document.getElementById('filterToggleBtn');
    const closeBtn = document.getElementById('closeFilters');
    const clearBtn = document.getElementById('clearFilters');
    const applyBtn = document.getElementById('applyFilters');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        panel.classList.add('hidden');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clearAllFilters();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        applyCurrentFilters();
        syncPanelToQuickFilters();
        panel.classList.add('hidden');
      });
    }

    // Price range sliders
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    const priceMinLabel = document.getElementById('priceMinLabel');
    const priceMaxLabel = document.getElementById('priceMaxLabel');

    if (priceMin && priceMax) {
      const updatePriceLabels = () => {
        let minVal = parseInt(priceMin.value);
        let maxVal = parseInt(priceMax.value);
        if (minVal > maxVal) {
          [priceMin.value, priceMax.value] = [maxVal, minVal];
          [minVal, maxVal] = [maxVal, minVal];
        }
        priceMinLabel.textContent = '\u20B9' + DataStore.formatIndianNumber(minVal);
        priceMaxLabel.textContent = '\u20B9' + DataStore.formatIndianNumber(maxVal);
      };

      priceMin.addEventListener('input', updatePriceLabels);
      priceMax.addEventListener('input', updatePriceLabels);
    }
  }

  function getFilterValues() {
    const filters = {};

    // BHK
    const bhkChecks = document.querySelectorAll('input[name="bhk"]:checked');
    if (bhkChecks.length > 0) {
      filters.bhk = Array.from(bhkChecks).map(c => c.value);
    }

    // Price
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    if (priceMin && priceMax) {
      filters.priceMin = parseInt(priceMin.value);
      filters.priceMax = parseInt(priceMax.value);
    }

    // Furnishing
    const furnChecks = document.querySelectorAll('input[name="furnishing"]:checked');
    if (furnChecks.length > 0) {
      filters.furnishing = Array.from(furnChecks).map(c => c.value);
    }

    // Society
    const socChecks = document.querySelectorAll('input[name="society"]:checked');
    if (socChecks.length > 0) {
      filters.society = Array.from(socChecks).map(c => c.value);
    }

    // Vacancy
    const vacChecks = document.querySelectorAll('input[name="vacancy"]:checked');
    if (vacChecks.length > 0) {
      const vals = Array.from(vacChecks).map(c => c.value);
      filters.vacancy = vals;
    }

    // Post type — array of selected types, no more "all"
    const ptChecks = document.querySelectorAll('input[name="postType"]:checked');
    if (ptChecks.length > 0) {
      filters.postType = Array.from(ptChecks).map(c => c.value);
    } else {
      // Nothing selected = show nothing (empty result)
      filters.postType = [];
    }

    return filters;
  }

  function countActiveFilters() {
    const f = getFilterValues();
    let count = 0;
    if (f.bhk && f.bhk.length > 0) count++;
    if (f.priceMin > 5000 || f.priceMax < 100000) count++;
    if (f.furnishing && f.furnishing.length > 0) count++;
    if (f.society && f.society.length > 0) count++;
    // Vacancy: count as active only if not both selected
    if (f.vacancy && f.vacancy.length > 0 && f.vacancy.length < 2) count++;
    // Post type: count as active only if not all three selected
    if (f.postType && f.postType.length > 0 && f.postType.length < 3) count++;
    return count;
  }

  function updateBadge() {
    const badge = document.getElementById('filterBadge');
    const count = countActiveFilters();
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  function applyCurrentFilters() {
    currentFilters = getFilterValues();
    const filtered = DataStore.filterPins(allPins, currentFilters);
    MapManager.renderPins(filtered);
    updateBadge();
  }

  function clearAllFilters() {
    // Uncheck all panel checkboxes
    document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    // Re-check all vacancy + post type (= show everything)
    document.querySelectorAll('input[name="vacancy"]').forEach(cb => cb.checked = true);
    document.querySelectorAll('input[name="postType"]').forEach(cb => cb.checked = true);

    // Reset sliders
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    if (priceMin) priceMin.value = 5000;
    if (priceMax) priceMax.value = 100000;

    const priceMinLabel = document.getElementById('priceMinLabel');
    const priceMaxLabel = document.getElementById('priceMaxLabel');
    if (priceMinLabel) priceMinLabel.textContent = '\u20B95,000';
    if (priceMaxLabel) priceMaxLabel.textContent = '\u20B91,00,000';

    // Sync quick filters
    syncPanelToQuickFilters();
    // Reset BHK quick filter chips to none active
    document.querySelectorAll('.qf-chip[data-qf="bhk"]').forEach(c => c.classList.remove('active'));

    currentFilters = {};
    MapManager.renderPins(allPins);
    updateBadge();
    Toast.show('Filters cleared', 'info');
  }

  function setAllPins(pins) {
    allPins = pins;
  }

  function getAllPins() {
    return allPins;
  }

  function getCurrentFilters() {
    return currentFilters;
  }

  function init() {
    initSearch();
    initFilterPanel();
    initQuickFilters();
  }

  return {
    init,
    applyCurrentFilters,
    clearAllFilters,
    setAllPins,
    getAllPins,
    getFilterValues,
    getCurrentFilters,
    updateBadge,
    syncPanelToQuickFilters,
  };
})();
