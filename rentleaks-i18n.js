/**
 * RentLeaks — the runtime half of localisation.
 *
 * The site's chrome is not in the HTML. script.js writes the header, the
 * footer, the modals, the filter rail and every listing card into the page
 * after load, and rentleaks-x.js, rentleaks-list.js and rentleaks-leads.js
 * each write more. Baking French into a static file therefore gets you a
 * French page with an English header on top of it.
 *
 * The obvious fix — thread a t() call through ten thousand lines of four
 * modules — is the one that breaks the live site. This does it the other way
 * round: the dictionary is keyed by the English string those modules already
 * emit, and a sweep over the DOM swaps each one as it appears. No caller
 * changes, no build step over the JS, and a key that is missing simply leaves
 * the English standing rather than rendering a blank or a raw key.
 *
 * Load order matters and is set by tools/build-locales.mjs:
 *
 *     <script src="../locales/fr.ui.js"></script>   sets window.RL_I18N
 *     <script src="../data.js"></script>
 *     <script src="../script.js"></script>
 *     <script src="../rentleaks-i18n.js"></script>
 *
 * The dictionary is a plain script rather than a fetch on purpose: a fetch
 * would paint the English chrome first and translate it a moment later, which
 * is visible, and it would fail outright when the site is opened from disk.
 *
 * On an English page window.RL_I18N is absent, nothing is swept, and the only
 * thing this file does is add the language switcher.
 */
