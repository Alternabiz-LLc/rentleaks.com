/*
 * RentLeaks broker network pages — the live parts.
 *
 * - Live numbers (open or paused, referral %, answer window, markets covered)
 *   come from the app (/api/network), so the founder changes them in the desk.
 * - A three-step form (tenant brief, or partner application) that checks each
 *   step before moving on, then posts JSON and opens the private link the app
 *   returns: the tenant's search room, or the partner's signing page.
 * - "Email my portal link" for existing partners.
 *
 * Plain ES2017, no dependencies. Without JavaScript every step shows at once
 * and the page stays readable.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('ent-js', 'hb-js');
  var DATA = window.RENTLEAKS_DATA || {};
  var TIMEOUT = 15000;
  var WHO = document.body.getAttribute('data-who') || 'tenant';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function apiBase() {
    if (typeof window.RL_API_URL === 'string') return window.RL_API_URL.replace(/\/$/, '');
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3100';
    var meta = $('meta[name="rl-api"]');
    return meta && meta.content ? meta.content.replace(/\/$/, '') : 'https://app.rentleaks.com';
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
      return res.json().catch(function () { return {}; }).then(function (json) { return { status: res.status, json: json }; });
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /* ---------- live numbers ---------- */
  var open = true;
  function applyConfig(cfg) {
    if (!cfg) return;
    if (cfg.offerHours) {
      $$('[data-live-hours]').forEach(function (el) { el.textContent = cfg.offerHours + ' h'; });
      $$('[data-live-hours-text]').forEach(function (el) { el.textContent = 'Answer within ' + cfg.offerHours + ' hours'; });
    }
    if (cfg.offersPerSearch) $$('[data-live-offers]').forEach(function (el) { el.textContent = String(cfg.offersPerSearch); });
    if (cfg.referralPct) $$('[data-live-pct]').forEach(function (el) { el.textContent = cfg.referralPct + '%'; });
    var markets = $('[data-live-markets]');
    if (markets && cfg.markets && cfg.markets.length) {
      $('span', markets).textContent = cfg.markets.slice(0, 16).join(' · ');
      markets.hidden = false;
    }
    var status = $('[data-live-status]');
    if (status && cfg.partners > 0 && WHO === 'tenant') {
      status.innerHTML = '<b>' + esc(cfg.partners) + '</b> verified broker' + (cfg.partners === 1 ? '' : 's') + ' in the network right now.';
      status.hidden = false;
    }
    if (cfg.open === false) {
      open = false;
      showError(WHO === 'tenant' ? 'New searches are paused for a moment. Please check back soon.' : 'Applications are paused for a moment. Please check back soon.');
      if (form) form.classList.add('is-closed');
    }
  }
  try {
    var cached = sessionStorage.getItem('rl_net_cfg');
    if (cached) applyConfig(JSON.parse(cached));
  } catch (e) { /* storage may be blocked */ }
  request('GET', '/api/network').then(function (r) {
    if (r.status === 200 && r.json) {
      applyConfig(r.json);
      try { sessionStorage.setItem('rl_net_cfg', JSON.stringify(r.json)); } catch (e) { /* ignore */ }
    }
  }).catch(function () { /* the static text stays */ });

  /* ---------- cities ---------- */
  var list = $('#hb-cities');
  if (list && DATA.cities) {
    list.innerHTML = DATA.cities
      .filter(function (c) { return !c.country || c.country === 'US' || c.country === 'USA' || c.state; })
      .map(function (c) { return '<option value="' + esc(c.name + (c.state ? ', ' + c.state : '')) + '"></option>'; })
      .join('');
  }

  /* ---------- reveal on scroll ---------- */
  var reveal = $$('.animate-on-scroll');
  if (!('IntersectionObserver' in window) || reduce) {
    reveal.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
    reveal.forEach(function (el) { io.observe(el); });
  }

  /* ---------- the form ---------- */
  var form = $('#hb-form');
  if (!form) return;
  var steps = $$('.hb-step', form);
  var dots = $$('[data-dot]', form);
  var nav = $('.hb-nav', form);
  var backBtn = $('[data-back]', form);
  var nextBtn = $('[data-next]', form);
  var at = 0;
  var el = form.elements;

  function showError(msg, field) {
    var box = form && $('.ent-form__error', form);
    if (!box) return;
    box.textContent = msg || '';
    box.hidden = !msg;
    $$('[aria-invalid]', form).forEach(function (x) { x.removeAttribute('aria-invalid'); });
    if (field) {
      var target = form.elements[field];
      if (target && target.length && !target.tagName) target = target[0];
      if (target && target.setAttribute) {
        var stepOf = target.closest ? target.closest('.hb-step') : null;
        if (stepOf) go(Number(stepOf.getAttribute('data-step')), true);
        if (target.type !== 'checkbox' && target.type !== 'radio') target.setAttribute('aria-invalid', 'true');
        try { target.focus({ preventScroll: false }); } catch (e) { target.focus(); }
      }
    }
  }

  function go(i, silent) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, k) { s.classList.toggle('is-on', k === at); });
    dots.forEach(function (d, k) {
      d.classList.toggle('is-on', k === at);
      d.classList.toggle('is-done', k < at);
    });
    backBtn.hidden = at === 0;
    nav.classList.toggle('is-last', at === steps.length - 1);
    if (!silent) {
      showError('');
      var first = $('input:not([type=hidden]):not(.ent-hp), select, textarea', steps[at]);
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (first && first.type !== 'radio' && first.type !== 'checkbox') setTimeout(function () { first.focus({ preventScroll: true }); }, 250);
    }
  }
  go(0, true);
  backBtn.addEventListener('click', function () { go(at - 1); });
  nextBtn.addEventListener('click', function () {
    var bad = check(at);
    if (bad) { showError(bad[0], bad[1]); return; }
    go(at + 1);
  });
  // Enter in a text field moves forward instead of submitting early.
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && at < steps.length - 1) {
      e.preventDefault();
      nextBtn.click();
    }
  });

  function checked(name) { return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); }
  function radio(name) { var c = checked(name); return c[0] || ''; }
  function splitList(v) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  /* ----- tenant helpers ----- */
  function capHint() {
    var t = radio('feeCapType');
    var label = $('[data-cap-label]', form);
    var input = el.feeCapValue;
    if (!label || !input) return;
    var wrap = input.closest('.hb-fee');
    if (wrap) wrap.hidden = t === 'none';
    label.textContent = t === 'pct' ? 'Up to (% of a year’s rent)' : t === 'flat' ? 'Up to ($)' : 'Up to (months of rent)';
    input.placeholder = t === 'pct' ? '12' : t === 'flat' ? '2500' : '1';
    estimate();
  }
  function estimate() {
    var out = $('[data-estimate]', form);
    if (!out) return;
    var t = radio('feeCapType');
    var v = Number(String(el.feeCapValue.value || '').replace(/[\s$,%]/g, ''));
    var rent = Number(el.budgetMax.value || 0);
    var cents = t === 'flat' ? v : t === 'pct' ? rent * 12 * v / 100 : rent * v;
    out.textContent = t !== 'flat' && !rent ? 'Add your budget to see the $' : isFinite(cents) && cents > 0 ? '≈ $' + Math.round(cents).toLocaleString('en-US') + (t === 'flat' ? '' : ' at your top budget') : '≈ —';
  }
  function termHint() {
    var box = $('.hb-months', form);
    if (box) box.hidden = radio('term') !== 'mid';
  }
  if (WHO === 'tenant') {
    $$('input[name="feeCapType"]', form).forEach(function (r) { r.addEventListener('change', capHint); });
    $$('input[name="term"]', form).forEach(function (r) { r.addEventListener('change', termHint); });
    el.feeCapValue.addEventListener('input', estimate);
    el.budgetMax.addEventListener('input', estimate);
    el.moveIn.min = today;
    capHint();
    termHint();
    var qp = new URLSearchParams(location.search);
    if (qp.get('city')) el.city.value = qp.get('city').slice(0, 60);
  }

  /* ----- partner helpers ----- */
  var NEEDS_BROKER = { salesperson: true, associate_broker: true };
  function superHint() {
    var box = $('[data-super]', form);
    if (box) box.hidden = !NEEDS_BROKER[el.licenseType.value];
  }
  if (WHO === 'partner') {
    el.licenseType.addEventListener('change', superHint);
    el.licenseState.addEventListener('input', function () { el.licenseState.value = el.licenseState.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2); });
    el.licenseExpires.min = today;
    superHint();
    var mp = new URLSearchParams(location.search).get('market');
    if (mp && !el.markets.value) el.markets.value = mp.slice(0, 50);
  }

  /* ----- per-step checks (the server checks everything again) ----- */
  function check(i) {
    if (WHO === 'tenant') {
      if (i === 0) {
        var city = el.city.value.trim();
        if (city.length < 2) return ['Which city are you looking in?', 'city'];
        if (!/[,\s][A-Za-z]{2}$/.test(city)) return ['Add the state after the city, e.g. Brooklyn, NY.', 'city'];
        if (radio('term') === 'mid' && el.termMonths.value && (Number(el.termMonths.value) < 1 || Number(el.termMonths.value) > 11)) return ['Short term is 1 to 11 months.', 'termMonths'];
      }
      if (i === 1) {
        var max = Number(el.budgetMax.value);
        if (!max || max < 100) return ['Add your top monthly budget.', 'budgetMax'];
        if (el.budgetMin.value && Number(el.budgetMin.value) > max) return ['The lowest budget can’t be above the highest.', 'budgetMin'];
        if (el.moveIn.value && el.moveIn.value < today) return ['Pick a move-in date from today on.', 'moveIn'];
      }
      if (i === 2) {
        if (radio('feeCapType') !== 'none' && !/^\d+(\.\d{1,2})?$/.test(String(el.feeCapValue.value).replace(/[\s$,%]/g, ''))) return ['Set the most you’ll pay a broker — or choose “Open to proposals”.', 'feeCapValue'];
        if (el.name.value.trim().length < 2) return ['Add your name.', 'name'];
        if (!EMAIL.test(el.email.value.trim())) return ['Add an email so broker proposals can reach you.', 'email'];
        if (!el.consent.checked) return ['Please agree to share your brief with matched brokers.', 'consent'];
      }
    } else {
      if (i === 0) {
        if (el.name.value.trim().length < 3) return ['Add your name as it appears on your licence.', 'name'];
        if (!EMAIL.test(el.email.value.trim())) return ['Add your work email.', 'email'];
        if (!/^\+?[\d\s().-]{7,}$/.test(el.phone.value.trim())) return ['Add a phone number tenants can reach.', 'phone'];
        if (el.brokerage.value.trim().length < 2) return ['Add your brokerage.', 'brokerage'];
        if (el.site.value && !/^https?:\/\/\S+\.\S+$/.test(el.site.value.trim())) return ['The website should start with https://', 'site'];
      }
      if (i === 1) {
        if (!/^[A-Za-z0-9-]{5,30}$/.test(el.licenseNumber.value.trim())) return ['Add your licence number.', 'licenseNumber'];
        if (!/^[A-Z]{2}$/.test(el.licenseState.value.trim())) return ['Add the two-letter state that issued your licence.', 'licenseState'];
        if (el.licenseExpires.value && el.licenseExpires.value <= today) return ['That licence has expired — renew it first.', 'licenseExpires'];
        if (NEEDS_BROKER[el.licenseType.value]) {
          if (el.supervisorName.value.trim().length < 3) return ['Add your supervising broker’s name.', 'supervisorName'];
          if (!EMAIL.test(el.supervisorEmail.value.trim())) return ['Add your supervising broker’s email — they sign too.', 'supervisorEmail'];
          if (el.supervisorEmail.value.trim().toLowerCase() === el.email.value.trim().toLowerCase()) return ['Your supervising broker needs their own email.', 'supervisorEmail'];
        }
      }
      if (i === 2) {
        if (!splitList(el.markets.value).length) return ['Add at least one city or neighborhood you cover.', 'markets'];
        if (!checked('specialties').length) return ['Pick at least one specialty.', 'specialties'];
        if (!el.consent.checked) return ['Please confirm your licence is active.', 'consent'];
      }
    }
    return null;
  }

  var SOURCES = ['fb_page', 'fb_post', 'fb_ad', 'instagram', 'linkedin', 'google', 'email', 'web', 'referral'];
  var params = new URLSearchParams(location.search);
  function source() {
    var src = (params.get('src') || '').toLowerCase();
    if (SOURCES.indexOf(src) !== -1) return src;
    var us = (params.get('utm_source') || '').toLowerCase();
    if (/^(fb|facebook)$/.test(us)) return /paid|cpc|ads?/.test((params.get('utm_medium') || '').toLowerCase()) ? 'fb_ad' : 'fb_post';
    if (/^(ig|instagram)$/.test(us)) return 'instagram';
    if (/linkedin/.test(us)) return 'linkedin';
    if (/google/.test(us)) return 'google';
    if (/mail|newsletter/.test(us)) return 'email';
    return 'web';
  }

  function payload() {
    if (WHO === 'tenant') {
      return {
        city: el.city.value,
        neighborhoods: splitList(el.neighborhoods.value),
        homeType: radio('homeType'),
        buildingAge: el.buildingAge.value,
        bedrooms: el.bedrooms.value,
        term: radio('term'),
        termMonths: radio('term') === 'mid' ? el.termMonths.value : '',
        budgetMax: el.budgetMax.value,
        budgetMin: el.budgetMin.value,
        moveIn: el.moveIn.value,
        language: el.language.value,
        mustHaves: checked('mustHaves'),
        notes: el.notes.value,
        feeCapType: radio('feeCapType'),
        feeCapValue: radio('feeCapType') === 'none' ? '' : el.feeCapValue.value,
        name: el.name.value,
        email: el.email.value,
        phone: el.phone.value,
        consent: el.consent.checked,
        website: el.website.value,
        source: source(),
        campaign: (params.get('utm_campaign') || '').slice(0, 80),
        referrer: (document.referrer || '').slice(0, 300)
      };
    }
    return {
      name: el.name.value,
      email: el.email.value,
      phone: el.phone.value,
      brokerage: el.brokerage.value,
      site: el.site.value,
      licenseType: el.licenseType.value,
      licenseNumber: el.licenseNumber.value,
      licenseState: el.licenseState.value,
      licenseExpires: el.licenseExpires.value,
      supervisorName: NEEDS_BROKER[el.licenseType.value] ? el.supervisorName.value : '',
      supervisorEmail: NEEDS_BROKER[el.licenseType.value] ? el.supervisorEmail.value : '',
      markets: splitList(el.markets.value),
      specialties: checked('specialties'),
      languages: checked('languages'),
      capacity: el.capacity.value,
      bio: el.bio.value,
      consent: el.consent.checked,
      website: el.website.value,
      source: source()
    };
  }

  // Server field names that live under a different input on this page.
  var FIELD_ALIAS = { state: 'city' };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!open) return;
    for (var i = 0; i < steps.length; i++) {
      var bad = check(i);
      if (bad) { showError(bad[0], bad[1]); return; }
    }
    showError('');
    form.classList.add('is-busy');
    var btn = $('[data-submit]', form);
    var label = btn.innerHTML;
    btn.textContent = WHO === 'tenant' ? 'Finding brokers…' : 'Sending…';
    var path = WHO === 'tenant' ? '/api/network/search' : '/api/network/partners';
    request('POST', path, payload()).then(function (r) {
      form.classList.remove('is-busy');
      btn.innerHTML = label;
      if (r.status === 201 && r.json && r.json.ok) {
        var link = WHO === 'tenant' ? r.json.room : r.json.sign;
        form.hidden = true;
        var done = $('#hb-done');
        var a = done && $('[data-room]', done);
        if (done) { done.hidden = false; done.focus(); }
        try { if (window.fbq) window.fbq('track', WHO === 'tenant' ? 'Lead' : 'SubmitApplication', { content_category: 'broker-network' }); } catch (err) { /* optional */ }
        if (link && a) {
          a.href = link;
          a.hidden = false;
          var text = $('[data-done-text]', done);
          if (text) text.textContent = WHO === 'tenant'
            ? (r.json.duplicate ? 'You already started this search — opening your search room…' : 'Your brief is with matching brokers. Opening your private search room (we’ve emailed you the link too)…')
            : 'Opening your referral partner agreement — read it, then sign in a minute…';
          setTimeout(function () { location.assign(link); }, 1600);
        }
        return;
      }
      var er = (r.json && r.json.error) || {};
      showError(er.message || 'We could not send that. Try again in a moment.', FIELD_ALIAS[er.code] || er.code);
    }).catch(function () {
      form.classList.remove('is-busy');
      btn.innerHTML = label;
      showError('We could not reach our server. Check your connection and try again.');
    });
  });

  /* ---------- partner portal link ---------- */
  var portal = $('#hb-portal');
  if (portal) {
    portal.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = portal.elements.email.value.trim();
      var msg = $('.hb-portal__msg', portal);
      if (!EMAIL.test(email)) { portal.elements.email.setAttribute('aria-invalid', 'true'); portal.elements.email.focus(); return; }
      portal.elements.email.removeAttribute('aria-invalid');
      request('POST', '/api/network/portal-link', { email: email }).then(function () {
        msg.textContent = 'If that email belongs to a partner, a fresh link is on its way.';
        msg.hidden = false;
      }).catch(function () {
        msg.textContent = 'We could not reach our server — try again in a moment.';
        msg.hidden = false;
      });
    });
  }
})();
