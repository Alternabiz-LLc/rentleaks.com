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
    match: 'rl_match'
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
    view: 'grid'
  };

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }
  function money(n) { return '$' + Number(n || 0).toLocaleString(); }
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

  function renderRoomsShowcase() {
    const isRooms = document.body.dataset.type === 'room' || state.type === 'room';
    if (!isRooms) {
      const leftover = $('#rl-rooms-media');
      if (leftover && document.body.dataset.type !== 'room') leftover.innerHTML = '';
      return;
    }
    const rooms = (DATA.listings || []).filter((l) => l.housingType === 'room');
    if (!rooms.length) return;
    const featured = rooms.filter((l) => l.cityId === 'nyc').concat(rooms).filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i).slice(0, 8);
    const lead = featured[0] || rooms[0];
    const leadMedia = listingMedia(lead);
    const videoIndex = Math.max(0, leadMedia.findIndex((x) => x.kind === 'video'));
    const html = `
      <section class="rl-media-hero" id="rl-rooms-hero">
        <video class="rl-media-hero__video" autoplay muted loop playsinline poster="${lead.image}" src="${lead.video && lead.video.src ? lead.video.src : ''}"></video>
        <div class="rl-media-hero__shade"></div>
        <div class="rl-media-hero__copy container">
          <nav class="rl-crumb rl-crumb--light" aria-label="Breadcrumb"><a href="${assetBase()}index.html">Home</a> / Rooms</nav>
          <p class="rl-kicker rl-kicker--light">Private bedrooms · 30-day minimum</p>
          <h1>Rooms you can see before you tour</h1>
          <p>A photo gallery and a video walkthrough on every room. Housemates are named. Rent is all-in.</p>
          <div class="rl-media-hero__actions">
            <a class="btn btn--primary" href="#listings">Browse ${rooms.length} rooms</a>
            <button type="button" class="btn btn--on-dark" data-open-gallery="${escapeHtml(lead.id)}" data-gallery-index="${videoIndex}">Play video tour</button>
          </div>
        </div>
      </section>
      <section class="rl-room-film container">
        <div class="rl-room-film__head">
          <h2>See the rooms</h2>
          <p>Bedroom, bath, kitchen, and a host video — not a single hero crop.</p>
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
    let mount = $('#rl-rooms-media');
    if (!mount) {
      const main = $('#main');
      if (!main) return;
      mount = document.createElement('div');
      mount.id = 'rl-rooms-media';
      const listings = $('#listings');
      main.insertBefore(mount, listings || main.firstElementChild);
    }
    mount.innerHTML = html;
    const oldHero = $('.page-hero');
    if (oldHero) oldHero.hidden = true;
  }
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
    if (/\/(listings|cities)\//.test(path)) return '../';
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
    const typeKeys = { room: 1, coliving: 1, furnished: 1, 'short-term': 1, 'lease-break': 1 };
    const active = page === key || (typeKeys[key] && type === key);
    return '<li><a href="' + href + '" class="nav__link' + (active ? ' nav__link--active' : '') + '">' + label + '</a></li>';
  }

  function injectChrome() {
    const saved = savedIds().length;
    const user = session();
    const headerHost = $('#rl-header');
    if (headerHost) {
      headerHost.innerHTML = `
        <header class="header">
          <div class="header__container">
            <a href="${assetBase()}index.html" class="logo" aria-label="RentLeaks Home">
              <span class="logo__mark">RL</span>
              <span class="logo__text">RentLeaks</span>
            </a>
            <nav class="nav" aria-label="Main navigation">
              <ul class="nav__list">
                ${navLink(assetBase() + 'rooms.html', 'Rooms', 'room')}
                ${navLink(assetBase() + 'coliving.html', 'Co-living', 'coliving')}
                ${navLink(assetBase() + 'furnished.html', 'Furnished', 'furnished')}
                ${navLink(assetBase() + 'short-term.html', '1-month+', 'short-term')}
                ${navLink(assetBase() + 'lease-break.html', 'Lease-break', 'lease-break')}
                ${navLink(assetBase() + 'cities.html', 'Cities', 'cities')}
                ${navLink(assetBase() + 'match.html', 'Match', 'match')}
              </ul>
            </nav>
            <div class="header__actions">
              <button type="button" class="header__link js-cmd" aria-label="Search">Search ⌘K</button>
              <a href="${assetBase()}saved.html" class="header__link">Saved${saved ? ' <span class="rl-count">' + saved + '</span>' : ''}</a>
              <a href="${assetBase()}list.html" class="header__link">List a place</a>
              ${user
                ? '<a href="' + assetBase() + 'saved.html" class="btn btn--primary">' + escapeHtml(user.name.split(' ')[0]) + '</a>'
                : '<a href="#" class="btn btn--primary js-modal-trigger" data-modal="auth">Sign in</a>'}
            </div>
            <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span><span></span></button>
          </div>
        </header>`;
    }

    const footerHost = $('#rl-footer');
    if (footerHost) {
      const base = assetBase();
      const typeLinks = (DATA.housingTypes || []).map((t) => '<li><a href="' + base + (t.href || typeHref(t.id)) + '">' + t.label + '</a></li>').join('');
      const featuredCities = (DATA.cities || []).filter((c) => c.featured);
      const cityLinks = featuredCities.filter((c) => (c.country || 'US') === 'US').slice(0, 4)
        .concat(featuredCities.filter((c) => (c.country || 'US') !== 'US').slice(0, 6))
        .map((c) => '<li><a href="' + cityHref(c) + '">' + c.name + '</a></li>').join('');
      footerHost.innerHTML = `
        <footer class="footer">
          <div class="container">
            <div class="newsletter">
              <div class="newsletter__inner">
                <h3 class="newsletter__title">Get the next flexible home first</h3>
                <p class="newsletter__desc">Alerts for rooms, co-living, furnished, 1-month+ stays, and lease takeovers — never hotel nights.</p>
                <form class="newsletter__form" action="#" aria-label="Alert signup">
                  <input type="email" class="newsletter__input" placeholder="Enter your email" required aria-label="Email address">
                  <button type="submit" class="btn btn--primary">Start alerts</button>
                </form>
              </div>
            </div>
            <div class="footer__grid">
              <div class="footer__brand">
                <a href="${base}index.html" class="logo logo--footer"><span class="logo__mark">RL</span><span class="logo__text">RentLeaks</span></a>
                <p class="footer__tagline">Flexible housing, priced honestly. U.S. + major European cities.</p>
              </div>
              <nav class="footer__nav">
                <div class="footer__col"><h4>Find</h4><ul>${typeLinks}<li><a href="${base}match.html">Stay DNA match</a></li></ul></div>
                <div class="footer__col"><h4>Cities</h4><ul>${cityLinks}<li><a href="${base}cities.html">All ${(DATA.cities || []).length} markets</a></li></ul></div>
                <div class="footer__col"><h4>Hosts</h4><ul>
                  <li><a href="${base}list.html?kind=lease-break">Post a lease-break free</a></li>
                  <li><a href="${base}list.html?kind=room">List a room</a></li>
                  <li><a href="${base}list.html?kind=coliving">Co-living operators</a></li>
                  <li><a href="${base}professionals.html">Plans & tools</a></li>
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
              <p>&copy; 2026 RentLeaks. Fair Housing applies in every market. Short-term means 30 days or more.</p>
            </div>
          </div>
        </footer>`;
    }

    if (!$('#modal-auth')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="modal-overlay" id="modal-auth" aria-hidden="true">
          <div class="modal" role="dialog" aria-labelledby="modal-auth-title">
            <button type="button" class="modal__close js-modal-close" aria-label="Close">&times;</button>
            <h2 id="modal-auth-title" class="modal__title">Your renter passport</h2>
            <p class="modal__subtitle">One profile. Save homes, compare, and apply without retyping.</p>
            <div class="modal-tabs">
              <button type="button" class="modal-tab is-active" data-panel="signin">Sign in</button>
              <button type="button" class="modal-tab" data-panel="signup">Create passport</button>
            </div>
            <div id="panel-signin" class="modal-panel is-active">
              <form class="form js-auth-form" data-action="signin">
                <div class="form-group"><label for="signin-email">Email</label><input type="email" id="signin-email" name="email" class="form-input" required placeholder="you@example.com"></div>
                <div class="form-group"><label for="signin-password">Password</label><input type="password" id="signin-password" name="password" class="form-input" required></div>
                <button type="submit" class="btn btn--primary">Sign in</button>
              </form>
            </div>
            <div id="panel-signup" class="modal-panel">
              <form class="form js-auth-form" data-action="signup">
                <div class="form-group"><label for="signup-name">Name</label><input type="text" id="signup-name" name="name" class="form-input" required></div>
                <div class="form-group"><label for="signup-email">Email</label><input type="email" id="signup-email" name="email" class="form-input" required></div>
                <div class="form-group"><label for="signup-password">Password</label><input type="password" id="signup-password" name="password" class="form-input" required minlength="8"></div>
                <button type="submit" class="btn btn--primary">Create passport</button>
              </form>
            </div>
          </div>
        </div>
        <div class="rl-compare-tray" id="rl-compare-tray" hidden></div>
        <div class="rl-cmd" id="rl-cmd" hidden>
          <div class="rl-cmd__panel" role="dialog" aria-label="Command search">
            <input type="search" id="rl-cmd-input" class="rl-cmd__input" placeholder="Jump to a city, stay type, or listing…" autocomplete="off">
            <div id="rl-cmd-results" class="rl-cmd__results"></div>
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
    if (s.priceMin) list = list.filter((l) => allIn(l) >= Number(s.priceMin));
    if (s.priceMax) list = list.filter((l) => allIn(l) <= Number(s.priceMax));
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

    if (s.sort === 'price-asc') list.sort((a, b) => allIn(a) - allIn(b));
    else if (s.sort === 'price-desc') list.sort((a, b) => allIn(b) - allIn(a));
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
    if (pref.budget && allIn(l) <= Number(pref.budget)) score += 12;
    else if (pref.budget && allIn(l) > Number(pref.budget)) score -= 16;
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

    return `
      <article class="listing-card animate-on-scroll" data-id="${escapeHtml(listing.id)}">
        <a href="${listingHref(listing)}" class="listing-card__link">
          <div class="listing-card__img-wrap">
            <div class="listing-card__img">
              <img class="listing-card__photo" src="${listing.image}" alt="${escapeHtml(listing.imageAlt || listing.title + ' in ' + listing.location)}" width="1400" height="933" loading="lazy" decoding="async">
              <span class="listing-card__badge">${escapeHtml(t.short)}</span>
              ${clock}
              ${match != null ? '<span class="rl-match-pill">' + match + '% fit</span>' : ''}
              ${hasVideo ? '<span class="listing-card__vid">Video</span>' : ''}
              ${shotCount > 1 ? '<span class="listing-card__shots">' + shotCount + ' photos</span>' : ''}
            </div>
          </div>
          <div class="listing-card__body">
            <p class="listing-card__price">${money(allIn(listing))}<span class="listing-card__period"> all-in /mo</span></p>
            <p class="rl-base-rent">Base ${money(listing.price)}${listing.priceSuffix || '/mo'}</p>
            <h3 class="listing-card__title">${escapeHtml(listing.title)}</h3>
            <p class="listing-card__address">${iconPin()} ${escapeHtml(listing.location)}</p>
            <p class="listing-card__specs">${escapeHtml(listing.specs)} · from ${formatDate(listing.availableFrom)}</p>
            ${extras ? '<p class="rl-card-meta">' + extras + '</p>' : ''}
          </div>
        </a>
        <button type="button" class="listing-card__save${saved ? ' listing-card__save--saved' : ''}" data-save="${escapeHtml(listing.id)}" aria-label="Save listing">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button type="button" class="rl-compare-btn${compared ? ' is-on' : ''}" data-compare="${escapeHtml(listing.id)}">${compared ? 'Added' : 'Compare'}</button>
      </article>`;
  }

  function renderListings() {
    const grid = $('#listings-grid');
    const empty = $('#listings-empty');
    const countEl = $('#listings-count');
    const list = filterListings();
    const city = state.city ? (cityMeta(state.city) || {}).name : '';
    const type = state.type ? typeMeta(state.type).label : 'Flexible homes';
    const where = city || state.location || 'U.S. + Europe';
    if (countEl) countEl.textContent = list.length + ' ' + type + ' in ' + where;
    const rc = $('#trust-rent-count');
    const cc = $('#trust-city-count');
    if (rc) rc.textContent = (DATA.listings || []).length.toLocaleString();
    if (cc) cc.textContent = String((DATA.cities || []).length);
    if (!grid) return;
    grid.classList.toggle('listings__grid--list', state.view === 'list');
    grid.innerHTML = list.map(renderListing).join('');
    grid.hidden = list.length === 0;
    renderRoomsShowcase();
    if (empty) {
      empty.hidden = list.length > 0;
      empty.innerHTML = '<p>No homes match yet. Widen stay length, city, or All-in budget — or <a href="match.html">run Stay DNA</a>.</p>';
    }
    const suggest = $('#rl-suggest');
    if (suggest && list.length) {
      const alts = filterListings({ city: state.city, type: '', priceMax: state.priceMax }).slice(0, 3);
      if (alts.length && state.type) {
        suggest.hidden = false;
        suggest.innerHTML = '<h3>Also nearby</h3><p>Same city, other flexible types — because the right stay is not always the first label.</p><div class="listings__grid">' + alts.map(renderListing).join('') + '</div>';
      }
    }
    setupScrollAnimations();
    injectListingsSchema(list);
  }

  function setupScrollAnimations() {
    if (typeof IntersectionObserver === 'undefined') {
      $$('.animate-on-scroll').forEach((el) => el.classList.add('visible'));
      return;
    }
    const io = window._rlScrollIo || (window._rlScrollIo = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }); },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    ));
    $$('.animate-on-scroll').forEach((el) => { el.classList.remove('visible'); io.observe(el); });
  }

  function populateSearchFields() {
    const citySel = $('#city');
    if (citySel && !(citySel.options && citySel.options.length > 2)) {
      const groups = {};
      (DATA.cities || []).forEach((c) => {
        const g = c.group || c.countryName || 'Other';
        (groups[g] = groups[g] || []).push(c);
      });
      const order = ['United States', 'United Kingdom', 'Scotland', 'Ireland', 'France', 'Spain', 'Netherlands', 'Switzerland', 'Germany', 'Italy'];
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
      items.map((l) => '<span>' + escapeHtml(typeMeta(l.housingType).short) + ' · ' + money(allIn(l)) + '</span>').join('') +
      '<a class="btn btn--primary btn--sm" href="compare.html">Open</a>' +
      '<button type="button" class="btn btn--outline btn--sm" id="rl-compare-clear">Clear</button></div>';
    const clear = $('#rl-compare-clear');
    if (clear) clear.onclick = () => { write(STORE.compare, []); renderCompareTray(); };
  }

  function renderHome() {
    const rc = $('#trust-rent-count');
    const cc = $('#trust-city-count');
    if (rc) rc.textContent = (DATA.listings || []).length.toLocaleString();
    if (cc) cc.textContent = String((DATA.cities || []).length);
    const types = $('#rl-types');
    if (types) {
      types.innerHTML = (DATA.housingTypes || []).map((t) => {
        const n = (DATA.listings || []).filter((l) => l.housingType === t.id).length;
        return `<a class="rl-type-card" href="${t.href}"><span class="rl-type-card__kicker">${n} live</span><h3>${t.label}</h3><p>${t.blurb}</p><span class="rl-type-card__cta">Browse ${t.short}</span></a>`;
      }).join('');
    }
    const cities = $('#rl-cities');
    if (cities) {
      const featured = (DATA.cities || []).filter((c) => c.featured);
      const homeCities = featured.filter((c) => (c.country || 'US') === 'US').slice(0, 8)
        .concat(featured.filter((c) => (c.country || 'US') !== 'US'));
      cities.innerHTML = homeCities.map((c) => {
        const n = (DATA.listings || []).filter((l) => l.cityId === c.id).length;
        const badge = (c.country || 'US') === 'US' ? '#' + c.rank : c.group;
        return `<a class="rl-city-card" href="${cityHref(c)}"><span class="rl-city-card__rank">${badge}</span><h3>${c.name}</h3><p>${c.state} · ${n} flexible homes</p><span>Walk ${c.walk} · Transit ${c.transit}</span></a>`;
      }).join('');
    }
    const pulse = $('#rl-pulse');
    if (pulse) {
      const rooms = (DATA.listings || []).filter((l) => l.housingType === 'room');
      const breaks = (DATA.listings || []).filter((l) => l.housingType === 'lease-break');
      const avgRoom = Math.round(rooms.reduce((s, l) => s + allIn(l), 0) / Math.max(1, rooms.length));
      const avgBreak = Math.round(breaks.reduce((s, l) => s + (l.remainingMonths || 0), 0) / Math.max(1, breaks.length));
      pulse.innerHTML = `
        <article class="rl-stat"><span>Live inventory</span><strong>${(DATA.listings || []).length}</strong><em>across ${(DATA.cities || []).length} markets</em></article>
        <article class="rl-stat"><span>Typical room all-in</span><strong>${money(avgRoom)}</strong><em>median-style snapshot</em></article>
        <article class="rl-stat"><span>Lease Clock</span><strong>${avgBreak} mo</strong><em>average time left on takeovers</em></article>
        <article class="rl-stat"><span>Min stay rule</span><strong>30 days</strong><em>homes, not hotel nights</em></article>`;
    }
    const grid = $('#listings-grid');
    if (grid) {
      const featured = (DATA.listings || []).filter((l) => l.featured).slice(0, 6);
      const fallback = filterListings({ type: '', city: 'nyc' }).slice(0, 6);
      grid.innerHTML = (featured.length ? featured : fallback).map(renderListing).join('');
    }
    const countEl = $('#listings-count');
    if (countEl) countEl.textContent = 'Featured this week';
  }

  function renderCitiesPage() {
    const grid = $('#rl-city-directory');
    if (!grid) return;
    const groups = {};
    (DATA.cities || []).forEach((c) => {
      const g = c.group || c.countryName || 'Other';
      (groups[g] = groups[g] || []).push(c);
    });
    const order = ['United States', 'United Kingdom', 'Scotland', 'Ireland', 'France', 'Spain', 'Netherlands', 'Switzerland', 'Germany', 'Italy'];
    grid.innerHTML = order.filter((g) => groups[g]).map((g) => {
      const rows = groups[g].map((c) => {
        const n = (DATA.listings || []).filter((l) => l.cityId === c.id).length;
        const avg = Math.round((DATA.listings || []).filter((l) => l.cityId === c.id).reduce((s, l) => s + allIn(l), 0) / Math.max(1, n));
        const badge = (c.country || 'US') === 'US' ? (c.rank <= 30 ? '#' + c.rank : 'Launch') : c.country;
        return `<a class="rl-city-row" href="${cityHref(c)}">
          <span class="rl-city-row__rank">${badge}</span>
          <span><strong>${c.name}</strong><em>${c.state}${c.launch ? ' · original RentLeaks market' : ''}</em></span>
          <span>${n} homes</span>
          <span>${money(avg)} avg all-in</span>
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
        return `<a class="rl-stat" href="${typeHref(t.id)}?city=${city.id}"><span>${t.label}</span><strong>${subset.length}</strong><em>${subset.length ? money(avg) + ' all-in' : 'coming online'}</em></a>`;
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
            ${l.housingType === 'lease-break' ? `<section class="rl-block rl-callout"><h2>Takeover math</h2><p>Remaining term × this rent vs. a typical furnished ${escapeHtml(l.cityName)} home. Estimated avoid-cost: <strong>${money(takeoverSave)}</strong> over ${l.remainingMonths} months. Confirm assignment vs sublet with the host before you send money.</p></section>` : ''}
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
              <p class="listing-card__price">${money(allIn(l))}<span class="listing-card__period"> all-in /mo</span></p>
              <ul class="rl-fee-stack">
                <li><span>Base rent</span><strong>${money(l.price)}</strong></li>
                <li><span>Utilities</span><strong>${fees.utilities ? money(fees.utilities) : 'Included'}</strong></li>
                <li><span>Wifi</span><strong>${fees.wifi ? money(fees.wifi) : 'Included'}</strong></li>
                <li><span>Cleaning</span><strong>${fees.cleaning ? money(fees.cleaning) : extras && l.housingType !== 'coliving' ? '—' : 'Included'}</strong></li>
                <li><span>Broker fee</span><strong>${fees.broker ? money(fees.broker) + ' one-time' : 'None'}</strong></li>
                <li><span>Deposit</span><strong>${money(l.deposit)}</strong></li>
              </ul>
              <p class="rl-host">Host ${escapeHtml(l.host.name)} · replies in ~${l.host.responseHours}h · ${escapeHtml(l.host.type)}</p>
              <a class="btn btn--primary" href="${assetBase()}apply.html?id=${encodeURIComponent(l.id)}">Apply with passport</a>
              <button type="button" class="btn btn--outline" data-save="${escapeHtml(l.id)}">${saved ? 'Saved' : 'Save'}</button>
              <button type="button" class="btn btn--outline" data-compare="${escapeHtml(l.id)}">Compare</button>
              <a class="btn btn--outline" href="contact.html?listing=${encodeURIComponent(l.id)}">Message host</a>
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
        ${l ? '<aside class="rl-price-card"><p class="rl-kicker">Applying to</p><h2>' + escapeHtml(l.title) + '</h2><p>' + money(allIn(l)) + ' all-in · ' + escapeHtml(l.location) + '</p></aside>' : ''}
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
      ['All-in /mo', (l) => money(allIn(l))],
      ['Base rent', (l) => money(l.price)],
      ['City', (l) => l.location],
      ['Available', (l) => formatDate(l.availableFrom)],
      ['Min stay', (l) => l.minStayMonths + ' mo'],
      ['Lease left', (l) => l.remainingMonths ? l.remainingMonths + ' mo' : '—'],
      ['Furnished', (l) => l.furnishedLevel],
      ['Private bath', (l) => l.privateBath ? 'Yes' : 'No'],
      ['Workspace', (l) => l.workplaceReady ? 'Yes' : 'No'],
      ['Pets', (l) => l.pets],
      ['Broker fee', (l) => l.fees && l.fees.broker ? money(l.fees.broker) : 'None'],
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
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModals() {
    $$('.modal-overlay.is-open').forEach((ov) => {
      ov.classList.remove('is-open');
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
    const query = (q || '').toLowerCase();
    const rows = [];
    (DATA.housingTypes || []).forEach((t) => {
      if (!query || t.label.toLowerCase().includes(query)) rows.push({ href: t.href, label: t.label, hint: 'Stay type' });
    });
    (DATA.cities || []).forEach((c) => {
      if (!query || c.name.toLowerCase().includes(query) || c.state.toLowerCase().includes(query)) {
        rows.push({ href: cityHref(c), label: c.name + ', ' + c.state, hint: 'City' });
      }
    });
    filterListings({ location: q, type: '', city: '' }).slice(0, 6).forEach((l) => {
      rows.push({ href: listingHref(l), label: l.title, hint: money(allIn(l)) + ' · ' + l.cityName });
    });
    box.innerHTML = rows.slice(0, 12).map((r) => '<a href="' + r.href + '"><strong>' + escapeHtml(r.label) + '</strong><span>' + escapeHtml(r.hint) + '</span></a>').join('') || '<p>No jump targets</p>';
  }

  function bindChromeEvents() {
    const navToggle = $('.nav-toggle');
    const nav = $('.nav');
    if (navToggle && nav && !navToggle.dataset.bound) {
      navToggle.dataset.bound = '1';
      navToggle.addEventListener('click', () => {
        const expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
        nav.classList.toggle('nav--open');
        document.body.style.overflow = expanded ? '' : 'hidden';
      });
    }
    $$('.js-modal-trigger').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.preventDefault(); openModal(btn.dataset.modal); });
    });
    $$('.js-modal-close').forEach((btn) => { btn.onclick = closeModals; });
    $$('.js-cmd').forEach((btn) => { btn.onclick = openCmd; });
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
    injectChrome();
    populateSearchFields();
    applyUrlToState();
    if (page === 'home') renderHome();
    else if (page === 'browse' || page === 'rent') renderListings();
    else if (page === 'listing') {
      renderDetail();
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
    if ($('#listings-grid') && page !== 'home' && page !== 'listing' && page !== 'saved' && page !== 'match') {
      // city page already rendered
    }
    bindEvents();
    if (params().get('modal') === 'auth') openModal('auth');
    setupScrollAnimations();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
