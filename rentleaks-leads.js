/**
 * RentLeaks — Facebook landing page (facebook.html)
 * ---------------------------------------------------------------------------
 * Where the Facebook Page's "Book now" button, posts and ads send people.
 * Three things to do, one form each:
 *
 *   Find me a home   → a lead with city, budget and dates      (kind: match)
 *   Book a viewing   → up to three slots for one real listing  (kind: viewing)
 *   Request to book  → move-in and move-out for one listing    (kind: stay)
 *
 * Requests go to the app's /api/leads. If the app can't be reached, nothing is
 * lost: the visitor is handed to Messenger with the request copied, so it lands
 * in the Page inbox instead. No payment is ever taken here.
 *
 * Only live, non-sample listings (from /api/leads/listings) can be viewed or
 * booked. The sample catalogue is never offered as bookable.
 *
 * Fair housing: the forms ask about the home, never about the people.
 */
(function () {
  'use strict';

  var MESSENGER_URL = 'https://m.me/rentleaks.official';
  var PAGE_URL = 'https://www.facebook.com/rentleaks.official';
  var TIMEOUT = 8000;
  var DATA = window.RENTLEAKS_DATA || {};

  var root = document.getElementById('fb-landing');
  if (!root) return;

  /* ---------- small helpers ---------------------------------------------- */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function money(n, cur) {
    if (DATA.fmt) return DATA.fmt(n, cur);
    return (cur || 'USD') + ' ' + Math.round(n).toLocaleString('en-US');
  }

  function apiBase() {
    if (typeof window.RL_API_URL === 'string') return window.RL_API_URL.replace(/\/$/, '');
    var meta = document.querySelector('meta[name="rl-api"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, '');
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3100';
    return 'https://app.rentleaks.com';
  }
  var API = apiBase();

  function request(method, path, body) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
    return fetch(API + path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
      credentials: 'omit'
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return {}; }).then(function (json) {
        return { status: res.status, json: json };
      });
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /* Where the visitor came from: ?src= wins, then UTM, then the referrer. */
  var params = new URLSearchParams(location.search);
  var SOURCES = ['fb_page', 'fb_button', 'fb_post', 'fb_ad', 'messenger', 'instagram', 'web'];
  function detectSource() {
    var src = (params.get('src') || '').toLowerCase();
    if (SOURCES.indexOf(src) !== -1) return src;
    var us = (params.get('utm_source') || '').toLowerCase();
    var um = (params.get('utm_medium') || '').toLowerCase();
    if (/^(fb|facebook)$/.test(us)) return /paid|cpc|ads?/.test(um) ? 'fb_ad' : 'fb_post';
    if (/^(ig|instagram)$/.test(us)) return 'instagram';
    if (/messenger/.test(us)) return 'messenger';
    if (/facebook\.com|fb\.com|l\.facebook/.test(document.referrer || '')) return 'fb_page';
    if (/instagram\.com/.test(document.referrer || '')) return 'instagram';
    return 'web';
  }
  var SOURCE = detectSource();
  var CAMPAIGN = (params.get('utm_campaign') || '').slice(0, 80);

  /* ---------- the same summary the server writes ------------------------- */

  var KIND_LABEL = { match: 'Find me a home', viewing: 'Viewing request', stay: 'Request to book' };
  var WINDOW_LABEL = { morning: 'Morning (9–12)', afternoon: 'Afternoon (12–5)', evening: 'Evening (5–8)' };

  function summary(lead, home) {
    var lines = [KIND_LABEL[lead.kind] + ' — ' + lead.name];
    if (home) lines.push('Home: ' + home.title + (home.url ? ' (' + home.url + ')' : ''));
    if (lead.cityId) lines.push('City: ' + lead.cityId);
    if (lead.housingType) lines.push('Type: ' + lead.housingType);
    if (lead.budgetMax) lines.push('Budget: up to ' + Number(lead.budgetMax).toLocaleString('en-US') + ' ' + (lead.currency || 'USD') + '/month');
    if (lead.moveIn) lines.push('Move-in: ' + lead.moveIn + (lead.moveOut ? ' · Move-out: ' + lead.moveOut : ''));
    if (lead.stayMonths) lines.push('Stay: ' + lead.stayMonths + ' month' + (Number(lead.stayMonths) === 1 ? '' : 's'));
    if (lead.viewingSlots && lead.viewingSlots.length) {
      lines.push('Viewing (' + (lead.viewingMode === 'video' ? 'video call' : 'in person') + '): ' +
        lead.viewingSlots.map(function (s) { return s.date + ' ' + WINDOW_LABEL[s.window]; }).join('; '));
    }
    if (lead.message) lines.push('Note: ' + lead.message);
    return lines.join('\n');
  }

  function messengerLink(text, ref) {
    var qs = new URLSearchParams();
    if (ref) qs.set('ref', ref);
    if (text) qs.set('text', text.slice(0, 600));
    var q = qs.toString();
    return MESSENGER_URL + (q ? '?' + q : '');
  }

  function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    } catch (e) { /* fall through */ }
    return Promise.reject(new Error('no clipboard'));
  }

  function track(kind) {
    try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_category: kind }); } catch (e) { /* optional */ }
    try { if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { lead_kind: kind, source: SOURCE }); } catch (e) { /* optional */ }
  }

  /* ---------- markup ----------------------------------------------------- */

  var cities = (DATA.cities || []).slice().sort(function (a, b) { return (a.rank || 99) - (b.rank || 99); });
  var types = (DATA.housingTypes || []).filter(function (t) { return t.id !== 'aparthotel'; });

  function cityOptions(selected) {
    var groups = {};
    var order = [];
    cities.forEach(function (c) {
      var g = c.country === 'US' ? 'United States' : c.country === 'CA' ? 'Canada' : 'Europe';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(c);
    });
    return '<option value="">Any city</option>' + order.map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function typeOptions() {
    return '<option value="">Any type</option>' + types.map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>';
    }).join('');
  }

  function contactFields(id) {
    return '' +
      '<div class="form__row">' +
        '<div class="form-group"><label for="' + id + '-name">Your name</label>' +
          '<input id="' + id + '-name" name="name" class="form-input" autocomplete="name" required minlength="2" maxlength="80"></div>' +
        '<div class="form-group"><label for="' + id + '-email">Email</label>' +
          '<input id="' + id + '-email" name="email" type="email" class="form-input" autocomplete="email" required maxlength="160"></div>' +
      '</div>' +
      '<div class="form-group"><label for="' + id + '-phone">Phone <span class="fbl-opt">optional — for a faster reply by call or text</span></label>' +
        '<input id="' + id + '-phone" name="phone" type="tel" class="form-input" autocomplete="tel" maxlength="32"></div>' +
      '<div class="form-group"><label for="' + id + '-message">Anything we should know? <span class="fbl-opt">optional</span></label>' +
        '<textarea id="' + id + '-message" name="message" class="form-input" rows="3" maxlength="1000" placeholder="Must-haves, questions about the home, the best time to reach you…"></textarea></div>' +
      /* Honeypot: hidden from people and from assistive technology. */
      '<div class="fbl-hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="fbl-consent"><input type="checkbox" name="consent" required> ' +
        '<span>RentLeaks' + (id === 'match' ? '' : ' and the host of this home') + ' may contact me by email' +
        ', phone or text about this request. No marketing lists; see our <a href="privacy.html">privacy policy</a>.</span></label>' +
      '<p class="fbl-err" role="alert" hidden></p>';
  }

  var TODAY = today();
  var stayOptions = '<option value="">Not sure yet</option>' +
    [1, 2, 3, 4, 6, 9, 12].map(function (m) { return '<option value="' + m + '">' + m + ' month' + (m === 1 ? '' : 's') + (m === 12 ? '+' : '') + '</option>'; }).join('');

  function slotRow(i) {
    return '<div class="fbl-slot">' +
      '<div class="form-group"><label for="slot-date-' + i + '">' + (i === 0 ? 'First choice' : i === 1 ? 'Second choice' : 'Third choice') + (i ? ' <span class="fbl-opt">optional</span>' : '') + '</label>' +
        '<input id="slot-date-' + i + '" type="date" name="slot-date-' + i + '" class="form-input" min="' + TODAY + '" max="' + addDays(TODAY, 60) + '"' + (i === 0 ? ' required' : '') + '></div>' +
      '<div class="form-group"><label for="slot-window-' + i + '">Time</label>' +
        '<select id="slot-window-' + i + '" name="slot-window-' + i + '" class="form-input"' + (i === 0 ? ' required' : '') + '>' +
          '<option value="">Choose…</option>' +
          '<option value="morning">Morning (9–12)</option>' +
          '<option value="afternoon">Afternoon (12–5)</option>' +
          '<option value="evening">Evening (5–8)</option>' +
        '</select></div>' +
    '</div>';
  }

  var initialTab = ({ viewing: 'viewing', stay: 'stay', book: 'stay', match: 'match' })[params.get('tab') || ''] || (params.get('listing') ? 'viewing' : 'match');

  root.innerHTML = '' +
    '<div class="fbl-tabs" role="tablist" aria-label="What would you like to do?">' +
      tabButton('match', 'Find me a home', 'Tell us what you need') +
      tabButton('viewing', 'Book a viewing', 'In person or video') +
      tabButton('stay', 'Request to book', 'Send your dates') +
    '</div>' +

    '<section class="fbl-panel" id="panel-match" role="tabpanel" aria-labelledby="tab-match">' +
      '<form class="form form-card" data-kind="match" novalidate>' +
        '<div class="form__row">' +
          '<div class="form-group"><label for="match-city">City</label><select id="match-city" name="cityId" class="form-input">' + cityOptions(params.get('city') || '') + '</select></div>' +
          '<div class="form-group"><label for="match-type">Type of home</label><select id="match-type" name="housingType" class="form-input">' + typeOptions() + '</select></div>' +
        '</div>' +
        '<div class="form__row">' +
          '<div class="form-group"><label for="match-budget">Monthly budget, all-in <span class="fbl-opt" data-currency-label>USD</span></label>' +
            '<input id="match-budget" name="budgetMax" type="number" inputmode="numeric" min="0" max="1000000" step="50" class="form-input" placeholder="e.g. 2000"></div>' +
          '<div class="form-group"><label for="match-movein">Move-in from</label>' +
            '<input id="match-movein" name="moveIn" type="date" min="' + TODAY + '" class="form-input"></div>' +
          '<div class="form-group"><label for="match-stay">How long?</label><select id="match-stay" name="stayMonths" class="form-input">' + stayOptions + '</select></div>' +
        '</div>' +
        contactFields('match') +
        '<button type="submit" class="btn btn--primary btn--lg">Send my request</button>' +
      '</form>' +
    '</section>' +

    '<section class="fbl-panel" id="panel-viewing" role="tabpanel" aria-labelledby="tab-viewing" hidden>' +
      '<div class="fbl-homes" data-for="viewing"></div>' +
      '<form class="form form-card" data-kind="viewing" novalidate hidden>' +
        '<div class="fbl-chosen" aria-live="polite"></div>' +
        '<fieldset class="fbl-fieldset"><legend>When can you view it?</legend>' +
          '<p class="fbl-hint">Give up to three options. The host confirms one by email or phone.</p>' +
          slotRow(0) + slotRow(1) + slotRow(2) +
        '</fieldset>' +
        '<fieldset class="fbl-fieldset fbl-mode"><legend>How?</legend>' +
          '<label><input type="radio" name="viewingMode" value="in-person" checked> In person</label>' +
          '<label><input type="radio" name="viewingMode" value="video"> Live video call</label>' +
        '</fieldset>' +
        '<div class="form-group"><label for="viewing-movein">Hoping to move in <span class="fbl-opt">optional</span></label>' +
          '<input id="viewing-movein" name="moveIn" type="date" min="' + TODAY + '" class="form-input"></div>' +
        contactFields('viewing') +
        '<button type="submit" class="btn btn--primary btn--lg">Request this viewing</button>' +
      '</form>' +
    '</section>' +

    '<section class="fbl-panel" id="panel-stay" role="tabpanel" aria-labelledby="tab-stay" hidden>' +
      '<div class="fbl-homes" data-for="stay"></div>' +
      '<form class="form form-card" data-kind="stay" novalidate hidden>' +
        '<div class="fbl-chosen" aria-live="polite"></div>' +
        '<div class="form__row">' +
          '<div class="form-group"><label for="stay-movein">Move-in</label>' +
            '<input id="stay-movein" name="moveIn" type="date" min="' + TODAY + '" class="form-input" required></div>' +
          '<div class="form-group"><label for="stay-moveout">Move-out</label>' +
            '<input id="stay-moveout" name="moveOut" type="date" min="' + addDays(TODAY, 1) + '" class="form-input" required></div>' +
        '</div>' +
        '<p class="fbl-hint">This is a request, not a payment. The host accepts or declines, and you only sign and pay after you have seen the home.</p>' +
        contactFields('stay') +
        '<button type="submit" class="btn btn--primary btn--lg">Send booking request</button>' +
      '</form>' +
    '</section>' +

    '<section class="fbl-done" hidden tabindex="-1" aria-live="polite"></section>';

  function tabButton(kind, label, sub) {
    var on = kind === initialTab;
    return '<button type="button" role="tab" id="tab-' + kind + '" aria-controls="panel-' + kind + '" aria-selected="' + on + '"' +
      (on ? '' : ' tabindex="-1"') + ' class="fbl-tab" data-tab="' + kind + '"><b>' + esc(label) + '</b><span>' + esc(sub) + '</span></button>';
  }

  /* ---------- tabs ------------------------------------------------------- */

  var tabs = $$('.fbl-tab', root);
  function showTab(kind, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === kind;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.fbl-panel', root).forEach(function (p) { p.hidden = p.id !== 'panel-' + kind; });
    $('.fbl-done', root).hidden = true;
    if (kind !== 'match') loadHomes();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function (e) {
      var next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
      if (next === null) return;
      e.preventDefault();
      var t2 = tabs[(next + tabs.length) % tabs.length];
      showTab(t2.getAttribute('data-tab'), true);
    });
  });
  root.addEventListener('click', function (e) {
    var go = e.target.closest && e.target.closest('[data-go-tab]');
    if (go) { e.preventDefault(); showTab(go.getAttribute('data-go-tab'), true); }
  });

  /* Budget currency follows the city. */
  var citySel = $('#match-city', root);
  function syncCurrency() {
    var c = cities.filter(function (x) { return x.id === citySel.value; })[0];
    var cur = (c && c.currency) || 'USD';
    $('[data-currency-label]', root).textContent = cur;
    citySel.form.setAttribute('data-budget-currency', cur);
  }
  citySel.addEventListener('change', syncCurrency);
  syncCurrency();

  /* ---------- bookable homes -------------------------------------------- */

  var homes = null;       // null = not loaded, [] = none
  var homesError = false;
  var chosen = null;
  var loading = null;

  function loadHomes() {
    if (homes || loading) return loading;
    renderHomes('loading');
    var qs = params.get('city') ? '?city=' + encodeURIComponent(params.get('city')) : '';
    loading = request('GET', '/api/leads/listings' + qs).then(function (r) {
      homes = r.status === 200 && r.json && Array.isArray(r.json.items) ? r.json.items : [];
      homesError = r.status !== 200;
    }, function () {
      homes = [];
      homesError = true;
    }).then(function () {
      loading = null;
      var wanted = params.get('listing');
      var pre = wanted && homes.filter(function (h) { return h.id === wanted; })[0];
      if (pre) choose(pre); else renderHomes();
    });
    return loading;
  }

  function renderHomes(state) {
    $$('.fbl-homes', root).forEach(function (box) {
      var kind = box.getAttribute('data-for');
      var form = $('form[data-kind="' + kind + '"]', root);
      if (state === 'loading') {
        box.innerHTML = '<div class="fbl-skel" aria-busy="true"><span></span><span></span><span></span></div>';
        form.hidden = true;
        return;
      }
      if (chosen) {
        box.innerHTML = '';
        form.hidden = false;
        $('.fbl-chosen', form).innerHTML = chosenCard(chosen);
        return;
      }
      form.hidden = true;
      if (!homes.length) {
        box.innerHTML = '<div class="fbl-empty">' +
          '<h2>' + (homesError ? 'We can’t load homes right now' : 'Homes open for viewings will appear here') + '</h2>' +
          '<p>' + (homesError
            ? 'Tell us what you need, or message us, and we’ll send you homes you can view this week.'
            : 'We only list homes you can actually see and book. Tell us what you need and we’ll match you as hosts publish them.') + '</p>' +
          '<p class="fbl-actions"><a href="#" class="btn btn--primary" data-go-tab="match">Tell us what you need</a> ' +
          '<a class="btn btn--outline" href="' + esc(messengerLink('', 'fb_landing_' + kind)) + '" target="_blank" rel="noopener">Message us</a></p>' +
        '</div>';
        return;
      }
      box.innerHTML = '<p class="fbl-hint">Choose a home' + (kind === 'viewing' ? ' to view' : ' to request') + '.</p>' +
        '<ul class="fbl-grid">' + homes.map(function (h) {
          return '<li><button type="button" class="fbl-home" data-home="' + esc(h.id) + '">' +
            (h.image ? '<img src="' + esc(h.image) + '" alt="" loading="lazy">' : '<span class="fbl-home__ph" aria-hidden="true"></span>') +
            '<span class="fbl-home__body">' +
              (h.sponsored ? '<span class="x-sponsor-tag">Sponsored</span>' : '') +
              '<b>' + esc(h.title) + '</b>' +
              '<span>' + esc([h.typeLabel, h.neighborhood, h.cityName].filter(Boolean).join(' · ')) + '</span>' +
              '<span class="fbl-home__price">' + esc(money(h.allIn, h.currency)) + ' <small>all-in /mo</small></span>' +
              '<span class="fbl-home__meta">From ' + esc(h.availableFrom || 'now') + ' · ' + esc(h.minStayMonths) + '+ month' + (h.minStayMonths === 1 ? '' : 's') + '</span>' +
            '</span></button></li>';
        }).join('') + '</ul>';
    });
  }

  function chosenCard(h) {
    return '<div class="fbl-picked">' +
      (h.image ? '<img src="' + esc(h.image) + '" alt="">' : '<span class="fbl-picked__ph" aria-hidden="true"></span>') +
      '<div><span class="fbl-opt">Your home</span><b>' + esc(h.title) + '</b>' +
      '<span>' + esc([h.cityName, money(h.allIn, h.currency) + ' all-in /mo', h.minStayMonths + '+ months'].join(' · ')) + '</span>' +
      '<span class="fbl-picked__links"><a href="' + esc(h.url) + '" target="_blank" rel="noopener">See the full listing</a> · ' +
      '<button type="button" class="fbl-link" data-change>Choose another</button></span></div></div>';
  }

  function choose(h) {
    chosen = h;
    renderHomes();
    var stayIn = $('#stay-movein', root);
    if (h.availableFrom && h.availableFrom > TODAY) stayIn.min = h.availableFrom;
    var form = $('.fbl-panel:not([hidden]) form', root);
    if (form) {
      var first = $('input[type="date"], input[name="name"]', form);
      if (first) first.focus();
    }
  }

  root.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('[data-home]');
    if (card) {
      var id = card.getAttribute('data-home');
      choose(homes.filter(function (h) { return h.id === id; })[0]);
      return;
    }
    if (e.target.closest && e.target.closest('[data-change]')) {
      chosen = null;
      renderHomes();
      var grid = $('.fbl-panel:not([hidden]) .fbl-home', root);
      if (grid) grid.focus();
    }
  });

  /* ---------- submit ----------------------------------------------------- */

  function collect(form) {
    var kind = form.getAttribute('data-kind');
    var f = form.elements;
    var val = function (name) { return f[name] ? String(f[name].value || '').trim() : ''; };
    var lead = {
      kind: kind,
      name: val('name'),
      email: val('email'),
      phone: val('phone'),
      message: val('message'),
      website: val('website'),
      consent: !!(f.consent && f.consent.checked),
      source: SOURCE,
      campaign: CAMPAIGN,
      referrer: (document.referrer || '').slice(0, 200)
    };
    if (kind === 'match') {
      lead.cityId = val('cityId');
      lead.housingType = val('housingType');
      lead.budgetMax = val('budgetMax');
      lead.currency = form.getAttribute('data-budget-currency') || 'USD';
      lead.moveIn = val('moveIn');
      lead.stayMonths = val('stayMonths');
    } else {
      lead.listingId = chosen ? chosen.id : '';
      lead.moveIn = val('moveIn');
    }
    if (kind === 'stay') lead.moveOut = val('moveOut');
    if (kind === 'viewing') {
      lead.viewingSlots = [0, 1, 2].map(function (i) {
        return { date: val('slot-date-' + i), window: val('slot-window-' + i) };
      }).filter(function (s) { return s.date || s.window; });
      var mode = $('input[name="viewingMode"]:checked', form);
      lead.viewingMode = mode ? mode.value : 'in-person';
    }
    return lead;
  }

  /* Checks worth doing before a round trip. The server repeats all of them. */
  var FIELD_FOR = { viewingSlots: 'slot-date-0', listingId: null };
  function precheck(lead) {
    if (lead.kind !== 'match' && !lead.listingId) return ['listingId', 'Choose a home first.'];
    if (lead.kind === 'viewing' && !lead.viewingSlots.some(function (s) { return s.date && s.window; })) return ['viewingSlots', 'Pick at least one date and time for the viewing.'];
    if (lead.kind === 'viewing' && lead.viewingSlots.some(function (s) { return !s.date || !s.window; })) return ['viewingSlots', 'Pick both a date and a time for each choice.'];
    if (lead.kind === 'stay' && !lead.moveIn) return ['moveIn', 'Add a move-in date.'];
    if (lead.kind === 'stay' && !lead.moveOut) return ['moveOut', 'Add a move-out date.'];
    if (lead.moveIn && lead.moveOut && lead.moveOut <= lead.moveIn) return ['moveOut', 'Move-out must be after move-in.'];
    if (lead.name.length < 2) return ['name', 'Add your name.'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return ['email', 'Add an email address we can reply to.'];
    if (!lead.consent) return ['consent', 'Tick the box so we are allowed to contact you about this request.'];
    return null;
  }

  function showError(form, field, message) {
    var box = $('.fbl-err', form);
    box.textContent = message;
    box.hidden = false;
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var name = field in FIELD_FOR ? FIELD_FOR[field] : field;
    var el = name && form.elements[name];
    if (el && el.focus) {
      el.setAttribute('aria-invalid', 'true');
      el.focus();
    } else {
      box.setAttribute('tabindex', '-1');
      box.focus();
    }
  }

  $$('form[data-kind]', root).forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lead = collect(form);
      var problem = precheck(lead);
      if (problem) { showError(form, problem[0], problem[1]); return; }
      $('.fbl-err', form).hidden = true;
      var btn = $('button[type="submit"]', form);
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';

      var home = lead.kind === 'match' ? null : { title: chosen.title, url: chosen.url };
      var text = summary(lead, home);

      request('POST', '/api/leads', lead).then(function (r) {
        if (r.status === 201) {
          track(lead.kind);
          done(true, lead, r.json.messenger || messengerLink(text, 'lead_' + r.json.id), text);
          return;
        }
        var err = (r.json && r.json.error) || {};
        if (r.status === 400 || r.status === 404 || r.status === 409 || r.status === 429) {
          if (err.code === 'listingId') { chosen = null; homes = null; loadHomes(); }
          showError(form, err.code, err.message || 'Check the form and try again.');
          return;
        }
        done(false, lead, messengerLink(text, 'fb_landing_offline'), text);
      }, function () {
        done(false, lead, messengerLink(text, 'fb_landing_offline'), text);
      }).then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  });

  function done(sent, lead, messenger, text) {
    var box = $('.fbl-done', root);
    $$('.fbl-panel', root).forEach(function (p) { p.hidden = true; });
    box.innerHTML = sent
      ? '<h2>Request sent</h2>' +
        '<p>Thanks, ' + esc(lead.name.split(' ')[0]) + '. We emailed a copy to <b>' + esc(lead.email) + '</b> and ' +
        (lead.kind === 'match' ? 'we’ll reply' : 'you’ll hear back') + ' within one business day.</p>' +
        '<pre class="fbl-summary">' + esc(text) + '</pre>' +
        '<p class="fbl-actions"><a class="btn btn--primary" data-messenger href="' + esc(messenger) + '" target="_blank" rel="noopener">Continue on Messenger</a> ' +
        '<a class="btn btn--outline" href="rent.html">Browse homes</a></p>' +
        '<p class="fbl-hint">Prefer to chat? Messenger opens with your request copied, so you can paste it if it isn’t filled in.</p>'
      : '<h2>Send it on Messenger instead</h2>' +
        '<p>We couldn’t send your request online just now. Nothing is lost: tap below, and Messenger opens with your request copied — paste it if it isn’t filled in.</p>' +
        '<pre class="fbl-summary">' + esc(text) + '</pre>' +
        '<p class="fbl-actions"><a class="btn btn--primary" data-messenger href="' + esc(messenger) + '" target="_blank" rel="noopener">Send on Messenger</a> ' +
        '<a class="btn btn--outline" href="mailto:hello@rentleaks.com?subject=' + encodeURIComponent(KIND_LABEL[lead.kind]) + '&body=' + encodeURIComponent(text) + '">Email it instead</a></p>';
    box.innerHTML += '<p class="fbl-safety"><b>Stay safe:</b> never pay rent or a deposit before you have seen the home and signed a lease. RentLeaks never takes payment and never asks for wire transfers, gift cards or crypto.</p>';
    box.hidden = false;
    box.focus();
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  root.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-messenger]');
    if (!a) return;
    var pre = $('.fbl-summary', root);
    if (pre) copy(pre.textContent).then(function () {
      var note = document.createElement('p');
      note.className = 'fbl-hint';
      note.setAttribute('role', 'status');
      note.textContent = 'Copied your request.';
      a.parentNode.appendChild(note);
      setTimeout(function () { note.remove(); }, 4000);
    }, function () { /* no clipboard: the text is on screen */ });
  });

  /* Header Messenger and Page links. */
  $$('[data-fb-messenger]').forEach(function (a) { a.href = messengerLink('', 'fb_landing_header'); });
  $$('[data-fb-page]').forEach(function (a) { a.href = PAGE_URL; });

  showTab(initialTab);
})();
