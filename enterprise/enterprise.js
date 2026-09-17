/*
 * RentLeaks Enterprise pages — the live parts.
 *
 * - Licence strip, "from" prices and the form's open state come from the app
 *   (/api/enterprise), so the founder changes them in the desk, not here.
 * - Package tabs, "Choose" buttons that fill the form, count-up stats.
 * - The request form posts JSON to /api/enterprise. Nothing here asks about the
 *   people who will live in the property, and nothing is charged.
 *
 * Plain ES2017, no dependencies. Works without the app: the page stays fully
 * readable and the form explains how else to reach us.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('ent-js');
  var DATA = window.RENTLEAKS_DATA || {};
  var TIMEOUT = 12000;

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

  /* ---------- live config: licence, prices, form ---------- */
  var formOpen = true;
  function applyConfig(cfg) {
    if (!cfg) return;
    var text = $('[data-licence]');
    if (cfg.broker && text) {
      var b = cfg.broker;
      var bits = ['<b>' + esc(b.name) + '</b>, licensed real estate broker', 'Licence ' + esc(b.licence) + ' (' + esc(b.states) + ')'];
      if (b.address) bits.push(esc(b.address));
      if (b.phone) bits.push('<a href="tel:' + esc(String(b.phone).replace(/[^\d+]/g, '')) + '">' + esc(b.phone) + '</a>');
      if (b.email) bits.push('<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
      text.innerHTML = bits.join(' · ');
      var ny = $('[data-ny-notice]');
      if (ny && b.nyNotice) { ny.href = b.nyNotice; ny.hidden = false; }
    }
    var prices = cfg.prices || {};
    $$('[data-price]').forEach(function (el) {
      var v = prices[el.getAttribute('data-price')];
      if (v) { el.textContent = v; el.parentNode.classList.add('has-price'); }
    });
    if (cfg.formOpen === false) {
      formOpen = false;
      var form = $('#ent-form');
      if (form) {
        form.classList.add('is-closed');
        showError('Online requests are paused for a moment. Email or message us and we will reply within a business day.');
      }
    }
  }
  try {
    var cached = sessionStorage.getItem('rl_ent_cfg');
    if (cached) applyConfig(JSON.parse(cached));
  } catch (e) { /* storage may be blocked */ }
  request('GET', '/api/enterprise').then(function (r) {
    if (r.status === 200 && r.json) {
      applyConfig(r.json);
      try { sessionStorage.setItem('rl_ent_cfg', JSON.stringify(r.json)); } catch (e) { /* ignore */ }
    }
  }).catch(function () { /* the static text stays */ });

  /* ---------- package tabs ---------- */
  var tabs = $$('.ent-tab');
  function showTab(id, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === id;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.ent-packs').forEach(function (p) {
      var on = p.id === 'pk-' + id;
      if (on) {
        p.removeAttribute('data-hidden');
        p.classList.remove('is-entering');
        void p.offsetWidth;
        p.classList.add('is-entering');
      } else {
        p.setAttribute('data-hidden', '');
      }
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      showTab(next.getAttribute('data-tab'), true);
    });
  });
  var hashTab = (location.hash || '').replace('#pk-', '');
  if (hashTab && $('#tab-' + hashTab)) showTab(hashTab);

  /* ---------- choose a package → fill the form ---------- */
  var form = $('#ent-form');
  function choose(packId) {
    if (!form) return;
    var sel = form.elements.packageId;
    if (sel) sel.value = packId;
    syncServices(packId);
    var q = $('#quote');
    if (q) q.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { if (form.elements.name) form.elements.name.focus({ preventScroll: true }); }, 450);
  }
  var PACK_SERVICES = {};
  $$('[data-pack]').forEach(function (card) { PACK_SERVICES[card.getAttribute('data-pack')] = card.getAttribute('data-track'); });
  function syncServices(packId) {
    if (!form || !packId) return;
    var track = PACK_SERVICES[packId];
    var map = {
      marketing: ['media', 'syndication'],
      brokerage: ['brokerage'],
      management: ['management'],
      owners: ['remote']
    };
    (map[track] || []).forEach(function (id) {
      var box = form.querySelector('input[name="services"][value="' + id + '"]');
      if (box) box.checked = true;
    });
    if (track === 'owners' && form.elements.outOfState) form.elements.outOfState.checked = true;
  }
  $$('[data-choose]').forEach(function (btn) {
    btn.addEventListener('click', function () { choose(btn.getAttribute('data-choose')); });
  });
  if (form && form.elements.packageId) {
    form.elements.packageId.addEventListener('change', function () { syncServices(form.elements.packageId.value); });
  }

  /* ---------- cities for the market field ---------- */
  var list = $('#ent-cities');
  if (list && DATA.cities) {
    list.innerHTML = DATA.cities.map(function (c) {
      return '<option value="' + esc(c.name + (c.state ? ', ' + c.state : '')) + '"></option>';
    }).join('');
  }

  /* ---------- count-up stats ---------- */
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(el) {
    var raw = el.getAttribute('data-count') || '';
    var m = /^(\d+)(.*)$/.exec(raw);
    if (!m || reduce) return;
    var end = Number(m[1]);
    var rest = m[2];
    var start = performance.now();
    var dur = 900;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased) + rest;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  $$('[data-count]').forEach(countUp);

  /* Reveal on scroll (script.js only wires this on listing pages). The
     statement bar fills when its card comes in. */
  var reveal = $$('.animate-on-scroll');
  if (!('IntersectionObserver' in window) || reduce) {
    reveal.forEach(function (el) { el.classList.add('is-visible'); });
    $$('.ent-statement__bar').forEach(function (b) { b.classList.add('is-static'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
    reveal.forEach(function (el) { io.observe(el); });
  }

  /* ---------- the request ---------- */
  var SOURCES = ['fb_page', 'fb_button', 'fb_post', 'fb_ad', 'messenger', 'instagram', 'linkedin', 'google', 'email', 'web'];
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
    if (/linkedin\.com/.test(document.referrer || '')) return 'linkedin';
    if (/facebook\.com|fb\.com/.test(document.referrer || '')) return 'fb_page';
    return 'web';
  }

  function showError(msg, field) {
    var box = form && $('.ent-form__error', form);
    if (!box) return;
    box.textContent = msg;
    box.hidden = !msg;
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
    if (field) {
      var target = field === 'services' ? form.querySelector('input[name="services"]') : form.elements[field];
      if (target && target.setAttribute) {
        if (field !== 'services') target.setAttribute('aria-invalid', 'true');
        target.focus();
      }
    }
  }

  function payload() {
    var el = form.elements;
    var checked = function (name) { return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); };
    return {
      name: el.name.value,
      email: el.email.value,
      phone: el.phone.value,
      company: el.company.value,
      role: el.role.value,
      ownerLocation: el.ownerLocation.value,
      outOfState: el.outOfState.checked,
      propertyKind: el.propertyKind.value,
      units: el.units.value,
      buildings: el.buildings.value,
      market: el.market.value,
      address: el.address.value,
      packageId: el.packageId.value,
      services: checked('services'),
      addOns: checked('addOns'),
      timeline: el.timeline.value,
      message: el.message.value,
      consent: el.consent.checked,
      website: el.website.value,
      source: source(),
      campaign: (params.get('utm_campaign') || '').slice(0, 80),
      referrer: (document.referrer || '').slice(0, 300)
    };
  }

  function localCheck(p) {
    if (p.name.trim().length < 2) return ['Add your name.', 'name'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email.trim())) return ['Add an email we can reply to.', 'email'];
    if (!p.services.length && !p.packageId) return ['Pick at least one service, or a package.', 'services'];
    if (!p.market.trim() && !p.address.trim()) return ['Tell us the city or the address.', 'market'];
    if (!p.consent) return ['Please agree to be contacted about this request.', 'consent'];
    return null;
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!formOpen) return;
      var p = payload();
      var bad = localCheck(p);
      if (bad) { showError(bad[0], bad[1]); return; }
      showError('');
      form.classList.add('is-busy');
      var btn = $('button[type="submit"]', form);
      var label = btn.innerHTML;
      btn.textContent = 'Sending…';
      request('POST', '/api/enterprise', p).then(function (r) {
        form.classList.remove('is-busy');
        btn.innerHTML = label;
        if (r.status === 201 && r.json && r.json.ok) {
          form.hidden = true;
          var done = $('#ent-done');
          if (done) { done.hidden = false; done.focus(); }
          try { if (window.fbq) window.fbq('track', 'Lead', { content_category: 'enterprise' }); } catch (err) { /* optional */ }
          return;
        }
        var er = (r.json && r.json.error) || {};
        showError(er.message || 'We could not send that. Try again in a moment.', er.code);
      }).catch(function () {
        form.classList.remove('is-busy');
        btn.innerHTML = label;
        showError('We could not reach our server. Check your connection and try again — or message us on Facebook.');
      });
    });
  }
})();
