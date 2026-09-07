/**
 * RentLeaks — live data source
 * ---------------------------------------------------------------------------
 * The site ships a complete baked catalog (data.js) so it renders instantly,
 * works with no backend, and keeps every pre-generated SEO page meaningful.
 * This layer upgrades that to live data when an API is reachable:
 *
 *   1. paint immediately from the baked catalog  (never a blank screen)
 *   2. ask the API for the real thing
 *   3. swap it in and re-render
 *
 * Every call fails soft. If the API is down, slow, or absent, the site simply
 * stays on the baked catalog — which is why this can be hosted on GitHub
 * Pages while still being live when the Next app is running.
 */
(function () {
  'use strict';

  function resolveBase() {
    if (typeof window.RL_API_URL === 'string') return window.RL_API_URL.replace(/\/$/, '');
    var meta = document.querySelector('meta[name="rl-api"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, '');
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
    return '';
  }

  var BASE = resolveBase();
  var TIMEOUT = 6000;

  function get(path, params) {
    if (!BASE) return Promise.reject(new Error('no-api'));
    var url = BASE + path;
    if (params) {
      var qs = Object.keys(params)
        .filter(function (k) { return params[k] !== '' && params[k] != null && params[k] !== false; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      if (qs) url += '?' + qs;
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('http-' + r.status);
        return r.json();
      })
      .catch(function (err) { clearTimeout(timer); throw err; });
  }

  /**
   * Budgets are typed in whatever currency the visitor is viewing, but the
   * API compares against allInUsd because listings span many currencies.
   * Convert on the way out.
   */
  function toUsd(amount) {
    if (!amount) return '';
    var D = window.RENTLEAKS_DATA;
    if (!D || !D.convert) return amount;
    var display = 'USD';
    try {
      var saved = JSON.parse(localStorage.getItem('rl_currency') || '""');
      if (saved) display = saved;
    } catch (e) { /* default */ }
    return Math.round(D.convert(Number(amount), display, 'USD'));
  }

  /** Browse-page filter state -> API query params. */
  function stateToParams(state, page, pageSize) {
    return {
      city: state.city || '',
      type: state.type || '',
      q: state.location || '',
      min: toUsd(state.priceMin),
      max: toUsd(state.priceMax),
      beds: state.beds || '',
      stay: state.minStay || '',
      moveIn: state.moveIn || '',
      furnished: state.furnished === 'fully' ? 1 : '',
      pets: state.pets === 'yes' ? 1 : '',
      bath: state.privateBath ? 1 : '',
      work: state.workspace ? 1 : '',
      nofee: state.noFee ? 1 : '',
      utils: state.utilitiesIn ? 1 : '',
      verified: state.verified ? 1 : '',
      sort: state.sort || 'newest',
      page: page || 1,
      pageSize: pageSize || 24
    };
  }

  var RLData = {
    base: BASE,
    // Flipped false permanently after a failure, so one outage does not cause
    // a stall on every subsequent interaction.
    enabled: !!BASE,
    live: false,

    disable: function (reason) {
      if (!RLData.enabled) return;
      RLData.enabled = false;
      RLData.live = false;
      if (window.console && console.info) {
        console.info('[RentLeaks] live data off (' + reason + ') — using the bundled catalog');
      }
      document.dispatchEvent(new CustomEvent('rl:data-offline'));
    },

    query: function (state, page, pageSize) {
      return get('/api/listings', stateToParams(state, page, pageSize)).then(function (r) {
        RLData.live = true;
        document.dispatchEvent(new CustomEvent('rl:data-live'));
        return r;
      }).catch(function (err) {
        RLData.disable(err.message);
        throw err;
      });
    },

    listing: function (id) {
      return get('/api/listings/' + encodeURIComponent(id));
    },

    cities: function () {
      return get('/api/cities');
    },

    meta: function () {
      return get('/api/meta').then(function (r) { RLData.live = true; return r; });
    }
  };

  window.RLData = RLData;

  /* ---------------------------------------------------------------------
   * Live counters — cheap, visible, and safe on every page.
   * ------------------------------------------------------------------- */
  function paintMeta(m) {
    var set = function (sel, value) {
      document.querySelectorAll(sel).forEach(function (el) { el.textContent = value; });
    };
    if (typeof m.listings === 'number') set('#trust-rent-count', m.listings.toLocaleString());
    if (typeof m.cities === 'number') set('#trust-city-count', String(m.cities));
    document.dispatchEvent(new CustomEvent('rl:meta', { detail: m }));
  }

  if (RLData.enabled) {
    RLData.meta().then(paintMeta).catch(function () { /* baked numbers stand */ });
  }
})();
