/*
 * RentLeaks × Facebook — the site side of the Facebook Page.
 *
 * 1. Footer: "Follow on Facebook" and "Message us" links on every page.
 * 2. Listing pages: a share row under the title (Facebook share dialog,
 *    Messenger on phones, copy link) with UTM tags so shares are countable.
 * 3. Meta Pixel — OFF unless a page carries <meta name="rl-meta-pixel">,
 *    and even then it loads only after the visitor accepts. Housing is a
 *    Special Ad Category on Meta: the pixel sends page views, listing views
 *    and contact clicks only — never search filters, budgets or anything a
 *    person typed.
 *
 * Applied to every page by tools/apply-facebook.py.
 */
(function () {
  "use strict";

  var PAGE_URL = "https://www.facebook.com/rentleaks.official";
  var MESSENGER_URL = "https://m.me/rentleaks.official";
  var CONSENT_KEY = "rl_meta_consent";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }

  var ICON_FB =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.79 8.43-4.94 8.43-9.94z"/></svg>';
  var ICON_MSG =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.2 5.43 3.14 7.17.16.15.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.98-.87a.8.8 0 0 1 .53-.04c.91.25 1.87.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63z"/></svg>';

  function injectStyles() {
    if (document.getElementById("rl-social-css")) return;
    var css =
      ".rl-social{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}" +
      ".rl-social a,.rl-share button,.rl-share a{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 14px;border-radius:999px;" +
      "border:1px solid var(--line-strong,#b7cdd2);background:var(--surface,#fff);color:var(--ink,#10242a);font:600 13px/1 var(--font-sans,system-ui,sans-serif);text-decoration:none;cursor:pointer}" +
      ".rl-social a:hover,.rl-share button:hover,.rl-share a:hover{border-color:var(--brand,#3795a6);color:var(--brand,#3795a6)}" +
      ".rl-social a:focus-visible,.rl-share button:focus-visible,.rl-share a:focus-visible{outline:2px solid var(--brand,#3795a6);outline-offset:2px}" +
      ".rl-share{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}" +
      ".rl-consent{position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;max-width:560px;margin:0 auto;" +
      "display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 16px;border-radius:14px;background:var(--surface-inv,#10242a);color:#f1f9fa;" +
      "font:14px/1.45 var(--font-sans,system-ui,sans-serif);box-shadow:0 12px 32px rgba(16,36,42,.28)}" +
      ".rl-consent p{margin:0;flex:1 1 260px}.rl-consent a{color:#b7dfe7}" +
      ".rl-consent button{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid #5fb5c4;background:transparent;color:#f1f9fa;font:600 13px/1 inherit;cursor:pointer}" +
      ".rl-consent button.is-primary{background:#3795a6;border-color:#3795a6}";
    document.head.appendChild(el("style", { id: "rl-social-css" }, css));
  }

  /* --- 1. footer links ---------------------------------------------------- */

  function addFooterLinks() {
    var brand = document.querySelector(".footer__brand");
    if (!brand || brand.querySelector(".rl-social")) return !!brand;
    var row = el("div", { class: "rl-social", "aria-label": "RentLeaks on Facebook" });
    row.appendChild(el("a", { href: PAGE_URL + "?utm_source=rentleaks&utm_medium=footer", target: "_blank", rel: "noopener" }, ICON_FB + "<span>Follow on Facebook</span>"));
    row.appendChild(el("a", { href: MESSENGER_URL, target: "_blank", rel: "noopener" }, ICON_MSG + "<span>Message us</span>"));
    brand.appendChild(row);
    return true;
  }

  /* --- 2. share row on listing pages ------------------------------------ */

  function canonicalUrl() {
    var c = document.querySelector('link[rel="canonical"]') || document.querySelector('meta[property="og:url"]');
    return (c && (c.getAttribute("href") || c.getAttribute("content"))) || location.href.split("#")[0];
  }

  function tagged(url, source) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return url + sep + "utm_source=" + source + "&utm_medium=social&utm_campaign=listing_share";
  }

  function addShareRow() {
    var isListing = /\/listings\//.test(location.pathname) || document.querySelector('meta[property="og:type"][content="article"]');
    if (!isListing) return false;
    var h1 = document.querySelector("main h1") || document.querySelector("h1");
    if (!h1) return false;
    var existing = document.querySelector(".rl-share");
    if (existing && existing.previousElementSibling === h1) return true;
    if (existing) existing.remove();
    var url = canonicalUrl();
    var row = el("div", { class: "rl-share", role: "group", "aria-label": "Share this home" });

    var fb = el("a", {
      href: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(tagged(url, "facebook")),
      target: "_blank",
      rel: "noopener",
    }, ICON_FB + "<span>Share on Facebook</span>");
    fb.addEventListener("click", function (e) {
      var w = window.open(fb.href, "rl-share", "width=640,height=560");
      if (w) e.preventDefault();
      track("Share", { method: "facebook" });
    });
    row.appendChild(fb);

    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      row.appendChild(el("a", {
        href: "fb-messenger://share/?link=" + encodeURIComponent(tagged(url, "messenger")),
      }, ICON_MSG + "<span>Send in Messenger</span>"));
    }

    var copy = el("button", { type: "button" }, "<span>Copy link</span>");
    copy.addEventListener("click", function () {
      var link = tagged(url, "copy");
      var done = function () {
        copy.firstChild.textContent = "Link copied";
        setTimeout(function () { copy.firstChild.textContent = "Copy link"; }, 1800);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () {});
      else {
        window.prompt("Copy this link", link);
      }
    });
    row.appendChild(copy);

    h1.insertAdjacentElement("afterend", row);
    return true;
  }

  /* --- 3. consent-gated Meta Pixel -------------------------------------- */

  var pixelId = null;
  var pixelOn = false;

  function readConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function writeConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) { /* private mode */ }
  }

  function loadPixel() {
    if (pixelOn || !pixelId) return;
    pixelOn = true;
    /* Meta's standard loader. */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
    var id = (document.querySelector("[data-id]") || {}).getAttribute && document.querySelector("[data-id]").getAttribute("data-id");
    if (id && /\/listings\//.test(location.pathname)) {
      /* content_ids match the Meta home-listing catalog (home_listing_id). */
      window.fbq("track", "ViewContent", { content_ids: [id], content_type: "home_listing" });
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href*="apply.html"], a[href^="mailto:"], a[href^="tel:"], a[href*="m.me/"]');
      if (a) track("Contact", {});
    }, true);
  }

  function track(name, params) {
    /* Contact is a standard event; Share is not, so it goes as a custom one. */
    var standard = { Contact: 1, ViewContent: 1, PageView: 1 };
    if (pixelOn && window.fbq) window.fbq(standard[name] ? "track" : "trackCustom", name, params || {});
  }

  function consentBar() {
    var bar = el("div", { class: "rl-consent", role: "region", "aria-label": "Advertising cookies" },
      "<p>We use Meta's pixel to measure our Facebook ads — page views and which homes were opened. Nothing you type is sent. " +
      '<a href="privacy.html">Privacy</a></p>');
    var no = el("button", { type: "button" }, "No thanks");
    var yes = el("button", { type: "button", class: "is-primary" }, "Allow");
    no.addEventListener("click", function () { writeConsent("denied"); bar.remove(); });
    yes.addEventListener("click", function () { writeConsent("granted"); bar.remove(); loadPixel(); });
    bar.appendChild(no);
    bar.appendChild(yes);
    document.body.appendChild(bar);
    var priv = bar.querySelector("a");
    var base = document.querySelector('script[src*="rentleaks-social.js"]');
    if (priv && base) priv.setAttribute("href", base.getAttribute("src").replace(/rentleaks-social\.js.*$/, "") + "privacy.html");
  }

  function setupPixel() {
    var m = document.querySelector('meta[name="rl-meta-pixel"]');
    pixelId = m && /^\d{6,20}$/.test(m.getAttribute("content") || "") ? m.getAttribute("content") : null;
    if (!pixelId) return;
    /* Global Privacy Control is treated as a "no". */
    if (navigator.globalPrivacyControl) return;
    var c = readConsent();
    if (c === "granted") loadPixel();
    else if (c !== "denied") consentBar();
  }

  /* Exposed so a "cookie settings" link can reopen the choice. */
  window.RentLeaksSocial = {
    resetConsent: function () { writeConsent(""); setupPixel(); },
    pageUrl: PAGE_URL,
  };

  ready(function () {
    injectStyles();
    setupPixel();
    /* script.js re-renders the listing and the footer after its data loads,
       replacing what was there. Keep both in place while that settles. */
    var queued = false;
    function sync() {
      queued = false;
      addFooterLinks();
      addShareRow();
    }
    sync();
    var mo = new MutationObserver(function () {
      if (!queued) {
        queued = true;
        requestAnimationFrame(sync);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); sync(); }, 20000);
  });
})();
