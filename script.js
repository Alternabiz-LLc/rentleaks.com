/**
 * RentLeaks — Flexible housing product
 * Search, match, compare, apply, list — driven by data.js
 */
(function () {
  const DATA = window.RENTLEAKS_DATA || { listings: [], cities: [], housingTypes: [] };
  const STORE = {
    saved: 'rl_saved',
    compare: 'rl_compare',
    profile: 'rl_profile',
    session: 'rl_session',
    alerts: 'rl_alerts',
    listings: 'rl_my_listings',
    recent: 'rl_recent',
    match: 'rl_match',
    currency: 'rl_currency'
  };

  const state = {
    type: '',
    city: '',
    location: '',
    priceMin: null,
    priceMax: null,
    beds: null,
    minStay: null,
    moveIn: '',
    furnished: '',
    pets: '',
    privateBath: false,
    workspace: false,
    noFee: false,
    utilitiesIn: false,
    verified: false,
    sort: 'newest',
    view: 'grid',
    page: 1
  };
  const PAGE_SIZE = 24;
  let browseMap = null;
  let browseMarkers = [];

  /* ---------- theme ---------- */
  function currentTheme() {
    try { return localStorage.getItem('rl_theme') || 'system'; } catch (e) { return 'system'; }
  }
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    try { localStorage.setItem('rl_theme', mode); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#0B1418' : '#FAF7F2');
    }
  }
  function resolvedDark() {
    const m = currentTheme();
    if (m === 'dark') return true;
    if (m === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function toggleTheme() { applyTheme(resolvedDark() ? 'light' : 'dark'); }

  /* ---------- value signal: all-in vs city benchmark ---------- */
  function cityBenchmark(l) {
    const c = cityMeta(l.cityId);
    if (!c) return null;
    const roomish = l.housingType === 'room' || l.housingType === 'coliving';
    // City benchmarks are stored in that city's own currency, matching the
    // listing, so no conversion is needed here.
    const base = roomish ? c.avgRoom : c.avgFurnished;
    return Number.isFinite(base) && base > 0 ? base : null;
  }
  function leakChip(l) {
    const base = cityBenchmark(l);
    if (!base) return '';
    const delta = Math.round(((allIn(l) - base) / base) * 100);
    if (delta <= -8) return '<span class="rl-leak rl-leak--under" title="Versus the typical all-in price in this market">' + Math.abs(delta) + '% under market</span>';
    if (delta >= 12) return '<span class="rl-leak rl-leak--over" title="Versus the typical all-in price in this market">' + delta + '% over market</span>';
    return '<span class="rl-leak" title="Versus the typical all-in price in this market">At market</span>';
  }

  /* ---------- fee transparency ---------- */
  const FEE_LABELS = { broker: 'Broker fee', utilities: 'Utilities', wifi: 'Wi-Fi', cleaning: 'Cleaning', parking: 'Parking', amenity: 'Amenity fee', admin: 'Admin fee' };
  function feeRows(l) {
    const fees = l.fees || {};
    const rows = [{ k: 'Base rent', v: money(l.price, l), zero: false }];
    Object.keys(fees).forEach((k) => {
      const amount = Number(fees[k] || 0);
      rows.push({ k: FEE_LABELS[k] || k, v: amount ? money(amount, l) : 'Included', zero: !amount });
    });
    return rows;
  }
  function feeStackHtml(l) {
    return '<div class="rl-fee-stack">' +
      feeRows(l).map((r) => '<div class="rl-fee-stack__row' + (r.zero ? ' rl-fee-stack__row--zero' : '') + '"><span>' + escapeHtml(r.k) + '</span><span>' + r.v + '</span></div>').join('') +
      '<div class="rl-fee-stack__row rl-fee-stack__row--total"><span>All-in / month</span><span>' + money(allIn(l), l) + '</span></div>' +
      '</div>';
  }
  function closeFeePop() {
    const el = $('#rl-fee-pop');
    if (el) el.remove();
  }
  function openFeePop(trigger, id) {
    closeFeePop();
    const l = listingById(id);
    if (!l) return;
    const pop = document.createElement('div');
    pop.id = 'rl-fee-pop';
    pop.className = 'rl-pop-over';
    pop.innerHTML = '<p class="rl-side__title" style="margin-bottom:.5rem">What you actually pay</p>' + feeStackHtml(l);
    document.body.appendChild(pop);
    const r = trigger.getBoundingClientRect();
    const w = pop.offsetWidth;
    let left = r.left + window.scrollX;
    if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12;
    pop.style.position = 'absolute';
    pop.style.left = Math.max(12, left) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
  }

  /* ---------- svg icons ---------- */
  function iconSearch() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  }
  function iconSun() {
    return '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  }
  function iconMoon() {
    return '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  }

  /* ---------- progressive enhancement of any search form ---------- */
  function decorateSearchFields() {
    $$('.search-field').forEach((field) => {
      if (field.querySelector('.search-field__label')) return;
      const control = field.querySelector('input, select');
      if (!control) return;
      const text = control.getAttribute('aria-label') || control.getAttribute('placeholder') || '';
      if (!text) return;
      const label = document.createElement('span');
      label.className = 'search-field__label';
      label.textContent = text.length > 18 ? text.slice(0, 17) + '…' : text;
      field.insertBefore(label, field.firstChild);
      field.classList.add('search-field--labeled');
      if (control.tagName === 'INPUT' && control.placeholder === text) {
        control.placeholder = control.type === 'number' ? 'Any' : 'Any area';
      }
    });
    $$('.btn--search').forEach((btn) => {
      if (btn.dataset.iconised) return;
      btn.dataset.iconised = '1';
      const label = btn.textContent.trim() || 'Search';
      btn.innerHTML = iconSearch() + '<span class="btn__label">' + label + '</span>';
      btn.setAttribute('aria-label', label);
    });
  }

  /* ---------- skeletons ---------- */
  function skeletonCards(n) {
    let html = '';
    for (let i = 0; i < n; i += 1) {
      html += '<div class="rl-skel-card"><div class="rl-skel"></div><div class="rl-skel"></div><div class="rl-skel"></div><div class="rl-skel"></div></div>';
    }
    return html;
  }

  /* ---------- active filter chips ---------- */
  const CHIP_DEFS = [
    { key: 'type', label: (v) => typeMeta(v).label },
    { key: 'city', label: (v) => (cityMeta(v) || {}).name || v },
    { key: 'location', label: (v) => '“' + v + '”' },
    { key: 'priceMin', label: (v) => 'From ' + money(v) },
    { key: 'priceMax', label: (v) => 'Up to ' + money(v) },
    { key: 'minStay', label: (v) => v + ' mo stay' },
    { key: 'moveIn', label: (v) => 'By ' + formatDate(v) },
    { key: 'privateBath', label: () => 'Private bath' },
    { key: 'workspace', label: () => 'Workspace' },
    { key: 'noFee', label: () => 'No broker fee' },
    { key: 'utilitiesIn', label: () => 'Utilities included' },
    { key: 'verified', label: () => 'Verified host' },
    { key: 'furnished', label: () => 'Fully furnished' },
    { key: 'pets', label: () => 'Pets ok' }
  ];
  function renderChips() {
    const host = $('#rl-chips');
    if (!host) return;
    const chips = CHIP_DEFS.filter((d) => state[d.key]).map((d) =>
      '<button type="button" class="rl-chip is-on" data-chip="' + d.key + '">' +
      escapeHtml(String(d.label(state[d.key]))) + '<span class="rl-chip__x" aria-hidden="true">✕</span>' +
      '<span class="sr-only">Remove filter</span></button>');
    if (chips.length > 1) chips.push('<button type="button" class="rl-chip rl-chip--clear" data-chip="__all">Clear all</button>');
    host.innerHTML = chips.join('');
    host.hidden = chips.length === 0;
  }
  function clearFilter(key) {
    state.page = 1;
    const boolKeys = { privateBath: 1, workspace: 1, noFee: 1, utilitiesIn: 1, verified: 1 };
    if (key === '__all') {
      CHIP_DEFS.forEach((d) => { state[d.key] = boolKeys[d.key] ? false : (d.key === 'priceMin' || d.key === 'priceMax' || d.key === 'minStay' ? null : ''); });
    } else {
      state[key] = boolKeys[key] ? false : (key === 'priceMin' || key === 'priceMax' || key === 'minStay' ? null : '');
    }
    syncFormFromState();
    pushBrowseUrl();
    renderListings();
  }
  function syncFormFromState() {
    const set = (sel, val) => { const el = $(sel); if (el) el.value = val == null ? '' : val; };
    set('#city', state.city); set('#housing-type', state.type); set('#location', state.location);
    set('#price-min', state.priceMin); set('#price-max', state.priceMax);
    set('#min-stay', state.minStay); set('#move-in', state.moveIn);
    const chk = (sel, on) => { const el = $(sel); if (el) el.checked = !!on; };
    chk('#filter-furnished', state.furnished === 'fully');
    chk('#filter-pets', state.pets === 'yes');
    chk('#filter-bath', state.privateBath);
    chk('#filter-work', state.workspace);
    chk('#filter-nofee', state.noFee);
    chk('#filter-utils', state.utilitiesIn);
    chk('#filter-verified', state.verified);
  }

  /* ---------- filter rail state ---------- */
  function paintRail() {
    const mark = (sel, attr, value) => {
      $$(sel + ' [' + attr + ']').forEach((b) => {
        b.classList.toggle('is-on', String(b.getAttribute(attr)) === String(value == null ? '' : value));
      });
    };
    mark('#rl-opt-type', 'data-set-type', state.type);
    mark('#rl-opt-beds', 'data-set-beds', state.beds);
    mark('#rl-opt-stay', 'data-set-stay', state.minStay);
    mark('#rl-opt-budget', 'data-set-max', state.priceMax);
    const min = $('#rail-min'); const max = $('#rail-max');
    if (min && document.activeElement !== min) min.value = state.priceMin || '';
    if (max && document.activeElement !== max) max.value = state.priceMax || '';
  }

  /* ---------- live data bridge ---------- */
  // Server-side results, when the API answered. null means "use the baked
  // catalog", which is also what we fall back to on any failure.
  let liveResult = null;

  function apiEnabled() {
    return !!(window.RLData && window.RLData.enabled);
  }

  function markLiveState(isLive) {
    document.body.classList.toggle('rl-live', !!isLive);
    const dot = $('#rl-live-badge');
    if (dot) {
      dot.textContent = isLive ? 'Live' : 'Cached';
      dot.classList.toggle('is-stale', !isLive);
    }
  }

  /* ---------- pagination ---------- */
  function renderPager(shown, total) {
    let pager = $('#rl-pager');
    const results = $('#rl-results') || ($('#listings-grid') || {}).parentNode;
    if (!results) return;
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'rl-pager';
      pager.className = 'rl-pager';
      results.appendChild(pager);
    }
    if (!total) { pager.hidden = true; return; }
    pager.hidden = false;
    const done = shown >= total;
    pager.innerHTML =
      '<p class="rl-pager__count">Showing <strong>' + shown.toLocaleString() + '</strong> of <strong>' + total.toLocaleString() + '</strong> homes</p>' +
      '<div class="rl-pager__bar"><span style="width:' + Math.round((shown / total) * 100) + '%"></span></div>' +
      (done
        ? '<p class="rl-pager__end">That is every home matching these filters.</p>'
        : '<button type="button" class="btn btn--outline js-load-more">Show ' + Math.min(PAGE_SIZE, total - shown) + ' more</button>');
  }

  /* ---------- mobile filter sheet ---------- */
  function openFilterSheet() {
    const side = $('#rl-filters');
    if (!side) return;
    side.classList.add('is-open');
    let scrim = $('#rl-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'rl-scrim';
      scrim.className = 'rl-scrim';
      document.body.appendChild(scrim);
      scrim.addEventListener('click', closeFilterSheet);
    }
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  }
  function closeFilterSheet() {
    const side = $('#rl-filters');
    if (side) side.classList.remove('is-open');
    const scrim = $('#rl-scrim');
    if (scrim) scrim.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function appOrigin() {
    if (window.RL_APP_URL) return String(window.RL_APP_URL).replace(/\/$/, '');
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'http://localhost:3100';
    return '';
  }
  function appHref(path, fallback) {
    const origin = appOrigin();
    return origin ? origin + path : assetBase() + fallback;
  }

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }
  /* ---------------------------------------------------------------------
   * Money
   * -------------------------------------------------------------------
   * Prices are stored in each market's own currency. Everything on screen is
   * converted into ONE display currency so figures stay comparable — mixing
   * £1,840 and C$1,415 in a sorted list is meaningless.
   *
   * money(amount, ctx) where ctx is a currency code, or any object carrying
   * one (a listing or a city). Omit ctx only for figures already expressed in
   * the display currency, such as the visitor's own budget input.
   * ------------------------------------------------------------------- */
  const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'CHF'];

  function displayCurrency() {
    const saved = read(STORE.currency, null);
    if (saved && CURRENCIES.indexOf(saved) !== -1) return saved;
    // Fall back to something sensible for the visitor's locale.
    try {
      const region = (navigator.language || '').split('-')[1];
      const byRegion = { CA: 'CAD', GB: 'GBP', CH: 'CHF', IE: 'EUR', FR: 'EUR', ES: 'EUR', NL: 'EUR', DE: 'EUR', IT: 'EUR' };
      if (region && byRegion[region]) return byRegion[region];
    } catch (e) { /* ignore */ }
    return 'USD';
  }

  function setDisplayCurrency(code) {
    if (CURRENCIES.indexOf(code) === -1) return;
    write(STORE.currency, code);
    document.dispatchEvent(new CustomEvent('rl:currency', { detail: code }));
  }

  function sourceCurrency(ctx) {
    if (!ctx) return null;
    if (typeof ctx === 'string') return ctx;
    if (ctx.currency) return ctx.currency;
    if (ctx.cityId) {
      const c = cityMeta(ctx.cityId);
      if (c && c.currency) return c.currency;
    }
    if (ctx.country && DATA.currencyForCountry) return DATA.currencyForCountry(ctx.country);
    return null;
  }

  function money(n, ctx) {
    const to = displayCurrency();
    const from = sourceCurrency(ctx) || to;
    const value = DATA.convert ? DATA.convert(n, from, to) : Number(n || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: to,
        minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(Math.round(value));
    } catch (e) {
      return (to === 'USD' ? '$' : to + ' ') + Math.round(value).toLocaleString();
    }
  }

  /** Comparable figure for sorting and budget filters, regardless of market. */
  function allInDisplay(l) {
    return DATA.convert
      ? DATA.convert(allIn(l), sourceCurrency(l) || 'USD', displayCurrency())
      : allIn(l);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function params() { return new URLSearchParams(window.location.search); }
  function typeMeta(id) {
    return (DATA.housingTypes || []).find((t) => t.id === id) || { id: id, label: id, short: id };
  }
  function cityMeta(id) {
    if (DATA.getCity) return DATA.getCity(id);
    return (DATA.cities || []).find((c) => c.id === id);
  }
  function listingById(id) {
    return (DATA.listings || []).find((l) => String(l.id) === String(id));
  }

  function listingMedia(l) {
    if (!l) return [];
    if (l.gallery && l.gallery.length) return l.gallery;
    const photos = (l.images || [l.image]).filter(Boolean).map((src, i) => ({
      kind: 'photo',
      src: src,
      caption: i === 0 ? 'Main photo' : 'Photo ' + (i + 1),
      alt: l.imageAlt || l.title
    }));
    if (l.video) {
      photos.push({
        kind: 'video',
        src: l.video.src,
        poster: l.video.poster || l.image,
        caption: l.video.caption || 'Video tour',
        alt: 'Video tour of ' + l.title
      });
    }
    return photos;
  }

  const lbState = { items: [], index: 0 };

  function ensureLightbox() {
    let el = $('#rl-lb');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'rl-lb';
    el.className = 'rl-lb';
    el.hidden = true;
    el.innerHTML = `
      <div class="rl-lb__shade" data-lb-close></div>
      <div class="rl-lb__panel" role="dialog" aria-modal="true" aria-label="Photo and video gallery">
        <button type="button" class="rl-lb__close" data-lb-close aria-label="Close gallery">Close</button>
        <button type="button" class="rl-lb__nav rl-lb__nav--prev" data-lb-step="-1" aria-label="Previous">‹</button>
        <button type="button" class="rl-lb__nav rl-lb__nav--next" data-lb-step="1" aria-label="Next">›</button>
        <div class="rl-lb__stage" id="rl-lb-stage"></div>
        <div class="rl-lb__meta">
          <p class="rl-lb__count" id="rl-lb-count"></p>
          <p class="rl-lb__cap" id="rl-lb-cap"></p>
        </div>
        <div class="rl-lb__film" id="rl-lb-film"></div>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  function paintLightbox() {
    const items = lbState.items;
    const item = items[lbState.index];
    if (!item) return;
    const stage = $('#rl-lb-stage');
    const cap = $('#rl-lb-cap');
    const count = $('#rl-lb-count');
    if (item.kind === 'video') {
      stage.innerHTML = '<video class="rl-lb__video" src="' + item.src + '" poster="' + escapeHtml(item.poster || '') + '" controls autoplay playsinline></video>';
    } else {
      const playing = stage.querySelector('video');
      if (playing) playing.pause();
      stage.innerHTML = '<img class="rl-lb__img" src="' + item.src + '" alt="' + escapeHtml(item.alt || item.caption || '') + '">';
    }
    if (cap) cap.textContent = item.caption || '';
    if (count) count.textContent = (lbState.index + 1) + ' / ' + items.length;
    $$('#rl-lb-film [data-lb-goto]').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.lbGoto) === lbState.index));
  }

  function openLightbox(items, index) {
    lbState.items = items || [];
    lbState.index = Math.max(0, Math.min(Number(index) || 0, Math.max(0, lbState.items.length - 1)));
    const el = ensureLightbox();
    const film = $('#rl-lb-film');
    if (film) {
      film.innerHTML = lbState.items.map((item, idx) => {
        const thumb = item.kind === 'video' ? (item.poster || item.src) : item.src;
        return '<button type="button" class="rl-lb__thumb' + (idx === lbState.index ? ' is-on' : '') + '" data-lb-goto="' + idx + '">' +
          '<img src="' + thumb + '" alt="">' +
          (item.kind === 'video' ? '<span class="rl-lb__play">▶</span>' : '') +
          '</button>';
      }).join('');
    }
    el.hidden = false;
    el.classList.add('is-open');
    document.body.classList.add('rl-lb-lock');
    paintLightbox();
  }

  function closeLightbox() {
    const el = $('#rl-lb');
    if (!el) return;
    const vid = el.querySelector('video');
    if (vid) vid.pause();
    el.hidden = true;
    el.classList.remove('is-open');
    document.body.classList.remove('rl-lb-lock');
  }

  function stepLightbox(dir) {
    if (!lbState.items.length) return;
    lbState.index = (lbState.index + dir + lbState.items.length) % lbState.items.length;
    paintLightbox();
  }

  function renderGalleryMosaic(l) {
    const items = listingMedia(l);
    const photos = items.filter((x) => x.kind === 'photo');
    const video = items.find((x) => x.kind === 'video');
    const show = photos.slice(0, 4);
    const tiles = show.map((item, i) => (
      '<button type="button" class="rl-mosaic__cell' + (i === 0 ? ' rl-mosaic__cell--hero' : '') + '" data-open-gallery="' + escapeHtml(l.id) + '" data-gallery-index="' + items.indexOf(item) + '">' +
        '<img src="' + item.src + '" alt="' + escapeHtml(item.alt || item.caption || l.title) + '" width="1400" height="933">' +
        '<span class="rl-mosaic__label">' + escapeHtml(item.caption || '') + '</span></button>'
    )).join('');
    const videoIndex = video ? items.indexOf(video) : 0;
    const videoTile = video
      ? '<button type="button" class="rl-mosaic__cell rl-mosaic__cell--video" data-open-gallery="' + escapeHtml(l.id) + '" data-gallery-index="' + videoIndex + '">' +
        '<img src="' + (video.poster || l.image) + '" alt="' + escapeHtml(video.alt || 'Video tour') + '">' +
        '<span class="rl-mosaic__play" aria-hidden="true">▶</span>' +
        '<span class="rl-mosaic__label">Video tour</span></button>'
      : '';
    return `
      <div class="rl-mosaic" id="rl-gallery">
        ${tiles}${videoTile}
        <button type="button" class="rl-mosaic__all" data-open-gallery="${escapeHtml(l.id)}" data-gallery-index="0">
          Show all ${items.length} photos &amp; video
        </button>
      </div>`;
  }

  function renderVideoTour(l) {
    if (!l.video || !l.video.src) return '';
    const items = listingMedia(l);
    const videoIndex = Math.max(0, items.findIndex((x) => x.kind === 'video'));
    return `
      <section class="rl-block rl-tour">
        <div class="rl-tour__head">
          <h2>Video tour</h2>
          <button type="button" class="btn btn--outline" data-open-gallery="${escapeHtml(l.id)}" data-gallery-index="${videoIndex}">Open in gallery</button>
        </div>
        <div class="rl-tour__frame">
          <video poster="${escapeHtml(l.video.poster || l.image)}" controls preload="metadata" playsinline src="${l.video.src}"></video>
        </div>
        <p>${escapeHtml(l.video.caption || 'Watch the host walk the bedroom, bath, and shared kitchen.')} Book a live tour before you send a deposit.</p>
      </section>`;
  }

  const MENU_HEROES = {
    room: {
      crumb: 'Rooms',
      kicker: 'Private bedrooms · 30-day minimum',
      title: 'Rooms you can see before you tour',
      blurb: 'A real bedroom with a door, named housemates, a photo gallery, and a video walkthrough. Rent is all-in.',
      film: 'See the rooms',
      filmSub: 'Bedroom, bath, kitchen, and a host video — not a single hero crop.',
      cta: 'Browse rooms',
      jump: '#listings'
    },
    coliving: {
      crumb: 'Co-living',
      kicker: 'Designed buildings · per-room inventory',
      title: 'Co-living with a real room list',
      blurb: 'Cleaning, coworking, and events are on the page. Inventory is per room — not a mystery house share.',
      film: 'See the buildings',
      filmSub: 'Studio-style and classic rooms in operated houses across the U.S. and Europe.',
      cta: 'Browse co-living',
      jump: '#listings'
    },
    furnished: {
      crumb: 'Furnished',
      kicker: 'Move in with a suitcase · 30-day minimum',
      title: 'Furnished homes with an inventory',
      blurb: 'Bed, desk, and kitchen tools are listed. No mattress-on-the-floor month. Ideal for relocations and contracts.',
      film: 'See the homes',
      filmSub: 'Inventoried apartments you can take for a month or a year.',
      cta: 'Browse furnished',
      jump: '#listings'
    },
    'short-term': {
      crumb: '1-month+',
      kicker: 'Mid-term housing · never hotel nights',
      title: 'One month or more — a home, not a booking',
      blurb: 'Short-term here starts at 30 days. Utilities and wifi sit in All-in rent. Built for pilots, contracts, and apartment-hunt buffers.',
      film: 'See 1-month+ stays',
      filmSub: 'Furnished mid-term homes in 69 markets.',
      cta: 'Browse 1-month+',
      jump: '#listings'
    },
    'lease-break': {
      crumb: 'Lease-break',
      kicker: 'Takeovers · assignment vs sublet',
      title: 'Take the rest of the lease',
      blurb: 'See the Lease Clock, months left, and whether it is an assignment or a sublet. Posting a lease-break is free.',
      film: 'See takeovers',
      filmSub: 'Remaining terms with takeover math before you send money.',
      cta: 'Browse lease-breaks',
      jump: '#listings'
    },
    cities: {
      crumb: 'Cities',
      kicker: '69 markets · U.S. + Canada + Europe',
      title: 'Pick a city, then a stay type',
      blurb: 'Rooms, co-living, furnished apartments, 1-month+ stays, and lease-breaks in New York, London, Paris, Dublin, Berlin, and 64 more markets.',
      film: 'Featured markets',
      filmSub: 'Jump into a city directory, then filter by stay type.',
      cta: 'Browse all cities',
      jump: '#rl-city-directory'
    },
    match: {
      crumb: 'Match',
      kicker: 'Stay DNA · two minutes',
      title: 'Rank homes by how they fit you',
      blurb: 'City, budget, stay length, and house energy. We score inventory in your browser — no credit pull, no unlock wall.',
      film: 'Homes we can rank',
      filmSub: 'Rooms, co-living, furnished, and takeovers — scored against your Stay DNA.',
      cta: 'Build my Stay DNA',
      jump: '#rl-match'
    }
  };

  function menuHeroKey() {
    const type = document.body.dataset.type || state.type || '';
    if (MENU_HEROES[type]) return type;
    const page = pageName();
    if (MENU_HEROES[page]) return page;
    return '';
  }

  function menuHeroStrip(active) {
    const items = [
      ['room', 'Rooms', 'rooms.html'],
      ['coliving', 'Co-living', 'coliving.html'],
      ['furnished', 'Furnished', 'furnished.html'],
      ['short-term', '1-month+', 'short-term.html'],
      ['lease-break', 'Lease-break', 'lease-break.html'],
      ['cities', 'Cities', 'cities.html'],
      ['match', 'Match', 'match.html']
    ];
    const base = assetBase();
    return '<nav class="rl-hero-menus" aria-label="Stay menus">' + items.map(([key, label, href]) =>
      '<a class="rl-hero-menus__link' + (key === active ? ' is-on' : '') + '" href="' + base + href + '">' + label + '</a>'
    ).join('') + '</nav>';
  }

  function renderMenuHero() {
    const key = menuHeroKey();
    if (!key) return;
    const copy = MENU_HEROES[key];
    const listings = DATA.listings || [];
    const typePool = ['room', 'coliving', 'furnished', 'short-term', 'lease-break'].includes(key)
      ? listings.filter((l) => l.housingType === key)
      : listings.filter((l) => l.featured).concat(listings);
    const pool = typePool.filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
    if (!pool.length) return;
    const featured = pool.filter((l) => l.cityId === 'nyc' || l.featured).concat(pool)
      .filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i)
      .slice(0, 8);
    const lead = pool.find((l) => l.video && l.video.src) || featured[0] || pool[0];
    const leadMedia = listingMedia(lead);
    const videoIndex = Math.max(0, leadMedia.findIndex((x) => x.kind === 'video'));
    const count = key === 'cities' ? (DATA.cities || []).length : pool.length;
    const html = `
      <section class="rl-media-hero" id="rl-menu-hero">
        ${lead.video && lead.video.src
          ? '<video class="rl-media-hero__video" autoplay muted loop playsinline poster="' + lead.image + '" src="' + lead.video.src + '"></video>'
          : '<img class="rl-media-hero__video" src="' + lead.image + '" alt="' + escapeHtml(lead.imageAlt || copy.title) + '">'}
        <div class="rl-media-hero__shade"></div>
        <div class="rl-media-hero__copy container">
          <nav class="rl-crumb rl-crumb--light" aria-label="Breadcrumb"><a href="${assetBase()}index.html">Home</a> / ${copy.crumb}</nav>
          ${menuHeroStrip(key)}
          <p class="rl-kicker rl-kicker--light">${copy.kicker}</p>
          <h1>${copy.title}</h1>
          <p>${copy.blurb}</p>
          <div class="rl-media-hero__actions">
            <a class="btn btn--primary" href="${copy.jump}">${copy.cta}${key !== 'match' && key !== 'cities' ? ' · ' + count : ''}</a>
            ${lead.video && lead.video.src
              ? '<button type="button" class="btn btn--on-dark" data-open-gallery="' + escapeHtml(lead.id) + '" data-gallery-index="' + videoIndex + '">Play video tour</button>'
              : '<a class="btn btn--on-dark" href="' + listingHref(lead) + '">View a featured stay</a>'}
          </div>
        </div>
      </section>
      <section class="rl-room-film container">
        <div class="rl-room-film__head">
          <h2>${copy.film}</h2>
          <p>${copy.filmSub}</p>
        </div>
        <div class="rl-room-film__grid">
          ${featured.map((l) => {
            const photo = listingMedia(l).find((x) => x.kind === 'photo') || { src: l.image };
            return '<a class="rl-room-film__card" href="' + listingHref(l) + '">' +
              '<img src="' + photo.src + '" alt="' + escapeHtml(l.imageAlt || l.title) + '" width="900" height="700" loading="lazy">' +
              (l.video ? '<span class="rl-room-film__vid">Video</span>' : '') +
              '<span class="rl-room-film__cap">' + escapeHtml(l.title) + ' · ' + escapeHtml(l.cityName) + '</span></a>';
          }).join('')}
        </div>
      </section>`;
    let mount = $('#rl-page-hero') || $('#rl-rooms-media');
    if (!mount) {
      const main = $('#main');
      if (!main) return;
      mount = document.createElement('div');
      mount.id = 'rl-page-hero';
      const after = $('#listings') || $('#rl-city-directory') || $('#rl-match') || main.firstElementChild;
      if (after && after.parentElement === main) main.insertBefore(mount, after);
      else if (after && after.closest('section')) main.insertBefore(mount, after.closest('section'));
      else main.insertBefore(mount, main.firstElementChild);
    }
    mount.innerHTML = html;
    const oldHero = $('.page-hero');
    if (oldHero) oldHero.hidden = true;
  }
  function renderRoomsShowcase() { renderMenuHero(); }
  function allIn(l) { return DATA.allIn ? DATA.allIn(l) : (l.allIn || l.price); }
  function daysUntil(iso) {
    if (!iso) return null;
    return Math.round((new Date(iso + 'T12:00:00') - new Date('2026-09-07T12:00:00')) / 86400000);
  }
  function formatDate(iso) {
    if (!iso) return 'Flexible';
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function savedIds() { return read(STORE.saved, []); }
  function compareIds() { return read(STORE.compare, []).slice(0, 3); }
  function session() { return read(STORE.session, null); }
  function profile() { return read(STORE.profile, null); }

  function toast(msg) {
    let el = $('#rl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rl-toast';
      el.className = 'rl-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  function iconPin() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  }

  function pageName() {
    return document.body.dataset.page || 'home';
  }

  function assetBase() {
    const path = window.location.pathname || '';
    if (/\/(listings|cities|operators)\//.test(path)) return '../';
    return '';
  }

  function listingHref(listing) {
    if (listing && listing.path) return assetBase() + listing.path;
    return assetBase() + 'listing.html?id=' + encodeURIComponent(listing && listing.id ? listing.id : '');
  }

  function cityHref(city) {
    const slug = city.slug || (DATA.slugify ? DATA.slugify(city.name) : city.id);
    return assetBase() + 'cities/' + slug + '.html';
  }

  function typeHref(typeId) {
    const files = DATA.typeFiles || {};
    return assetBase() + (files[typeId] || ('rent.html?type=' + encodeURIComponent(typeId)));
  }

  function navLink(href, label, key) {
    const page = pageName();
    const type = params().get('type') || params().get('category') || document.body.dataset.type || '';
    const typeKeys = { room: 1, coliving: 1, furnished: 1, 'short-term': 1, aparthotel: 1, 'lease-break': 1 };
    const active = page === key || (typeKeys[key] && type === key);
    return '<li><a href="' + href + '" class="nav__link' + (active ? ' nav__link--active' : '') + '">' + label + '</a></li>';
  }


  function injectChrome() {
    const saved = savedIds().length;
    const user = session();
    const base = assetBase();
    const headerHost = $('#rl-header');
    if (headerHost) {
      headerHost.innerHTML = `
        <header class="header">
          <div class="header__container">
            <a href="${base}index.html" class="logo" aria-label="RentLeaks home">
              <span class="logo__mark">RL</span>
              <span class="logo__text">RentLeaks</span>
            </a>
            <nav class="nav" id="rl-nav" aria-label="Main navigation">
              <ul class="nav__list">
                ${navLink(base + 'rooms.html', 'Rooms', 'room')}
                ${navLink(base + 'coliving.html', 'Co-living', 'coliving')}
                ${navLink(base + 'furnished.html', 'Furnished', 'furnished')}
                ${navLink(base + 'short-term.html', '1-month+', 'short-term')}
                ${navLink(base + 'aparthotel.html', 'Aparthotel', 'aparthotel')}
                ${navLink(base + 'lease-break.html', 'Lease-break', 'lease-break')}
                ${navLink(base + 'cities.html', 'Cities', 'cities')}
                ${navLink(base + 'operators.html', 'Operators', 'operators')}
                ${navLink(base + 'match.html', 'Stay DNA', 'match')}
              </ul>
            </nav>
            <div class="header__actions">
              <button type="button" class="header__link js-cmd" aria-label="Search everything">
                <span class="js-cmd__label">Search everything</span><kbd>⌘K</kbd>
              </button>
              <a href="${base}saved.html" class="header__link">Saved${saved ? ' <span class="rl-count">' + saved + '</span>' : ''}</a>
              <a href="${appHref('/list', base + 'list.html')}" class="header__link">List a place</a>
              <label class="cur-select" title="Display currency">
                <span class="sr-only">Display currency</span>
                <select class="js-currency" aria-label="Display currency">
                  ${CURRENCIES.map((c) => '<option value="' + c + '"' + (c === displayCurrency() ? ' selected' : '') + '>' + c + '</option>').join('')}
                </select>
              </label>
              <button type="button" class="theme-toggle js-theme" aria-label="Switch colour theme">${iconSun()}${iconMoon()}</button>
              ${user
                ? '<a href="' + base + 'saved.html" class="btn btn--primary btn--sm">' + escapeHtml(user.name.split(' ')[0]) + '</a>'
                : '<a href="' + appHref('/login', base + 'index.html') + '" class="btn btn--primary btn--sm' + (appOrigin() ? '' : ' js-modal-trigger') + '" data-modal="auth">Sign in</a>'}
              <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="rl-nav"><span></span><span></span><span></span></button>
            </div>
          </div>
        </header>`;
    }

    const footerHost = $('#rl-footer');
    if (footerHost) {
      const typeLinks = (DATA.housingTypes || []).map((t) => '<li><a href="' + base + (t.href || typeHref(t.id)) + '">' + t.label + '</a></li>').join('');
      const featuredCities = (DATA.cities || []).filter((c) => c.featured);
      const cityLinks = featuredCities.filter((c) => (c.country || 'US') === 'US').slice(0, 4)
        .concat(featuredCities.filter((c) => (c.country || 'US') !== 'US').slice(0, 5))
        .map((c) => '<li><a href="' + cityHref(c) + '">' + c.name + '</a></li>').join('');
      footerHost.innerHTML = `
        <footer class="footer">
          <div class="container">
            <div class="newsletter">
              <div class="newsletter__inner">
                <div>
                  <h3 class="newsletter__title">Get the next flexible home first</h3>
                  <p class="newsletter__desc">Rooms, co-living, furnished, 1-month+ stays and lease takeovers — the moment they list. Never hotel nights.</p>
                </div>
                <form class="newsletter__form" action="#" aria-label="Alert signup">
                  <input type="email" class="newsletter__input" placeholder="you@example.com" required aria-label="Email address">
                  <button type="submit" class="btn btn--primary">Start alerts</button>
                </form>
              </div>
            </div>
            <div class="footer__grid">
              <div class="footer__brand">
                <a href="${base}index.html" class="logo logo--footer"><span class="logo__mark">RL</span><span class="logo__text">RentLeaks</span></a>
                <p class="footer__tagline">Flexible housing, priced honestly. Every price all-in, every stay 30 days or more.</p>
              </div>
              <nav class="footer__nav" aria-label="Footer">
                <div class="footer__col"><h4>Find</h4><ul>${typeLinks}<li><a href="${base}match.html">Stay DNA match</a></li></ul></div>
                <div class="footer__col"><h4>Cities</h4><ul>${cityLinks}<li><a href="${base}cities.html">All ${(DATA.cities || []).length} markets</a></li></ul></div>
                <div class="footer__col"><h4>Hosts</h4><ul>
                  <li><a href="${base}list.html?kind=lease-break">Post a lease-break free</a></li>
                  <li><a href="${base}list.html?kind=room">List a room</a></li>
                  <li><a href="${base}list.html?kind=coliving">Co-living operators</a></li>
                  <li><a href="${base}operators.html">Operator boutiques</a></li>
                  <li><a href="${base}professionals.html">Plans &amp; tools</a></li>
                </ul></div>
                <div class="footer__col"><h4>Company</h4><ul>
                  <li><a href="${base}faq.html">FAQ</a></li>
                  <li><a href="${base}contact.html">Contact</a></li>
                  <li><a href="${base}privacy.html">Privacy</a></li>
                  <li><a href="${base}terms.html">Terms</a></li>
                  <li><a href="${base}llms.txt">AI index</a></li>
                </ul></div>
              </nav>
            </div>
            <div class="footer__bottom">
              <p>&copy; 2026 RentLeaks. Fair Housing applies in every market we list.</p>
              <p>Short-term means 30 days or more — homes, not hotel nights.</p>
            </div>
          </div>
        </footer>`;
    }

    if (!$('#modal-auth')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="modal-overlay" id="modal-auth" aria-hidden="true">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-auth-title">
            <button type="button" class="modal__close js-modal-close" aria-label="Close">&times;</button>
            <h2 id="modal-auth-title" class="modal__title">Your renter passport</h2>
            <p class="modal__subtitle">One profile. Save homes, compare, and apply without retyping. Stored in this browser.</p>
            <div class="modal-tabs" role="tablist">
              <button type="button" class="modal-tab is-active" data-panel="signin">Sign in</button>
              <button type="button" class="modal-tab" data-panel="signup">Create passport</button>
            </div>
            <div id="panel-signin" class="modal-panel is-active">
              <form class="form js-auth-form" data-action="signin">
                <div class="form-group"><label for="signin-email">Email</label><input type="email" id="signin-email" name="email" class="form-input" required placeholder="you@example.com"></div>
                <div class="form-group"><label for="signin-password">Password</label><input type="password" id="signin-password" name="password" class="form-input" required></div>
                <button type="submit" class="btn btn--primary btn--block">Sign in</button>
              </form>
            </div>
            <div id="panel-signup" class="modal-panel">
              <form class="form js-auth-form" data-action="signup">
                <div class="form-group"><label for="signup-name">Name</label><input type="text" id="signup-name" name="name" class="form-input" required></div>
                <div class="form-group"><label for="signup-email">Email</label><input type="email" id="signup-email" name="email" class="form-input" required></div>
                <div class="form-group"><label for="signup-password">Password</label><input type="password" id="signup-password" name="password" class="form-input" required minlength="8"></div>
                <button type="submit" class="btn btn--primary btn--block">Create passport</button>
              </form>
            </div>
          </div>
        </div>
        <div class="rl-compare-tray" id="rl-compare-tray" hidden></div>
        <div class="rl-cmd" id="rl-cmd" hidden>
          <div class="rl-cmd__panel" role="dialog" aria-modal="true" aria-label="Search everything">
            <input type="search" id="rl-cmd-input" class="rl-cmd__input" placeholder="Jump to a city, stay type, or home…" autocomplete="off">
            <div id="rl-cmd-results" class="rl-cmd__results"></div>
            <div class="rl-cmd__hint"><span>↑↓ to move</span><span>↵ to open</span><span>esc to close</span></div>
          </div>
        </div>`;
      document.body.appendChild(wrap);
    }
    renderCompareTray();
  }
  function filterListings(override) {
    const s = Object.assign({}, state, override || {});
    let list = (DATA.listings || []).filter((l) => l.type !== 'sale');

    if (s.type) list = list.filter((l) => l.housingType === s.type || (l.categories || []).includes(s.type));
    if (s.city) {
      const city = cityMeta(s.city);
      list = list.filter((l) => l.cityId === s.city || (city && l.cityName === city.name));
    }
    if (s.location) {
      const q = s.location.toLowerCase();
      list = list.filter((l) =>
        (l.location || '').toLowerCase().includes(q) ||
        (l.address || '').toLowerCase().includes(q) ||
        (l.neighborhood || '').toLowerCase().includes(q) ||
        (l.cityName || '').toLowerCase().includes(q) ||
        (l.title || '').toLowerCase().includes(q)
      );
    }
    // Budgets are typed in the display currency; listings are stored in their
    // own. Compare on the converted figure, never the raw one.
    if (s.priceMin) list = list.filter((l) => allInDisplay(l) >= Number(s.priceMin));
    if (s.priceMax) list = list.filter((l) => allInDisplay(l) <= Number(s.priceMax));
    if (s.beds) list = list.filter((l) => (l.beds || 0) >= Number(s.beds));
    if (s.minStay) list = list.filter((l) => (l.minStayMonths || 1) <= Number(s.minStay));
    if (s.moveIn) list = list.filter((l) => !l.availableFrom || l.availableFrom <= s.moveIn);
    if (s.furnished === 'fully') list = list.filter((l) => l.furnishedLevel === 'fully');
    if (s.pets === 'yes') list = list.filter((l) => l.pets && l.pets !== 'none');
    if (s.privateBath) list = list.filter((l) => l.privateBath);
    if (s.workspace) list = list.filter((l) => l.workplaceReady);
    if (s.noFee) list = list.filter((l) => l.noFee);
    if (s.utilitiesIn) list = list.filter((l) => (l.utilitiesIncluded || []).includes('utilities') || (l.fees && l.fees.utilities === 0));
    if (s.verified) list = list.filter((l) => l.verified);

    if (s.sort === 'price-asc') list.sort((a, b) => allInDisplay(a) - allInDisplay(b));
    else if (s.sort === 'price-desc') list.sort((a, b) => allInDisplay(b) - allInDisplay(a));
    else if (s.sort === 'move-in') list.sort((a, b) => String(a.availableFrom).localeCompare(String(b.availableFrom)));
    else if (s.sort === 'match' && read(STORE.match, null)) {
      const pref = read(STORE.match, null);
      list.sort((a, b) => scoreListing(b, pref) - scoreListing(a, pref));
    } else list.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

    return list;
  }

  function scoreListing(l, pref) {
    if (!pref) return 0;
    let score = 40;
    if (pref.city && l.cityId === pref.city) score += 22;
    if (pref.types && pref.types.includes(l.housingType)) score += 18;
    if (pref.budget && allInDisplay(l) <= Number(pref.budget)) score += 12;
    else if (pref.budget && allInDisplay(l) > Number(pref.budget)) score -= 16;
    if (pref.stay && (l.minStayMonths || 1) <= Number(pref.stay)) score += 8;
    if (pref.workspace && l.workplaceReady) score += 6;
    if (pref.pets === 'yes' && l.pets !== 'none') score += 6;
    if (pref.privateBath && l.privateBath) score += 6;
    if (pref.vibe && l.vibe === pref.vibe) score += 8;
    if (l.verified) score += 4;
    if (l.noFee) score += 3;
    return Math.max(0, Math.min(99, score));
  }


  function renderListing(listing) {
    const t = typeMeta(listing.housingType);
    const saved = savedIds().includes(listing.id);
    const compared = compareIds().includes(listing.id);
    const pref = read(STORE.match, null);
    const match = pref ? scoreListing(listing, pref) : null;
    const clock = listing.housingType === 'lease-break' && listing.remainingMonths
      ? '<span class="rl-clock">' + listing.remainingMonths + ' mo left</span>'
      : '';
    const extras = [
      listing.verified ? 'Verified' : null,
      listing.noFee ? 'No fee' : null,
      listing.furnishedLevel === 'fully' ? 'Furnished' : null,
      listing.workplaceReady ? 'Workspace' : null
    ].filter(Boolean).slice(0, 3).join(' · ');
    const media = listingMedia(listing);
    const shotCount = media.filter((x) => x.kind === 'photo').length;
    const hasVideo = media.some((x) => x.kind === 'video');
    const id = escapeHtml(listing.id);
    const href = listingHref(listing);

    return `
      <article class="listing-card animate-on-scroll" data-id="${id}">
        <div class="listing-card__img-wrap">
          <div class="listing-card__img">
            <img class="listing-card__photo" src="${listing.image}" alt="${escapeHtml(listing.imageAlt || listing.title + ' in ' + listing.location)}" width="1400" height="933" loading="lazy" decoding="async">
            <span class="listing-card__badge">${escapeHtml(t.short)}</span>
            ${clock}
            ${match != null ? '<span class="rl-match-pill">' + match + '% fit</span>' : ''}
            ${hasVideo ? '<span class="listing-card__vid">Video</span>' : ''}
            ${shotCount > 1 ? '<span class="listing-card__shots">' + shotCount + ' photos</span>' : ''}
          </div>
          <button type="button" class="listing-card__save${saved ? ' listing-card__save--saved' : ''}" data-save="${id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save this home'}">
            <svg viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
        <div class="listing-card__body">
          <p class="listing-card__price">${money(allIn(listing), listing)}<span class="listing-card__period">all-in /mo</span>${leakChip(listing)}</p>
          <button type="button" class="rl-allin-live" data-fees="${id}" aria-label="See what makes up this price">Base ${money(listing.price, listing)} + fees</button>
          <h3 class="listing-card__title"><a href="${href}" class="listing-card__link">${escapeHtml(listing.title)}</a></h3>
          <p class="listing-card__address">${iconPin()}${escapeHtml(listing.location)}</p>
          <p class="listing-card__specs">${escapeHtml(listing.specs)} · from ${formatDate(listing.availableFrom)}</p>
          ${extras ? '<p class="rl-card-meta">' + extras + '</p>' : ''}
          <button type="button" class="rl-compare-btn${compared ? ' is-on' : ''}" data-compare="${id}" aria-pressed="${compared}">${compared ? 'Added' : 'Compare'}</button>
        </div>
      </article>`;
  }
  function listingCoords(listing) {
    if (listing && Number.isFinite(listing.lat) && Number.isFinite(listing.lng)) {
      return { lat: listing.lat, lng: listing.lng };
    }
    const city = listing ? cityMeta(listing.cityId) : null;
    if (!city || !Number.isFinite(city.lat)) return null;
    const seed = (listing.id || '').length;
    return {
      lat: city.lat + ((seed % 80) - 40) / 1000,
      lng: city.lng + ((seed % 80) - 40) / 800
    };
  }

  function ensureLeaflet(done) {
    if (window.L) { done(); return; }
    if (document.getElementById('rl-leaflet-js')) {
      document.getElementById('rl-leaflet-js').addEventListener('load', done, { once: true });
      return;
    }
    const css = document.createElement('link');
    css.id = 'rl-leaflet-css';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.id = 'rl-leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = done;
    document.body.appendChild(script);
  }


  function ensureBrowseLayout() {
    const grid = $('#listings-grid');
    if (!grid) return;
    if ($('#rl-browse')) return;

    const container = grid.closest('.container') || grid.parentNode;
    const adv = $('.rl-adv');
    const top = $('.listings__top');
    const empty = $('#listings-empty');
    const suggest = $('#rl-suggest');

    const browse = document.createElement('div');
    browse.className = 'rl-browse';
    browse.id = 'rl-browse';

    const side = document.createElement('aside');
    side.className = 'rl-side';
    side.id = 'rl-filters';
    side.setAttribute('aria-label', 'Filters');
    side.innerHTML = '<div class="rl-side__head"><span class="rl-side__title">Refine</span>' +
      '<button type="button" class="rl-side__clear" data-chip="__all">Reset</button></div>';

    const typeFs = document.createElement('fieldset');
    typeFs.className = 'rl-fieldset';
    typeFs.innerHTML = '<legend>Stay type</legend><div class="rl-optlist" id="rl-opt-type">' +
      '<button type="button" class="rl-opt" data-set-type="">Everything</button>' +
      (DATA.housingTypes || []).map((t) => {
        const n = (DATA.listings || []).filter((l) => l.housingType === t.id).length;
        return '<button type="button" class="rl-opt" data-set-type="' + t.id + '">' + escapeHtml(t.label) + '<span>' + n + '</span></button>';
      }).join('') + '</div>';
    side.appendChild(typeFs);

    const priceFs = document.createElement('fieldset');
    priceFs.className = 'rl-fieldset';
    priceFs.innerHTML = '<legend>All-in budget / month</legend>' +
      '<div class="rl-range">' +
      '<label class="sr-only" for="rail-min">Minimum all-in</label>' +
      '<input type="number" id="rail-min" min="0" step="50" placeholder="Min" inputmode="numeric">' +
      '<span aria-hidden="true">–</span>' +
      '<label class="sr-only" for="rail-max">Maximum all-in</label>' +
      '<input type="number" id="rail-max" min="0" step="50" placeholder="Max" inputmode="numeric">' +
      '</div>' +
      '<div class="rl-optrow" id="rl-opt-budget">' +
      [1500, 2500, 4000].map((v) => '<button type="button" class="rl-opt rl-opt--sm" data-set-max="' + v + '">Under ' + money(v) + '</button>').join('') +
      '</div>';
    side.appendChild(priceFs);

    const bedFs = document.createElement('fieldset');
    bedFs.className = 'rl-fieldset';
    bedFs.innerHTML = '<legend>Bedrooms</legend><div class="rl-optrow" id="rl-opt-beds">' +
      [['', 'Any'], ['1', '1+'], ['2', '2+'], ['3', '3+']].map((b) =>
        '<button type="button" class="rl-opt rl-opt--sm" data-set-beds="' + b[0] + '">' + b[1] + '</button>').join('') +
      '</div>';
    side.appendChild(bedFs);

    const stayFs = document.createElement('fieldset');
    stayFs.className = 'rl-fieldset';
    stayFs.innerHTML = '<legend>Stay length</legend><div class="rl-optrow" id="rl-opt-stay">' +
      [['', 'Any'], ['1', '1 mo'], ['3', '3 mo'], ['6', '6 mo'], ['12', '12 mo']].map((b) =>
        '<button type="button" class="rl-opt rl-opt--sm" data-set-stay="' + b[0] + '">' + b[1] + '</button>').join('') +
      '</div>';
    side.appendChild(stayFs);

    const fs = document.createElement('fieldset');
    fs.className = 'rl-fieldset';
    fs.innerHTML = '<legend>Must-haves</legend>';
    if (adv) { adv.parentNode.removeChild(adv); fs.appendChild(adv); }
    side.appendChild(fs);

    const done = document.createElement('div');
    done.className = 'rl-side__done';
    done.innerHTML = '<button type="button" class="btn btn--primary btn--block js-filter-done">Show homes</button>';
    side.appendChild(done);

    const results = document.createElement('div');
    results.className = 'rl-results';
    results.id = 'rl-results';

    const chips = document.createElement('div');
    chips.className = 'rl-chips';
    chips.id = 'rl-chips';
    chips.hidden = true;

    container.insertBefore(browse, top || grid);
    browse.appendChild(side);
    browse.appendChild(results);
    if (top) results.appendChild(top);
    results.appendChild(chips);
    results.appendChild(grid);
    if (empty) results.appendChild(empty);
    if (suggest) results.appendChild(suggest);

    const map = document.createElement('div');
    map.id = 'rl-browse-map';
    map.className = 'rl-map';
    map.hidden = true;
    browse.appendChild(map);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'rl-filter-fab js-filter-open';
    fab.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M7 12h10M10 18h4"/></svg> Filters';
    document.body.appendChild(fab);
  }

  function renderBrowseMap(list) {
    const el = $('#rl-browse-map');
    if (!el) return;
    const on = state.view === 'map';
    el.hidden = !on;
    const browse = $('#rl-browse');
    if (browse) browse.classList.toggle('rl-browse--map', on);
    if (!on) return;
    ensureLeaflet(function () {
      if (!browseMap) {
        browseMap = window.L.map(el, { scrollWheelZoom: false }).setView([40.71, -74], 3);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap', maxZoom: 18
        }).addTo(browseMap);
      }
      browseMarkers.forEach((marker) => marker.remove());
      browseMarkers = [];
      const bounds = [];
      list.slice(0, 160).forEach((listing) => {
        const geo = listingCoords(listing);
        if (!geo) return;
        bounds.push([geo.lat, geo.lng]);
        const icon = window.L.divIcon({
          className: '',
          html: '<span class="rl-price-marker">' + money(allIn(listing), listing) + '</span>',
          iconSize: [70, 26],
          iconAnchor: [35, 26]
        });
        const marker = window.L.marker([geo.lat, geo.lng], { icon: icon }).addTo(browseMap);
        marker.bindPopup(
          '<a class="rl-pop" href="' + listingHref(listing) + '">' +
          '<img src="' + listing.image + '" alt="" loading="lazy">' +
          '<span class="rl-pop__b"><span class="rl-pop__p">' + money(allIn(listing), listing) + ' all-in</span>' +
          '<span class="rl-pop__t">' + escapeHtml(listing.title) + '</span></span></a>'
        );
        browseMarkers.push(marker);
      });
      if (bounds.length === 1) browseMap.setView(bounds[0], 13);
      else if (bounds.length > 1) browseMap.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
      setTimeout(function () { browseMap.invalidateSize(); }, 80);
    });
  }
  function hydrateListingMap() {
    const id = document.body.dataset.listingId || params().get('id');
    const listing = listingById(id);
    const geo = listingCoords(listing);
    if (!listing || !geo) return;
    let el = $('#rl-listing-map');
    if (!el) {
      const host = $('.rl-detail') || $('#rl-detail') || $('#main');
      if (!host) return;
      const section = document.createElement('section');
      section.className = 'rl-block';
      section.innerHTML = '<h2>On the map</h2><div id="rl-listing-map" class="rl-map rl-map--detail"></div>';
      host.appendChild(section);
      el = $('#rl-listing-map');
    }
    ensureLeaflet(function () {
      const map = window.L.map(el).setView([geo.lat, geo.lng], 14);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      window.L.marker([geo.lat, geo.lng]).addTo(map)
        .bindPopup(escapeHtml(listing.title) + '<br>' + money(allIn(listing), listing) + ' all-in /mo');
    });
  }


  function renderListings() {
    // When the API is reachable, filtering/sorting/paging happen in Postgres
    // rather than over a 482-item array in the browser. The baked catalog
    // still renders first so there is never an empty frame.
    if (apiEnabled() && $('#listings-grid')) {
      const token = (renderListings._token = (renderListings._token || 0) + 1);
      window.RLData.query(state, state.page, PAGE_SIZE)
        .then((r) => {
          if (token !== renderListings._token) return; // a newer query won
          liveResult = r;
          markLiveState(true);
          paintListings();
        })
        .catch(() => {
          liveResult = null;
          markLiveState(false);
          paintListings();
        });
    }
    paintListings();
  }

  function paintListings() {
    const grid = $('#listings-grid');
    const empty = $('#listings-empty');
    const countEl = $('#listings-count');
    const usingLive = !!liveResult;
    const list = usingLive ? liveResult.items : filterListings();
    const city = state.city ? (cityMeta(state.city) || {}).name : '';
    const type = state.type ? typeMeta(state.type).label : 'flexible homes';
    const where = city || state.location || 'the U.S. + Canada + Europe';
    const total = usingLive ? liveResult.total : list.length;
    if (countEl) countEl.textContent = total.toLocaleString() + ' ' + type.toLowerCase() + ' in ' + where;
    const rc = $('#trust-rent-count');
    const cc = $('#trust-city-count');
    if (rc) rc.textContent = (DATA.listings || []).length.toLocaleString();
    if (cc) cc.textContent = String((DATA.cities || []).length);
    if (!grid) return;

    ensureBrowseLayout();
    renderChips();
    paintRail();
    grid.classList.toggle('is-list', state.view === 'list');
    $$('[data-view]').forEach((btn) => btn.classList.toggle('is-on', btn.dataset.view === state.view));

    if (!grid.dataset.painted) {
      grid.innerHTML = skeletonCards(6);
      grid.dataset.painted = '1';
    }
    let shown;
    if (usingLive) {
      // The API returns one page; accumulate them so "Show more" appends
      // instead of replacing.
      const acc = (paintListings._acc = state.page === 1 ? [] : (paintListings._acc || []));
      const merged = state.page === 1 ? list : acc.concat(list);
      paintListings._acc = merged;
      grid.innerHTML = merged.map(renderListing).join('');
      shown = merged.length;
      grid.hidden = merged.length === 0;
    } else {
      shown = Math.min(list.length, PAGE_SIZE * state.page);
      grid.innerHTML = list.slice(0, shown).map(renderListing).join('');
      grid.hidden = list.length === 0;
    }
    renderPager(shown, total);
    renderBrowseMap(usingLive ? (paintListings._acc || list) : list);
    renderRoomsShowcase();

    if (empty) {
      empty.hidden = total > 0;
      empty.innerHTML = '<h3>Nothing matches — yet</h3>' +
        '<p>Try a longer stay window, a wider all-in budget, or drop a must-have. Rooms and lease-breaks move fast, so alerts beat refreshing.</p>' +
        '<button type="button" class="btn btn--outline" data-chip="__all">Clear all filters</button> ' +
        '<a class="btn btn--primary" href="' + assetBase() + 'match.html">Run Stay DNA</a>';
    }
    const suggest = $('#rl-suggest');
    if (suggest) {
      const alts = total ? filterListings({ city: state.city, type: '', priceMax: state.priceMax }).slice(0, 3) : [];
      if (alts.length && state.type) {
        suggest.hidden = false;
        suggest.innerHTML = '<div class="section-head"><div class="section-head__text"><span class="section-head__eyebrow">Widen the net</span>' +
          '<h2>Also worth a look</h2><p>Same city, different stay type — the right home is not always the label you started with.</p></div></div>' +
          '<div class="listings__grid">' + alts.map(renderListing).join('') + '</div>';
      } else {
        suggest.hidden = true;
      }
    }
    setupScrollAnimations();
    injectListingsSchema(usingLive ? (paintListings._acc || list) : list);
  }

  function setupScrollAnimations() {
    const els = $$('.animate-on-scroll');
    if (typeof IntersectionObserver === 'undefined' ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = window._rlScrollIo || (window._rlScrollIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
        });
      },
      { threshold: 0.04, rootMargin: '0px 0px -32px 0px' }
    ));
    els.forEach((el) => { if (!el.classList.contains('is-visible')) io.observe(el); });
  }
  function populateSearchFields() {
    const citySel = $('#city');
    if (citySel && !(citySel.options && citySel.options.length > 2)) {
      const groups = {};
      (DATA.cities || []).forEach((c) => {
        const g = c.group || c.countryName || 'Other';
        (groups[g] = groups[g] || []).push(c);
      });
      const preferred = ['United States', 'Canada', 'United Kingdom', 'Scotland', 'Ireland', 'France', 'Spain', 'Netherlands', 'Switzerland', 'Germany', 'Italy'];
      // Preference, not a whitelist: any group not listed above still renders,
      // so adding a country to the catalog can never silently drop it.
      const order = preferred.filter((g) => groups[g])
        .concat(Object.keys(groups).filter((g) => preferred.indexOf(g) === -1).sort());
      citySel.innerHTML = '<option value="">All cities</option>' + order.filter((g) => groups[g]).map((g) =>
        '<optgroup label="' + g + '">' + groups[g].map((c) =>
          '<option value="' + c.id + '">' + c.name + ', ' + c.state + (c.launch ? ' · launch' : '') + '</option>'
        ).join('') + '</optgroup>'
      ).join('');
    }
    const typeSel = $('#housing-type');
    if (typeSel) {
      typeSel.innerHTML = '<option value="">All stay types</option>' + (DATA.housingTypes || []).map((t) =>
        '<option value="' + t.id + '">' + t.label + '</option>'
      ).join('');
    }
    const loc = $('#location');
    if (loc && !loc.getAttribute('list')) {
      loc.setAttribute('list', 'rl-places');
      if (!$('#rl-places')) {
        const dl = document.createElement('datalist');
        dl.id = 'rl-places';
        const opts = [];
        (DATA.cities || []).forEach((c) => {
          opts.push(c.name);
          (c.neighborhoods || []).forEach((n) => opts.push(n + ', ' + c.name));
        });
        dl.innerHTML = opts.map((o) => '<option value="' + escapeHtml(o) + '">').join('');
        document.body.appendChild(dl);
      }
    }
  }

  function syncStateFromForm() {
    state.page = 1;
    state.location = $('#location')?.value?.trim() || '';
    state.city = $('#city')?.value || state.city;
    state.type = $('#housing-type')?.value || state.type;
    state.priceMin = $('#price-min')?.value || null;
    state.priceMax = $('#price-max')?.value || null;
    state.beds = $('#beds')?.value || null;
    state.minStay = $('#min-stay')?.value || null;
    state.moveIn = $('#move-in')?.value || '';
    state.sort = $('#sort')?.value || state.sort;
    state.furnished = $('#filter-furnished')?.checked ? 'fully' : '';
    state.pets = $('#filter-pets')?.checked ? 'yes' : '';
    state.privateBath = !!$('#filter-bath')?.checked;
    state.workspace = !!$('#filter-work')?.checked;
    state.noFee = !!$('#filter-nofee')?.checked;
    state.utilitiesIn = !!$('#filter-utils')?.checked;
    state.verified = !!$('#filter-verified')?.checked;
  }

  function applyUrlToState() {
    const p = params();
    state.type = p.get('type') || p.get('category') || document.body.dataset.type || '';
    state.city = p.get('city') || document.body.dataset.city || '';
    state.location = p.get('location') || p.get('q') || '';
    state.priceMin = p.get('min');
    state.priceMax = p.get('max');
    state.beds = p.get('beds');
    state.minStay = p.get('stay');
    state.moveIn = p.get('moveIn') || '';
    state.sort = p.get('sort') || 'newest';
    if (p.get('view') === 'list' || p.get('view') === 'map' || p.get('view') === 'grid') state.view = p.get('view');
    if (location.hash === '#map') state.view = 'map';
    if (p.get('pets') === '1') state.pets = 'yes';
    if (p.get('bath') === '1') state.privateBath = true;
    if (p.get('work') === '1') state.workspace = true;
    if ($('#location') && state.location) $('#location').value = state.location;
    if ($('#city') && state.city) $('#city').value = state.city;
    if ($('#housing-type') && state.type) $('#housing-type').value = state.type;
    if ($('#price-min') && state.priceMin) $('#price-min').value = state.priceMin;
    if ($('#price-max') && state.priceMax) $('#price-max').value = state.priceMax;
    if ($('#beds') && state.beds) $('#beds').value = state.beds;
    if ($('#min-stay') && state.minStay) $('#min-stay').value = state.minStay;
    if ($('#move-in') && state.moveIn) $('#move-in').value = state.moveIn;
    if ($('#sort')) $('#sort').value = state.sort;
  }

  function pushBrowseUrl() {
    if (pageName() !== 'browse' && pageName() !== 'rent') return;
    const p = new URLSearchParams();
    if (state.type) p.set('type', state.type);
    if (state.city) p.set('city', state.city);
    if (state.location) p.set('q', state.location);
    if (state.priceMax) p.set('max', state.priceMax);
    if (state.minStay) p.set('stay', state.minStay);
    if (state.moveIn) p.set('moveIn', state.moveIn);
    const qs = p.toString();
    history.replaceState({}, '', (qs ? 'rent.html?' + qs : 'rent.html') + window.location.hash);
  }

  function toggleSave(id) {
    const ids = savedIds();
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : ids.concat(id);
    write(STORE.saved, next);
    toast(next.includes(id) ? 'Saved to your shortlist' : 'Removed from saved');
    injectChrome();
    bindChromeEvents();
  }

  function toggleCompare(id) {
    let ids = compareIds();
    if (ids.includes(id)) ids = ids.filter((x) => x !== id);
    else {
      if (ids.length >= 3) { toast('Compare up to 3 homes'); return; }
      ids = ids.concat(id);
    }
    write(STORE.compare, ids);
    renderCompareTray();
    $$('[data-compare]').forEach((btn) => {
      const on = ids.includes(btn.dataset.compare);
      btn.classList.toggle('is-on', on);
      btn.textContent = on ? 'Added' : 'Compare';
    });
  }

  function renderCompareTray() {
    const tray = $('#rl-compare-tray');
    if (!tray) return;
    const ids = compareIds();
    if (!ids.length) { tray.hidden = true; tray.innerHTML = ''; return; }
    const items = ids.map(listingById).filter(Boolean);
    tray.hidden = false;
    tray.innerHTML = '<div class="rl-compare-tray__inner"><strong>Compare</strong>' +
      items.map((l) => '<span>' + escapeHtml(typeMeta(l.housingType).short) + ' · ' + money(allIn(l), l) + '</span>').join('') +
      '<a class="btn btn--primary btn--sm" href="compare.html">Open</a>' +
      '<button type="button" class="btn btn--outline btn--sm" id="rl-compare-clear">Clear</button></div>';
    const clear = $('#rl-compare-clear');
    if (clear) clear.onclick = () => { write(STORE.compare, []); renderCompareTray(); };
  }



  /* ---------------------------------------------------------------------
   * Hero carousel — featured photos and video tours
   * -------------------------------------------------------------------
   * Slides are drawn from featured listings across different cities so the
   * hero shows real inventory rather than stock decoration. Media is loaded
   * lazily (only the active slide and its neighbour), video plays only while
   * its slide is active and on screen, and autoplay yields to
   * prefers-reduced-motion, hover, focus and hidden tabs.
   * ------------------------------------------------------------------- */
  const HERO_SLIDE_MS = 6000;

  function heroSlidePicks(limit) {
    const featured = (DATA.listings || []).filter((l) => l.featured && l.image);
    const pool = featured.length ? featured : (DATA.listings || []);
    const seenCity = {};
    const seenType = {};
    const picks = [];
    // One per city first, spreading housing types, so the reel feels curated.
    pool.forEach((l) => {
      if (picks.length >= limit) return;
      if (seenCity[l.cityId]) return;
      if ((seenType[l.housingType] || 0) >= 2) return;
      seenCity[l.cityId] = 1;
      seenType[l.housingType] = (seenType[l.housingType] || 0) + 1;
      picks.push(l);
    });
    for (let i = 0; picks.length < limit && i < pool.length; i += 1) {
      if (picks.indexOf(pool[i]) === -1) picks.push(pool[i]);
    }
    return picks.slice(0, limit);
  }

  function renderHeroCarousel() {
    const host = $('#rl-hero-carousel');
    if (!host) return;
    const slides = heroSlidePicks(6);
    if (!slides.length) { host.hidden = true; return; }

    host.innerHTML = `
      <div class="rl-hero-car" role="group" aria-roledescription="carousel" aria-label="Featured homes">
        <div class="rl-hero-car__stage">
          ${slides.map((l, i) => {
            const isVideo = i % 3 === 1 && l.video && l.video.src;
            const t = typeMeta(l.housingType);
            const media = isVideo
              ? `<video class="rl-hero-car__media" muted playsinline loop preload="none"
                        poster="${escapeHtml(l.video.poster || l.image)}"
                        data-src="${escapeHtml(l.video.src)}"
                        aria-label="${escapeHtml(l.title)} video tour"></video>
                 <span class="rl-hero-car__kind">Video tour</span>`
              : `<img class="rl-hero-car__media" alt="${escapeHtml(l.imageAlt || l.title)}"
                      ${i === 0 ? 'src="' + escapeHtml(l.image) + '" fetchpriority="high"' : 'data-src="' + escapeHtml(l.image) + '" loading="lazy"'}
                      decoding="async" width="1400" height="1750">`;
            return `
              <figure class="rl-hero-car__slide${i === 0 ? ' is-active' : ''}" data-slide="${i}" ${i === 0 ? '' : 'aria-hidden="true"'}>
                ${media}
                <span class="rl-hero-car__shade" aria-hidden="true"></span>
                <figcaption class="rl-hero-car__cap">
                  <span class="rl-hero-car__badge">${escapeHtml(t.short)} · ${escapeHtml(l.cityName)}</span>
                  <a class="rl-hero-car__title" href="${listingHref(l)}" tabindex="${i === 0 ? '0' : '-1'}">${escapeHtml(l.title)}</a>
                  <span class="rl-hero-car__price">${money(allIn(l), l)}<em>all-in /mo</em></span>
                </figcaption>
              </figure>`;
          }).join('')}
        </div>

        <button type="button" class="rl-hero-car__nav rl-hero-car__nav--prev" aria-label="Previous home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button type="button" class="rl-hero-car__nav rl-hero-car__nav--next" aria-label="Next home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        <div class="rl-hero-car__dots" role="tablist" aria-label="Choose a featured home">
          ${slides.map((l, i) => `<button type="button" class="rl-hero-car__dot${i === 0 ? ' is-on' : ''}" role="tab"
              aria-selected="${i === 0}" data-goto="${i}" aria-label="${escapeHtml(l.cityName)} — ${escapeHtml(l.title)}"><i></i></button>`).join('')}
        </div>
        <p class="sr-only" aria-live="polite" id="rl-hero-car-status"></p>
      </div>`;

    startHeroCarousel(host, slides);
  }

  function startHeroCarousel(host, slides) {
    const stage = host.querySelector('.rl-hero-car__stage');
    const figures = $$('.rl-hero-car__slide', host);
    const dots = $$('.rl-hero-car__dot', host);
    const status = host.querySelector('#rl-hero-car-status');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer = null;
    let paused = false;
    let visible = true;

    function loadMediaFor(i) {
      [i, (i + 1) % figures.length].forEach((n) => {
        const el = figures[n] && figures[n].querySelector('[data-src]');
        if (el && !el.getAttribute('src')) {
          el.setAttribute('src', el.dataset.src);
          el.removeAttribute('data-src');
        }
      });
    }

    function show(next) {
      index = (next + figures.length) % figures.length;
      loadMediaFor(index);
      figures.forEach((f, i) => {
        const on = i === index;
        f.classList.toggle('is-active', on);
        if (on) f.removeAttribute('aria-hidden'); else f.setAttribute('aria-hidden', 'true');
        const link = f.querySelector('.rl-hero-car__title');
        if (link) link.tabIndex = on ? 0 : -1;
        const vid = f.querySelector('video');
        if (vid) {
          if (on && !reduced && visible) { const pr = vid.play(); if (pr && pr.catch) pr.catch(() => {}); }
          else { try { vid.pause(); } catch (e) { /* ignore */ } }
        }
      });
      dots.forEach((d, i) => {
        d.classList.toggle('is-on', i === index);
        d.setAttribute('aria-selected', String(i === index));
      });
      const l = slides[index];
      if (status && l) status.textContent = l.title + ', ' + l.cityName + ' — slide ' + (index + 1) + ' of ' + figures.length;
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      stop();
      if (reduced || paused || !visible || figures.length < 2) return;
      timer = setInterval(() => show(index + 1), HERO_SLIDE_MS);
    }

    host.querySelector('.rl-hero-car__nav--prev').onclick = () => { show(index - 1); play(); };
    host.querySelector('.rl-hero-car__nav--next').onclick = () => { show(index + 1); play(); };
    dots.forEach((d) => { d.onclick = () => { show(Number(d.dataset.goto)); play(); }; });

    host.addEventListener('mouseenter', () => { paused = true; stop(); });
    host.addEventListener('mouseleave', () => { paused = false; play(); });
    host.addEventListener('focusin', () => { paused = true; stop(); });
    host.addEventListener('focusout', () => {
      if (!host.contains(document.activeElement)) { paused = false; play(); }
    });
    host.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });

    // Swipe on touch devices.
    let x0 = null;
    stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (visible) play(); else stop();
    });

    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => { visible = en.isIntersecting; if (visible) play(); else stop(); });
      }, { threshold: 0.25 }).observe(host);
    }

    show(0);
    play();
  }


  /** Popular entry points — fills the hero column and gives crawlers real links. */
  function renderHeroQuick() {
    const host = $('#rl-hero-quick');
    if (!host) return;
    const listings = DATA.listings || [];
    const count = (fn) => listings.filter(fn).length;
    const picks = [
      { label: 'Rooms in New York', href: 'rent.html?type=room&city=nyc', n: count((l) => l.housingType === 'room' && l.cityId === 'nyc') },
      { label: 'Co-living in Berlin', href: 'rent.html?type=coliving&city=berlin', n: count((l) => l.housingType === 'coliving' && l.cityId === 'berlin') },
      { label: 'Lease-breaks in Toronto', href: 'rent.html?type=lease-break&city=toronto', n: count((l) => l.housingType === 'lease-break' && l.cityId === 'toronto') },
      { label: 'Furnished in London', href: 'rent.html?type=furnished&city=london', n: count((l) => l.housingType === 'furnished' && l.cityId === 'london') },
      { label: '1-month+ in Paris', href: 'rent.html?type=short-term&city=paris', n: count((l) => l.housingType === 'short-term' && l.cityId === 'paris') }
    ].filter((p) => p.n > 0);

    host.innerHTML = '<span class="hero__quick-label">Popular right now</span>' +
      '<div class="hero__quick-row">' +
      picks.map((p) => '<a class="hero__quick-chip" href="' + p.href + '">' + escapeHtml(p.label) +
        '<b>' + p.n + '</b></a>').join('') +
      '</div>';
  }


  /* ---------------------------------------------------------------------
   * Operator boutiques
   * ------------------------------------------------------------------- */
  const OPERATOR_KIND_LABEL = { coliving: 'Co-living operator', portfolio: 'Furnished operator', hotel: 'Aparthotel operator', landlord: 'Independent landlord' };

  function operatorHref(o) {
    if (!o) return assetBase() + 'operators.html';
    return assetBase() + 'operators/' + (o.slug || String(o.id || '').replace(/^op-/, '')) + '.html';
  }

  function operatorInitials(name) {
    // Skip connectives and punctuation so "Harbor & Hall" is HH, not H&.
    const skip = { and: 1, the: 1, of: 1, group: 1, co: 1 };
    const words = String(name || '?').split(/[\s.]+/)
      .filter((w) => /^[a-z0-9]/i.test(w) && !skip[w.toLowerCase()]);
    return (words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?');
  }

  function operatorOf(listing) {
    if (!listing || !listing.operatorId || !DATA.getOperator) return null;
    return DATA.getOperator(listing.operatorId);
  }


  /* ---------------------------------------------------------------------
   * Reusable listing browser
   * -------------------------------------------------------------------
   * One search / filter / sort / grid-list surface, mounted anywhere a set
   * of homes is shown — an operator's boutique, a city page, a stay type.
   * The scope fixes what it can ever show ({operatorId} | {cityId} | {type});
   * the controls only ever narrow within that scope, and only offer facets
   * that actually exist in it.
   *
   * Progressive enhancement: the host already contains server-rendered cards
   * for crawlers and no-JS visitors. Mounting replaces them.
   * ------------------------------------------------------------------- */
  function scopedListings(scope) {
    let rows = (DATA.listings || []).filter((l) => l.type !== 'sale');
    if (scope.operatorId) rows = rows.filter((l) => l.operatorId === scope.operatorId);
    if (scope.cityId) rows = rows.filter((l) => l.cityId === scope.cityId);
    if (scope.type) rows = rows.filter((l) => l.housingType === scope.type);
    return rows;
  }

  function mountListingBrowser(host, scope, opts) {
    if (!host) return;
    const options = opts || {};
    const all = scopedListings(scope);
    if (!all.length) return;

    const st = { q: '', city: '', type: '', max: null, sort: 'price-asc', view: 'grid', page: 1, must: '' };
    const PER = options.pageSize || 12;

    // Only offer facets that exist inside this scope.
    const cityIds = [];
    const typeIds = [];
    all.forEach((l) => {
      if (cityIds.indexOf(l.cityId) === -1) cityIds.push(l.cityId);
      if (typeIds.indexOf(l.housingType) === -1) typeIds.push(l.housingType);
    });
    const showCity = !scope.cityId && cityIds.length > 1;
    const showType = !scope.type && typeIds.length > 1;

    host.innerHTML = `
      <div class="rl-browser" data-browser>
        <form class="search-card rl-browser__search" role="search" onsubmit="return false">
          <div class="search-form__row">
            <div class="search-field">
              <input type="search" data-b="q" placeholder="Search this portfolio" aria-label="Search this portfolio" title="Search within ${escapeHtml(options.label || 'these homes')}" autocomplete="off">
            </div>
            ${showCity ? `<div class="search-field"><select data-b="city" aria-label="City">
              <option value="">All cities</option>
              ${cityIds.map((id) => { const c = cityMeta(id); return c ? '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>' : ''; }).join('')}
            </select></div>` : ''}
            ${showType ? `<div class="search-field"><select data-b="type" aria-label="Stay type">
              <option value="">All stay types</option>
              ${typeIds.map((t) => '<option value="' + t + '">' + escapeHtml(typeMeta(t).label) + '</option>').join('')}
            </select></div>` : ''}
            <div class="search-field"><input type="number" data-b="max" min="0" placeholder="Any" aria-label="All-in max"></div>
          </div>
        </form>

        <div class="rl-chips">
          <button type="button" class="rl-chip" data-b-must="furnished">Furnished</button>
          <button type="button" class="rl-chip" data-b-must="privateBath">Private bath</button>
          <button type="button" class="rl-chip" data-b-must="workspace">Workspace</button>
          <button type="button" class="rl-chip" data-b-must="noFee">No fee</button>
          <button type="button" class="rl-chip" data-b-must="pets">Pets ok</button>
        </div>

        <div class="listings__top">
          <h2 class="listings__count" data-b-count></h2>
          <div class="rl-view" role="group" aria-label="View">
            <button type="button" data-b-view="grid" class="is-on">Grid</button>
            <button type="button" data-b-view="list">List</button>
          </div>
          <div class="listings__sort">
            <label>Sort</label>
            <select data-b="sort">
              <option value="price-asc">All-in: low to high</option>
              <option value="price-desc">All-in: high to low</option>
              <option value="move-in">Soonest move-in</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        <div class="listings__grid" data-b-results></div>
        <div class="listings__empty" data-b-empty hidden></div>
        <div class="rl-pager" data-b-pager hidden></div>
      </div>`;

    const $b = (sel) => host.querySelector(sel);
    const results = $b('[data-b-results]');
    const countEl = $b('[data-b-count]');
    const empty = $b('[data-b-empty]');
    const pager = $b('[data-b-pager]');

    function match() {
      let rows = all.slice();
      const q = st.q.trim().toLowerCase();
      if (q) {
        rows = rows.filter((l) =>
          (l.title || '').toLowerCase().includes(q) ||
          (l.neighborhood || '').toLowerCase().includes(q) ||
          (l.cityName || '').toLowerCase().includes(q) ||
          (l.location || '').toLowerCase().includes(q));
      }
      if (st.city) rows = rows.filter((l) => l.cityId === st.city);
      if (st.type) rows = rows.filter((l) => l.housingType === st.type);
      if (st.max) rows = rows.filter((l) => allInDisplay(l) <= Number(st.max));
      if (st.must === 'furnished') rows = rows.filter((l) => l.furnishedLevel === 'fully');
      if (st.must === 'privateBath') rows = rows.filter((l) => l.privateBath);
      if (st.must === 'workspace') rows = rows.filter((l) => l.workplaceReady);
      if (st.must === 'noFee') rows = rows.filter((l) => l.noFee);
      if (st.must === 'pets') rows = rows.filter((l) => l.pets && l.pets !== 'none');

      if (st.sort === 'price-asc') rows.sort((a, b) => allInDisplay(a) - allInDisplay(b));
      else if (st.sort === 'price-desc') rows.sort((a, b) => allInDisplay(b) - allInDisplay(a));
      else if (st.sort === 'move-in') rows.sort((a, b) => String(a.availableFrom).localeCompare(String(b.availableFrom)));
      else rows.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
      return rows;
    }

    function paint() {
      const rows = match();
      const shown = Math.min(rows.length, PER * st.page);
      countEl.textContent = rows.length.toLocaleString() + ' of ' + all.length +
        ' ' + (all.length === 1 ? 'home' : 'homes');
      results.className = 'listings__grid' + (st.view === 'list' ? ' is-list' : '');
      results.innerHTML = rows.slice(0, shown).map(renderListing).join('');
      results.hidden = rows.length === 0;
      empty.hidden = rows.length > 0;
      if (!rows.length) {
        empty.innerHTML = '<h3>Nothing here matches</h3><p>Widen the budget or drop a must-have to see the rest of this portfolio.</p><button type="button" class="btn btn--outline" data-b-clear>Clear filters</button>';
      }
      if (rows.length > shown) {
        pager.hidden = false;
        pager.innerHTML = '<p class="rl-pager__count">Showing <strong>' + shown + '</strong> of <strong>' + rows.length + '</strong></p>' +
          '<button type="button" class="btn btn--outline" data-b-more>Show ' + Math.min(PER, rows.length - shown) + ' more</button>';
      } else {
        pager.hidden = true;
      }
      host.querySelectorAll('[data-b-must]').forEach((b) => b.classList.toggle('is-on', b.dataset.bMust === st.must));
      host.querySelectorAll('[data-b-view]').forEach((b) => b.classList.toggle('is-on', b.dataset.bView === st.view));
      setupScrollAnimations();
    }

    let t;
    host.addEventListener('input', (e) => {
      const k = e.target.dataset.b;
      if (!k) return;
      clearTimeout(t);
      t = setTimeout(() => {
        st[k] = e.target.value;
        if (k === 'max') st.max = e.target.value ? Number(e.target.value) : null;
        st.page = 1;
        paint();
      }, 180);
    });
    host.addEventListener('change', (e) => {
      const k = e.target.dataset.b;
      if (!k || k === 'q' || k === 'max') return;
      st[k] = e.target.value;
      st.page = 1;
      paint();
    });
    host.addEventListener('click', (e) => {
      const m = e.target.closest('[data-b-must]');
      if (m) { st.must = st.must === m.dataset.bMust ? '' : m.dataset.bMust; st.page = 1; paint(); return; }
      const v = e.target.closest('[data-b-view]');
      if (v) { st.view = v.dataset.bView; paint(); return; }
      if (e.target.closest('[data-b-more]')) { st.page += 1; paint(); return; }
      if (e.target.closest('[data-b-clear]')) {
        st.q = ''; st.city = ''; st.type = ''; st.max = null; st.must = ''; st.page = 1;
        host.querySelectorAll('[data-b]').forEach((el) => { if (el.tagName !== 'SELECT' || el.dataset.b !== 'sort') el.value = ''; });
        paint();
      }
    });
    document.addEventListener('rl:currency', paint);

    decorateSearchFields();
    paint();
  }

  /** Mount browsers onto any pre-rendered page that declares a scope. */
  function mountScopedBrowsers() {
    $$('[data-browse-scope]').forEach((host) => {
      const kind = host.dataset.browseScope;
      const value = host.dataset.browseValue || '';
      if (kind === 'operator') {
        const op = DATA.getOperator ? DATA.getOperator(value) : null;
        if (op) mountListingBrowser(host, { operatorId: op.id }, { label: op.name, pageSize: 12 });
      } else if (kind === 'city') {
        mountListingBrowser(host, { cityId: value }, { label: (cityMeta(value) || {}).name, pageSize: 12 });
      } else if (kind === 'type') {
        mountListingBrowser(host, { type: value }, { label: typeMeta(value).label, pageSize: 12 });
      }
    });
  }

  /* --- Operator directory: search, filter, sort, grid/list ------------- */
  const opState = { q: '', kind: '', country: '', verified: false, minHomes: 0, sort: 'homes', view: 'grid' };

  function operatorCities(o) {
    return o.cityIds.map((id) => (cityMeta(id) || {}).name).filter(Boolean);
  }

  function filterOperators() {
    let rows = (DATA.operators || []).slice();
    const q = opState.q.trim().toLowerCase();
    if (q) {
      rows = rows.filter((o) =>
        o.name.toLowerCase().includes(q) ||
        (o.tagline || '').toLowerCase().includes(q) ||
        operatorCities(o).some((c) => c.toLowerCase().includes(q)) ||
        o.countries.some((c) => c.toLowerCase().includes(q)));
    }
    if (opState.kind) rows = rows.filter((o) => o.kind === opState.kind);
    if (opState.country) rows = rows.filter((o) => o.countries.indexOf(opState.country) !== -1);
    if (opState.verified) rows = rows.filter((o) => o.verified);
    if (opState.minHomes) rows = rows.filter((o) => o.count >= opState.minHomes);

    if (opState.sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (opState.sort === 'cities') rows.sort((a, b) => b.cityIds.length - a.cityIds.length);
    else if (opState.sort === 'price') rows.sort((a, b) => a.fromAllInUsd - b.fromAllInUsd);
    else if (opState.sort === 'reply') rows.sort((a, b) => a.responseHours - b.responseHours);
    else rows.sort((a, b) => b.count - a.count);
    return rows;
  }

  function operatorCardHtml(o) {
    const cities = operatorCities(o);
    return `
      <a class="rl-op-card animate-on-scroll" href="${operatorHref(o)}">
        <span class="rl-op-card__mark" aria-hidden="true">${escapeHtml(operatorInitials(o.name))}</span>
        <span class="rl-op-card__body">
          <strong>${escapeHtml(o.name)}</strong>
          <em>${escapeHtml(o.tagline)}</em>
          <span class="rl-op-card__meta">${o.count} ${o.count === 1 ? 'home' : 'homes'} · ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}${o.verified ? ' · Verified' : ''}</span>
        </span>
      </a>`;
  }

  function operatorRowHtml(o) {
    const cities = operatorCities(o);
    return `
      <a class="rl-op-row animate-on-scroll" href="${operatorHref(o)}">
        <span class="rl-op-card__mark" aria-hidden="true">${escapeHtml(operatorInitials(o.name))}</span>
        <span class="rl-op-row__main">
          <strong>${escapeHtml(o.name)}</strong>
          <em>${escapeHtml(o.tagline)}</em>
        </span>
        <span class="rl-op-row__col"><b>${escapeHtml(OPERATOR_KIND_LABEL[o.kind] || 'Operator')}</b><i>${o.since ? 'since ' + o.since : ''}</i></span>
        <span class="rl-op-row__col"><b>${o.count}</b><i>${o.count === 1 ? 'home' : 'homes'}</i></span>
        <span class="rl-op-row__col"><b>${cities.length}</b><i>${cities.length === 1 ? 'city' : 'cities'}</i></span>
        <span class="rl-op-row__col"><b>${money(o.fromAllIn, o.currency)}</b><i>from</i></span>
        <span class="rl-op-row__col"><b>~${o.responseHours}h</b><i>reply</i></span>
        <span class="rl-op-row__go" aria-hidden="true">→</span>
      </a>`;
  }

  function paintOperators() {
    const host = $('#rl-op-results');
    const countEl = $('#rl-op-count');
    const empty = $('#rl-op-empty');
    if (!host) return;
    const rows = filterOperators();

    if (countEl) {
      countEl.textContent = rows.length.toLocaleString() + ' ' +
        (rows.length === 1 ? 'operator' : 'operators') +
        (opState.kind ? ' · ' + (OPERATOR_KIND_LABEL[opState.kind] || '') : '');
    }
    host.className = opState.view === 'list' ? 'rl-op-list' : 'rl-op-grid';
    host.innerHTML = opState.view === 'list'
      ? rows.map(operatorRowHtml).join('')
      : rows.map(operatorCardHtml).join('');
    host.hidden = rows.length === 0;
    if (empty) {
      empty.hidden = rows.length > 0;
      empty.innerHTML = '<h3>No operators match</h3><p>Try a different market, or clear the filters to see all ' +
        (DATA.operators || []).length + '.</p><button type="button" class="btn btn--outline js-op-clear">Clear filters</button>';
    }
    $$('[data-op-kind]').forEach((b) => b.classList.toggle('is-on', b.dataset.opKind === opState.kind));
    $$('[data-op-view]').forEach((b) => b.classList.toggle('is-on', b.dataset.opView === opState.view));
    const vf = $('#op-verified');
    if (vf) vf.checked = opState.verified;
    setupScrollAnimations();
  }

  function renderOperatorsDirectory() {
    const shell = $('#rl-operators');
    if (!shell) return;
    const ops = DATA.operators || [];
    const countries = [];
    ops.forEach((o) => o.countries.forEach((c) => { if (countries.indexOf(c) === -1) countries.push(c); }));
    countries.sort();

    shell.innerHTML = `
      <form class="search-card rl-op-search" role="search" onsubmit="return false">
        <div class="search-form__row">
          <div class="search-field">
            <input type="search" id="op-q" placeholder="Search operators, brands or cities" aria-label="Search operators" autocomplete="off">
          </div>
          <div class="search-field">
            <select id="op-country" aria-label="Country">
              <option value="">All countries</option>
              ${countries.map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>').join('')}
            </select>
          </div>
          <div class="search-field">
            <select id="op-size" aria-label="Portfolio size">
              <option value="0">Any size</option>
              <option value="2">2+ homes</option>
              <option value="10">10+ homes</option>
              <option value="25">25+ homes</option>
            </select>
          </div>
        </div>
      </form>

      <div class="rl-chips" id="rl-op-kinds">
        <button type="button" class="rl-chip is-on" data-op-kind="">All operators</button>
        <button type="button" class="rl-chip" data-op-kind="coliving">Co-living</button>
        <button type="button" class="rl-chip" data-op-kind="portfolio">Furnished portfolios</button>
        <button type="button" class="rl-chip" data-op-kind="hotel">Hotel groups</button>
        <button type="button" class="rl-chip" data-op-kind="landlord">Independent landlords</button>
        <label class="rl-check rl-check--inline"><input type="checkbox" id="op-verified"> Verified only</label>
      </div>

      <div class="listings__top">
        <h2 class="listings__count" id="rl-op-count">${ops.length} operators</h2>
        <div class="rl-view" role="group" aria-label="View">
          <button type="button" data-op-view="grid" class="is-on">Grid</button>
          <button type="button" data-op-view="list">List</button>
        </div>
        <div class="listings__sort">
          <label for="op-sort">Sort</label>
          <select id="op-sort">
            <option value="homes">Most homes</option>
            <option value="cities">Most markets</option>
            <option value="price">Lowest from-price</option>
            <option value="reply">Fastest reply</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      <div id="rl-op-results" class="rl-op-grid"></div>
      <div id="rl-op-empty" class="listings__empty" hidden></div>`;

    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    let t;
    on('#op-q', 'input', (e) => { clearTimeout(t); t = setTimeout(() => { opState.q = e.target.value; paintOperators(); }, 180); });
    on('#op-country', 'change', (e) => { opState.country = e.target.value; paintOperators(); });
    on('#op-size', 'change', (e) => { opState.minHomes = Number(e.target.value) || 0; paintOperators(); });
    on('#op-sort', 'change', (e) => { opState.sort = e.target.value; paintOperators(); });
    on('#op-verified', 'change', (e) => { opState.verified = e.target.checked; paintOperators(); });

    shell.addEventListener('click', (e) => {
      const k = e.target.closest('[data-op-kind]');
      if (k) { opState.kind = k.dataset.opKind; paintOperators(); }
      const v = e.target.closest('[data-op-view]');
      if (v) { opState.view = v.dataset.opView; paintOperators(); }
      if (e.target.closest('.js-op-clear')) {
        opState.q = ''; opState.kind = ''; opState.country = ''; opState.verified = false; opState.minHomes = 0;
        const q = $('#op-q'); if (q) q.value = '';
        const c = $('#op-country'); if (c) c.value = '';
        const z = $('#op-size'); if (z) z.value = '0';
        paintOperators();
      }
    });

    decorateSearchFields();
    paintOperators();
  }

  function renderOperatorPage() {
    const root = $('#rl-operator');
    if (!root) return;
    const slug = document.body.dataset.operator ||
      (location.pathname.match(/\/operators\/([^/]+)\.html/) || [])[1] ||
      params().get('op') || '';
    const o = DATA.getOperator ? DATA.getOperator(decodeURIComponent(slug)) : null;

    if (!o) {
      root.innerHTML = '<div class="container rl-empty"><h1>Operator not found</h1><p>This boutique may have been removed.</p><a class="btn btn--primary" href="' + assetBase() + 'operators.html">All operators</a></div>';
      return;
    }

    const homes = (DATA.listings || []).filter((l) => l.operatorId === o.id);
    const cities = o.cityIds.map((id) => (cityMeta(id) || {}).name).filter(Boolean);
    const typeChips = o.types.map((t) => '<a class="rl-chip" href="' + assetBase() + 'rent.html?type=' + t + '">' + escapeHtml(typeMeta(t).label) + '</a>').join('');

    root.innerHTML = `
      <div class="container">
        <nav class="rl-crumb" aria-label="Breadcrumb"><a href="${assetBase()}index.html">Home</a> / <a href="${assetBase()}operators.html">Operators</a> / ${escapeHtml(o.name)}</nav>

        <header class="rl-op-hero">
          <span class="rl-op-hero__mark" aria-hidden="true">${escapeHtml(operatorInitials(o.name))}</span>
          <div class="rl-op-hero__text">
            <span class="rl-kicker">${escapeHtml(OPERATOR_KIND_LABEL[o.kind] || 'Operator')}${o.since ? ' · since ' + o.since : ''}</span>
            <h1>${escapeHtml(o.name)}</h1>
            <p class="rl-lead">${escapeHtml(o.tagline)}</p>
            <div class="rl-badges">
              ${o.verified ? '<span class="rl-badge rl-badge--safe">All homes verified</span>' : ''}
              ${o.noFeeAll ? '<span class="rl-badge">No broker fee</span>' : ''}
              <span class="rl-badge">Replies in ~${o.responseHours}h</span>
            </div>
          </div>
        </header>

        <div class="rl-pulse">
          <article class="rl-stat"><span>Homes listed</span><strong>${o.count}</strong><em>across this portfolio</em></article>
          <article class="rl-stat"><span>Markets</span><strong>${o.cityIds.length}</strong><em>${escapeHtml(cities.slice(0, 3).join(', '))}${cities.length > 3 ? ' +' + (cities.length - 3) : ''}</em></article>
          <article class="rl-stat"><span>From</span><strong>${money(o.fromAllIn, o.currency)}</strong><em>all-in${o.multiCurrency ? ' · cheapest of ' + o.countries.length + ' countries' : ' per month'}</em></article>
          <article class="rl-stat"><span>Typical reply</span><strong>${o.responseHours}h</strong><em>to a first message</em></article>
        </div>

        ${typeChips ? '<div class="rl-chips rl-block">' + typeChips + '</div>' : ''}

        <section class="rl-block">
          <div class="section-head"><div class="section-head__text">
            <span class="section-head__eyebrow">Portfolio</span>
            <h2>${o.count} ${o.count === 1 ? 'home' : 'homes'} from ${escapeHtml(o.name)}</h2>
          </div></div>
          <div data-browse-scope="operator" data-browse-value="${escapeHtml(o.slug)}"></div>
        </section>
      </div>`;
    mountScopedBrowsers();
    setupScrollAnimations();
  }

  function renderHome() {
    const listings = DATA.listings || [];
    const cities = DATA.cities || [];
    const rc = $('#trust-rent-count');
    const cc = $('#trust-city-count');
    if (rc) rc.textContent = listings.length.toLocaleString();
    if (cc) cc.textContent = String(cities.length);

    const types = $('#rl-types');
    if (types) {
      types.innerHTML = (DATA.housingTypes || []).map((t) => {
        const n = listings.filter((l) => l.housingType === t.id).length;
        return `<a class="rl-type-card" href="${t.href}"><span class="rl-type-card__kicker">${n} live</span><h3>${t.label}</h3><p>${t.blurb}</p><span class="rl-type-card__cta">Browse ${t.short}</span></a>`;
      }).join('');
    }

    const cityHost = $('#rl-cities');
    if (cityHost) {
      const featured = cities.filter((c) => c.featured);
      const homeCities = featured.filter((c) => (c.country || 'US') === 'US').slice(0, 8)
        .concat(featured.filter((c) => (c.country || 'US') !== 'US'));
      cityHost.innerHTML = homeCities.map((c) => {
        const n = listings.filter((l) => l.cityId === c.id).length;
        const badge = (c.country || 'US') === 'US' ? '#' + c.rank : c.group;
        return `<a class="rl-city-card" href="${cityHref(c)}"><span class="rl-city-card__rank">${badge}</span><h3>${c.name}</h3><p>${c.state} · ${n} flexible homes</p><span>Walk ${c.walk} · Transit ${c.transit}</span></a>`;
      }).join('');
    }

    const rooms = listings.filter((l) => l.housingType === 'room');
    const breaks = listings.filter((l) => l.housingType === 'lease-break');
    // Average across markets only makes sense once converted.
    const avgRoom = Math.round(rooms.reduce((s, l) => s + allInDisplay(l), 0) / Math.max(1, rooms.length));
    const avgBreak = Math.round(breaks.reduce((s, l) => s + (l.remainingMonths || 0), 0) / Math.max(1, breaks.length));
    const noFee = listings.filter((l) => l.noFee).length;
    const noFeePct = Math.round((noFee / Math.max(1, listings.length)) * 100);

    const pulse = $('#rl-pulse');
    if (pulse) {
      pulse.innerHTML = `
        <article class="rl-stat"><span>Live inventory <b id="rl-live-badge" class="rl-live-tag">Cached</b></span><strong>${listings.length.toLocaleString()}</strong><em>across ${cities.length} markets</em></article>
        <article class="rl-stat"><span>Typical room all-in</span><strong>${money(avgRoom)}</strong><em>fees already counted</em></article>
        <article class="rl-stat"><span>Lease Clock</span><strong>${avgBreak} mo</strong><em>average time left on takeovers</em></article>
        <article class="rl-stat"><span>No broker fee</span><strong>${noFeePct}%</strong><em>of every home we list</em></article>`;
    }

    const proof = $('#rl-proof');
    if (proof) {
      const nyc = cities.find((c) => c.id === 'nyc') || cities[0] || {};
      const nycRooms = listings.filter((l) => l.cityId === nyc.id && l.housingType === 'room');
      const cheapest = nycRooms.slice().sort((a, b) => allIn(a) - allIn(b))[0];
      const bench = nyc.avgRoom || 0;
      const pct = cheapest && bench ? Math.max(6, Math.min(100, Math.round((allIn(cheapest) / bench) * 100))) : 60;
      proof.innerHTML = `
        <div class="hero-proof__head">
          <span class="hero-proof__title">Market pulse</span>
          <span class="hero-proof__live"><span class="hero-proof__dot"></span><span id="rl-live-badge">Cached</span></span>
        </div>
        <div class="hero-proof__row"><span class="hero-proof__k">Homes listed right now</span><span class="hero-proof__v">${listings.length.toLocaleString()}</span></div>
        <div class="hero-proof__row"><span class="hero-proof__k">Markets covered</span><span class="hero-proof__v">${cities.length}</span></div>
        <div class="hero-proof__row"><span class="hero-proof__k">Listings with zero broker fee</span><span class="hero-proof__v">${noFeePct}%</span></div>
        <div class="hero-proof__row"><span class="hero-proof__k">Lease-breaks posted free</span><span class="hero-proof__v">${breaks.length}</span></div>
        <div style="padding-top:.5rem">
          <p class="hero-proof__note">Cheapest ${escapeHtml(nyc.name || 'New York')} room vs. the ${escapeHtml(nyc.name || 'local')} median</p>
          <div class="hero-proof__bar"><span class="hero-proof__fill" style="width:${pct}%"></span></div>
          <p class="hero-proof__note" style="margin-top:.35rem">${cheapest ? money(allIn(cheapest), cheapest) + ' all-in vs ' + money(bench) + ' typical' : 'All-in pricing on every card'}</p>
        </div>`;
    }

    renderHeroCarousel();
    renderHeroQuick();

    const grid = $('#listings-grid');
    if (grid) {
      const featured = listings.filter((l) => l.featured).slice(0, 6);
      const fallback = filterListings({ type: '', city: 'nyc' }).slice(0, 6);
      grid.innerHTML = (featured.length ? featured : fallback).map(renderListing).join('');
    }
  }
  function renderCitiesPage() {
    const grid = $('#rl-city-directory');
    if (!grid) return;
    const groups = {};
    (DATA.cities || []).forEach((c) => {
      const g = c.group || c.countryName || 'Other';
      (groups[g] = groups[g] || []).push(c);
    });
    const preferred = ['United States', 'Canada', 'United Kingdom', 'Scotland', 'Ireland', 'France', 'Spain', 'Netherlands', 'Switzerland', 'Germany', 'Italy'];
      // Preference, not a whitelist: any group not listed above still renders,
      // so adding a country to the catalog can never silently drop it.
      const order = preferred.filter((g) => groups[g])
        .concat(Object.keys(groups).filter((g) => preferred.indexOf(g) === -1).sort());
    grid.innerHTML = order.filter((g) => groups[g]).map((g) => {
      const rows = groups[g].map((c) => {
        const n = (DATA.listings || []).filter((l) => l.cityId === c.id).length;
        const avg = Math.round((DATA.listings || []).filter((l) => l.cityId === c.id).reduce((s, l) => s + allIn(l), 0) / Math.max(1, n));
        const badge = (c.country || 'US') === 'US' ? (c.rank <= 30 ? '#' + c.rank : 'Launch') : c.country;
        return `<a class="rl-city-row" href="${cityHref(c)}">
          <span class="rl-city-row__rank">${badge}</span>
          <span><strong>${c.name}</strong><em>${c.state}${c.launch ? ' · original RentLeaks market' : ''}</em></span>
          <span>${n} homes</span>
          <span>${money(avg, c)} avg all-in</span>
          <span>Walk ${c.walk}</span>
        </a>`;
      }).join('');
      return `<section class="rl-city-group"><h2 class="rl-city-group__title">${g}</h2>${rows}</section>`;
    }).join('');
  }

  function renderCityPage() {
    const id = params().get('city') || 'nyc';
    const city = cityMeta(id);
    if (!city) return;
    state.city = city.id;
    const title = $('#rl-city-title');
    const sub = $('#rl-city-sub');
    const nhoods = $('#rl-nhoods');
    const pulse = $('#rl-city-pulse');
    if (title) title.textContent = city.name + ' flexible housing';
    document.title = city.name + ' rooms, co-living, furnished & lease-breaks | RentLeaks';
    if (sub) sub.textContent = 'Rooms, co-living, furnished apartments, 1-month+ stays, and lease-breaks in ' + city.name + ', ' + city.state + '.';
    if (nhoods) {
      nhoods.innerHTML = (city.neighborhoods || []).map((n) =>
        '<a class="category-chip" href="' + assetBase() + 'rent.html?city=' + city.id + '&q=' + encodeURIComponent(n) + '">' + escapeHtml(n) + '</a>'
      ).join('');
    }
    if (pulse) {
      const list = (DATA.listings || []).filter((l) => l.cityId === city.id);
      const byType = (DATA.housingTypes || []).map((t) => {
        const subset = list.filter((l) => l.housingType === t.id);
        const avg = Math.round(subset.reduce((s, l) => s + allIn(l), 0) / Math.max(1, subset.length));
        return `<a class="rl-stat" href="${typeHref(t.id)}?city=${city.id}"><span>${t.label}</span><strong>${subset.length}</strong><em>${subset.length ? money(avg, c) + ' all-in' : 'coming online'}</em></a>`;
      }).join('');
      pulse.innerHTML = byType;
    }
    if ($('#city')) $('#city').value = city.id;
    renderListings();
  }

  function renderDetail() {
    const id = params().get('id') || document.body.dataset.listingId;
    const l = listingById(id);
    const root = $('#rl-detail');
    if (!root) return;
    if (!l) {
      root.innerHTML = '<div class="container rl-empty"><h1>Listing unavailable</h1><p>It may have been taken. Browse live inventory instead.</p><a class="btn btn--primary" href="' + assetBase() + 'rent.html">Back to search</a></div>';
      return;
    }
    const recent = read(STORE.recent, []).filter((x) => x !== l.id).slice(0, 8);
    recent.unshift(l.id);
    write(STORE.recent, recent);
    const t = typeMeta(l.housingType);
    document.title = l.title + ' · ' + l.cityName + ' | RentLeaks';
    const pref = read(STORE.match, null);
    const match = pref ? scoreListing(l, pref) : null;
    const fees = l.fees || {};
    const extras = (fees.utilities || 0) + (fees.wifi || 0) + (fees.cleaning || 0);
    const takeoverSave = l.housingType === 'lease-break'
      ? Math.max(0, Math.round((cityMeta(l.cityId)?.avgFurnished || l.price * 1.3) - l.price) * (l.remainingMonths || 1))
      : 0;
    const furniture = (l.furniture || []).map((f) => '<li>' + escapeHtml(f) + '</li>').join('') || '<li>Unfurnished — bring your own</li>';
    const mates = (l.housemates || []).map((m) =>
      '<article class="rl-mate"><strong>' + escapeHtml(m.name) + '</strong><span>' + escapeHtml(m.ageRange) + ' · ' + escapeHtml(m.occupation) + '</span><em>' + escapeHtml(m.vibe) + '</em></article>'
    ).join('');
    const amens = (l.amenities || []).map((a) => '<span class="amenity-chip">' + escapeHtml(a.replace(/-/g, ' ')) + '</span>').join('');
    const scores = l.neighborhoodScores || {};
    const saved = savedIds().includes(l.id);

    root.innerHTML = `
      <div class="container rl-detail">
        <nav class="rl-crumb" aria-label="Breadcrumb"><a href="${assetBase()}rent.html">Search</a> / <a href="${l.cityPath ? assetBase() + l.cityPath : cityHref({ id: l.cityId, name: l.cityName, slug: (cityMeta(l.cityId) || {}).slug })}">${escapeHtml(l.cityName)}</a> / <a href="${typeHref(l.housingType)}">${escapeHtml(t.label)}</a></nav>
        ${renderGalleryMosaic(l)}
        <div class="rl-detail__grid">
          <div>
            <div class="rl-kicker">${escapeHtml(t.label)} · ${escapeHtml(l.neighborhood)}</div>
            <h1>${escapeHtml(l.title)}</h1>
            <p class="listing-card__address">${escapeHtml(l.address)}</p>
            <div class="rl-badges">
              ${l.verified ? '<span class="rl-badge">Verified host</span>' : ''}
              ${l.noFee ? '<span class="rl-badge">No broker fee</span>' : ''}
              ${l.scamShield ? '<span class="rl-badge rl-badge--safe">Scam Shield</span>' : ''}
              ${match != null ? '<span class="rl-badge rl-badge--fit">' + match + '% Stay DNA</span>' : ''}
            </div>
            <p class="rl-lead">${escapeHtml(l.description)}</p>
            ${renderVideoTour(l)}
            <section class="rl-block">
              <h2>Stay terms</h2>
              <dl class="rl-dl">
                <div><dt>Available</dt><dd>${formatDate(l.availableFrom)}</dd></div>
                <div><dt>Minimum stay</dt><dd>${l.minStayMonths} month${l.minStayMonths === 1 ? '' : 's'}</dd></div>
                <div><dt>Maximum stay</dt><dd>${l.maxStayMonths} months</dd></div>
                ${l.leaseEnd ? '<div><dt>Lease ends</dt><dd>' + formatDate(l.leaseEnd) + ' · ' + l.remainingMonths + ' months left</dd></div>' : ''}
                ${l.takeoverType ? '<div><dt>Takeover type</dt><dd>' + l.takeoverType + '</dd></div>' : ''}
                <div><dt>Furnished</dt><dd>${l.furnishedLevel}</dd></div>
                <div><dt>Pets</dt><dd>${l.pets === 'none' ? 'Not allowed' : l.pets}</dd></div>
              </dl>
            </section>
            ${l.housingType === 'lease-break' ? `<section class="rl-block rl-callout"><h2>Takeover math</h2><p>Remaining term × this rent vs. a typical furnished ${escapeHtml(l.cityName)} home. Estimated avoid-cost: <strong>${money(takeoverSave, l)}</strong> over ${l.remainingMonths} months. Confirm assignment vs sublet with the host before you send money.</p></section>` : ''}
            <section class="rl-block">
              <h2>Furniture inventory</h2>
              <ul class="rl-list">${furniture}</ul>
            </section>
            ${mates ? '<section class="rl-block"><h2>Who you would live with</h2><div class="rl-mates">' + mates + '</div></section>' : ''}
            ${l.building ? `<section class="rl-block"><h2>Building</h2><p><strong>${escapeHtml(l.building.name)}</strong> · ${l.building.roomsAvailable} rooms open · ${escapeHtml(l.building.cleaning)} cleaning${l.building.events ? ' · resident events' : ''}${l.building.coworking ? ' · coworking' : ''}.</p></section>` : ''}
            <section class="rl-block">
              <h2>Neighborhood pulse</h2>
              <p>${escapeHtml(l.commuteNote)}</p>
              <div class="rl-scores">
                <span>Walk ${scores.walk || '—'}</span><span>Transit ${scores.transit || '—'}</span>
                <span>Grocery ${scores.grocery || '—'}</span><span>Quiet ${scores.quiet || '—'}</span>
              </div>
            </section>
            <section class="rl-block"><h2>Amenities</h2><div class="amenity-chips">${amens}</div></section>
            <section class="rl-block rl-shield">
              <h2>Scam Shield</h2>
              <ul>
                <li>Never wire a deposit before a live video tour or in-person walkthrough.</li>
                <li>RentLeaks does not ask you to pay off-platform “application unlock” fees.</li>
                <li>Lease-breaks must show remaining term and assignment vs sublet.</li>
                <li>Report this listing from the apply step if anything feels off.</li>
              </ul>
            </section>
          </div>
          <aside class="rl-side">
            <div class="rl-price-card">
              <p class="listing-card__price">${money(allIn(l), l)}<span class="listing-card__period">all-in /mo</span>${leakChip(l)}</p>
              <ul class="rl-fee-stack">
                <li><span>Base rent</span><strong>${money(l.price, l)}</strong></li>
                <li><span>Utilities</span><strong>${fees.utilities ? money(fees.utilities, l) : 'Included'}</strong></li>
                <li><span>Wifi</span><strong>${fees.wifi ? money(fees.wifi, l) : 'Included'}</strong></li>
                <li><span>Cleaning</span><strong>${fees.cleaning ? money(fees.cleaning, l) : extras && l.housingType !== 'coliving' ? '—' : 'Included'}</strong></li>
                <li><span>Broker fee</span><strong>${fees.broker ? money(fees.broker, l) + ' one-time' : 'None'}</strong></li>
                <li><span>Deposit</span><strong>${money(l.deposit, l)}</strong></li>
              </ul>
              ${(function () {
                const op = operatorOf(l);
                if (!op) return '<p class="rl-host">Listed by ' + escapeHtml(l.host.name) + ' · replies in ~' + l.host.responseHours + 'h · current tenant</p>';
                return '<a class="rl-host rl-host--link" href="' + operatorHref(op) + '">' +
                  '<span class="rl-host__mark" aria-hidden="true">' + escapeHtml(operatorInitials(op.name)) + '</span>' +
                  '<span class="rl-host__text"><strong>' + escapeHtml(op.name) + '</strong>' +
                  '<span>' + op.count + ' ' + (op.count === 1 ? 'home' : 'homes') + ' · replies in ~' + op.responseHours + 'h</span></span>' +
                  '<span class="rl-host__go" aria-hidden="true">→</span></a>';
              })()}
              <a class="btn btn--primary btn--lg" href="${assetBase()}apply.html?id=${encodeURIComponent(l.id)}">Apply with passport</a>
              <div class="rl-price-card__actions">
                <button type="button" class="btn btn--outline" data-save="${escapeHtml(l.id)}">${saved ? 'Saved' : 'Save'}</button>
                <button type="button" class="btn btn--outline" data-compare="${escapeHtml(l.id)}">Compare</button>
              </div>
              <a class="btn btn--ghost btn--sm" href="${assetBase()}contact.html?listing=${encodeURIComponent(l.id)}">Message host</a>
            </div>
          </aside>
        </div>
        <section class="rl-block">
          <h2>Similar stays</h2>
          <div class="listings__grid" id="rl-similar"></div>
        </section>
      </div>`;
    const similar = filterListings({ type: l.housingType, city: l.cityId }).filter((x) => x.id !== l.id).slice(0, 3);
    const sim = $('#rl-similar');
    if (sim) sim.innerHTML = similar.map(renderListing).join('');
  }

  function renderMatch() {
    const root = $('#rl-match');
    if (!root) return;
    const existing = read(STORE.match, null);
    root.innerHTML = `
      <form class="rl-quiz" id="rl-quiz">
        <div class="form-group"><label>Where first?</label>
          <select name="city" class="form-input" required>
            <option value="">Choose a city</option>
            ${(DATA.cities || []).map((c) => '<option value="' + c.id + '"' + (existing && existing.city === c.id ? ' selected' : '') + '>' + c.name + '</option>').join('')}
          </select>
        </div>
        <fieldset class="rl-fieldset"><legend>Stay types you will consider</legend>
          ${(DATA.housingTypes || []).map((t) => '<label class="rl-check"><input type="checkbox" name="types" value="' + t.id + '"' + (existing && (existing.types || []).includes(t.id) ? ' checked' : '') + '> ' + t.label + '</label>').join('')}
        </fieldset>
        <div class="form-group"><label>All-in monthly ceiling</label>
          <input type="number" name="budget" class="form-input" min="400" step="50" value="${existing?.budget || 2500}" required>
        </div>
        <div class="form-group"><label>Longest you can commit (months)</label>
          <select name="stay" class="form-input">
            <option value="1">1–3 months</option>
            <option value="3">Up to 3</option>
            <option value="6">Up to 6</option>
            <option value="12" ${(existing && existing.stay === '12') ? 'selected' : ''}>Up to 12</option>
          </select>
        </div>
        <div class="form-group"><label>House energy</label>
          <select name="vibe" class="form-input">
            ${['quiet-professional', 'social', 'creative', 'mixed'].map((v) => '<option value="' + v + '"' + (existing && existing.vibe === v ? ' selected' : '') + '>' + v.replace('-', ' ') + '</option>').join('')}
          </select>
        </div>
        <label class="rl-check"><input type="checkbox" name="workspace" ${existing?.workspace ? 'checked' : ''}> I need a real desk / work setup</label>
        <label class="rl-check"><input type="checkbox" name="pets" ${existing?.pets === 'yes' ? 'checked' : ''}> I have a pet</label>
        <label class="rl-check"><input type="checkbox" name="privateBath" ${existing?.privateBath ? 'checked' : ''}> Private bathroom is a must</label>
        <button type="submit" class="btn btn--primary">Build my Stay DNA</button>
      </form>
      <div id="rl-match-results"></div>`;
    $('#rl-quiz').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const pref = {
        city: fd.get('city'),
        types: fd.getAll('types'),
        budget: fd.get('budget'),
        stay: fd.get('stay'),
        vibe: fd.get('vibe'),
        workspace: fd.get('workspace') === 'on',
        pets: fd.get('pets') === 'on' ? 'yes' : 'no',
        privateBath: fd.get('privateBath') === 'on'
      };
      if (!pref.types.length) pref.types = (DATA.housingTypes || []).map((t) => t.id);
      write(STORE.match, pref);
      const ranked = filterListings({ city: pref.city, type: '' })
        .map((l) => ({ l, s: scoreListing(l, pref) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 9);
      const box = $('#rl-match-results');
      box.innerHTML = '<h2>Your ranked homes</h2><p>Stay DNA is a local fit score — budget, stay length, vibe, and must-haves. Not a credit decision.</p><div class="listings__grid">' + ranked.map((x) => renderListing(x.l)).join('') + '</div>';
      toast('Stay DNA saved — listings will show a fit score');
    });
  }

  function renderSaved() {
    const root = $('#rl-saved');
    if (!root) return;
    const saved = savedIds().map(listingById).filter(Boolean);
    const alerts = read(STORE.alerts, []);
    const recent = read(STORE.recent, []).map(listingById).filter(Boolean).slice(0, 6);
    root.innerHTML = `
      <section class="rl-block"><h2>Shortlist</h2>
        ${saved.length ? '<div class="listings__grid">' + saved.map(renderListing).join('') + '</div>' : '<p>Nothing saved yet. Heart a room or lease-break to build a shortlist.</p>'}
      </section>
      <section class="rl-block"><h2>Alerts</h2>
        <form id="rl-alert-form" class="form profile-form">
          <div class="form__row">
            <div class="form-group"><label>City</label><select name="city" class="form-input">${(DATA.cities || []).map((c) => '<option value="' + c.id + '">' + c.name + '</option>').join('')}</select></div>
            <div class="form-group"><label>Type</label><select name="type" class="form-input">${(DATA.housingTypes || []).map((t) => '<option value="' + t.id + '">' + t.label + '</option>').join('')}</select></div>
          </div>
          <div class="form-group"><label>All-in max</label><input type="number" name="max" class="form-input" value="2500"></div>
          <button class="btn btn--primary" type="submit">Save alert</button>
        </form>
        <ul class="rl-list" id="rl-alert-list">${alerts.map((a, i) => '<li>' + escapeHtml(a.type) + ' in ' + escapeHtml(a.city) + ' ≤ ' + money(a.max) + ' <button type="button" data-del-alert="' + i + '">Remove</button></li>').join('')}</ul>
      </section>
      <section class="rl-block"><h2>Recently viewed</h2>
        <div class="listings__grid">${recent.map(renderListing).join('')}</div>
      </section>`;
    $('#rl-alert-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const next = alerts.concat([{ city: fd.get('city'), type: fd.get('type'), max: Number(fd.get('max')) }]);
      write(STORE.alerts, next);
      toast('Alert on. We will flag matching new homes in this browser.');
      renderSaved();
    });
  }

  function renderApply() {
    const root = $('#rl-apply');
    if (!root) return;
    const l = listingById(params().get('id'));
    const p = profile() || {};
    root.innerHTML = `
      <div class="rl-apply">
        ${l ? '<aside class="rl-price-card"><p class="rl-kicker">Applying to</p><h2>' + escapeHtml(l.title) + '</h2><p>' + money(allIn(l), l) + ' all-in · ' + escapeHtml(l.location) + '</p></aside>' : ''}
        <form class="form form-card" id="rl-passport">
          <h2>Renter passport</h2>
          <p>Reuse this on every apply. Hosts see stay length and move window — not a mystery email.</p>
          <div class="form-group"><label>Full name</label><input name="name" class="form-input" required value="${escapeHtml(p.name || '')}"></div>
          <div class="form-group"><label>Email</label><input type="email" name="email" class="form-input" required value="${escapeHtml(p.email || '')}"></div>
          <div class="form-group"><label>Move-in window</label><input type="date" name="moveIn" class="form-input" value="${escapeHtml(p.moveIn || '')}"></div>
          <div class="form-group"><label>Intended stay (months)</label><input type="number" name="stay" class="form-input" min="1" max="18" value="${escapeHtml(p.stay || 3)}"></div>
          <div class="form-group"><label>Income range</label>
            <select name="income" class="form-input">
              <option>Under $50k</option><option> $50–75k</option><option>$75–120k</option><option>$120k+</option>
            </select>
          </div>
          <div class="form-group"><label>Why this stay</label><textarea name="note" class="form-input" rows="4" placeholder="Relocation, contract, lease-break, housemate fit…">${escapeHtml(p.note || '')}</textarea></div>
          <label class="rl-check"><input type="checkbox" name="tour" checked> I will not pay a deposit before a live tour</label>
          <button class="btn btn--primary" type="submit">${l ? 'Send application' : 'Save passport'}</button>
        </form>
      </div>`;
    $('#rl-passport').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const next = { name: fd.get('name'), email: fd.get('email'), moveIn: fd.get('moveIn'), stay: fd.get('stay'), income: fd.get('income'), note: fd.get('note') };
      write(STORE.profile, next);
      write(STORE.session, { name: next.name, email: next.email });
      toast(l ? 'Application sent to the host. Passport saved.' : 'Passport saved.');
      injectChrome();
      bindChromeEvents();
    });
  }

  function renderListWizard() {
    const root = $('#rl-list');
    if (!root) return;
    const kind = params().get('kind') || 'room';
    root.innerHTML = `
      <form class="form form-card rl-wizard" id="rl-wizard">
        <p class="rl-kicker">List in minutes</p>
        <h2>What are you listing?</h2>
        <div class="rl-kind-grid">
          ${(DATA.housingTypes || []).map((t) => '<label class="rl-kind' + (kind === t.id ? ' is-on' : '') + '"><input type="radio" name="housingType" value="' + t.id + '"' + (kind === t.id ? ' checked' : '') + '><strong>' + t.label + '</strong><span>' + t.promise + '</span></label>').join('')}
        </div>
        <div class="form-group"><label>City</label>
          <select name="cityId" class="form-input" required>${(DATA.cities || []).map((c) => '<option value="' + c.id + '"' + (c.id === 'nyc' ? ' selected' : '') + '>' + c.name + '</option>').join('')}</select>
        </div>
        <div class="form-group"><label>Neighborhood</label><input name="neighborhood" class="form-input" required placeholder="Williamsburg, Brickell, Mission…"></div>
        <div class="form-group"><label>Title</label><input name="title" class="form-input" required placeholder="Private room + bath near the G"></div>
        <div class="form__row">
          <div class="form-group"><label>Monthly rent</label><input type="number" name="price" class="form-input" required min="400" value="1400"></div>
          <div class="form-group"><label>Utilities /mo</label><input type="number" name="utilities" class="form-input" value="0"></div>
        </div>
        <div class="form__row">
          <div class="form-group"><label>Available</label><input type="date" name="availableFrom" class="form-input" required></div>
          <div class="form-group"><label>Min stay (months)</label><input type="number" name="minStayMonths" class="form-input" min="1" value="1"></div>
        </div>
        <div class="form-group" id="rl-lease-fields" hidden>
          <label>Lease end date</label><input type="date" name="leaseEnd" class="form-input">
          <label>Takeover type</label>
          <select name="takeoverType" class="form-input"><option value="assignment">Assignment</option><option value="sublet">Sublet</option></select>
        </div>
        <div class="form-group"><label>Description</label><textarea name="description" class="form-input" rows="4" required placeholder="Who lives here, what is included, what is not."></textarea></div>
        <p class="rl-allin-live">All-in preview: <strong id="rl-allin-preview">$1,400</strong> /mo</p>
        <p class="pricing-note">Lease-break posts are free. Rooms and furnished stays can start free while we seed a city.</p>
        <button class="btn btn--primary" type="submit">Publish listing</button>
      </form>`;
    const form = $('#rl-wizard');
    const syncAllIn = () => {
      const price = Number(form.price.value || 0);
      const util = Number(form.utilities.value || 0);
      $('#rl-allin-preview').textContent = money(price + util);
      const type = form.housingType.value;
      $('#rl-lease-fields').hidden = type !== 'lease-break';
      $$('.rl-kind').forEach((el) => el.classList.toggle('is-on', el.querySelector('input').checked));
      // Aparthotels exist here only because of the 30-day floor: hold it.
      const kindNow = (form.querySelector('input[name="housingType"]:checked') || {}).value;
      const minStayEl = form.querySelector('[name="minStayMonths"]');
      if (minStayEl) {
        const locked = kindNow === 'aparthotel';
        minStayEl.min = '1';
        if (locked && Number(minStayEl.value || 0) < 1) minStayEl.value = '1';
        minStayEl.setAttribute('aria-describedby', locked ? 'rl-minstay-note' : '');
        let note = form.querySelector('#rl-minstay-note');
        if (locked && !note) {
          note = document.createElement('p');
          note.id = 'rl-minstay-note';
          note.className = 'pricing-note';
          note.textContent = 'Aparthotel listings are monthly only — RentLeaks does not take nightly bookings.';
          minStayEl.parentNode.appendChild(note);
        } else if (!locked && note) {
          note.remove();
        }
      }
    };
    form.addEventListener('input', syncAllIn);
    form.addEventListener('change', syncAllIn);
    syncAllIn();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const city = cityMeta(fd.get('cityId'));
      const type = fd.get('housingType');
      const price = Number(fd.get('price'));
      const utilities = Number(fd.get('utilities') || 0);
      const id = 'mine-' + Date.now();
      const listing = {
        id, type: 'rent', housingType: type,
        title: fd.get('title'),
        address: fd.get('neighborhood') + ', ' + city.name + ', ' + city.state,
        neighborhood: fd.get('neighborhood'),
        cityId: city.id, cityName: city.name, state: city.state,
        price, priceSuffix: '/mo',
        fees: { broker: 0, utilities, wifi: 0, cleaning: 0, parking: 0 },
        allIn: price + utilities, deposit: price, lastMonth: 0,
        beds: 1, baths: 1, sqft: 200,
        specs: type === 'room' || type === 'coliving' ? 'Host-listed room' : 'Host-listed apartment',
        privateBath: true, roommates: type === 'room' ? 1 : 0, housemates: [],
        furnishedLevel: type === 'lease-break' ? 'partial' : 'fully',
        furniture: ['bed + mattress', 'desk + chair'],
        minStayMonths: Number(fd.get('minStayMonths') || 1),
        maxStayMonths: type === 'lease-break' ? 6 : 12,
        availableFrom: fd.get('availableFrom'),
        leaseEnd: fd.get('leaseEnd') || null,
        remainingMonths: type === 'lease-break' ? 4 : null,
        takeoverType: fd.get('takeoverType') || null,
        utilitiesIncluded: utilities === 0 ? ['utilities'] : [],
        amenities: ['workspace'], workplaceReady: true, pets: 'none',
        verified: false, noFee: true, scamShield: true,
        images: [IMAGES_SAFE()], image: IMAGES_SAFE(),
        location: city.name + ' · ' + fd.get('neighborhood'),
        categories: [type],
        description: fd.get('description'),
        neighborhoodScores: { walk: city.walk, transit: city.transit, grocery: 70, nightlife: 60, quiet: 55 },
        commuteNote: 'Host-listed. Confirm transit on your tour.',
        postedAt: '2026-09-07', featured: true,
        building: null,
        host: { name: (session() && session().name) || 'You', type: type === 'lease-break' ? 'current-tenant' : 'host', responseHours: 2 },
        vibe: 'mixed'
      };
      const mine = read(STORE.listings, []);
      mine.unshift(listing);
      write(STORE.listings, mine);
      DATA.listings.unshift(listing);
      toast('Live on RentLeaks in this browser');
      window.location.href = listingHref(listing);
    });
  }

  function IMAGES_SAFE() {
    return 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80';
  }

  function renderComparePage() {
    const root = $('#rl-compare');
    if (!root) return;
    const items = compareIds().map(listingById).filter(Boolean);
    if (!items.length) {
      root.innerHTML = '<p>Add up to 3 homes from search, then come back.</p><a class="btn btn--primary" href="' + assetBase() + 'rent.html">Browse</a>';
      return;
    }
    const rows = [
      ['Stay type', (l) => typeMeta(l.housingType).label],
      ['All-in /mo', (l) => money(allIn(l), l)],
      ['Base rent', (l) => money(l.price, l)],
      ['City', (l) => l.location],
      ['Available', (l) => formatDate(l.availableFrom)],
      ['Min stay', (l) => l.minStayMonths + ' mo'],
      ['Lease left', (l) => l.remainingMonths ? l.remainingMonths + ' mo' : '—'],
      ['Furnished', (l) => l.furnishedLevel],
      ['Private bath', (l) => l.privateBath ? 'Yes' : 'No'],
      ['Workspace', (l) => l.workplaceReady ? 'Yes' : 'No'],
      ['Pets', (l) => l.pets],
      ['Broker fee', (l) => l.fees && l.fees.broker ? money(l.fees.broker, l) : 'None'],
      ['Verified', (l) => l.verified ? 'Yes' : 'Not yet']
    ];
    root.innerHTML = '<div class="rl-compare-table"><table><thead><tr><th></th>' +
      items.map((l) => '<th><a href="' + listingHref(l) + '">' + escapeHtml(l.title) + '</a></th>').join('') +
      '</tr></thead><tbody>' +
      rows.map((r) => '<tr><th>' + r[0] + '</th>' + items.map((l) => '<td>' + r[1](l) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  function renderProfessionalsCopy() {
    const note = $('#rl-pro-note');
    if (note) {
      note.textContent = 'Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. Lease-break listings are free.';
    }
  }

  function injectListingsSchema(list) {
    if (!list || !list.length) return;
    $$('script[data-rl-schema]').forEach((n) => n.remove());
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Flexible housing on RentLeaks',
      description: 'Rooms, co-living, furnished apartments, 1-month stays, and lease-breaks in major U.S. cities.',
      numberOfItems: list.length,
      itemListElement: list.slice(0, 12).map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Accommodation',
          name: l.title,
          address: { '@type': 'PostalAddress', streetAddress: l.address, addressLocality: l.cityName, addressRegion: l.state },
          offers: { '@type': 'Offer', price: allIn(l), priceCurrency: 'USD' }
        }
      }))
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.rlSchema = '1';
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
  }


  function openModal(id) {
    const overlay = $('#modal-' + id);
    if (!overlay) return;
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const focusable = overlay.querySelector('input, button, a');
    if (focusable) focusable.focus();
  }

  function closeModals() {
    $$('.modal-overlay.is-active').forEach((ov) => {
      ov.classList.remove('is-active');
      ov.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }
  function openCmd() {
    const cmd = $('#rl-cmd');
    if (!cmd) return;
    cmd.hidden = false;
    cmd.classList.add('is-open');
    const input = $('#rl-cmd-input');
    if (input) { input.value = ''; input.focus(); renderCmd(''); }
  }
  function closeCmd() {
    const cmd = $('#rl-cmd');
    if (cmd) {
      cmd.hidden = true;
      cmd.classList.remove('is-open');
    }
  }

  function renderCmd(q) {
    const box = $('#rl-cmd-results');
    if (!box) return;
    const query = (q || '').trim().toLowerCase();
    const rows = [];
    (DATA.housingTypes || []).forEach((t) => {
      if (!query || t.label.toLowerCase().includes(query)) {
        rows.push({ href: assetBase() + t.href, label: t.label, hint: 'Stay type' });
      }
    });
    (DATA.cities || []).forEach((c) => {
      if (!query || c.name.toLowerCase().includes(query) || String(c.state).toLowerCase().includes(query)) {
        rows.push({ href: cityHref(c), label: c.name + ', ' + c.state, hint: 'Market' });
      }
    });
    if (query) {
      filterListings({ location: q, type: '', city: '' }).slice(0, 6).forEach((l) => {
        rows.push({ href: listingHref(l), label: l.title, hint: money(allIn(l), l) + ' all-in · ' + l.cityName });
      });
    }
    box.innerHTML = rows.slice(0, 12).map((r, i) =>
      '<a href="' + r.href + '"' + (i === 0 ? ' class="is-active"' : '') + '><strong>' + escapeHtml(r.label) + '</strong><span>' + escapeHtml(r.hint) + '</span></a>'
    ).join('') || '<p>Nothing matches “' + escapeHtml(q) + '”. Try a city or “lease-break”.</p>';
    cmdIndex = 0;
  }

  let cmdIndex = 0;
  function moveCmd(dir) {
    const links = $$('#rl-cmd-results a');
    if (!links.length) return;
    cmdIndex = (cmdIndex + dir + links.length) % links.length;
    links.forEach((a, i) => a.classList.toggle('is-active', i === cmdIndex));
    links[cmdIndex].scrollIntoView({ block: 'nearest' });
  }
  function openActiveCmd() {
    const active = $('#rl-cmd-results a.is-active') || $('#rl-cmd-results a');
    if (active) window.location.href = active.getAttribute('href');
  }

  function bindChromeEvents() {
    const navToggle = $('.nav-toggle');
    const nav = $('.nav');
    if (navToggle && nav && !navToggle.dataset.bound) {
      navToggle.dataset.bound = '1';
      navToggle.addEventListener('click', () => {
        const expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
        nav.classList.toggle('is-open', !expanded);
      });
    }
    $$('.js-modal-trigger').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => { e.preventDefault(); openModal(btn.dataset.modal); });
    });
    $$('.js-modal-close').forEach((btn) => { btn.onclick = closeModals; });
    $$('.js-cmd').forEach((btn) => { btn.onclick = openCmd; });
    $$('.js-theme').forEach((btn) => { btn.onclick = toggleTheme; });
    $$('.js-currency').forEach((sel) => {
      sel.onchange = () => setDisplayCurrency(sel.value);
    });

    const header = $('.header');
    if (header && !window._rlStuck) {
      window._rlStuck = true;
      const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }
  function bindEvents() {
    bindChromeEvents();

    document.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('modal-overlay')) closeModals();
      if (e.target.id === 'rl-cmd') closeCmd();
      const save = e.target.closest('[data-save]');
      if (save) {
        e.preventDefault();
        e.stopPropagation();
        toggleSave(save.dataset.save);
        const on = savedIds().includes(save.dataset.save);
        save.classList.toggle('listing-card__save--saved', on);
        const svg = save.querySelector('svg');
        if (svg) svg.setAttribute('fill', on ? 'currentColor' : 'none');
      }
      const cmp = e.target.closest('[data-compare]');
      if (cmp) {
        e.preventDefault();
        e.stopPropagation();
        toggleCompare(cmp.dataset.compare);
      }
      const del = e.target.closest('[data-del-alert]');
      if (del) {
        const alerts = read(STORE.alerts, []);
        alerts.splice(Number(del.dataset.delAlert), 1);
        write(STORE.alerts, alerts);
        renderSaved();
      }
      const gal = e.target.closest('[data-open-gallery]');
      if (gal) {
        e.preventDefault();
        const listing = listingById(gal.dataset.openGallery);
        if (listing) openLightbox(listingMedia(listing), Number(gal.dataset.galleryIndex || 0));
      }
      if (e.target.closest('[data-lb-close]')) closeLightbox();
      const lbStep = e.target.closest('[data-lb-step]');
      if (lbStep) stepLightbox(Number(lbStep.dataset.lbStep));
      const lbGoto = e.target.closest('[data-lb-goto]');
      if (lbGoto) {
        lbState.index = Number(lbGoto.dataset.lbGoto);
        paintLightbox();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeLightbox(); closeModals(); closeCmd(); }
      if ($('#rl-lb') && $('#rl-lb').classList.contains('is-open')) {
        if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const cmd = $('#rl-cmd');
        if (cmd && !cmd.hidden) closeCmd(); else openCmd();
      }
    });

    const cmdInput = $('#rl-cmd-input');
    if (cmdInput) cmdInput.addEventListener('input', () => renderCmd(cmdInput.value));

    $$('.modal-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.modal-tab').forEach((t) => t.classList.remove('is-active'));
        $$('.modal-panel').forEach((p) => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        const panel = $('#panel-' + tab.dataset.panel);
        if (panel) panel.classList.add('is-active');
      });
    });

    $$('.js-auth-form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = fd.get('name') || String(fd.get('email') || 'Member').split('@')[0];
        write(STORE.session, { name: name, email: fd.get('email') });
        if (form.dataset.action === 'signup') {
          write(STORE.profile, Object.assign(profile() || {}, { name: name, email: fd.get('email') }));
        }
        closeModals();
        toast('Signed in. Your passport lives in this browser.');
        injectChrome();
        bindChromeEvents();
      });
    });

    const form = $('.search-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        syncStateFromForm();
        if (pageName() === 'home') {
          const p = new URLSearchParams();
          if (state.type) p.set('type', state.type);
          if (state.city) p.set('city', state.city);
          if (state.location) p.set('q', state.location);
          if (state.priceMax) p.set('max', state.priceMax);
          if (state.minStay) p.set('stay', state.minStay);
          if (state.moveIn) p.set('moveIn', state.moveIn);
          window.location.href = 'rent.html' + (p.toString() ? '?' + p : '');
          return;
        }
        pushBrowseUrl();
        renderListings();
        $('#listings')?.scrollIntoView({ behavior: 'smooth' });
      });
      ['input', 'change'].forEach((ev) => {
        form.addEventListener(ev, () => {
          if (pageName() === 'home') return;
          syncStateFromForm();
          pushBrowseUrl();
          renderListings();
        });
      });
    }

    $$('.rl-adv input').forEach((el) => {
      el.addEventListener('change', () => {
        syncStateFromForm();
        renderListings();
      });
    });

    const sortEl = $('#sort');
    if (sortEl) sortEl.addEventListener('change', () => { state.sort = sortEl.value; renderListings(); });

    const viewBtns = $$('[data-view]');
    viewBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.view = btn.dataset.view;
        viewBtns.forEach((b) => b.classList.toggle('is-on', b === btn));
        renderListings();
      });
    });

    $$('.pricing-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.pricing-tab').forEach((t) => { t.classList.remove('pricing-tab--active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('pricing-tab--active');
        tab.setAttribute('aria-selected', 'true');
      });
    });

    function handleFormSubmit(formEl, successMsg) {
      if (!formEl) return;
      const btn = formEl.querySelector('button[type="submit"]');
      if (btn && !btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
      formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
        setTimeout(() => {
          const existing = formEl.querySelector('.form__message--success');
          if (existing) { existing.hidden = false; existing.textContent = successMsg; }
          else {
            const p = document.createElement('p');
            p.className = 'form__message form__message--success';
            p.textContent = successMsg;
            formEl.appendChild(p);
          }
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || 'Submit'; }
        }, 500);
      });
    }
    handleFormSubmit($('#contact-form'), 'Thanks — a human will reply within a day.');
    handleFormSubmit($('#profile-form'), 'Alerts are on for this browser.');
    handleFormSubmit($('#sales-form'), 'Received. Operator onboarding will follow up.');
    $$('.newsletter__form').forEach((f) => {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = f.querySelector('button[type="submit"]');
        const inp = f.querySelector('input[type="email"]');
        const alerts = read(STORE.alerts, []);
        alerts.push({ city: 'nyc', type: 'room', max: 3000, email: inp && inp.value });
        write(STORE.alerts, alerts);
        if (inp) inp.value = '';
        if (btn) btn.textContent = 'Alerts on';
        toast('Alert saved');
      });
    });

    /* --- fee popover, chips, filter sheet --------------------------- */
    document.addEventListener('click', (e) => {
      const feeBtn = e.target.closest('[data-fees]');
      if (feeBtn) {
        e.preventDefault();
        const already = $('#rl-fee-pop');
        if (already && already.dataset.for === feeBtn.dataset.fees) { closeFeePop(); return; }
        openFeePop(feeBtn, feeBtn.dataset.fees);
        const pop = $('#rl-fee-pop');
        if (pop) pop.dataset.for = feeBtn.dataset.fees;
        return;
      }
      if (!e.target.closest('#rl-fee-pop')) closeFeePop();

      const chip = e.target.closest('[data-chip]');
      if (chip) { e.preventDefault(); clearFilter(chip.dataset.chip); }

      const setType = e.target.closest('[data-set-type]');
      if (setType) { state.type = setType.dataset.setType; state.page = 1; pushBrowseUrl(); renderListings(); return; }
      const setBeds = e.target.closest('[data-set-beds]');
      if (setBeds) { state.beds = setBeds.dataset.setBeds || null; state.page = 1; renderListings(); return; }
      const setStay = e.target.closest('[data-set-stay]');
      if (setStay) { state.minStay = setStay.dataset.setStay || null; state.page = 1; renderListings(); return; }
      const setMax = e.target.closest('[data-set-max]');
      if (setMax) {
        const v = Number(setMax.dataset.setMax);
        state.priceMax = state.priceMax === v ? null : v;
        state.page = 1; renderListings(); return;
      }
      if (e.target.closest('.js-load-more')) {
        state.page += 1;
        renderListings();
        return;
      }
      if (e.target.closest('.js-filter-open')) openFilterSheet();
      if (e.target.closest('.js-filter-done')) closeFilterSheet();
    });
    document.addEventListener('input', (e) => {
      if (e.target.id === 'rail-min' || e.target.id === 'rail-max') {
        clearTimeout(window._rlRailT);
        window._rlRailT = setTimeout(() => {
          state.priceMin = $('#rail-min').value ? Number($('#rail-min').value) : null;
          state.priceMax = $('#rail-max').value ? Number($('#rail-max').value) : null;
          state.page = 1;
          renderListings();
        }, 320);
      }
    });
    window.addEventListener('resize', closeFeePop, { passive: true });
    window.addEventListener('scroll', closeFeePop, { passive: true });

    document.addEventListener('keydown', (e) => {
      const cmd = $('#rl-cmd');
      if (!cmd || cmd.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); moveCmd(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveCmd(-1); }
      if (e.key === 'Enter') { e.preventDefault(); openActiveCmd(); }
    });
  }

  function init() {
    const page = pageName();
    if (page === 'listing' && params().get('id')) {
      const found = listingById(params().get('id'));
      if (found && found.path && !/\/listings\//.test(location.pathname)) {
        location.replace(found.path);
        return;
      }
    }
    if (page === 'city' && params().get('city')) {
      const found = cityMeta(params().get('city'));
      if (found && found.slug && !/\/cities\//.test(location.pathname)) {
        location.replace('cities/' + found.slug + '.html');
        return;
      }
    }
    applyTheme(currentTheme());
    document.documentElement.classList.add('js-reveal');
    injectChrome();
    populateSearchFields();
    decorateSearchFields();
    applyUrlToState();
    renderMenuHero();
    if (page === 'home') renderHome();
    else if (page === 'browse' || page === 'rent') renderListings();
    else if (page === 'listing') {
      renderDetail();
      hydrateListingMap();
      if (params().get('gallery') === '1') {
        const found = listingById(params().get('id') || document.body.dataset.listingId);
        if (found) openLightbox(listingMedia(found), Number(params().get('shot') || 0));
      }
    }
    else if (page === 'cities') renderCitiesPage();
    else if (page === 'city') {
      const slugMatch = location.pathname.match(/\/cities\/([^/]+)\.html/);
      if (slugMatch && !params().get('city')) {
        const city = cityMeta(decodeURIComponent(slugMatch[1]));
        if (city) state.city = city.id;
      }
      if (!document.body.dataset.static) renderCityPage();
    }
    else if (page === 'match') renderMatch();
    else if (page === 'saved') renderSaved();
    else if (page === 'apply') renderApply();
    else if (page === 'list') renderListWizard();
    else if (page === 'compare') renderComparePage();
    else if (page === 'professionals') renderProfessionalsCopy();
    else if (page === 'operators') renderOperatorsDirectory();
    else if (page === 'operator') renderOperatorPage();
    if ($('#listings-grid') && page !== 'home' && page !== 'listing' && page !== 'saved' && page !== 'match') {
      // city page already rendered
    }
    document.addEventListener('rl:currency', () => {
      const page = pageName();
      if (page === 'home') renderHome();
      else if (page === 'browse' || page === 'rent') { state.page = 1; renderListings(); }
      else if (page === 'listing') renderDetail();
      else if (page === 'city') renderCityPage();
      else if (page === 'compare') renderComparePage();
      else if (page === 'saved') renderSaved();
      setupScrollAnimations();
    });
    document.addEventListener('rl:meta', () => markLiveState(true));
    document.addEventListener('rl:data-offline', () => markLiveState(false));
    markLiveState(false);
    mountScopedBrowsers();
    bindEvents();
    if (params().get('modal') === 'auth') openModal('auth');
    setupScrollAnimations();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
