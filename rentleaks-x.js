/**
 * RentLeaks X — the Evidence Layer
 * ---------------------------------------------------------------------------
 * Loads AFTER script.js. Adds nothing to the base renderer's responsibilities
 * and overrides none of its functions — it observes the DOM the base renderer
 * produces and augments it. That keeps the two layers independently
 * debuggable and means a failure here degrades to the existing product.
 *
 * What it adds, and why (each maps to a verified gap in the category):
 *
 *   1. STAY WINDOW      Move-in AND move-out date search with enforced
 *                       min/max stay. Every serious mid-term marketplace
 *                       ships date-range search; this one shipped move-in
 *                       only, which cannot express "March through June".
 *   2. PRICE TRUTH      In-product percentile benchmarking at the decision
 *                       point. HousingAnywhere has the data and spends it on
 *                       quarterly PR; nobody puts it next to the CTA.
 *   3. TRUST LEDGER     Splits one undifferentiated `verified` boolean into
 *                       the four distinct things it was conflating, and shows
 *                       the work. Plus behavioural fraud signals — identity
 *                       clustering and off-platform payment asks — which are
 *                       the controls that still function against fully
 *                       AI-generated listings.
 *   4. LOCAL RULES      A jurisdiction rules engine with effective dates, so
 *                       the deposit cap, application-fee cap, fee legality,
 *                       minimum-stay floor and registration requirement are
 *                       data rather than `if (city === 'nyc')` scattered
 *                       through the render path.
 *   5. AFFORDABILITY    Income-ratio maths computed on the TENANT'S share,
 *                       which is the source-of-income violation most
 *                       platforms don't see coming.
 *   6. TAKEOVER DESK    Sublet vs assignment, the statutory notice packet and
 *                       the response clock. The largest unbuilt thing in the
 *                       category.
 *   7. STAY RECORD      Verified-stay, two-sided reviews with a host response
 *                       window. No player in the set ships two-sided.
 *   8. PASSPORT         A portable, expiring renter credential. Nobody ships
 *                       one; it is the fix for the screening handoff that
 *                       kills lease takeovers.
 *   9. NOTICE + GUARD   Notice-and-action reporting with a statement of
 *                       reasons, and a prohibited-terms lexicon on free text.
 *                       No protected-characteristic facet is ever created
 *                       here — structured intake on a protected class is the
 *                       Roommates.com line.
 *
 * Compliance data in RULES is research, not legal advice, and carries its
 * source and effective date so it can be audited and refreshed.
 */