(function () {
  "use strict";

  var CONF = window.RL_I18N || null;
  var DICT = (CONF && CONF.ui) || null;

  /* Locales that have a built tree. Kept here rather than inferred from the
     URL so the switcher on an English page knows what it can offer. */
  var LOCALES = [
    { code: "en", label: "English", dir: "" },
    { code: "fr", label: "Français", dir: "fr" },
    { code: "de", label: "Deutsch", dir: "de" }
  ];

  /* Pages that exist in every locale. A page outside this list has no
     translation, so the switcher sends the visitor to that locale's home
     rather than to a URL that would 404. */
  var TRANSLATED = [
    "", "index.html", "rooms.html", "coliving.html", "furnished.html",
    "short-term.html", "aparthotel.html", "lease-break.html", "rent.html",
    "cities.html", "match.html", "list.html", "professionals.html",
    "operators.html", "faq.html", "contact.html", "privacy.html",
    "terms.html", "404.html"
  ];

  /* ------------------------------------------------------------------ *
   * Where are we
   * ------------------------------------------------------------------ */

  function currentLocale() {
    var seg = (window.location.pathname || "/").split("/").filter(Boolean)[0] || "";
    for (var i = 0; i < LOCALES.length; i++) {
      if (LOCALES[i].dir && LOCALES[i].dir === seg) return LOCALES[i];
    }
    return LOCALES[0];
  }

  /* The path with any locale prefix taken off: "/fr/cities/paris.html"
     becomes "cities/paris.html", which is the key both trees share. */
  function neutralPath() {
    var parts = (window.location.pathname || "/").split("/").filter(Boolean);
    if (parts.length && LOCALES.some(function (l) { return l.dir === parts[0]; })) parts.shift();
    var p = parts.join("/");
    return p === "index.html" ? "" : p;
  }

  function hrefFor(locale) {
    var p = neutralPath();
    // A page with no counterpart would 404 on the other side. Sending the
    // visitor to that locale's home is a worse answer than a translation and
    // a better one than a dead link.
    if (TRANSLATED.indexOf(p) === -1) p = "";
    return "/" + (locale.dir ? locale.dir + "/" : "") + p + window.location.search;
  }

  var HERE = currentLocale();

  /* ------------------------------------------------------------------ *
   * The sweep
   * ------------------------------------------------------------------ */

  /* Attributes a reader or a screen reader actually meets. `value` is only
     translated on a button, never on a text field, where it is user data. */
  var ATTRS = ["placeholder", "aria-label", "title", "alt", "aria-placeholder"];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };

  /* Composed strings — "19% under market", "3 housemates", "from Oct 15, 2026" —
     carry a number in the middle, so no exact key can ever match them. They
     are handled by rule instead: a regex per shape, with {1} standing for the
     capture. {1:sqm} converts square feet to square metres, because a French
     or German page quoting a room in sqft is simply the wrong unit, and
     {1:mon} maps an English month abbreviation. */
  var RULES = ((CONF && CONF.patterns) || []).map(function (r) {
    return { re: new RegExp(r.re), to: r.to };
  });
  var MONTHS = (CONF && CONF.months) || {};

  function expand(tpl, m) {
    return tpl.replace(/\{(\d+)(?::(\w+))?\}/g, function (_, i, fn) {
      var v = m[Number(i)];
      if (v === undefined) return "";
      if (fn === "sqm") return String(Math.round(Number(v) * 0.092903));
      if (fn === "mon") return MONTHS[v] || v;
      if (fn === "t") return (DICT && DICT[v] !== undefined) ? DICT[v] : v;
      return v;
    });
  }

  function byRule(t) {
    for (var i = 0; i < RULES.length; i++) {
      var m = RULES[i].re.exec(t);
      if (m) return expand(RULES[i].to, m);
    }
    return null;
  }

  /* One string, exact key first, then the rules. */
  function one(t) {
    if (DICT && DICT[t] !== undefined) return DICT[t];
    return byRule(t);
  }

  var SEP = " \u00b7 ";   // the middle dot these templates join fields with

  function lookup(raw) {
    if (!DICT) return null;
    var t = raw.trim();
    if (t.length < 2) return null;

    var hit = one(t);

    /* A card's spec line is four separate facts glued together —
       "Shared bath · 3 housemates · 203 sqft · from Oct 15, 2026" — and the
       glue is done at render time, so the whole line is never a key. Splitting
       on the separator turns one impossible lookup into four possible ones,
       and a segment with no translation simply stays as it was. */
    if (hit === null && t.indexOf(SEP) !== -1) {
      var parts = t.split(SEP);
      var any = false;
      var done = parts.map(function (part) {
        var v = one(part.trim());
        if (v === null) return part;
        any = true;
        return v;
      });
      if (any) hit = done.join(SEP);
    }

    if (hit === null || hit === undefined) return null;
    // Put back whatever whitespace the template had around it, or the markup
    // collapses: "Saved" and " Saved " sit differently inside a flex row.
    var lead = raw.slice(0, raw.length - raw.replace(/^\s+/, "").length);
    var tail = raw.slice(raw.replace(/\s+$/, "").length);
    return lead + hit + tail;
  }

  function sweepText(root) {
    if (!DICT) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentNode;
        if (!p || SKIP_TAGS[p.nodeName]) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && /\S/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var node, out;
    while ((node = walker.nextNode())) {
      out = lookup(node.nodeValue);
      if (out !== null && out !== node.nodeValue) node.nodeValue = out;
    }
  }

  function sweepAttrs(root) {
    if (!DICT) return;
    var sel = ATTRS.map(function (a) { return "[" + a + "]"; }).join(",");
    var nodes = root.querySelectorAll ? root.querySelectorAll(sel) : [];
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.closest("[data-no-i18n]")) return;
      ATTRS.forEach(function (a) {
        var v = el.getAttribute(a);
        if (!v) return;
        var out = lookup(v);
        if (out !== null && out !== v) el.setAttribute(a, out);
      });
    });
    // Buttons carry their label in value=; text inputs carry the visitor's
    // own typing there, so the two cases cannot share a rule.
    Array.prototype.forEach.call(
      root.querySelectorAll ? root.querySelectorAll('input[type="submit"],input[type="button"],input[type="reset"]') : [],
      function (el) {
        var out = lookup(el.value || "");
        if (out !== null && out !== el.value) el.value = out;
      }
    );
    // <option> labels are text nodes and are handled by the text sweep, but a
    // <select> with an aria-label inside a shadowed template is not.
    if (root.nodeType === 1 && root.matches && root.matches(sel)) sweepAttrs(root.parentNode || document.body);
  }

  function sweep(root) {
    var el = root || document.body;
    if (!el) return;
    sweepText(el);
    sweepAttrs(el);
  }

  /* ------------------------------------------------------------------ *
   * Keeping it swept
   * ------------------------------------------------------------------ */

  /* Every module here re-renders on interaction — a filter change rebuilds
     the whole grid, opening the command palette builds it from scratch. A
     one-shot pass at load would translate the first paint and nothing after
     it, so the observer is not an optimisation, it is the mechanism.
     Only childList is observed: the sweep changes nodeValue and attributes,
     neither of which is reported here, so it cannot retrigger itself. */
  function watch() {
    if (!DICT || !window.MutationObserver) return;
    var queue = [];
    var scheduled = false;

    function flush() {
      scheduled = false;
      var batch = queue;
      queue = [];
      for (var i = 0; i < batch.length; i++) {
        if (batch[i].isConnected !== false) sweep(batch[i]);
      }
    }

    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1) queue.push(n);
          else if (n.nodeType === 3) { var out = lookup(n.nodeValue || ""); if (out !== null) n.nodeValue = out; }
        }
      }
      if (queue.length && !scheduled) {
        scheduled = true;
        (window.requestAnimationFrame || window.setTimeout)(flush, 0);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------------------ *
   * Language switcher
   * ------------------------------------------------------------------ */

  function styleOnce() {
    if (document.getElementById("rl-i18n-css")) return;
    var s = document.createElement("style");
    s.id = "rl-i18n-css";
    s.textContent =
      ".rl-lang{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:999px;" +
      "border:1px solid var(--line-strong,#b7cdd2);background:var(--surface,#fff)}" +
      ".rl-lang a{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;" +
      "font:600 12px/1 var(--font-sans,system-ui,sans-serif);text-decoration:none;color:var(--ink-soft,#53707a)}" +
      ".rl-lang a:hover{color:var(--brand,#3795a6)}" +
      ".rl-lang a[aria-current=\"true\"]{background:var(--brand,#3795a6);color:#fff}" +
      ".rl-lang a:focus-visible{outline:2px solid var(--brand,#3795a6);outline-offset:2px}" +
      "@media(max-width:900px){.rl-lang{order:9}}";
    document.head.appendChild(s);
  }

  /* Rendered as real <a> elements, one per locale, not a <select> that needs
     JavaScript to go anywhere: these are the hreflang cluster's own URLs and
     a crawler should be able to follow them. */
  function addSwitcher() {
    var host = document.querySelector(".header__actions");
    if (!host || host.querySelector(".rl-lang")) return !!host;
    styleOnce();
    var nav = document.createElement("nav");
    nav.className = "rl-lang";
    nav.setAttribute("aria-label", (CONF && CONF.nav && CONF.nav.languageLabel) || "Language");
    nav.setAttribute("data-no-i18n", "");   // never translate the language names
    LOCALES.forEach(function (l) {
      var a = document.createElement("a");
      a.href = hrefFor(l);
      a.hreflang = l.code;
      a.lang = l.code;
      a.textContent = l.code.toUpperCase();
      a.title = l.label;
      if (l.code === HERE.code) {
        a.setAttribute("aria-current", "true");
        a.rel = "nofollow";      // self-link, nothing for a crawler to follow
      }
      nav.appendChild(a);
    });
    // Before the theme toggle, so the row still ends on the primary button.
    var toggle = host.querySelector(".theme-toggle");
    host.insertBefore(nav, toggle || null);
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Locale defaults
   * ------------------------------------------------------------------ */

  /* script.js guesses a display currency from navigator.language, which gets
     a French speaker in New York dollars on a French page. The locale is the
     better signal — but only as a default: it is written once, and the
     header's own currency select overwrites it for good afterwards. */
  function seedCurrency() {
    if (!CONF || !CONF.currency) return;
    try {
      if (localStorage.getItem("rl_currency")) return;
      localStorage.setItem("rl_currency", JSON.stringify(CONF.currency));
    } catch (e) { /* private mode, or storage disabled — the guess still works */ }
  }

  /* ------------------------------------------------------------------ *
   * Start
   * ------------------------------------------------------------------ */

  function start() {
    sweep(document.body);
    // The chrome is injected by script.js on DOMContentLoaded too, and the
    // order between two listeners is not ours to assume. The observer covers
    // it whenever it lands; this only saves a frame when we are second.
    if (!addSwitcher()) {
      var tries = 0;
      var t = setInterval(function () {
        if (addSwitcher() || ++tries > 40) clearInterval(t);
      }, 50);
    }
    watch();
  }

  // Before any listener runs, and in particular before script.js builds the
  // header and reads the currency out of storage.
  seedCurrency();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.RL_I18N_RUNTIME = {
    locale: HERE.code,
    translate: function (s) { var v = lookup(s); return v === null ? s : v; },
    sweep: sweep,
    hrefFor: hrefFor,
    missing: function (root) {
      // Development aid: every string on the page the dictionary does not
      // cover, so a gap is a list to work through rather than a surprise.
      var out = {}, el = root || document.body;
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode;
          if (!p || SKIP_TAGS[p.nodeName]) return NodeFilter.FILTER_REJECT;
          return /\S/.test(n.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var done = {};
      if (DICT) Object.keys(DICT).forEach(function (k) { done[DICT[k]] = 1; });
      var n;
      while ((n = w.nextNode())) {
        var t = n.nodeValue.trim();
        if (t.length <= 2 || !/[A-Za-z]{3}/.test(t)) continue;
        if (!DICT || DICT[t] !== undefined) continue;   // has a translation
        if (done[t]) continue;                          // IS a translation
        out[t] = (out[t] || 0) + 1;
      }
      return out;
    }
  };
})();
