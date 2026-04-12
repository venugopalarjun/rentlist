/* ============================================
   data.js - Data layer with Supabase + localStorage fallback
   ============================================ */

const DataStore = (() => {
  // ---- Supabase Config (replace with your credentials) ----
  const SUPABASE_URL = 'https://chsbrilpfqyqyeoyghcd.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoc2JyaWxwZnF5cXllb3lnaGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDAyMTcsImV4cCI6MjA5MTQ3NjIxN30.d_Kt5z7NG79G36W44xRdWejpF1phSaiZ63CTDzoz47o';
  const TABLE = 'pins';

  let supabase = null;
  let useLocalStorage = true;

  const CITY_KEY = 'rentlist_city';
  const MY_PINS_KEY = 'rentlist_my_pins'; // IDs of pins I created
  const MY_REPORTS_KEY = 'rentlist_my_reports'; // IDs of pins I reported
  const REPORT_THRESHOLD = 3; // Auto-remove after this many reports

  let currentCity = localStorage.getItem(CITY_KEY) || 'bangalore';

  function getStorageKey() { return `rentlist_pins_${currentCity}`; }
  function getCurrentCity() { return currentCity; }
  function getCityData() { return CityData[currentCity]; }

  function getNeighborhoods() {
    const city = getCityData();
    return city ? city.neighborhoods : [];
  }

  // ---- Ownership tracking ----
  function getMyPinIds() {
    try {
      return JSON.parse(localStorage.getItem(MY_PINS_KEY)) || [];
    } catch { return []; }
  }

  function addMyPinId(id) {
    const ids = getMyPinIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(MY_PINS_KEY, JSON.stringify(ids));
    }
  }

  function removeMyPinId(id) {
    const ids = getMyPinIds().filter(i => i !== id);
    localStorage.setItem(MY_PINS_KEY, JSON.stringify(ids));
  }

  function isMyPin(id) {
    return getMyPinIds().includes(id);
  }

  // ---- Helpers ----
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function roundCoord(val) {
    // Round to ~1m precision (5 decimal places ~ 1.1m)
    return Math.round(val * 100000) / 100000;
  }

  function formatIndianNumber(num) {
    if (!num && num !== 0) return '';
    num = parseInt(num);
    if (isNaN(num)) return '';
    const str = num.toString();
    if (str.length <= 3) return str;
    let last3 = str.slice(-3);
    let rest = str.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return rest + ',' + last3;
  }

  function parseIndianNumber(str) {
    if (!str) return 0;
    return parseInt(str.toString().replace(/,/g, '')) || 0;
  }

  // ---- Seed Data: Generate from city profiles ----
  function generateSeedData(cityKey) {
    const city = CityData[cityKey];
    if (!city) return [];

    const seeds = [];
    const now = new Date();
    const neighborhoods = city.neighborhoods;
    const hoodProfiles = city.hoodProfiles || {};
    const hoodWeights = city.hoodWeights || {};

    // Default profile for neighborhoods not listed in hoodProfiles
    const defaultProfile = {
      rent: { '1rk': [5500,9000], 1:[9000,16000], 2:[15000,28000], 3:[24000,45000], 4:[38000,65000] },
      area: { '1rk': [230,360], 1:[430,640], 2:[750,1150], 3:[1100,1700], 4:[1600,2500] },
      gatedPct: 0.50, furnishMix: [0.25, 0.50, 0.25], depositRange: [2,5],
      societies: [null, null, null],
    };

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randBetween(min, max) { return min + Math.random() * (max - min); }
    function roundTo(val, step) { return Math.round(val / step) * step; }

    const bhkOptions = ['1rk', 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4];

    // Build weighted list
    const weightedHoods = [];
    neighborhoods.forEach(hood => {
      const weight = hoodWeights[hood.name] || 2;
      for (let w = 0; w < weight; w++) weightedHoods.push(hood);
    });

    const pinCount = cityKey === 'bangalore' ? 100 : 85;

    for (let i = 0; i < pinCount; i++) {
      const hood = pick(weightedHoods);
      const profile = hoodProfiles[hood.name] || defaultProfile;
      const bhk = pick(bhkOptions);
      const bhkKey = String(bhk);

      // Rent from real neighborhood range
      const [minR, maxR] = profile.rent[bhkKey] || profile.rent[1];
      const rent = roundTo(randBetween(minR, maxR), 500);

      // Area sqft from real range
      const [minA, maxA] = profile.area[bhkKey] || profile.area[1];
      const area = roundTo(randBetween(minA, maxA), 50);

      // Deposit: realistic month multiplier for this area
      const [depMin, depMax] = profile.depositRange;
      const depositMonths = Math.floor(randBetween(depMin, depMax + 0.99));
      const deposit = rent * depositMonths;

      // Furnishing weighted by neighborhood profile
      const fRoll = Math.random();
      const furnishing = fRoll < profile.furnishMix[0] ? 'unfurnished'
        : fRoll < profile.furnishMix[0] + profile.furnishMix[1] ? 'semi' : 'fully';

      // Society type weighted
      const society = Math.random() < profile.gatedPct ? 'gated' : 'independent';

      // Real society name (null = no name, just gated/independent)
      const societyName = society === 'gated' ? pick(profile.societies) : null;

      // Spread createdAt over last 90 days so it looks organic
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date(now.getTime() - daysAgo * 86400000).toISOString();

      // Slight coordinate jitter within neighborhood (0.008 degrees ~ 900m)
      const lat = roundCoord(hood.lat + (Math.random() - 0.5) * 0.016);
      const lng = roundCoord(hood.lng + (Math.random() - 0.5) * 0.016);

      seeds.push({
        id: generateId(),
        postType: 'tenant',
        bhk,
        rent,
        deposit,
        depositMonths,
        furnishing,
        society,
        availableFrom: null,
        floor: null,
        area: null,
        pets: null,
        notes: societyName ? societyName : '',
        contact: '',
        lat,
        lng,
        neighborhood: hood.name,
        vacantSoon: false,
        reports: 0,
        createdAt,
      });
    }

    return seeds;
  }

  // ---- Switch City ----
  function switchCity(cityKey) {
    if (!CityData[cityKey]) return false;
    currentCity = cityKey;
    localStorage.setItem(CITY_KEY, cityKey);

    // Seed if needed
    if (useLocalStorage) {
      const SEED_VERSION = 'v6';
      const key = getStorageKey();
      const existing = localStorage.getItem(key);
      const version = localStorage.getItem(key + '_version');
      if (!existing || version !== SEED_VERSION) {
        const seeds = generateSeedData(cityKey);
        localStorage.setItem(key, JSON.stringify(seeds));
        localStorage.setItem(key + '_version', SEED_VERSION);
      }
    }
    return true;
  }

  // ---- Init ----
  function init() {
    // Try to init Supabase (CDN exposes window.supabase.createClient)
    if (typeof window !== 'undefined' &&
        SUPABASE_URL && !SUPABASE_URL.includes('YOUR_PROJECT')) {
      try {
        const createClient = window.supabase?.createClient;
        if (createClient) {
          supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
          useLocalStorage = false;
          console.log('[DataStore] Using Supabase backend');
        }
      } catch (e) {
        console.warn('[DataStore] Supabase init failed, using localStorage', e);
      }
    }

    if (useLocalStorage) {
      console.log('[DataStore] Using localStorage (demo mode) — set SUPABASE_URL & KEY in data.js to go live');
      // Seed localStorage if empty or outdated for current city
      const SEED_VERSION = 'v6';
      const key = getStorageKey();
      const existing = localStorage.getItem(key);
      const version = localStorage.getItem(key + '_version');
      if (!existing || version !== SEED_VERSION) {
        const seeds = generateSeedData(currentCity);
        localStorage.setItem(key, JSON.stringify(seeds));
        localStorage.setItem(key + '_version', SEED_VERSION);
      }
    }
  }

  // ---- Auto-expiry ----
  const TENANT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;  // 1 year
  const LISTING_EXPIRY_MS = 15 * 24 * 60 * 60 * 1000;   // 15 days

  function filterExpired(pins) {
    const now = new Date();
    return pins.filter(pin => {
      if (!pin.createdAt) return true;
      const age = now - new Date(pin.createdAt);
      // Tenant pins expire after 1 year
      if (pin.postType === 'tenant') return age < TENANT_EXPIRY_MS;
      // Owner & flatmate pins expire after 15 days
      return age < LISTING_EXPIRY_MS;
    });
  }

  // ---- CRUD Operations ----

  // Fetch all pins (used for initial load & localStorage)
  async function getPins() {
    let pins;
    if (useLocalStorage) {
      const data = localStorage.getItem(getStorageKey());
      pins = data ? JSON.parse(data) : [];
    } else {
      const { data, error } = await supabase.from(TABLE).select('*').eq('city', currentCity).order('"createdAt"', { ascending: false });
      if (error) { console.error(error); return []; }
      pins = data;
    }
    // Auto-remove expired owner/flatmate pins
    const active = filterExpired(pins);
    if (active.length < pins.length && useLocalStorage) {
      localStorage.setItem(getStorageKey(), JSON.stringify(active));
    }
    return active;
  }

  // Fetch pins within a map viewport (bounds object: {south, north, west, east})
  async function getPinsByBounds(bounds) {
    if (useLocalStorage) {
      const all = await getPins();
      return all.filter(p =>
        p.lat >= bounds.south && p.lat <= bounds.north &&
        p.lng >= bounds.west && p.lng <= bounds.east
      );
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('city', currentCity)
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east)
      .order('"createdAt"', { ascending: false });

    if (error) { console.error(error); return []; }
    return filterExpired(data);
  }

  async function createPin(pin) {
    pin.id = generateId();
    pin.lat = roundCoord(pin.lat);
    pin.lng = roundCoord(pin.lng);
    pin.createdAt = new Date().toISOString();
    pin.reports = 0;
    pin.city = currentCity;

    if (useLocalStorage) {
      const pins = await getPins();
      pins.unshift(pin);
      localStorage.setItem(getStorageKey(), JSON.stringify(pins));
    } else {
      const { data, error } = await supabase.from(TABLE).insert([pin]).select();
      if (error) { console.error(error); return null; }
      pin = data[0];
    }

    // Track as my pin
    addMyPinId(pin.id);
    return pin;
  }

  async function updatePin(updatedPin) {
    if (useLocalStorage) {
      let pins = await getPins();
      const idx = pins.findIndex(p => p.id === updatedPin.id);
      if (idx === -1) return null;
      pins[idx] = { ...pins[idx], ...updatedPin };
      localStorage.setItem(getStorageKey(), JSON.stringify(pins));
      return pins[idx];
    }

    const { id, ...rest } = updatedPin;
    const { data, error } = await supabase.from(TABLE).update(rest).eq('id', id).select();
    if (error) { console.error(error); return null; }
    return data[0];
  }

  async function deletePin(id) {
    if (useLocalStorage) {
      let pins = await getPins();
      pins = pins.filter(p => p.id !== id);
      localStorage.setItem(getStorageKey(), JSON.stringify(pins));
    } else {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) { console.error(error); return false; }
    }

    // Remove from my pins
    removeMyPinId(id);
    return true;
  }

  function filterPins(pins, filters) {
    return pins.filter(pin => {
      // BHK
      if (filters.bhk && filters.bhk.length > 0) {
        if (!filters.bhk.includes(String(pin.bhk))) return false;
      }
      // Price range
      if (filters.priceMin !== undefined && pin.rent < filters.priceMin) return false;
      if (filters.priceMax !== undefined && pin.rent > filters.priceMax) return false;
      // Furnishing
      if (filters.furnishing && filters.furnishing.length > 0) {
        if (!filters.furnishing.includes(pin.furnishing)) return false;
      }
      // Society
      if (filters.society && filters.society.length > 0) {
        if (!filters.society.includes(pin.society)) return false;
      }
      // Post type (always an array now)
      if (filters.postType && Array.isArray(filters.postType)) {
        if (filters.postType.length === 0) return false;
        if (!filters.postType.includes(pin.postType)) return false;
      }
      // Vacancy
      if (filters.vacancy && Array.isArray(filters.vacancy) && filters.vacancy.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const matchesNow = pin.availableFrom ? pin.availableFrom <= today : true;
        const matchesSoon = pin.vacantSoon === true;
        const hasNow = filters.vacancy.includes('now');
        const hasSoon = filters.vacancy.includes('soon');
        if (hasNow && hasSoon) {
          // no filter
        } else if (hasNow) {
          if (!matchesNow) return false;
        } else if (hasSoon) {
          if (!matchesSoon) return false;
        }
      }
      return true;
    });
  }

  // ---- Reporting ----
  function getMyReportIds() {
    try {
      return JSON.parse(localStorage.getItem(MY_REPORTS_KEY)) || [];
    } catch { return []; }
  }

  function hasReported(pinId) {
    return getMyReportIds().includes(pinId);
  }

  function addMyReport(pinId) {
    const ids = getMyReportIds();
    if (!ids.includes(pinId)) {
      ids.push(pinId);
      localStorage.setItem(MY_REPORTS_KEY, JSON.stringify(ids));
    }
  }

  async function reportPin(id) {
    if (hasReported(id)) {
      return { alreadyReported: true };
    }

    if (useLocalStorage) {
      let pins = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
      const idx = pins.findIndex(p => p.id === id);
      if (idx === -1) return null;

      pins[idx].reports = (pins[idx].reports || 0) + 1;
      addMyReport(id);

      if (pins[idx].reports >= REPORT_THRESHOLD) {
        pins.splice(idx, 1);
        localStorage.setItem(getStorageKey(), JSON.stringify(pins));
        return { removed: true };
      }

      localStorage.setItem(getStorageKey(), JSON.stringify(pins));
      return { reported: true, count: pins[idx].reports };
    } else {
      const { data: current, error: fetchErr } = await supabase.from(TABLE).select('reports').eq('id', id).single();
      if (fetchErr) { console.error(fetchErr); return null; }

      const newCount = (current.reports || 0) + 1;
      addMyReport(id);

      if (newCount >= REPORT_THRESHOLD) {
        const { error } = await supabase.from(TABLE).delete().eq('id', id);
        if (error) { console.error(error); return null; }
        return { removed: true };
      }

      const { error } = await supabase.from(TABLE).update({ reports: newCount }).eq('id', id);
      if (error) { console.error(error); return null; }
      return { reported: true, count: newCount };
    }
  }

  function resetSeedData() {
    const seeds = generateSeedData(currentCity);
    localStorage.setItem(getStorageKey(), JSON.stringify(seeds));
    return seeds;
  }

  // ---- Public API ----
  return {
    init,
    getPins,
    getPinsByBounds,
    createPin,
    updatePin,
    deletePin,
    isMyPin,
    filterPins,
    resetSeedData,
    reportPin,
    hasReported,
    switchCity,
    getCurrentCity,
    getCityData,
    getNeighborhoods,
    formatIndianNumber,
    parseIndianNumber,
    generateId,
    roundCoord,
    // Backward compat — dynamic getter
    get NEIGHBORHOODS() { return getNeighborhoods(); },
  };
})();