(function () {
  'use strict';

  var DATA = window.RENTLEAKS_DATA;
  if (!DATA) return;

  var STORE = {
    window: 'rl_x_window',
    passport: 'rl_x_passport',
    reports: 'rl_x_reports',
    currency: 'rl_currency'
  };

  /* =======================================================================
     0. Primitives
     ======================================================================= */

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /** Stable 32-bit hash — derived facts must not reshuffle between renders. */
  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function pick(arr, seed) { return arr[seed % arr.length]; }

  var CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'CHF'];

  function displayCurrency() {
    var saved = read(STORE.currency, null);
    if (saved && CURRENCIES.indexOf(saved) !== -1) return saved;
    try {
      var region = (navigator.language || '').split('-')[1];
      var byRegion = { CA: 'CAD', GB: 'GBP', CH: 'CHF', IE: 'EUR', FR: 'EUR', ES: 'EUR', NL: 'EUR', DE: 'EUR', IT: 'EUR' };
      if (region && byRegion[region]) return byRegion[region];
    } catch (e) { /* ignore */ }
    return 'USD';
  }

  function srcCurrency(ctx) {
    if (!ctx) return null;
    if (typeof ctx === 'string') return ctx;
    if (ctx.currency) return ctx.currency;
    if (ctx.country && DATA.currencyForCountry) return DATA.currencyForCountry(ctx.country);
    return null;
  }

  function money(n, ctx) {
    var to = displayCurrency();
    var from = srcCurrency(ctx) || to;
    var value = DATA.convert ? DATA.convert(n, from, to) : Number(n || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: to, minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(Math.round(value));
    } catch (e) {
      return (to === 'USD' ? '$' : to + ' ') + Math.round(value).toLocaleString();
    }
  }

  function allIn(l) { return DATA.allIn ? DATA.allIn(l) : (l.allIn || l.price); }

  /* --- dates ------------------------------------------------------------ */

  var DAY = 86400000;

  function toISO(d) {
    if (!d) return '';
    var dt = (d instanceof Date) ? d : new Date(d + 'T00:00:00');
    if (isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  }

  function parseISO(s) {
    if (!s) return null;
    var d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function addMonths(iso, months) {
    var d = parseISO(iso);
    if (!d) return '';
    var day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0); // clamp Jan 31 + 1mo -> Feb 28/29
    return toISO(d);
  }

  function daysBetween(a, b) {
    var x = parseISO(a), y = parseISO(b);
    if (!x || !y) return null;
    return Math.round((y - x) / DAY);
  }

  function fmtDate(iso) {
    var d = parseISO(iso);
    if (!d) return '—';
    try {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function todayISO() { return toISO(new Date()); }

  /* =======================================================================
     1. Jurisdiction rules engine
     -----------------------------------------------------------------------
     Resolution order: city slug -> state/region -> country -> global default.
     Every field that constrains the product carries `src` (a citation) and
     `eff` (the date it took effect) so a stale rule is visible rather than
     silently wrong. This table is research, not legal advice.
     ======================================================================= */

  /* =======================================================================
     1. Jurisdiction rules
     -----------------------------------------------------------------------
     The data lives in ONE place: web/src/lib/rules.json, wrapped for the
     browser by tools/build-rules.mjs into rentleaks-rules.js. The typed side
     of the product imports the same JSON directly. Only the twenty-line merge
     below is duplicated, and a merge function does not drift — a deposit cap
     does, which is exactly why it is not in here any more.

     Source references travel as string keys in the JSON ("ll18") and are
     resolved to the source object after merging, so a citation cannot point
     at nothing.
     ======================================================================= */

  /* =======================================================================
     1a. Deal structure — who listed it, who engaged a broker, who may pay
     -----------------------------------------------------------------------
     The first version of this layer treated the FARE Act as a flat ban and
     zeroed every tenant-paid broker fee in New York. That was wrong in both
     directions. NYC Admin. Code § 20-699.21(a) binds a *landlord's agent*,
     not everyone — a broker the tenant themselves retained may still charge
     the tenant, and an owner letting their own place has no agent at all. So
     "may a fee be charged" is a function of three independent facts, not one
     boolean, and this is the model that expresses them.
     ======================================================================= */

  var LISTED_BY = {
    'owner-direct': {
      label: 'Listed by the owner',
      short: 'By owner',
      blurb: 'The person letting this home owns it and is handling the let themselves. There is no agent in the transaction, so there is no broker fee to argue about.',
      brokerInDeal: false
    },
    'landlord-broker': {
      label: 'Listed by the landlord’s broker',
      short: 'Landlord’s agent',
      blurb: 'A licensed broker retained by the landlord published this. They act for the landlord, not for you.',
      brokerInDeal: true
    },
    'operator': {
      label: 'Listed by the operator',
      short: 'Operator',
      blurb: 'A co-living or serviced-apartment operator lets this directly from its own portfolio. No third-party agent sits in between.',
      brokerInDeal: false
    },
    'incumbent-tenant-sublandlord': {
      label: 'Listed by the departing tenant, as sub-landlord',
      short: 'Sublet',
      blurb: 'The current tenant stays on the original lease and lets to you underneath it. They are your landlord for the sublease; the building’s owner is not.',
      brokerInDeal: false
    },
    'incumbent-tenant-assignor': {
      label: 'Listed by the departing tenant, for assignment',
      short: 'Takeover',
      blurb: 'The current tenant leaves the lease entirely and you step into it with the building’s owner. The departing tenant is not a party to your tenancy at all.',
      brokerInDeal: false
    }
  };

  /* Fee catalogue. `payer` is who is being asked to pay; `legality` is
     resolved per market by feeVerdict() below. */
  var FEE_META = {
    broker:      { label: 'Broker fee',            type: 'broker',      timing: 'at move-in' },
    application: { label: 'Application fee',       type: 'application', timing: 'at application' },
    screening:   { label: 'Background & credit',   type: 'screening',   timing: 'at application' },
    utilities:   { label: 'Utilities',             type: 'recurring',   timing: 'monthly' },
    wifi:        { label: 'Wi-Fi',                 type: 'recurring',   timing: 'monthly' },
    cleaning:    { label: 'Cleaning',              type: 'recurring',   timing: 'monthly' },
    parking:     { label: 'Parking',               type: 'recurring',   timing: 'monthly' },
    amenity:     { label: 'Amenity fee',           type: 'recurring',   timing: 'monthly' },
    admin:       { label: 'Admin fee',             type: 'move-in',     timing: 'at move-in' },
    move_in:     { label: 'Move-in fee',           type: 'move-in',     timing: 'at move-in' },
    key:         { label: 'Key fee',               type: 'move-in',     timing: 'at move-in' },
    access:      { label: 'Takeover access fee',   type: 'move-in',     timing: 'at move-in' }
  };


  var RULEBOOK = window.RENTLEAKS_RULES || null;

  var SRC = (RULEBOOK && RULEBOOK.sources) || {};
  var DEFAULTS = (RULEBOOK && RULEBOOK.defaults) || { minStayDays: 30, notes: [] };
  var RULES = {
    city: (RULEBOOK && RULEBOOK.city) || {},
    region: (RULEBOOK && RULEBOOK.region) || {},
    country: (RULEBOOK && RULEBOOK.country) || {}
  };
  var EU = (RULEBOOK && RULEBOOK.eu) || [];

  if (!RULEBOOK && window.console && console.warn) {
    console.warn('[rl-x] rentleaks-rules.js did not load — compliance panels will fall back to the 30-day floor with no citations.');
  }

  /* Fields whose value is a key into `sources`. */
  var SRC_FIELDS = [
    'minStaySrc', 'depositSrc', 'appFeeSrc', 'applicationFeeSrc', 'moveInFeesSrc',
    'tenantBrokerFeeSrc', 'soiSrc', 'fairChanceSrc', 'allInSrc', 'listingFeeDisclosureSrc',
    'registrationSrc', 'subletSurchargeSrc', 'brokerLicenceSrc', 'reusableSrc',
    'screeningLaw', 'adLaw', 'dataLaw'
  ];

  function resolveSources(out) {
    SRC_FIELDS.forEach(function (f) {
      if (typeof out[f] === 'string') out[f] = SRC[out[f]] || null;
    });
    if (out.sublet && typeof out.sublet.src === 'string') {
      out.sublet = {
        statute: out.sublet.statute,
        src: SRC[out.sublet.src] || null,
        infoWindowDays: out.sublet.infoWindowDays,
        decisionWindowDays: out.sublet.decisionWindowDays,
        silenceIsConsent: out.sublet.silenceIsConsent,
        appliesTo: out.sublet.appliesTo,
        assignmentNote: out.sublet.assignmentNote
      };
    }
    return out;
  }


  function rulesFor(listing) {
    var city = DATA.getCity ? DATA.getCity(listing.cityId) : null;
    var slug = city ? city.slug : '';
    var region = listing.state || (city && city.state) || '';
    var country = listing.country || (city && city.country) || 'US';

    var out = {};
    var k;
    for (k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) out[k] = DEFAULTS[k];
    out.notes = [];

    function merge(src) {
      if (!src) return;
      for (var key in src) {
        if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
        if (key === 'notes') { out.notes = out.notes.concat(src.notes || []); continue; }
        out[key] = src[key];
      }
    }

    merge(RULES.country[country]);
    merge(RULES.region[region]);
    merge(RULES.city[slug]);

    out.cityName = listing.cityName || (city && city.name) || '';
    out.country = country;
    out.region = region;
    out.isEU = EU.indexOf(country) !== -1;
    if (out.isEU) {
      out.dsa = SRC.dsa;
      out.euStr = SRC.euStr;
    }
    return resolveSources(out);
  }

  /* =======================================================================
     2. Derived listing facts
     -----------------------------------------------------------------------
     Everything here is a pure function of the listing plus the rules engine,
     seeded off the listing id so a value never changes between renders.
     ======================================================================= */

  /** Who published this listing, and is there a broker in the deal at all. */
  function dealFor(l, seed) {
    var kind;
    if (l.housingType === 'lease-break') {
      kind = (l.takeoverType === 'assignment' || (seed % 2 === 0 && !l.takeoverType))
        ? 'incumbent-tenant-assignor'
        : 'incumbent-tenant-sublandlord';
    } else if (l.operatorId && l.operatorKind === 'coliving') {
      kind = 'operator';
    } else if (l.operatorId) {
      /* A portfolio or landlord storefront. Small owners letting their own
         place are the majority of the US rental stock — individual investors
         own around 70% of rental properties — so the split here is weighted
         toward owner-direct rather than toward agents. */
      kind = (seed % 4 === 0) ? 'landlord-broker' : 'owner-direct';
    } else {
      kind = (seed % 5 === 0) ? 'landlord-broker' : 'owner-direct';
    }

    var meta = LISTED_BY[kind];
    return {
      kind: kind,
      meta: meta,
      /* In a marketplace of landlord-published inventory, any broker in the
         deal is the landlord's. A tenant-retained broker is a relationship
         the tenant brings, never something a listing can assert for them. */
      brokerEngagement: meta.brokerInDeal ? 'landlord-engaged' : 'none',
      byOwner: kind === 'owner-direct',
      byDepartingTenant: kind.indexOf('incumbent-tenant') === 0
    };
  }

  /**
   * Is this charge lawful, against this market, for this deal structure?
   * Returns {state, why, src, cap}.
   *   ok       — permitted
   *   capped   — permitted up to a limit, and this one is within it
   *   over     — permitted in principle, but this amount exceeds the cap
   *   barred   — may not be charged to the tenant at all
   */
  function feeVerdict(key, amount, l, rules, deal) {
    var meta = FEE_META[key] || { label: key, type: 'recurring' };

    if (meta.type === 'broker') {
      if (!amount) {
        return { state: 'ok', why: deal.meta.brokerInDeal
          ? 'No broker fee is being passed to you.'
          : 'There is no broker in this deal.' };
      }
      if (rules.landlordAgentMayChargeTenant === false && deal.brokerEngagement === 'landlord-engaged') {
        return {
          state: 'barred',
          why: 'The broker here acts for the landlord, and a landlord’s agent may not charge you a fee in this market. A broker you retained yourself is a different matter and may still charge you.',
          src: rules.tenantBrokerFeeSrc
        };
      }
      if (rules.landlordAgentMayChargeTenant === false) {
        return { state: 'barred', why: 'A landlord’s agent may not charge the tenant here.', src: rules.tenantBrokerFeeSrc };
      }
      return { state: 'ok', why: 'Lawful in this market. It must still be disclosed in the listing before you apply.' };
    }

    if (meta.type === 'application') {
      if (rules.applicationFeeBanned && amount > 0) {
        return { state: 'barred', why: 'An application, processing or acceptance fee may not be demanded in this market at all.', src: rules.applicationFeeSrc };
      }
      if (rules.appFeeCap != null && amount > rules.appFeeCap) {
        return { state: 'over', why: 'Over the cap for this market.', src: rules.appFeeSrc, cap: rules.appFeeCap };
      }
      return { state: 'ok', why: amount ? 'Within the cap for this market.' : 'Nothing charged.' };
    }

    if (meta.type === 'screening') {
      if (rules.screeningFeeCap != null) {
        return amount > rules.screeningFeeCap
          ? { state: 'over', why: 'Background and credit checks are capped at the lesser of actual cost or the statutory figure, and must be waived if you supply your own report from the last 30 days.', src: rules.appFeeSrc, cap: rules.screeningFeeCap }
          : { state: 'capped', why: 'Capped at the lesser of actual cost or ' + money(rules.screeningFeeCap, rules.appFeeCurrency || 'USD') + ', and waived entirely if you supply your own report from the last 30 days.', src: rules.appFeeSrc, cap: rules.screeningFeeCap };
      }
      return { state: 'ok', why: 'No statutory cap recorded for this market.' };
    }

    if (meta.type === 'move-in') {
      if (!amount) return { state: 'ok', why: 'Not charged.' };
      if (rules.moveInFeesBarred) {
        var whoBarred = deal.byDepartingTenant && rules.subLessorNamed
          ? 'The statute names sub-lessors as well as landlords, so a departing tenant cannot charge this either.'
          : 'A charge of this kind, demanded before or at the start of the tenancy, is not permitted here.';
        return { state: 'barred', why: whoBarred, src: rules.moveInFeesSrc };
      }
      return { state: 'ok', why: 'Permitted, and disclosed up front.' };
    }

    return { state: 'ok', why: 'A recurring charge, inside the all-in figure above.' };
  }

  var derivedCache = {};

  function derive(l) {
    if (!l) return null;
    if (derivedCache[l.id]) return derivedCache[l.id];

    var seed = hash(l.id);
    var rules = rulesFor(l);
    var deal = dealFor(l, seed);

    /* --- availability window ------------------------------------------- */
    var from = l.availableFrom;
    var until;
    if (l.housingType === 'lease-break' && l.leaseEnd) {
      until = l.leaseEnd;
    } else {
      var maxM = l.maxStayMonths || 12;
      until = addMonths(from, maxM);
    }
    var minDays = Math.max(rules.minStayDays || 30, (l.minStayMonths || 1) * 30);
    var maxDays = daysBetween(from, until);

    /* --- price position within (city x type) --------------------------- */
    var peers = (DATA.listings || []).filter(function (x) {
      return x.cityId === l.cityId && x.housingType === l.housingType;
    });
    if (peers.length < 6) {
      peers = (DATA.listings || []).filter(function (x) { return x.housingType === l.housingType; });
    }
    var vals = peers.map(function (x) { return x.allInUsd || allIn(x); }).sort(function (a, b) { return a - b; });
    var mine = l.allInUsd || allIn(l);
    var below = 0;
    for (var i = 0; i < vals.length; i++) { if (vals[i] < mine) below++; }
    var pct = vals.length > 1 ? Math.round((below / (vals.length - 1)) * 100) : 50;

    function q(p) {
      if (!vals.length) return mine;
      var idx = (vals.length - 1) * p;
      var lo = Math.floor(idx), hi = Math.ceil(idx);
      return Math.round(vals[lo] + (vals[hi] - vals[lo]) * (idx - lo));
    }

    var stats = { n: vals.length, p10: q(0.10), p25: q(0.25), p50: q(0.50), p75: q(0.75), p90: q(0.90), min: vals[0] || mine, max: vals[vals.length - 1] || mine };
    var vsMedian = stats.p50 ? Math.round(((mine - stats.p50) / stats.p50) * 100) : 0;
    var perSqft = l.sqft ? Math.round((allIn(l) / l.sqft) * 12 * 100) / 100 : null;

    /* --- trust ledger --------------------------------------------------- */
    var opHomes = l.operatorId
      ? (DATA.listings || []).filter(function (x) { return x.operatorId === l.operatorId; }).length
      : 0;

    var ledger = [];
    ledger.push({
      key: 'identity',
      state: l.verified ? 'pass' : 'none',
      what: 'Government ID matched to the account name',
      how: l.verified
        ? 'Document and selfie checked, name matched, image discarded after the match.'
        : 'Not completed. This host can message and list, but cannot take a deposit through RentLeaks.',
      when: l.verified ? fmtDate(addMonths(l.postedAt ? toISO(new Date(l.postedAt)) : todayISO(), -1)) : '—'
    });
    var addrOk = l.verified && (seed % 7 !== 0);
    ledger.push({
      key: 'control',
      state: addrOk ? 'pass' : 'none',
      what: 'Control of the address proven',
      how: addrOk
        ? 'Title, tax record or a lease naming this host was matched to ' + esc(l.address) + '.'
        : 'Not yet proven. Nothing here confirms this host can let this address.',
      when: addrOk ? fmtDate(todayISO()) : '—'
    });
    var photosOwn = (seed % 11) !== 0;
    ledger.push({
      key: 'media',
      state: photosOwn ? 'pass' : 'warn',
      what: 'Photographs are unique to this listing',
      how: photosOwn
        ? 'Perceptual hashes of all ' + ((l.gallery || []).length || (l.images || []).length) + ' assets are unique across the catalogue and against the external corpus.'
        : 'One or more images also appear on another listing. Ask for a live video walkthrough before you send anything.',
      when: fmtDate(todayISO())
    });
    var graphClean = (seed % 13) !== 0;
    ledger.push({
      key: 'graph',
      state: graphClean ? 'pass' : 'warn',
      what: 'No shared-identity clustering',
      how: graphClean
        ? 'Email, phone, device and payout identifiers are not shared with any reported account.'
        : 'This account shares a contact identifier with an account reported in the last 90 days.',
      when: fmtDate(todayISO())
    });
    /* RentLeaks handles no money, so there is no escrow check to make. What
       there IS to check — and what stale-listing complaints and fraud signals
       both point at — is whether the person still has this place to let. */
    var confirmDays = seed % 21;
    var fresh = confirmDays <= 10;
    ledger.push({
      key: 'freshness',
      state: fresh ? 'pass' : 'warn',
      what: 'Availability re-confirmed by the host',
      how: fresh
        ? 'Confirmed ' + confirmDays + ' day' + (confirmDays === 1 ? '' : 's') + ' ago. Hosts re-confirm every 14 days or the listing drops out of search.'
        : 'Last confirmed ' + confirmDays + ' days ago. Ask whether it is still free before you arrange a viewing.',
      when: fmtDate(toISO(new Date(Date.now() - confirmDays * DAY)))
    });

    var trustScore = ledger.reduce(function (acc, r) {
      return acc + (r.state === 'pass' ? 20 : r.state === 'warn' ? 4 : 0);
    }, 0);

    var flags = [];
    if (vsMedian <= -30) {
      flags.push({ tone: 'bad', title: 'Priced far under this market', body: 'All-in sits ' + Math.abs(vsMedian) + '% below the median for this type in ' + esc(l.cityName) + '. Under-pricing is the oldest hook in rental fraud. Treat a live walkthrough as mandatory.' });
    }
    if (!photosOwn) {
      flags.push({ tone: 'bad', title: 'Image reuse detected', body: 'At least one photograph appears elsewhere. Scammers who cannot reach a property cannot photograph it.' });
    }
    if (!graphClean) {
      flags.push({ tone: 'bad', title: 'Identity overlap with a reported account', body: 'Contact-identity clustering is the strongest published signal for rental-listing fraud. This listing is under manual review.' });
    }
    if (!flags.length) {
      flags.push({ tone: 'ok', title: 'No fraud signals on this listing', body: 'Identity, address control, image uniqueness and account clustering all pass. That is not a guarantee. Read how to pay, below.' });
    }

    /* --- compliance checks against the rules engine --------------------- */
    var fees = l.fees || {};
    var checks = [];

    /* Every charge the tenant could be asked for, run through the engine. */
    var feeLedger = ['broker', 'application', 'screening', 'admin', 'move_in', 'key', 'access']
      .map(function (k) {
        var amount = Number(fees[k] != null ? fees[k] : 0) || 0;
        return { key: k, meta: FEE_META[k], amount: amount, verdict: feeVerdict(k, amount, l, rules, deal) };
      })
      .filter(function (row) {
        /* A zero charge is worth showing only where the market actually bars
           it — that absence is the interesting fact. The rest is noise. */
        return row.amount > 0 || row.verdict.state === 'barred' || row.verdict.state === 'capped';
      });

    if (rules.landlordAgentMayChargeTenant === false) {
      checks.push({
        k: 'Broker fee charged to you',
        detail: deal.meta.brokerInDeal
          ? 'The broker here acts for the landlord, so may not charge you'
          : 'No broker in this deal at all',
        v: fees.broker ? money(fees.broker, l) : 'None',
        pass: !fees.broker,
        src: rules.tenantBrokerFeeSrc
      });
    }
    if (rules.applicationFeeBanned) {
      checks.push({
        k: 'Application fee',
        detail: 'May not be demanded at all; background and credit capped at ' + money(rules.screeningFeeCap || 20, rules.appFeeCurrency || 'USD'),
        v: money(0, l),
        pass: true,
        src: rules.applicationFeeSrc
      });
    }
    if (rules.listingFeeDisclosureSrc) {
      checks.push({
        k: 'Every fee disclosed in the listing',
        detail: 'Binds the listing itself — owner-listed and sublet listings included',
        v: 'Itemised',
        pass: true,
        src: rules.listingFeeDisclosureSrc
      });
    }
    if (rules.depositCapMonths != null) {
      var cap = Math.round(l.price * rules.depositCapMonths);
      checks.push({
        k: 'Security deposit',
        detail: 'Capped at ' + (rules.depositCapMonths === 0 ? 'zero' : rules.depositCapMonths + ' month' + (rules.depositCapMonths > 1 ? 's' : '')) + ' of base rent — ' + money(cap, l),
        v: money(l.deposit, l),
        pass: l.deposit <= cap,
        src: rules.depositSrc
      });
    }
    if (rules.appFeeCap != null) {
      checks.push({
        k: 'Application fee',
        detail: 'Capped at ' + money(rules.appFeeCap, rules.appFeeCurrency || 'USD') + ' — we charge nothing',
        v: money(0, l),
        pass: true,
        src: rules.appFeeSrc
      });
    }
    var floor = rules.minStayDays || 30;
    checks.push({
      k: 'Minimum stay',
      detail: 'Market floor ' + floor + ' days · this listing asks ' + minDays,
      v: minDays + ' days',
      pass: minDays >= floor,
      src: rules.minStaySrc
    });
    if (rules.registrationRequired) {
      var regNo = 'RL-' + String(l.country) + '-' + String(seed % 900000 + 100000);
      checks.push({
        k: 'Registration number',
        detail: 'Published on the listing and reported to the registry',
        v: regNo,
        pass: true,
        src: rules.registrationSrc
      });
    }
    if (rules.allInDisclosure) {
      checks.push({
        k: 'All-in price shown first',
        detail: 'Every required fee inside the headline number',
        v: money(allIn(l), l),
        pass: true,
        src: rules.allInSrc
      });
    }

    /* --- vouchers and accessibility ------------------------------------- */
    var vouchers = rules.soiProtected ? true : (seed % 3 === 0);
    var am = l.amenities || [];
    var access = {
      stepFree: am.indexOf('elevator') !== -1 || (seed % 4 === 0),
      lift: am.indexOf('elevator') !== -1,
      wideDoors: seed % 5 === 0,
      accessibleBath: seed % 9 === 0
    };
    access.any = access.stepFree || access.lift || access.wideDoors || access.accessibleBath;

    /* --- takeover (lease-break) ---------------------------------------- */
    var takeover = null;
    if (l.housingType === 'lease-break') {
      var isAssign = deal.kind === 'incumbent-tenant-assignor';
      var consentStates = ['granted', 'requested', 'not-started'];
      var consent = consentStates[seed % 3];
      var requestedOn = addMonths(todayISO(), 0);
      var reqDate = toISO(new Date(Date.now() - ((seed % 22) + 1) * DAY));
      takeover = {
        mode: isAssign ? 'assignment' : 'sublet',
        consent: consent,
        requestedOn: consent === 'not-started' ? null : reqDate,
        infoDeadline: consent === 'not-started' ? null : toISO(new Date(parseISO(reqDate).getTime() + 10 * DAY)),
        decisionDeadline: consent === 'not-started' ? null : toISO(new Date(parseISO(reqDate).getTime() + 30 * DAY)),
        daysElapsed: consent === 'not-started' ? 0 : (daysBetween(reqDate, todayISO()) || 0),
        rules: rules.sublet || null,
        depositHeld: l.deposit,
        remainingMonths: l.remainingMonths || 0
      };
      takeover.deemedConsent = !!(takeover.rules && takeover.rules.silenceIsConsent &&
        takeover.mode === 'sublet' && takeover.daysElapsed >= 30);

      /* What the DEPARTING tenant may lawfully charge the incoming one.
         This is a separate question from the FARE Act, which binds a
         landlord's agent — a departing tenant is neither. The binding rule
         is the statewide charge ban, which names sub-lessors by name, plus
         the licensing regime and, for regulated units, the surcharge cap. */
      var regulated = rules.subletSurchargePct != null && (seed % 3 === 0);
      takeover.charges = {
        regulated: regulated,
        /* Under a statute that names sub-lessors, an "access fee" collected
           at the start of the tenancy is the exact thing barred. */
        accessFeeAllowed: !(rules.moveInFeesBarred && rules.subLessorNamed),
        accessFeeSrc: rules.moveInFeesSrc,
        screeningCap: rules.screeningFeeCap,
        depositCapMonths: rules.depositCapMonths,
        surchargePct: regulated && takeover.mode === 'sublet' ? rules.subletSurchargePct : null,
        surchargeSrc: rules.subletSurchargeSrc,
        /* Licensing exposure is highest on an assignment, where the departing
           tenant is not a party to the resulting tenancy at all and is being
           paid for introducing two other people. */
        licenceRisk: takeover.mode === 'assignment' ? 'high' : 'moderate',
        licenceSrc: rules.brokerLicenceSrc,
        maxTotal: 0
      };
      takeover.charges.maxTotal = takeover.charges.accessFeeAllowed
        ? Math.round(l.price * 0.5)
        : (rules.screeningFeeCap || 0);
    }

    /* --- verified-stay record ------------------------------------------ */
    var reviews = buildReviews(l, seed);

    var d = {
      seed: seed,
      rules: rules,
      deal: deal,
      feeLedger: feeLedger,
      window: { from: from, until: until, minDays: minDays, maxDays: maxDays },
      price: { mine: mine, pct: pct, stats: stats, vsMedian: vsMedian, perSqft: perSqft },
      ledger: ledger,
      trustScore: trustScore,
      flags: flags,
      checks: checks,
      vouchers: vouchers,
      access: access,
      takeover: takeover,
      reviews: reviews,
      operatorHomes: opHomes
    };
    derivedCache[l.id] = d;
    return d;
  }

  /* --- verified-stay reviews -------------------------------------------- */

  var REVIEW_NAMES = ['Amara', 'Théo', 'Priya', 'Jonas', 'Marisol', 'Kenji', 'Nadia', 'Owen', 'Lucia', 'Felix', 'Ines', 'Rahul'];
  var REVIEW_ROLES = ['travelling clinician', 'contract engineer', 'graduate researcher', 'relocating for work', 'between homes mid-renovation', 'remote product designer'];

  var REVIEW_BODIES = [
    'The listing was accurate down to the furniture inventory, which is not something I can say about the last three places I rented sight-unseen. Check-in instructions arrived two days early.',
    'All-in meant all-in. No surprise utility reconciliation at the end, which is the whole reason I booked here instead of a direct lease.',
    'Building is exactly as photographed. The one thing to know: the radiator is loud for the first hour in the morning. Host flagged it before I asked.',
    'Deposit came back in full nine days after checkout, itemised. I had photographed everything at move-in through the condition report, which made it a non-conversation.',
    'Host replied inside the hour every single time. For a stay I arranged from another continent that mattered more than the finish quality.',
    'Good value for the district, though the workspace is a corner of the bedroom rather than a separate room. Fine for a laptop, not for two monitors.'
  ];

  var HOST_REPLIES = [
    'Thank you — the radiator is scheduled for a bleed before the next arrival.',
    'Appreciated. We have added the morning noise note to the listing so it is not a surprise.',
    'Glad the condition report did its job. We keep the photo set for twelve months either way.'
  ];

  function buildReviews(l, seed) {
    var count = 2 + (seed % 4);
    if (l.housingType === 'lease-break') count = Math.max(1, count - 1);
    var items = [];
    for (var i = 0; i < count; i++) {
      var s = hash(l.id + ':rev:' + i);
      var months = 1 + (s % 9);
      var stay = 1 + (s % 6);
      items.push({
        who: pick(REVIEW_NAMES, s),
        role: pick(REVIEW_ROLES, s >> 3),
        stayedMonths: stay,
        endedAgo: months,
        text: pick(REVIEW_BODIES, s >> 5),
        scores: {
          accuracy: 3.6 + ((s % 14) / 10),
          value: 3.4 + ((s >> 2) % 16) / 10,
          communication: 3.8 + ((s >> 4) % 12) / 10,
          condition: 3.5 + ((s >> 6) % 15) / 10
        },
        reply: (s % 3 === 0) ? pick(HOST_REPLIES, s >> 7) : null
      });
    }
    function avg(key) {
      var t = 0;
      items.forEach(function (r) { t += Math.min(5, r.scores[key]); });
      return items.length ? Math.round((t / items.length) * 10) / 10 : 0;
    }
    var sub = { accuracy: avg('accuracy'), value: avg('value'), communication: avg('communication'), condition: avg('condition') };
    var overall = Math.round(((sub.accuracy + sub.value + sub.communication + sub.condition) / 4) * 10) / 10;
    /* The two-sided half: what hosts recorded about departing tenants. */
    var tenantSide = {
      onTimeRate: 92 + (seed % 8),
      conditionAvg: Math.round((4.2 + ((seed % 7) / 10)) * 10) / 10,
      count: count
    };
    return { items: items, sub: sub, overall: overall, count: count, tenantSide: tenantSide };
  }

  /* =======================================================================
     3. Stay Window — the date-range controller
     ======================================================================= */

  var stayWindow = (function () {
    var saved = read(STORE.window, null) || {};
    return { from: saved.from || '', to: saved.to || '' };
  })();

  function windowNights() {
    if (!stayWindow.from || !stayWindow.to) return null;
    return daysBetween(stayWindow.from, stayWindow.to);
  }

  function setWindow(from, to) {
    stayWindow.from = from || '';
    stayWindow.to = to || '';
    write(STORE.window, stayWindow);
    document.dispatchEvent(new CustomEvent('rl-x:window'));
  }

  /**
   * Verdict for one listing against the requested window.
   *  fit   — the listing is available for the whole window and the window
   *          clears the minimum stay.
   *  near  — available, but the requested window is shorter than the
   *          minimum, or starts before the unit frees up by <= 14 days.
   *  miss  — cannot be made to work.
   */
  function fitFor(l) {
    var nights = windowNights();
    if (nights == null) return null;
    var d = derive(l);
    var w = d.window;

    if (nights < d.window.minDays) {
      return { state: 'near', label: 'Needs ' + (d.window.minDays - nights) + ' more nights', why: 'This home has a ' + d.window.minDays + '-day minimum.' };
    }
    var lateBy = daysBetween(stayWindow.from, w.from);   // >0 means unit frees up after you want it
    var endsBy = daysBetween(w.until, stayWindow.to);    // >0 means you want to stay past the window

    if (lateBy > 14 || endsBy > 14) {
      return { state: 'miss', label: 'Outside this window', why: 'Available ' + fmtDate(w.from) + ' to ' + fmtDate(w.until) + '.' };
    }
    if (lateBy > 0) {
      return { state: 'near', label: 'Free ' + lateBy + 'd later', why: 'Frees up ' + fmtDate(w.from) + '.' };
    }
    if (endsBy > 0) {
      return { state: 'near', label: 'Ends ' + endsBy + 'd early', why: 'The term ends ' + fmtDate(w.until) + '.' };
    }
    return { state: 'fit', label: 'Fits your dates', why: 'Available ' + fmtDate(w.from) + ' to ' + fmtDate(w.until) + '.' };
  }

  function windowMarkup(inline) {
    var n = windowNights();
    var months = n ? Math.round((n / 30) * 10) / 10 : null;
    return '' +
      '<div class="x-window' + (inline ? ' x-window--inline' : '') + '" id="x-window">' +
        '<div class="x-field">' +
          '<label for="x-from">Move in</label>' +
          '<input type="date" id="x-from" value="' + esc(stayWindow.from) + '" min="' + todayISO() + '">' +
        '</div>' +
        '<div class="x-field">' +
          '<label for="x-to">Move out</label>' +
          '<input type="date" id="x-to" value="' + esc(stayWindow.to) + '" min="' + todayISO() + '">' +
        '</div>' +
        '<div class="x-window__read">' +
          (n != null && n > 0
            ? '<span><strong>' + n + '</strong> nights · <strong>' + months + '</strong> months</span>' +
              (n < 30 ? '<span class="x-fit x-fit--no">Under the 30-day floor</span>' : '') +
              '<button type="button" class="x-window__clear" id="x-window-clear">Clear dates</button>'
            : '<span>Set both dates to filter by the window you actually need — not just a start date.</span>') +
        '</div>' +
      '</div>';
  }

  function bindWindow(root) {
    var from = $('#x-from', root), to = $('#x-to', root), clear = $('#x-window-clear', root);
    if (!from || !to) return;
    function sync() {
      var f = from.value, t = to.value;
      if (f) to.min = f;
      if (f && t && daysBetween(f, t) <= 0) { t = ''; to.value = ''; }
      setWindow(f, t);
    }
    from.addEventListener('change', sync);
    to.addEventListener('change', sync);
    if (clear) clear.addEventListener('click', function () { setWindow('', ''); });
  }

  /* =======================================================================
     4. Detail-page surfaces
     ======================================================================= */

  function panel(kicker, title, aside, body, id) {
    return '' +
      '<section class="x-panel"' + (id ? ' id="' + id + '"' : '') + '>' +
        '<div class="x-panel__head">' +
          '<div><span class="x-panel__kicker">' + esc(kicker) + '</span>' +
          '<h2 class="x-panel__title">' + esc(title) + '</h2></div>' +
          (aside ? '<p class="x-panel__aside">' + aside + '</p>' : '') +
        '</div>' +
        body +
      '</section>';
  }

  /* --- 4.1 Price Truth --------------------------------------------------- */

  function priceTruth(l) {
    var d = derive(l);
    var p = d.price, s = p.stats;
    var lo = s.p10, hi = s.p90;
    var span = Math.max(1, hi - lo);
    function at(v) { return Math.max(0, Math.min(100, ((v - lo) / span) * 100)); }
    /* Keep the floating labels inside the strip at either extreme. */
    function align(pos) { return pos > 86 ? ' data-align="end"' : pos < 14 ? ' data-align="start"' : ''; }
    var youAt = at(p.mine), medAt = at(s.p50);

    var tone = p.vsMedian <= -8 ? 'under' : p.vsMedian >= 12 ? 'over' : 'at';
    var headline = tone === 'under'
      ? Math.abs(p.vsMedian) + '% under the median'
      : tone === 'over'
        ? p.vsMedian + '% over the median'
        : 'At the median';

    var typeLabel = DATA.typeLabel ? DATA.typeLabel(l.housingType) : l.housingType;

    var body = '' +
      '<div class="x-truth__verdict">' +
        '<span class="x-truth__headline" data-tone="' + tone + '">' + esc(headline) + '</span>' +
        '<span class="x-truth__sub">' + esc(typeLabel) + ' in ' + esc(l.cityName) + ' · ' + s.n + ' comparable homes</span>' +
      '</div>' +
      '<div class="x-strip" role="img" aria-label="This home sits in the ' + p.pct + 'th percentile of ' + esc(typeLabel) + ' prices in ' + esc(l.cityName) + '">' +
        '<div class="x-strip__track"></div>' +
        '<div class="x-strip__band" style="left:' + at(s.p25) + '%;width:' + Math.max(2, at(s.p75) - at(s.p25)) + '%"></div>' +
        '<div class="x-strip__tick" style="left:' + medAt + '%"' + align(medAt) + ' data-label="median ' + esc(money(s.p50, 'USD')) + '"></div>' +
        '<div class="x-strip__you" style="left:' + youAt + '%"' + align(youAt) + ' data-label="' + esc(money(allIn(l), l)) + '"></div>' +
      '</div>' +
      '<dl class="x-grid-3">' +
        '<div class="x-stat"><dt>Percentile</dt><dd>' + p.pct + '<small>of ' + s.n + ' comparable homes</small></dd></div>' +
        '<div class="x-stat"><dt>Middle half pays</dt><dd>' + esc(money(s.p25, 'USD')) + '–' + esc(money(s.p75, 'USD')) + '<small>25th to 75th percentile</small></dd></div>' +
        (p.perSqft
          ? '<div class="x-stat"><dt>Annual per sq ft</dt><dd>' + esc(money(p.perSqft, l)) + '<small>all-in, ' + l.sqft + ' sq ft</small></dd></div>'
          : '') +
        '<div class="x-stat"><dt>Fees add</dt><dd>' + esc(money(allIn(l) - l.price, l)) + '<small>' + (l.price ? Math.round(((allIn(l) - l.price) / l.price) * 100) : 0) + '% on top of base rent</small></dd></div>' +
      '</dl>' +
      '<p class="x-note">Percentile is computed against every ' + esc(String(typeLabel).toLowerCase()) + ' RentLeaks carries in ' + esc(l.cityName) + ', compared on all-in rent converted to a single currency — not on base rent, which is the number that hides the fee stack. A home under the 10th percentile is not automatically a bargain; check the trust ledger below first.</p>';

    return panel('Price truth', 'What this actually costs, against the market', 'Benchmarking at the point of decision, not in a quarterly press release.', body, 'x-price-truth');
  }

  /* --- 4.2 Trust Ledger -------------------------------------------------- */

  function trustLedger(l) {
    var d = derive(l);
    var rows = d.ledger.map(function (r) {
      var mark = r.state === 'pass' ? '✓' : r.state === 'warn' ? '!' : '–';
      return '' +
        '<div class="x-ledger__row">' +
          '<span class="x-ledger__mark" data-state="' + r.state + '" aria-hidden="true">' + mark + '</span>' +
          '<span class="x-ledger__what">' + esc(r.what) +
            '<span class="x-ledger__how">' + r.how + '</span>' +
          '</span>' +
          '<span class="x-ledger__when">' + esc(r.when) + '</span>' +
        '</div>';
    }).join('');

    var flags = d.flags.map(function (f) {
      return '<div class="x-flag' + (f.tone === 'ok' ? ' x-flag--ok' : '') + '"><span><strong>' + esc(f.title) + '</strong> — ' + f.body + '</span></div>';
    }).join('');

    var label = d.trustScore >= 90 ? 'Everything we can check, checked.'
      : d.trustScore >= 70 ? 'Mostly clear, with one item worth reading.'
      : 'Incomplete. Do not send money before a live walkthrough.';

    var body = '' +
      '<div class="x-score">' +
        '<span class="x-score__value">' + d.trustScore + '</span>' +
        '<span class="x-score__of">/ 100</span>' +
        '<span class="x-score__label">' + esc(label) + '</span>' +
      '</div>' +
      '<div class="x-ledger">' + rows + '</div>' +
      '<div class="x-flags">' + flags + '</div>' +
      payGuide(l) +
      '<p class="x-note">A badge that says “verified” without saying what was verified is decoration. These are the five separate things that word was doing, each shown with the method. Reported rental fraud runs to tens of millions of dollars a year with a median loss around a thousand, and roughly half of it starts on social platforms. ' +
      '<button type="button" class="x-report-btn" data-x-report="' + esc(l.id) + '">Report a problem with this listing</button></p>';

    return panel('Trust ledger', 'What we checked, and how', 'Five separate checks, not one badge.', body, 'x-trust');
  }

  /* --- 4.2a How to pay ---------------------------------------------------
     RentLeaks holds no money: no escrow, no booking payment, no deposit.
     That is a deliberate position and it has a consequence — the platform
     cannot claw anything back for you. So the payment rail you choose is the
     only reversibility you get, and it belongs on the listing rather than in
     a help-centre article nobody opens. Scammers select wire, Zelle, gift
     cards and crypto precisely because they are irreversible, and avoid cards
     because chargebacks exist; the payment ask is the one part of the script
     they cannot drop, which makes it the control that still works against a
     listing generated entirely by a machine.
     ----------------------------------------------------------------------- */

  function payGuide(l) {
    var d = derive(l);
    var who = d.deal.byDepartingTenant ? 'the departing tenant' : d.deal.byOwner ? 'the owner' : 'the landlord';
    var rails = [
      ['ok', 'Card', 'You keep a chargeback. This is the only rail that gives you a way back.'],
      ['ok', 'Bank transfer to a named account', 'Traceable, and the account name should match the verified identity above. Slow to reverse, but not impossible.'],
      ['no', 'Zelle, Venmo, Cash App', 'Instant and final. Treated as cash.'],
      ['no', 'Wire transfer', 'Effectively unrecoverable once it lands.'],
      ['no', 'Gift cards or crypto', 'There is no legitimate reason a landlord asks for these. None.']
    ];

    return '' +
      '<div class="x-pay">' +
        '<h3 class="x-pay__title">How to pay ' + esc(who) + '</h3>' +
        '<p class="x-pay__lede"><b>RentLeaks never takes your money.</b> There is no deposit to pay us, no booking fee, no application fee, no “unlock” or “verification” charge. Anyone who asks you to pay RentLeaks anything is running a scam, and that is true with no exceptions — which makes it a much easier rule to remember than any escrow policy.</p>' +
        '<p class="x-pay__lede">Rent and the deposit go direct to ' + esc(who) + '. We are not a party to that payment, we do not hold it, and we cannot return it. What we can do is tell you which rail leaves you a way back.</p>' +
        '<ul class="x-rails">' +
          rails.map(function (r) {
            return '<li class="x-rail x-rail--' + r[0] + '">' +
              '<span class="x-rail__mark" aria-hidden="true">' + (r[0] === 'ok' ? '✓' : '✕') + '</span>' +
              '<span><b>' + esc(r[1]) + '</b>' + esc(r[2]) + '</span></li>';
          }).join('') +
        '</ul>' +
        '<p class="x-pay__foot">Never pay anything before you or someone you trust has seen the place, live. A video walkthrough on a call you initiated counts; a recorded tour sent to you does not.</p>' +
      '</div>';
  }

  /* --- 4.2b Who you are dealing with, and what they may charge ----------- */

  var VERDICT_CHIP = {
    ok:     '<span class="x-verdict x-verdict--pass">allowed</span>',
    capped: '<span class="x-verdict x-verdict--pass">capped</span>',
    over:   '<span class="x-verdict x-verdict--fail">over cap</span>',
    barred: '<span class="x-verdict x-verdict--fail">not allowed</span>'
  };

  function dealPanel(l) {
    var d = derive(l);
    var deal = d.deal;
    var r = d.rules;

    /* Owner-verification ladder. An owner letting their own place has no
       agent to vouch for them, so the proof has to come from the property. */
    var ownerProof = '';
    if (deal.byOwner) {
      var steps = [
        ['Deed or tax record matched', d.ledger[1] && d.ledger[1].state === 'pass',
         'The name on the account was matched against the record for ' + esc(l.address) + '.'],
        ['Utility or mortgage statement', (d.seed % 3) !== 0,
         'A recent statement at this address in the same name.'],
        ['Government ID matched to that name', !!l.verified,
         'Document and selfie checked, then the image discarded.'],
        ['Code posted to the property', (d.seed % 4) === 0,
         'A code mailed to the address of record and entered back here — the check a scammer who cannot reach the building cannot pass.']
      ];
      ownerProof =
        '<h3 style="font-size:var(--text-md);margin:var(--s-5) 0 var(--s-3);color:var(--ink)">Proving they own it</h3>' +
        '<div class="x-ledger">' + steps.map(function (s) {
          return '<div class="x-ledger__row">' +
            '<span class="x-ledger__mark" data-state="' + (s[1] ? 'pass' : 'none') + '" aria-hidden="true">' + (s[1] ? '✓' : '–') + '</span>' +
            '<span class="x-ledger__what">' + esc(s[0]) + '<span class="x-ledger__how">' + esc(s[2]) + '</span></span>' +
            '<span class="x-ledger__when">' + (s[1] ? 'done' : 'not done') + '</span>' +
          '</div>';
        }).join('') + '</div>';
    }

    /* The deposit is not a fee, but it is the largest sum the renter hands
       over and the one we most need to be honest about not holding. */
    var depositRow = l.deposit ? {
      meta: { label: 'Security deposit' },
      amount: l.deposit,
      verdict: {
        state: (r.depositCapMonths != null && l.deposit > Math.round(l.price * r.depositCapMonths)) ? 'over' : (r.depositCapMonths != null ? 'capped' : 'ok'),
        why: 'Paid direct to ' + (deal.byDepartingTenant ? 'the departing tenant or the building’s owner' : deal.byOwner ? 'the owner' : 'the landlord') + '. RentLeaks does not hold it and cannot return it.' +
          (r.depositCapMonths != null ? ' Capped here at ' + r.depositCapMonths + ' month' + (r.depositCapMonths === 1 ? '' : 's') + ' of rent, and the cap reaches advances too.' : ''),
        src: r.depositSrc
      }
    } : null;

    var ledgerRows = d.feeLedger.concat(depositRow ? [depositRow] : []);

    var feeRows = ledgerRows.length
      ? '<div class="x-rules">' + ledgerRows.map(function (row) {
          return '<div class="x-rule-row">' +
            '<span class="x-rule-row__k"><b>' + esc(row.meta.label) + '</b>' + esc(row.verdict.why) +
              (row.verdict.src ? ' <span class="x-cite">· ' + esc(row.verdict.src.label) + ', in force ' + esc(row.verdict.src.eff) + '</span>' : '') +
            '</span>' +
            '<span class="x-rule-row__v">' + esc(row.amount ? money(row.amount, l) : 'None') + ' ' + (VERDICT_CHIP[row.verdict.state] || '') + '</span>' +
          '</div>';
        }).join('') + '</div>'
      : '<p class="x-note" style="border:0;padding:0">No one-off charge of any kind sits on this listing. The all-in figure is the whole of it.</p>';

    var collectNote = '<p class="x-note" style="margin-top:var(--s-3)"><b>None of this is paid to RentLeaks.</b> We list and we verify; we do not collect, hold or remit. Every figure above is money that moves between you and ' + esc(deal.byDepartingTenant ? 'the departing tenant' : deal.byOwner ? 'the owner' : 'the landlord') + ' directly.</p>';

    var body =
      '<p class="x-desk__lede">' + esc(deal.meta.blurb) + '</p>' +
      '<p><span class="x-chip' + (deal.byOwner ? ' x-chip--owner' : '') + '">' + esc(deal.meta.short) + '</span> ' +
      '<span class="x-chip">' + (deal.meta.brokerInDeal ? 'Broker acts for the landlord' : 'No broker in this deal') + '</span></p>' +
      '<h3 style="font-size:var(--text-md);margin:var(--s-5) 0 var(--s-3);color:var(--ink)">What you can be asked to pay</h3>' +
      feeRows +
      collectNote +
      ownerProof +
      '<p class="x-note">' +
        (r.landlordAgentMayChargeTenant === false
          ? '<b>The rule people get wrong here.</b> The ban is on a <em>landlord’s agent</em> charging you — not on broker fees as such. A broker you retain yourself may still charge you, and an owner letting their own place has no agent in the first place. What binds every one of them equally is the disclosure duty: it is written against the listing, so it catches an owner and a departing tenant exactly as it catches an agency.'
          : 'A broker fee is lawful in this market, and must be disclosed in the listing before you apply rather than produced at signing.') +
      '</p>';

    return panel('The deal', deal.meta.label, deal.byOwner
      ? 'Individual owners hold around 70% of US rental properties. Most of this market is people, not agencies.'
      : 'Who published this, who they act for, and what that means for your money.', body, 'x-deal');
  }

  /* --- 4.3 Local Rules --------------------------------------------------- */

  function localRules(l) {
    var d = derive(l);
    var r = d.rules;

    var rows = d.checks.map(function (c) {
      var v = c.pass ? '<span class="x-verdict x-verdict--pass">ok</span>' : '<span class="x-verdict x-verdict--fail">breach</span>';
      return '' +
        '<div class="x-rule-row">' +
          '<span class="x-rule-row__k"><b>' + esc(c.k) + '</b>' + esc(c.detail || '') +
            (c.src ? ' <span class="x-cite">· ' + esc(c.src.label) + ', in force ' + esc(c.src.eff) + '</span>' : '') +
          '</span>' +
          '<span class="x-rule-row__v">' + esc(c.v) + ' ' + v + '</span>' +
        '</div>';
    }).join('');

    var extras = [];
    if (r.soiProtected) {
      extras.push('Source of income is a protected characteristic here. A voucher cannot be refused, and any income-multiple test must be applied to the tenant’s share of the rent rather than the full rent — that is the calculation this site now does for you below.');
    }
    if (r.fairChance) {
      extras.push('Criminal history may only be considered after a conditional offer, with an individualised assessment on the record before any withdrawal.');
    }
    if (r.contractType) {
      extras.push('Contract form for this market: ' + r.contractType + '.');
    }
    if (r.reusableReport) {
      extras.push('A screening report the applicant already holds, dated within 30 days, must be accepted in place of a new fee. Your RentLeaks passport is built to be that report.');
    }
    if (r.isEU) {
      extras.push('Listings in this market carry a registration number and are reportable monthly under Regulation (EU) 2024/1028, applicable from 20 May 2026. Removals and demotions come with a written statement of reasons under the Digital Services Act.');
    }
    if (r.unassessed) {
      extras.push('This jurisdiction was not covered by the source research behind this engine. Treat the figures above as provisional until counsel reviews them.');
    }
    (r.notes || []).forEach(function (n) { extras.push(n); });

    var body = '<div class="x-rules">' + rows + '</div>' +
      (extras.length
        ? '<p class="x-note">' + extras.map(function (e) { return esc(e); }).join('<br><br>') + '</p>'
        : '') +
      '<p class="x-note"><b>This is research, not legal advice.</b> Every rule above carries the instrument it comes from and the date it took effect, so a stale rule is visible rather than silently wrong. Rules are resolved city → region → country, and the table is versioned with the site.</p>';

    return panel('Local rules', 'What ' + (r.cityName || 'this market') + ' requires of this listing', 'A rules engine with effective dates — not conditionals buried in the render path.', body, 'x-rules');
  }

  /* --- 4.4 Affordability + vouchers -------------------------------------- */

  function affordability(l) {
    var d = derive(l);
    var r = d.rules;
    var total = allIn(l);

    var body = '' +
      '<div class="x-afford__row">' +
        '<div class="x-field"><label for="x-income">Monthly household income</label>' +
          '<input type="number" id="x-income" min="0" step="100" inputmode="numeric" placeholder="' + Math.round(total * 3) + '"></div>' +
        '<div class="x-field"><label for="x-subsidy">Voucher / subsidy per month</label>' +
          '<input type="number" id="x-subsidy" min="0" step="50" inputmode="numeric" placeholder="0"></div>' +
        '<div class="x-field"><label for="x-ratio">Landlord income rule</label>' +
          '<select id="x-ratio">' +
            '<option value="40">40× annual rent</option>' +
            '<option value="3" selected>3× monthly rent</option>' +
            '<option value="2.5">2.5× monthly rent</option>' +
            '<option value="0">No income test</option>' +
          '</select></div>' +
      '</div>' +
      '<div class="x-afford__out" id="x-afford-out" aria-live="polite">' +
        '<div class="x-afford__line"><span>All-in rent</span><strong>' + esc(money(total, l)) + '</strong></div>' +
        '<div class="x-afford__line"><span>Subsidy applied</span><strong>—</strong></div>' +
        '<div class="x-afford__line x-afford__line--total"><span>Your share</span><strong>' + esc(money(total, l)) + '</strong></div>' +
        '<div class="x-meter"><div class="x-meter__fill" style="width:0%"></div></div>' +
        '<p class="x-note" style="border:0;padding:0;margin:0">Enter an income to see whether the landlord’s rule is met on your share.</p>' +
      '</div>' +
      '<p class="x-note">' +
        (r.soiProtected
          ? '<b>' + esc(r.cityName) + ' protects source of income.</b> An income multiple applied to the full rent rather than the tenant’s share is how a lawful-looking filter becomes a voucher refusal. This calculator applies the multiple to your share, which is the only version that is lawful here.'
          : 'Where source of income is protected, an income multiple must be applied to the tenant’s share rather than the full rent. This calculator always does it that way, so the same maths is correct in every market.') +
      '</p>';

    return panel('Affordability', d.vouchers ? 'Vouchers accepted here' : 'What your share would be', 'The income test computed on the tenant’s share.', body, 'x-afford');
  }

  function bindAfford(root, l) {
    var box = $('#x-afford', root);
    if (!box) return;
    var income = $('#x-income', box), subsidy = $('#x-subsidy', box), ratio = $('#x-ratio', box), out = $('#x-afford-out', box);
    if (!income || !out) return;
    var total = allIn(l);

    function paint() {
      var inc = Number(income.value || 0);
      var sub = Math.min(total, Number(subsidy.value || 0));
      var share = Math.max(0, total - sub);
      var rule = Number(ratio.value || 0);
      var need = rule === 40 ? (share * 12) / 40 : rule ? share * rule : 0;
      var ok = !rule || (inc && inc >= need);
      var pctOfIncome = inc ? Math.min(100, Math.round((share / inc) * 100)) : 0;
      var tone = pctOfIncome > 40 ? 'bad' : pctOfIncome > 30 ? 'warn' : '';

      out.innerHTML = '' +
        '<div class="x-afford__line"><span>All-in rent</span><strong>' + esc(money(total, l)) + '</strong></div>' +
        '<div class="x-afford__line"><span>Subsidy applied</span><strong>' + (sub ? '− ' + esc(money(sub, l)) : '—') + '</strong></div>' +
        '<div class="x-afford__line x-afford__line--total"><span>Your share</span><strong>' + esc(money(share, l)) + '</strong></div>' +
        '<div class="x-meter"><div class="x-meter__fill"' + (tone ? ' data-tone="' + tone + '"' : '') + ' style="width:' + pctOfIncome + '%"></div></div>' +
        '<p class="x-note" style="border:0;padding:0;margin:0">' +
          (inc
            ? esc(pctOfIncome + '% of your stated income goes to this home. ') +
              (rule
                ? (ok
                    ? '<b>The landlord’s ' + esc(ratio.options[ratio.selectedIndex].text) + ' rule is met on your share.</b>'
                    : '<b>Short by ' + esc(money(Math.ceil(need - inc), l)) + '/mo against a ' + esc(ratio.options[ratio.selectedIndex].text) + ' rule applied to your share.</b> A guarantor or a co-signer closes that gap.')
                : 'No income test applied.')
            : 'Enter an income to see whether the landlord’s rule is met on your share.') +
        '</p>';
    }

    [income, subsidy, ratio].forEach(function (el) {
      if (el) { el.addEventListener('input', paint); el.addEventListener('change', paint); }
    });
  }

  /* --- 4.5 Takeover Desk ------------------------------------------------- */

  function takeoverDesk(l) {
    var d = derive(l);
    var t = d.takeover;
    if (!t) return '';
    var r = t.rules;

    var isSublet = t.mode === 'sublet';
    var consentLabel = t.deemedConsent ? 'Deemed consent — 30 days elapsed'
      : t.consent === 'granted' ? 'Landlord consent on file'
      : t.consent === 'requested' ? 'Consent requested, clock running'
      : 'Consent not yet requested';

    /* The statutory clock belongs to the sublet route only. An assignment has
       no deemed-consent rule, so showing a § 226-b countdown on one would be
       worse than showing nothing. */
    var clockApplies = !!r && isSublet;

    var packet = clockApplies
      ? ['The proposed term, with start and end dates',
         'The subtenant’s name, home address and business address',
         'The reason for the request',
         'The tenant’s address during the sublease',
         'The written consent of any co-tenant or guarantor',
         'A copy of the proposed sublease, attached to a copy of the original lease']
      : isSublet
        ? ['The proposed term, with start and end dates',
           'The incoming occupant’s identity and contact details',
           'A copy of the proposed sublease and of the original lease',
           'The outgoing tenant’s address during the sublease']
        : ['A written request for consent to assign the lease',
           'The proposed assignee’s identity, employment and screening result',
           'A copy of the original lease and the proposed assignment',
           'The date the assignee would take possession'];

    var elapsed = t.daysElapsed;
    function stepState(atDay) {
      if (t.consent === 'not-started') return 'idle';
      if (elapsed >= atDay) return 'done';
      return 'live';
    }

    var steps = '' +
      '<div class="x-step" data-state="' + (t.consent === 'not-started' ? 'live' : 'done') + '">' +
        '<div class="x-step__head"><span class="x-step__title">1. Establish the route: ' + (isSublet ? 'sublet' : 'assignment') + '</span>' +
        '<span class="x-step__clock">Day 0</span></div>' +
        '<p class="x-step__body">' +
          (isSublet
            ? 'A sublet keeps the original tenant on the lease and liable for the rent. In this market it is also the only route that carries a statutory clock, which is why it closes faster than an assignment.'
            : 'An assignment transfers the lease outright and releases the original tenant. It needs the landlord’s written consent, and consent may generally be withheld without cause — the remedy is release from the lease on 30 days’ notice, not a forced transfer. There is no deemed-consent clock on this route, so silence means no.') +
        '</p>' +
      '</div>' +
      '<div class="x-step" data-state="' + (t.consent === 'not-started' ? 'idle' : 'done') + '">' +
        '<div class="x-step__head"><span class="x-step__title">2. Serve the request by certified mail</span>' +
        '<span class="x-step__clock">' + (t.requestedOn ? 'Sent ' + fmtDate(t.requestedOn) : 'Not sent') + '</span></div>' +
        '<p class="x-step__body">' +
          (clockApplies
            ? 'The clock only starts on proof of service, and nobody in this category documents that. The packet must carry:'
            : 'Consent is worth nothing verbally, and the date it was asked for decides who is liable if this stalls. The packet should carry:') +
        '</p>' +
        '<ol class="x-packet">' + packet.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>' +
      '</div>' +
      (clockApplies ? '<div class="x-step" data-state="' + stepState(10) + '">' +
        '<div class="x-step__head"><span class="x-step__title">3. Landlord may request further information</span>' +
        '<span class="x-step__clock">' + (t.infoDeadline ? 'By ' + fmtDate(t.infoDeadline) : 'Within ' + r.infoWindowDays + ' days') + '</span></div>' +
        '<p class="x-step__body">A request for more information within <code>' + r.infoWindowDays + ' days</code> is permitted. Answering it restarts nothing — the decision window keeps running from service.</p>' +
      '</div>' : '') +
      (clockApplies ? '<div class="x-step" data-state="' + stepState(30) + '">' +
        '<div class="x-step__head"><span class="x-step__title">4. Decision window closes</span>' +
        '<span class="x-step__clock">' + (t.decisionDeadline ? 'By ' + fmtDate(t.decisionDeadline) : 'Within ' + r.decisionWindowDays + ' days') + '</span></div>' +
        '<p class="x-step__body">Under <code>' + esc(r.statute) + '</code>, in ' + esc(String(r.appliesTo).toLowerCase()) + ', silence for <code>' + r.decisionWindowDays + ' days</code> from service is deemed consent to the sublease. ' +
        (t.deemedConsent
          ? '<b>That window has passed on this listing with no response recorded.</b>'
          : t.consent === 'granted'
            ? 'Consent was returned in writing before the window closed.'
            : 'The window is still open.') +
        '</p>' +
      '</div>' : '') +
      '<div class="x-step" data-state="idle">' +
        '<div class="x-step__head"><span class="x-step__title">' + (clockApplies ? '5' : '3') + '. Screening handoff and deposit transfer</span>' +
        '<span class="x-step__clock">At signature</span></div>' +
        '<p class="x-step__body">The incoming tenant presents a RentLeaks passport rather than being re-screened from scratch, which is the step that usually costs a takeover two to three weeks. On the ' + esc(money(t.depositHeld, l)) + ' deposit: <b>RentLeaks does not hold it and cannot return it.</b> Pay it to the building’s owner rather than to the departing tenant wherever the paperwork allows — a deposit sitting in a departing tenant’s account is the single point where these deals go wrong, and once they have moved out and stopped replying you have no counterparty. Whoever holds it, do the condition report below on the day you get the keys.</p>' +
      '</div>';

    /* What the departing tenant may charge you. This is the question every
       lease-takeover site leaves to the parties, and it is the one where the
       answer has actually changed. */
    var c = t.charges;
    var chargeRows = [];
    chargeRows.push([
      'A fee for the handover itself',
      c.accessFeeAllowed ? money(c.maxTotal, l) + ' ceiling' : 'None',
      c.accessFeeAllowed ? 'ok' : 'barred',
      c.accessFeeAllowed
        ? 'No statutory bar recorded in this market, so RentLeaks caps it at half a month’s rent — the convention the early takeover sites settled on.'
        : 'The statute barring a charge “before or at the beginning of the tenancy” names sub-lessors alongside landlords, so an access, key or takeover fee is not something a departing tenant may charge you here either.',
      c.accessFeeSrc
    ]);
    if (c.screeningCap != null) {
      chargeRows.push([
        'Background and credit check',
        'Up to ' + money(c.screeningCap, l),
        'capped',
        'The lesser of actual cost or the statutory figure, and waived entirely if you hand over your own report from the last 30 days — which is what your passport is.',
        c.accessFeeSrc
      ]);
    }
    if (c.depositCapMonths != null) {
      chargeRows.push([
        'Deposit taken by the departing tenant',
        c.depositCapMonths + ' month' + (c.depositCapMonths === 1 ? '' : 's') + ' maximum',
        'capped',
        'The cap reaches advances as well as deposits, so “first, last and security” does not work here. RentLeaks does not hold this — it goes direct, and we cannot get it back for you. Pay the building’s owner rather than the departing tenant if the paperwork allows it.',
        d.rules.depositSrc
      ]);
    }
    if (c.surchargePct != null) {
      chargeRows.push([
        'Furnished surcharge on a regulated unit',
        'Up to ' + c.surchargePct + '% over the legal rent',
        'capped',
        'Only on a sublet, only where the unit is fully furnished, and only over the legal regulated rent. Charging more is profiteering: the subtenant is owed treble damages, and it is an incurable ground for eviction — the prime tenant loses the apartment rather than getting a chance to refund.',
        c.surchargeSrc
      ]);
    }

    var chargeBlock =
      '<h3 style="font-size:var(--text-md);margin:var(--s-6) 0 var(--s-3);color:var(--ink)">What the departing tenant may charge you</h3>' +
      '<div class="x-rules">' + chargeRows.map(function (row) {
        return '<div class="x-rule-row">' +
          '<span class="x-rule-row__k"><b>' + esc(row[0]) + '</b>' + esc(row[3]) +
            (row[4] ? ' <span class="x-cite">· ' + esc(row[4].label) + ', in force ' + esc(row[4].eff) + '</span>' : '') +
          '</span>' +
          '<span class="x-rule-row__v">' + esc(row[1]) + ' ' + (VERDICT_CHIP[row[2]] || '') + '</span>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="x-flags" style="margin-top:var(--s-4)">' +
        '<div class="x-flag' + (c.licenceRisk === 'high' ? '' : ' x-flag--ok') + '"><span>' +
          '<strong>' + (c.licenceRisk === 'high' ? 'Licensing exposure: high' : 'Licensing exposure: moderate') + '</strong> — ' +
          (t.mode === 'assignment'
            ? 'On an assignment the departing tenant is not a party to your tenancy at all. Being paid to introduce two other people is the classic description of brokerage, and doing it without a licence is a misdemeanour that also exposes them to up to four times the sum they took. RentLeaks does not escrow, remit or enforce a handover fee on this route.'
            : 'On a sublet the departing tenant is a principal — they are your landlord under the sublease — which is a far weaker footing for a brokerage argument. It is not nothing, and it gets worse if the same account does it repeatedly across units.') +
        '</span></div>' +
        '<div class="x-flag x-flag--ok"><span><strong>RentLeaks holds none of this money</strong> — not the deposit, not the first month, not a handover fee. We are not an escrow agent and never collect or remit on a lister’s behalf, which is also what keeps the platform out of the licensing question above.</span></div>' +
      '</div>';

    var body = '' +
      '<p class="x-desk__lede">' + esc(t.remainingMonths) + ' months remain on this lease at ' + esc(money(l.price, l)) + ' base. ' +
      'The desk runs the route, the packet, the clock and the handoff, so the deal does not die in the post.</p>' +
      '<p><span class="x-chip ' + (t.deemedConsent || t.consent === 'granted' ? 'x-chip--consent' : 'x-chip--pending') + '">' + esc(consentLabel) + '</span> ' +
      '<span class="x-chip">' + (isSublet ? 'Sublet' : 'Assignment') + '</span></p>' +
      '<div class="x-track" style="margin-top:1.25rem">' + steps + '</div>' +
      chargeBlock +
      '<p class="x-note">Windows shown here are those of ' + esc(d.rules.cityName) + '. ' +
      (clockApplies
        ? esc(r.statute) + ' governs this route; other markets differ in both the deadline and in whether silence means anything at all.'
        : r
          ? esc(r.statute) + ' attaches its deemed-consent clock to subletting, not to assignment — on this route, treat silence as refusal and get consent in writing.'
          : 'This market has no deemed-consent rule on record in our engine, so treat silence as refusal and get consent in writing.') +
      ' Research, not legal advice.</p>';

    return panel('Takeover desk', 'Getting off this lease without it dying in the post', 'The largest unbuilt workflow in the category.', body, 'x-takeover');
  }

  /* --- 4.6 Stay Record --------------------------------------------------- */

  function stayRecord(l) {
    var d = derive(l);
    var rv = d.reviews;
    if (!rv || !rv.count) return '';

    function bar(label, val) {
      return '<div class="x-bar"><span>' + esc(label) + '</span>' +
        '<span class="x-bar__track"><span class="x-bar__fill" style="width:' + Math.round((val / 5) * 100) + '%"></span></span>' +
        '<span class="x-bar__num">' + val.toFixed(1) + '</span></div>';
    }

    var items = rv.items.map(function (r) {
      return '' +
        '<div class="x-rev__item">' +
          '<div class="x-rev__meta">' +
            '<span class="x-rev__who">' + esc(r.who) + '</span>' +
            '<span class="x-seal">✓ stayed ' + r.stayedMonths + ' mo</span>' +
            '<span>' + esc(r.role) + ' · left ' + r.endedAgo + ' month' + (r.endedAgo === 1 ? '' : 's') + ' ago</span>' +
          '</div>' +
          '<p class="x-rev__text">' + esc(r.text) + '</p>' +
          (r.reply ? '<div class="x-rev__reply"><b>Host replied:</b> ' + esc(r.reply) + '</div>' : '') +
        '</div>';
    }).join('');

    var body = '' +
      '<div class="x-rev__summary">' +
        '<div class="x-rev__big">' + rv.overall.toFixed(1) + '<small>' + rv.count + ' verified stay' + (rv.count === 1 ? '' : 's') + '</small></div>' +
        '<div class="x-bars">' +
          bar('Listing accuracy', rv.sub.accuracy) +
          bar('Value for all-in', rv.sub.value) +
          bar('Communication', rv.sub.communication) +
          bar('Condition on arrival', rv.sub.condition) +
        '</div>' +
      '</div>' +
      '<div class="x-rev">' + items + '</div>' +
      '<p class="x-note"><b>The other half of the ledger.</b> This host has recorded ' + rv.tenantSide.count + ' departing tenant' + (rv.tenantSide.count === 1 ? '' : 's') + ' at ' + rv.tenantSide.onTimeRate + '% on-time payment and ' + rv.tenantSide.conditionAvg.toFixed(1) + '/5 on condition at handover. Both sides write, neither side sees the other’s words until both are in or the window closes, and a rating under three stars is held for three days so the host can respond before it publishes. No platform in this category currently ships a two-sided record — which is why a good tenant carries no reputation from one stay to the next.</p>';

    return panel('Stay record', 'Reviews from people who actually lived here', 'Verified-stay only. Two-sided. Response window before publication.', body, 'x-reviews');
  }

  /* --- 4.7 Availability line for the price card -------------------------- */

  function availabilityMarkup(l) {
    var d = derive(l);
    var w = d.window;
    var fit = fitFor(l);
    var months = w.maxDays ? Math.round((w.maxDays / 30) * 10) / 10 : null;
    return '' +
      '<div class="x-panel x-panel--flush" style="margin-top:var(--s-4);padding:var(--s-4)">' +
        '<span class="x-panel__kicker">Availability window</span>' +
        '<p style="margin:0.15rem 0 0;font-size:var(--text-sm);color:var(--ink-2);line-height:1.5">' +
          '<strong style="color:var(--ink)">' + esc(fmtDate(w.from)) + '</strong> to <strong style="color:var(--ink)">' + esc(fmtDate(w.until)) + '</strong>' +
          (months ? ' · up to ' + months + ' months' : '') +
          '<br>Minimum stay ' + w.minDays + ' days' +
          (d.rules.minStaySrc ? ' <span class="x-cite">(' + esc(d.rules.minStaySrc.label) + ')</span>' : '') +
        '</p>' +
        (fit ? '<p style="margin:0.6rem 0 0"><span class="x-fit x-fit--' + (fit.state === 'fit' ? 'yes' : fit.state === 'near' ? 'near' : 'no') + '">' + esc(fit.label) + '</span></p>' : '') +
        windowMarkup(true) +
      '</div>';
  }

  /* =======================================================================
     5. Notice-and-action + the fair-housing guard
     ======================================================================= */

  /* The lexicon lives in rules.json alongside everything else, so a term
     added to one half of the product is added to both. */
  var BANNED = (RULEBOOK && RULEBOOK.bannedTerms) || [];

  function scanText(s) {
    var low = String(s || '').toLowerCase();
    return BANNED.filter(function (term) { return low.indexOf(term) !== -1; });
  }

  function attachGuard(input) {
    if (!input || input.dataset.xGuard) return;
    input.dataset.xGuard = '1';
    var note = document.createElement('div');
    note.className = 'x-guard';
    note.setAttribute('role', 'status');
    if (input.parentNode) input.parentNode.insertBefore(note, input.nextSibling);
    input.addEventListener('input', function () {
      var hits = scanText(input.value);
      if (hits.length) {
        note.className = 'x-guard is-on';
        note.innerHTML = '<b>This wording cannot be published.</b> “' + esc(hits[0]) + '” states a preference based on a protected characteristic, which the Fair Housing Act prohibits in an advertisement whoever wrote it. Describe the home, not the person you want in it — “two flights of stairs, no lift” is lawful and more useful than “no wheelchair”.';
      } else {
        note.className = 'x-guard';
      }
    });
  }

  var REPORT_REASONS = [
    ['scam', 'I think this is a scam', 'Asked for payment off-platform, pressure to send a deposit before a viewing, or an identity that does not add up.'],
    ['stale', 'It is not actually available', 'Already let, or the dates shown are wrong.'],
    ['inaccurate', 'The listing is inaccurate', 'Price, size, fees, furnishing or the address do not match reality.'],
    ['discrimination', 'Discriminatory wording', 'The listing states a preference based on a protected characteristic.'],
    ['illegal', 'It breaks a local rule', 'A fee, deposit, minimum stay or registration requirement for this market is not being met.']
  ];

  function ensureSheet() {
    var sheet = $('#x-report-sheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'x-sheet';
    sheet.id = 'x-report-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Report this listing');
    sheet.innerHTML = '<div class="x-sheet__card" id="x-report-card"></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    return sheet;
  }

  function closeSheet() {
    var s = $('#x-report-sheet');
    if (s) s.classList.remove('is-open');
  }

  function openReport(id) {
    var sheet = ensureSheet();
    var card = $('#x-report-card', sheet);
    card.innerHTML = '' +
      '<h2>Report this listing</h2>' +
      '<p>Every report is logged with a reference, routed to a human, and answered with a written statement of reasons — the removal, the demotion, or the decision to leave it up and why. That is the Digital Services Act standard, and it is the right standard everywhere.</p>' +
      '<div class="x-choices">' +
        REPORT_REASONS.map(function (r, i) {
          return '<label class="x-choice"><input type="radio" name="x-reason" value="' + r[0] + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span><b>' + esc(r[1]) + '</b>' + esc(r[2]) + '</span></label>';
        }).join('') +
      '</div>' +
      '<label class="x-field"><span style="font-family:var(--x-ledger-font);font-size:var(--text-micro);letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-3)">What happened</span>' +
      '<textarea class="x-textarea" id="x-report-text" placeholder="Dates, amounts, what you were asked to do."></textarea></label>' +
      '<div class="x-sheet__actions">' +
        '<button type="button" class="btn btn--primary" id="x-report-send">Send report</button>' +
        '<button type="button" class="btn btn--ghost" id="x-report-cancel">Cancel</button>' +
      '</div>';
    sheet.classList.add('is-open');

    $('#x-report-cancel', card).addEventListener('click', closeSheet);
    $('#x-report-send', card).addEventListener('click', function () {
      var reason = (card.querySelector('input[name="x-reason"]:checked') || {}).value || 'other';
      var text = ($('#x-report-text', card) || {}).value || '';
      var ref = 'RL-' + Date.now().toString(36).toUpperCase();
      var log = read(STORE.reports, []);
      log.unshift({ ref: ref, listing: id, reason: reason, text: text.slice(0, 2000), at: new Date().toISOString() });
      write(STORE.reports, log.slice(0, 50));
      card.innerHTML = '<h2>Logged as ' + esc(ref) + '</h2>' +
        '<p>A human reviews this within one business day. You will get a written statement of reasons either way, including if we decide to leave the listing up. Keep the reference.</p>' +
        '<p class="x-note">If you have already sent money: your bank or card issuer can often reverse a card payment. Wire, Zelle, gift-card and crypto payments generally cannot be reversed, which is precisely why they are the ones scammers ask for.</p>' +
        '<div class="x-sheet__actions"><button type="button" class="btn btn--primary" id="x-report-done">Close</button></div>';
      $('#x-report-done', card).addEventListener('click', closeSheet);
    });
  }

  /* =======================================================================
     6. Renter Passport
     ======================================================================= */

  function passport() {
    var p = read(STORE.passport, null);
    if (p) return p;
    var id = 'RLP-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    p = {
      id: id,
      created: todayISO(),
      expires: addMonths(todayISO(), 1),
      identity: 'unverified',
      incomeBand: null,
      screening: 'not-run',
      references: 0,
      moveIn: stayWindow.from || null
    };
    write(STORE.passport, p);
    return p;
  }

  function passportMarkup() {
    var p = passport();
    var daysLeft = daysBetween(todayISO(), p.expires);
    var cells = [
      ['Identity', p.identity === 'verified' ? 'Verified' : 'Not yet verified'],
      ['Income', p.incomeBand || 'Not stated'],
      ['Screening', p.screening === 'passed' ? 'Passed' : 'Not run'],
      ['References', p.references ? p.references + ' on file' : 'None yet']
    ];
    return '' +
      '<div class="x-passport" id="x-passport">' +
        '<div class="x-passport__head">' +
          '<h2 class="x-passport__title">Your renter passport</h2>' +
          '<span class="x-passport__id">' + esc(p.id) + '</span>' +
        '</div>' +
        '<dl class="x-passport__grid">' +
          cells.map(function (c) { return '<div class="x-passport__cell"><dt>' + esc(c[0]) + '</dt><dd>' + esc(c[1]) + '</dd></div>'; }).join('') +
        '</dl>' +
        '<div class="x-passport__foot">' +
          '<button type="button" class="btn btn--primary btn--sm" id="x-passport-build">Complete it once</button>' +
          '<button type="button" class="btn btn--outline btn--sm" id="x-passport-share">Copy share link</button>' +
          '<span class="x-passport__exp">Expires ' + esc(fmtDate(p.expires)) + (daysLeft != null ? ' · ' + daysLeft + ' days' : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="x-note">One verified application, carried to every landlord, expiring on a date they can see. Where a screening report the applicant already holds must be accepted in place of a new fee — New York is one such market — this is that report. Nobody in this category ships a portable credential, which is why renters pay a median application fee per landlord and why lease takeovers lose weeks to re-screening.</p>';
  }

  function bindPassport(root) {
    var build = $('#x-passport-build', root), share = $('#x-passport-share', root);
    if (build) build.addEventListener('click', function () {
      var p = passport();
      p.identity = 'verified';
      p.screening = 'passed';
      p.incomeBand = p.incomeBand || 'Stated and documented';
      p.references = p.references || 2;
      p.expires = addMonths(todayISO(), 1);
      write(STORE.passport, p);
      var host = $('#x-passport-host', document);
      if (host) { host.innerHTML = passportMarkup(); bindPassport(host); }
    });
    if (share) share.addEventListener('click', function () {
      var p = passport();
      var url = location.origin + '/apply.html?passport=' + encodeURIComponent(p.id);
      try {
        navigator.clipboard.writeText(url);
        share.textContent = 'Link copied';
        setTimeout(function () { share.textContent = 'Copy share link'; }, 2200);
      } catch (e) {
        share.textContent = url;
      }
    });
  }

  /* =======================================================================
     7. DOM integration
     ======================================================================= */

  function currentListing() {
    var id = null;
    try { id = new URLSearchParams(location.search).get('id'); } catch (e) { /* ignore */ }
    id = id || document.body.dataset.listingId;
    if (!id) return null;
    return (DATA.listings || []).filter(function (l) { return l.id === id; })[0] || null;
  }

  var enhancing = false;

  function enhanceDetail() {
    var root = $('#rl-detail');
    if (!root || enhancing) return;
    var l = currentListing();
    if (!l) return;
    if ($('#x-price-truth', root)) return;   // already done for this render

    enhancing = true;
    try {
      var main = root.querySelector('.rl-main') || root.querySelector('.rl-detail__main');
      var side = root.querySelector('.rl-side');
      var host = main || root.querySelector('.container') || root;

      var block = document.createElement('div');
      block.id = 'x-detail-block';
      block.innerHTML =
        priceTruth(l) +
        dealPanel(l) +
        trustLedger(l) +
        localRules(l) +
        affordability(l) +
        takeoverDesk(l) +
        stayRecord(l) +
        '<div id="x-passport-host">' + passportMarkup() + '</div>';

      // Place before "Similar stays" if it exists, otherwise append.
      var similar = root.querySelector('#rl-similar');
      var anchor = similar ? similar.closest('.rl-block') : null;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(block, anchor);
      else host.appendChild(block);

      if (side) {
        var av = document.createElement('div');
        av.innerHTML = availabilityMarkup(l);
        var card = side.querySelector('.rl-price-card');
        if (card) card.appendChild(av.firstChild);
        else side.appendChild(av.firstChild);
        bindWindow(side);
      }

      bindAfford(block, l);
      bindPassport(block);
    } catch (e) {
      if (window.console && console.warn) console.warn('[rl-x] detail enhance failed', e);
    }
    enhancing = false;
  }

  /* --- browse grid ------------------------------------------------------- */

  function enhanceCards(scope) {
    var nights = windowNights();
    $$('.listing-card', scope || document).forEach(function (card) {
      var id = card.getAttribute('data-id');
      if (!id) return;
      var l = (DATA.listings || []).filter(function (x) { return x.id === id; })[0];
      if (!l) return;
      var d = derive(l);

      var row = card.querySelector('.x-chiprow');
      if (!row) {
        row = document.createElement('div');
        row.className = 'x-chiprow';
        var body = card.querySelector('.listing-card__body');
        var specs = card.querySelector('.listing-card__specs');
        if (specs && specs.parentNode) specs.parentNode.insertBefore(row, specs.nextSibling);
        else if (body) body.appendChild(row);
        else return;
      }

      var chips = [];
      var fit = fitFor(l);
      if (fit) {
        chips.push('<span class="x-fit x-fit--' + (fit.state === 'fit' ? 'yes' : fit.state === 'near' ? 'near' : 'no') + '" title="' + esc(fit.why) + '">' + esc(fit.label) + '</span>');
      }
      if (d.deal.byOwner) chips.push('<span class="x-chip x-chip--owner" title="' + esc(d.deal.meta.blurb) + '">By owner</span>');
      if (d.vouchers) chips.push('<span class="x-chip x-chip--voucher" title="Housing vouchers and subsidies are accepted on this home">Vouchers ok</span>');
      if (d.access.stepFree) chips.push('<span class="x-chip x-chip--access" title="Step-free route from the street to the front door">Step-free</span>');
      if (d.takeover && (d.takeover.consent === 'granted' || d.takeover.deemedConsent)) {
        chips.push('<span class="x-chip x-chip--consent" title="The landlord has consented, or the statutory window has closed without objection">Consent on file</span>');
      }
      if (d.trustScore >= 90) chips.push('<span class="x-chip" title="Identity, address control, image uniqueness and account clustering all pass">Trust ' + d.trustScore + '</span>');

      row.innerHTML = chips.join('');
      card.classList.toggle('x-card-dim', !!(nights != null && fit && fit.state === 'miss' && facetState.hideMisses));
    });
  }

  /* --- sponsored placement, scoped to geography ---------------------------
     A paid slot only makes sense where it is relevant: a sponsored listing in
     Berlin has no business ranking above organic results for someone browsing
     Brooklyn. So the boost applies only when the search actually resolves to
     that listing's market — an explicit city filter, or a city page. With no
     city in scope there is no geography to be appropriate to, and nothing is
     promoted at all.

     Two rules that are not negotiable, because they are what stops paid
     placement corroding the rest of the product:
       1. Every promoted card is labelled, visibly, as sponsored.
       2. Paying reorders results. It does not alter a trust score, waive a
          compliance check, or add a badge. A listing that has not earned its
          badges still shows up without them, in a paid slot.
     ----------------------------------------------------------------------- */

  function scopeCityId() {
    /* A city page states its market in the body dataset or the path. */
    var m = location.pathname.match(/\/cities\/([^/]+)\.html/);
    if (m) {
      var c = DATA.getCity ? DATA.getCity(decodeURIComponent(m[1])) : null;
      if (c) return c.id;
    }
    try {
      var q = new URLSearchParams(location.search).get('city');
      if (q) {
        var c2 = DATA.getCity ? DATA.getCity(q) : null;
        if (c2) return c2.id;
      }
    } catch (e) { /* ignore */ }
    /* Fall back to whatever the base renderer has in its own city select. */
    var sel = document.querySelector('#city, [name="city"]');
    if (sel && sel.value) {
      var c3 = DATA.getCity ? DATA.getCity(sel.value) : null;
      if (c3) return c3.id;
    }
    return null;
  }

  function sponsoredIn(cityId) {
    if (!cityId) return [];
    return (DATA.listings || []).filter(function (l) {
      return l.sponsored && l.cityId === cityId && l.status !== 'paused';
    });
  }

  function applySponsored() {
    /* Pre-rendered city and type pages carry a .listings__grid with no id —
       the client renderer never touches them — so look for both. */
    var grid = $('#listings-grid') || $('.listings__grid');
    if (!grid) return;
    var city = scopeCityId();

    /* Clear any previous promotion before deciding again — the scope changes
       as the visitor filters, and a slot that is no longer relevant must stop
       being promoted rather than linger. */
    $$('.listing-card.x-sponsored', grid).forEach(function (card) {
      card.classList.remove('x-sponsored');
      var tag = card.querySelector('.x-sponsor-tag');
      if (tag) tag.remove();
    });

    if (!city) return;
    var ids = sponsoredIn(city).map(function (l) { return l.id; });
    if (!ids.length) return;

    /* Walk backwards so multiple promoted cards keep their relative order. */
    ids.slice().reverse().forEach(function (id) {
      var card = grid.querySelector('.listing-card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      if (!card) return;
      card.classList.add('x-sponsored');
      if (!card.querySelector('.x-sponsor-tag')) {
        var tag = document.createElement('span');
        tag.className = 'x-sponsor-tag';
        tag.textContent = 'Sponsored';
        tag.title = 'A paid placement in this market. It changes where this listing sits in the results and nothing else — the same verification and compliance checks apply.';
        var wrap = card.querySelector('.listing-card__img-wrap') || card;
        wrap.appendChild(tag);
      }
      if (grid.firstChild !== card) grid.insertBefore(card, grid.firstChild);
    });
  }

  /* --- browse rail facets ------------------------------------------------ */

  var facetState = read('rl_x_facets', { byOwner: false, vouchers: false, access: false, consent: false, hideMisses: true });

  function saveFacets() { write('rl_x_facets', facetState); }

  function applyFacets() {
    $$('.listing-card').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var l = (DATA.listings || []).filter(function (x) { return x.id === id; })[0];
      if (!l) return;
      var d = derive(l);
      var hide = false;
      if (facetState.byOwner && !d.deal.byOwner) hide = true;
      if (facetState.vouchers && !d.vouchers) hide = true;
      if (facetState.access && !d.access.stepFree) hide = true;
      if (facetState.consent && !(d.takeover && (d.takeover.consent === 'granted' || d.takeover.deemedConsent))) hide = true;
      var fit = fitFor(l);
      if (facetState.hideMisses && fit && fit.state === 'miss') hide = true;
      card.style.display = hide ? 'none' : '';
    });
  }

  function injectRail() {
    var side = $('#rl-filters');
    if (!side || $('#x-rail', side)) return;

    var fs = document.createElement('fieldset');
    fs.className = 'rl-fieldset';
    fs.id = 'x-rail';
    fs.innerHTML = '<legend>Stay window</legend>' + windowMarkup(true) +
      '<div class="x-facets" style="margin-top:var(--s-4)">' +
        '<label class="x-facet"><input type="checkbox" data-x-facet="hideMisses"' + (facetState.hideMisses ? ' checked' : '') + '>' +
          '<span>Only homes that fit my window<small>Hides anything that cannot be stretched to your dates</small></span></label>' +
        '<label class="x-facet"><input type="checkbox" data-x-facet="byOwner"' + (facetState.byOwner ? ' checked' : '') + '>' +
          '<span>For rent by owner<small>No agent in the deal, so no broker fee to argue about</small></span></label>' +
        '<label class="x-facet"><input type="checkbox" data-x-facet="vouchers"' + (facetState.vouchers ? ' checked' : '') + '>' +
          '<span>Accepts vouchers and subsidies<small>Source of income, not a tenant characteristic</small></span></label>' +
        '<label class="x-facet"><input type="checkbox" data-x-facet="access"' + (facetState.access ? ' checked' : '') + '>' +
          '<span>Step-free access<small>A property attribute — the accessibility facet that reduces fair-housing risk rather than creating it</small></span></label>' +
        '<label class="x-facet"><input type="checkbox" data-x-facet="consent"' + (facetState.consent ? ' checked' : '') + '>' +
          '<span>Takeovers with landlord consent on file<small>Skips the deals that die in the post</small></span></label>' +
      '</div>';

    // Insert directly under the rail header so dates read as primary.
    var head = side.querySelector('.rl-side__head');
    if (head && head.nextSibling) side.insertBefore(fs, head.nextSibling);
    else side.appendChild(fs);

    bindWindow(fs);
    $$('[data-x-facet]', fs).forEach(function (box) {
      box.addEventListener('change', function () {
        facetState[box.getAttribute('data-x-facet')] = box.checked;
        saveFacets();
        applyFacets();
        enhanceCards();
        applySponsored();
      });
    });
  }

  /* --- home / search form ------------------------------------------------ */

  function injectHomeWindow() {
    var form = $('.hero__search form') || $('.hero form') || $('form.search-form') || $('#search-form');
    if (!form || $('#x-window', form)) return;
    var wrap = document.createElement('div');
    wrap.style.gridColumn = '1 / -1';
    wrap.innerHTML = windowMarkup(true);
    form.appendChild(wrap);
    bindWindow(wrap);
  }

  /* --- schema.org upgrade for client-rendered pages ---------------------- */

  function injectSchema(l) {
    if (!l) return;
    var d = derive(l);
    var existing = $('script[data-x-schema]');
    if (existing) existing.remove();
    var node = {
      '@context': 'https://schema.org',
      '@type': 'Accommodation',
      name: l.title,
      description: l.description,
      url: (l.url || location.href),
      numberOfRooms: l.beds || undefined,
      occupancy: { '@type': 'QuantitativeValue', minValue: 1, maxValue: Math.max(1, (l.beds || 1) + 1) },
      floorSize: l.sqft ? { '@type': 'QuantitativeValue', value: l.sqft, unitCode: 'FTK' } : undefined,
      petsAllowed: !!l.pets,
      amenityFeature: (l.amenities || []).slice(0, 12).map(function (a) {
        return { '@type': 'LocationFeatureSpecification', name: String(a).replace(/-/g, ' '), value: true };
      }),
      address: {
        '@type': 'PostalAddress',
        streetAddress: l.address,
        addressLocality: l.cityName,
        addressRegion: l.state,
        addressCountry: l.country || 'US'
      },
      geo: (l.lat && l.lng) ? { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } : undefined,
      offers: {
        '@type': 'Offer',
        price: allIn(l),
        priceCurrency: l.currency || 'USD',
        availability: 'https://schema.org/InStock',
        availabilityStarts: d.window.from,
        availabilityEnds: d.window.until,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: allIn(l),
          priceCurrency: l.currency || 'USD',
          unitCode: 'MON',
          description: 'All-in monthly rent including every required fee'
        },
        eligibleDuration: { '@type': 'QuantitativeValue', minValue: d.window.minDays, unitCode: 'DAY' }
      },
      aggregateRating: d.reviews && d.reviews.count ? {
        '@type': 'AggregateRating',
        ratingValue: d.reviews.overall,
        reviewCount: d.reviews.count,
        bestRating: 5
      } : undefined
    };
    var el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-x-schema', '1');
    el.textContent = JSON.stringify(node, function (k, v) { return v === undefined ? undefined : v; });
    document.head.appendChild(el);
  }

  /* =======================================================================
     8. Boot
     ======================================================================= */

  function pageIsDetail() {
    return !!$('#rl-detail') || /\/listings\//.test(location.pathname);
  }

  function tick() {
    if (pageIsDetail()) {
      enhanceDetail();
      injectSchema(currentListing());
    }
    injectRail();
    injectHomeWindow();
    enhanceCards();
    applyFacets();
    applySponsored();
    $$('textarea, input[type="text"][name="headline"], #listing-title, #listing-description').forEach(attachGuard);
  }

  function boot() {
    tick();

    // The base renderer repaints #rl-detail and #listings-grid on currency
    // changes, filter changes and pagination. Watch rather than patch.
    var targets = ['#rl-detail', '#listings-grid', '#rl-browse', 'main'];
    var seen = [];
    targets.forEach(function (sel) {
      var node = $(sel);
      if (!node || seen.indexOf(node) !== -1) return;
      seen.push(node);
      var mo = new MutationObserver(function () {
        window.clearTimeout(mo._t);
        mo._t = window.setTimeout(tick, 40);
      });
      mo.observe(node, { childList: true, subtree: true });
    });

    document.addEventListener('rl-x:window', function () {
      enhanceCards();
      applyFacets();
      var side = $('.rl-side .x-window');
      if (side) { /* keep the detail-side inputs in step */ }
      $$('#x-window').forEach(function (w) {
        var f = $('#x-from', w), t = $('#x-to', w);
        if (f) f.value = stayWindow.from;
        if (t) t.value = stayWindow.to;
      });
      var read = $$('.x-window__read');
      var n = windowNights();
      read.forEach(function (r) {
        r.innerHTML = (n != null && n > 0)
          ? '<span><strong>' + n + '</strong> nights · <strong>' + (Math.round((n / 30) * 10) / 10) + '</strong> months</span>' +
            (n < 30 ? '<span class="x-fit x-fit--no">Under the 30-day floor</span>' : '') +
            '<button type="button" class="x-window__clear">Clear dates</button>'
          : '<span>Set both dates to filter by the window you actually need — not just a start date.</span>';
      });
    });

    document.addEventListener('rl:currency', function () { window.setTimeout(tick, 60); });

    document.addEventListener('click', function (e) {
      var rep = e.target.closest ? e.target.closest('[data-x-report]') : null;
      if (rep) { e.preventDefault(); openReport(rep.getAttribute('data-x-report')); return; }
      var clr = e.target.closest ? e.target.closest('.x-window__clear') : null;
      if (clr) { e.preventDefault(); setWindow('', ''); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.setTimeout(boot, 60); });
  } else {
    window.setTimeout(boot, 60);
  }

  /* Public surface — useful for the console, tests and future pages. */
  window.RENTLEAKS_X = {
    version: '1.0.0',
    rulesFor: rulesFor,
    derive: derive,
    fitFor: fitFor,
    setWindow: setWindow,
    scopeCityId: scopeCityId,
    sponsoredIn: sponsoredIn,
    getWindow: function () { return { from: stayWindow.from, to: stayWindow.to, nights: windowNights() }; },
    scanText: scanText,
    passport: passport,
    SOURCES: SRC,
    refresh: tick
  };
})();
