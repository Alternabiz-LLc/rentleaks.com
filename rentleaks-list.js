/**
 * RentLeaks — Listing Composer
 * ---------------------------------------------------------------------------
 * Replaces the list-a-place wizard. Every surface built on top of this
 * catalogue — stay-window search, price truth, the fee-legality engine, the
 * takeover desk, the structured data an AI crawler reads — is only as good as
 * what the composer can express. The old wizard could not express an
 * availability window, an itemised fee, a deposit, a photograph, who was
 * doing the listing, or which currency the rent was in. So none of those
 * surfaces could be trusted on a real listing rather than a seeded one.
 *
 * The design rule here: a field exists because something downstream reads it
 * or because a rule requires it. Nothing is collected for its own sake, and
 * nothing that touches a protected characteristic is collected at all — a
 * structured question about the tenant is the line that costs a platform its
 * intermediary protection, so the composer asks about the HOME and lets the
 * free text be free text, scanned for wording that cannot lawfully be
 * published.
 *
 * Publication is gated. A listing cannot go live without photographs of the
 * actual unit, an itemised fee breakdown, a stay window that clears the
 * market's floor, a deposit inside the market's cap, and clean wording. Those
 * are not nags — they are `blocking` checks, because a listing that fails them
 * is either unlawful in its market or is the shape of a listing that renters
 * abandon.
 */
(function () {
  'use strict';

  var DATA = window.RENTLEAKS_DATA;
  if (!DATA) return;

  var X = window.RENTLEAKS_X || {};
  var VERIFY = window.RENTLEAKS_VERIFY || {};
  var STORE = { draft: 'rl_c_draft' };

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function read(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function addMonths(iso, n) {
    var d = new Date(String(iso || todayISO()) + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    var day = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < day) d.setDate(0);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    var x = new Date(a + 'T00:00:00'), y = new Date(b + 'T00:00:00');
    if (isNaN(x) || isNaN(y)) return null;
    return Math.round((y - x) / 86400000);
  }

  /* --- money in the market's own currency, not the lister's browser ------ */

  function cityOf(id) { return (DATA.getCity && DATA.getCity(id)) || null; }

  function currencyFor(cityId) {
    var c = cityOf(cityId);
    if (c && c.currency) return c.currency;
    if (c && DATA.currencyForCountry) return DATA.currencyForCountry(c.country || 'US');
    return 'USD';
  }

  function money(n, cur) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n || 0));
    } catch (e) { return (cur || 'USD') + ' ' + Math.round(n || 0); }
  }

  function symbolFor(cur) {
    try { return (0).toLocaleString(undefined, { style: 'currency', currency: cur, minimumFractionDigits: 0 }).replace(/[\d\s.,]/g, ''); }
    catch (e) { return cur; }
  }

  /* --- the rules engine, against whatever city is selected --------------- */

  function rulesNow() {
    var c = cityOf(draft.cityId);
    if (!X.rulesFor || !c) return {};
    return X.rulesFor({
      cityId: draft.cityId,
      cityName: c.name,
      state: c.state,
      country: c.country || 'US'
    });
  }

  /* =======================================================================
     Draft
     ======================================================================= */

  var FEE_TYPES = [
    ['utilities', 'Utilities', 'monthly'],
    ['wifi', 'Wi-Fi / internet', 'monthly'],
    ['cleaning', 'Cleaning', 'monthly'],
    ['parking', 'Parking', 'monthly'],
    ['amenity', 'Amenity fee', 'monthly'],
    ['storage', 'Storage', 'monthly'],
    ['pet', 'Pet rent', 'monthly'],
    ['broker', 'Broker fee', 'once'],
    ['admin', 'Admin fee', 'once'],
    ['move_in', 'Move-in fee', 'once'],
    ['key', 'Key fee', 'once']
  ];

  var ROOM_LABELS = ['Bedroom', 'Bathroom', 'Kitchen', 'Living room', 'Workspace', 'Building', 'Outdoor', 'Floor plan', 'Other'];

  var AMENITIES = [
    ['laundry-in-unit', 'Laundry in unit'], ['laundry-in-building', 'Laundry in building'],
    ['ac', 'Air conditioning'], ['heating', 'Heating included'], ['dishwasher', 'Dishwasher'],
    ['elevator', 'Lift'], ['workspace', 'Desk / workspace'], ['bike-storage', 'Bike storage'],
    ['gym', 'Gym'], ['pool', 'Pool'], ['outdoor', 'Balcony or garden'], ['parking', 'Parking']
  ];

  /* Attributes of the PROPERTY. Never of the person. This is the one
     accessibility-adjacent facet that reduces fair-housing risk instead of
     creating it, because it describes a step, not a tenant. */
  var ACCESS = [
    ['step-free', 'Step-free from the street to the door'],
    ['lift', 'Lift to the floor'],
    ['wide-doors', 'Doorways 32 inches / 81 cm or wider'],
    ['accessible-bath', 'Roll-in shower or grab rails'],
    ['ground-floor', 'Ground floor']
  ];

  var defaults = {
    role: 'owner',
    housingType: 'room',
    cityId: 'nyc',
    title: '',
    neighborhood: '',
    address: '',
    unit: '',
    beds: 1,
    baths: 1,
    sqft: '',
    furnishedLevel: 'fully',
    price: 1400,
    deposit: '',
    fees: [{ type: 'utilities', amount: 0, cadence: 'monthly', mandatory: true }],
    availableFrom: todayISO(),
    availableUntil: '',
    minStayMonths: 1,
    maxStayMonths: 12,
    leaseEnd: '',
    takeoverType: 'sublet',
    consentStatus: 'pending',
    registrationNumber: '',
    vouchers: true,
    pets: 'none',
    amenities: [],
    access: [],
    photos: [],          // { url, label, quality, name }
    description: '',
    sponsored: false,
    plan: 'week'
  };

  var draft = (function () {
    var saved = read(STORE.draft, null);
    var d = {};
    Object.keys(defaults).forEach(function (k) { d[k] = defaults[k]; });
    if (saved) {
      Object.keys(saved).forEach(function (k) {
        /* Photos are object URLs — they do not survive a reload, so they are
           never restored from a draft even if one was somehow persisted. */
        if (k !== 'photos' && k in d) d[k] = saved[k];
      });
    }
    return d;
  })();

  function saveDraft() {
    var copy = {};
    Object.keys(draft).forEach(function (k) { if (k !== 'photos') copy[k] = draft[k]; });
    write(STORE.draft, copy);
  }

  function isLeaseBreak() { return draft.housingType === 'lease-break'; }

  /* =======================================================================
     Derived numbers
     ======================================================================= */

  function monthlyFees() {
    return draft.fees.filter(function (f) { return f.cadence === 'monthly'; })
      .reduce(function (a, f) { return a + (Number(f.amount) || 0); }, 0);
  }
  function onceFees() {
    return draft.fees.filter(function (f) { return f.cadence === 'once'; })
      .reduce(function (a, f) { return a + (Number(f.amount) || 0); }, 0);
  }
  function allIn() { return (Number(draft.price) || 0) + monthlyFees(); }

  function minStayDays() {
    return Math.max(1, Math.round((Number(draft.minStayMonths) || 1) * 30));
  }

  function windowDays() {
    if (!draft.availableFrom || !draft.availableUntil) return null;
    return daysBetween(draft.availableFrom, draft.availableUntil);
  }

  /* =======================================================================
     Publication gate
     ======================================================================= */

  function checks() {
    var r = rulesNow();
    var cur = currencyFor(draft.cityId);
    var out = [];

    function add(id, ok, blocking, title, why) {
      out.push({ id: id, ok: ok, blocking: blocking, title: title, why: why });
    }

    add('basics', !!(draft.title.trim().length > 8 && draft.neighborhood.trim() && draft.address.trim()), true,
      'Title, neighbourhood and address',
      'The address is never published in full — it sets the map pin and it is what an ownership document gets matched against.');

    /* Photographs. Around half of renters abandon a listing with no photos of
       the actual unit, and a scammer who cannot reach a property cannot
       photograph it — so this is the rare rule that lifts conversion and cuts
       fraud with the same constraint. */
    var enough = draft.photos.length >= 4;
    add('photos', enough, true,
      'At least four photographs of this unit',
      enough
        ? draft.photos.length + ' uploaded. The first is the cover.'
        : 'You have ' + draft.photos.length + '. Renters abandon listings without photographs of the actual place more than any other reason, and stock images are the clearest fraud signal there is.');

    var feesOk = draft.fees.every(function (f) { return f.type && (Number(f.amount) >= 0); });
    add('fees', feesOk && draft.fees.length > 0, true,
      'Every fee itemised',
      r.listingFeeDisclosureSrc
        ? 'Required on the listing itself in this market — ' + r.listingFeeDisclosureSrc.label + '. A fee disclosed at signing rather than in the advert is the thing the rule exists to stop.'
        : 'Renters abandon at the point they discover a fee that was not in the advert. Put all of them here and the all-in figure does the selling.');

    var floor = r.minStayDays || 30;
    var meetsFloor = minStayDays() >= floor;
    add('minstay', meetsFloor, true,
      'Minimum stay clears ' + floor + ' days',
      meetsFloor
        ? 'Yours is ' + minStayDays() + ' days.' + (r.minStaySrc ? ' Floor set by ' + r.minStaySrc.label + '.' : '')
        : 'This market sets a floor of ' + floor + ' days' + (r.minStaySrc ? ' under ' + r.minStaySrc.label : '') + '. Yours is ' + minStayDays() + '.');

    var w = windowDays();
    add('window', !!(draft.availableFrom && draft.availableUntil && w && w >= minStayDays()), true,
      'Availability window',
      draft.availableUntil
        ? (w && w >= minStayDays() ? 'Open ' + w + ' days — long enough for your own minimum.' : 'The window is shorter than the minimum stay you set.')
        : 'An end date is what makes "available March through June" answerable — by our search, and by an assistant reading the page.');

    if (r.depositCapMonths != null) {
      var cap = Math.round((Number(draft.price) || 0) * r.depositCapMonths);
      var depOk = (Number(draft.deposit) || 0) <= cap;
      add('deposit', depOk, true,
        'Deposit within ' + r.depositCapMonths + ' month' + (r.depositCapMonths === 1 ? '' : 's'),
        depOk ? 'Cap here is ' + money(cap, cur) + '. The cap reaches advances too, so no "first, last and security".'
              : 'Over the cap of ' + money(cap, cur) + (r.depositSrc ? ' under ' + r.depositSrc.label : '') + '.');
    }

    /* Fee legality, run through the same engine the public listing uses. */
    if (r.landlordAgentMayChargeTenant === false) {
      var brokerFee = draft.fees.filter(function (f) { return f.type === 'broker'; })
        .reduce(function (a, f) { return a + (Number(f.amount) || 0); }, 0);
      var brokerOk = !brokerFee || draft.role === 'tenant-broker';
      add('broker', brokerOk, true,
        'No broker fee charged to the renter',
        brokerOk
          ? 'None on this listing. A broker the renter retains themselves is a different arrangement and is not affected.'
          : 'A landlord’s agent may not charge the renter here' + (r.tenantBrokerFeeSrc ? ' — ' + r.tenantBrokerFeeSrc.label : '') + '. Remove it, or bill it to the landlord.');
    }
    if (r.applicationFeeBanned) {
      var appFee = draft.fees.filter(function (f) { return f.type === 'admin' || f.type === 'move_in' || f.type === 'key'; })
        .reduce(function (a, f) { return a + (Number(f.amount) || 0); }, 0);
      add('movein', !appFee, true,
        'No move-in, admin or key fee',
        appFee ? 'Charges demanded before or at the start of a tenancy are barred in this market' + (r.applicationFeeSrc ? ' under ' + r.applicationFeeSrc.label : '') + ' — and the statute names sub-lessors as well as landlords.'
               : 'None charged. Background and credit may still be recovered up to the statutory cap.');
    }

    /* Wording. The lexicon runs on what will actually be published. */
    var hits = X.scanText ? X.scanText(draft.title + ' ' + draft.description) : [];
    add('wording', hits.length === 0, true,
      'Wording is publishable',
      hits.length
        ? 'The phrase “' + hits[0] + '” states a preference based on a protected characteristic. Describe the home, not the person you want in it.'
        : 'Nothing in the title or description states a preference about who may live here.');

    add('description', draft.description.trim().length >= 120, false,
      'Description with some substance',
      'Who else lives there, what is genuinely included, what the building is like at 8am. The listings that convert say the awkward thing before the viewing does.');

    if (r.registrationRequired) {
      add('registration', !!draft.registrationNumber.trim(), true,
        'Registration number',
        'Required on the listing in this market' + (r.registrationSrc ? ' under ' + r.registrationSrc.label : '') + ', and reported to the registry.');
    }

    if (isLeaseBreak()) {
      add('leaseend', !!draft.leaseEnd, true, 'Lease end date',
        'It sets the remaining term, which is the first thing anyone taking over a lease looks at.');
      add('consent', draft.consentStatus !== 'pending', false,
        'Landlord consent settled',
        draft.consentStatus === 'pending'
          ? 'You can publish without it. The listing will show that consent is not yet settled, which is fairer to everyone than finding out at signing.'
          : 'Recorded. The takeover desk shows this to renters.');
    }

    var v = VERIFY.result ? VERIFY.result() : null;
    add('verified', !!(v && v.identity), false,
      'Identity verified',
      v && v.identity ? 'Verified. Your listings carry the badge.'
                      : 'Unverified listings are shown with a warning and rank below verified ones. It takes about four minutes.');

    return out;
  }

  function blockers() { return checks().filter(function (c) { return c.blocking && !c.ok; }); }

  function completeness() {
    var cs = checks();
    var done = cs.filter(function (c) { return c.ok; }).length;
    return Math.round((done / cs.length) * 100);
  }

  /* =======================================================================
     Render
     ======================================================================= */

  function host() { return $('#rl-list'); }

  function render() {
    var el = host();
    if (!el) return;
    var cur = currencyFor(draft.cityId);
    var r = rulesNow();

    el.innerHTML =
      '<div class="c-shell">' +
        '<div>' +
          sectionWho(r) +
          sectionHome(cur) +
          sectionPhotos() +
          sectionDates(r) +
          sectionMoney(cur, r) +
          (isLeaseBreak() ? sectionTakeover(r) : '') +
          sectionAccess(r) +
          sectionWords() +
        '</div>' +
        '<aside class="c-aside">' + aside(cur, r) + '</aside>' +
      '</div>';

    bind();
  }

  function sec(title, sub, body, id) {
    return '<section class="c-section"' + (id ? ' id="' + id + '"' : '') + '>' +
      '<div class="c-section__head"><h2 class="c-section__title">' + esc(title) + '</h2>' +
      (sub ? '<p class="c-section__sub">' + sub + '</p>' : '') + '</div>' + body + '</section>';
  }

  function sectionWho(r) {
    var v = VERIFY.result ? VERIFY.result() : null;
    var roles = [
      ['owner', 'I own it'],
      ['manager', 'I manage it'],
      ['tenant', 'I am the tenant, leaving early']
    ];
    return sec('Who is listing', 'This decides what we ask you to prove, and what renters are told about who they are dealing with.',
      '<div class="c-row">' +
        roles.map(function (x) {
          return '<label class="v-role' + (draft.role === x[0] ? ' is-on' : '') + '" style="grid-template-columns:1.1rem 1fr">' +
            '<input type="radio" name="c-role" value="' + x[0] + '"' + (draft.role === x[0] ? ' checked' : '') + '>' +
            '<span><b>' + esc(x[1]) + '</b></span></label>';
        }).join('') +
      '</div>' +
      '<div style="margin-top:var(--s-4);display:flex;flex-wrap:wrap;gap:var(--s-2);align-items:center">' +
        '<span class="v-badge v-badge--id' + (v && v.identity ? '' : ' is-off') + '">ID verified</span>' +
        '<span class="v-badge v-badge--listing' + (v && v.listing ? '' : ' is-off') + '">' + (draft.role === 'tenant' ? 'Lease on file' : 'Listing verified') + '</span>' +
        (draft.role === 'tenant' ? '<span class="v-badge v-badge--consent' + (v && v.consent ? '' : ' is-off') + '">Consent on file</span>' : '') +
        '<a class="btn btn--outline btn--sm" href="verify.html">' + (v && v.identity ? 'Review verification' : 'Verify now — 4 minutes, free') + '</a>' +
      '</div>');
  }

  function sectionHome(cur) {
    var types = DATA.housingTypes || [];
    return sec('The home', 'Facts about the property. We never ask anything about who you want living in it — a structured question on that is the line a listings platform cannot cross.',
      '<div class="c-row">' +
        field('Stay type', '<select data-c="housingType">' + types.map(function (t) {
          return '<option value="' + t.id + '"' + (draft.housingType === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
        }).join('') + '</select>') +
        field('City', '<select data-c="cityId">' + (DATA.cities || []).map(function (c) {
          return '<option value="' + c.id + '"' + (draft.cityId === c.id ? ' selected' : '') + '>' + esc(c.name) + (c.state ? ', ' + esc(c.state) : '') + '</option>';
        }).join('') + '</select>', 'Prices in ' + cur + ' — the market’s own currency, converted for renters browsing in another.') +
        field('Neighbourhood', '<input type="text" data-c="neighborhood" value="' + esc(draft.neighborhood) + '" placeholder="Bushwick">') +
      '</div>' +
      '<div class="c-row">' +
        field('Street address', '<input type="text" data-c="address" value="' + esc(draft.address) + '" placeholder="294 Lenox Ave" autocomplete="street-address">', 'Never shown in full. Sets the map pin and gets matched against your ownership document.') +
        field('Unit', '<input type="text" data-c="unit" value="' + esc(draft.unit) + '" placeholder="5R">') +
      '</div>' +
      '<div class="c-field" style="margin-bottom:var(--s-3)"><label>Title</label>' +
        '<input type="text" data-c="title" value="' + esc(draft.title) + '" placeholder="Private room with its own bath, two stops from the L" maxlength="90">' +
        '<small>' + draft.title.length + '/90</small></div>' +
      '<div class="c-row">' +
        field('Bedrooms', '<input type="number" min="0" max="10" data-c="beds" value="' + esc(draft.beds) + '">') +
        field('Bathrooms', '<input type="number" min="0" max="10" step="0.5" data-c="baths" value="' + esc(draft.baths) + '">') +
        field('Size (sq ft)', '<input type="number" min="0" data-c="sqft" value="' + esc(draft.sqft) + '" placeholder="174">') +
        field('Furnishing', '<select data-c="furnishedLevel">' +
          [['fully', 'Fully furnished'], ['partial', 'Partly furnished'], ['none', 'Unfurnished']].map(function (f) {
            return '<option value="' + f[0] + '"' + (draft.furnishedLevel === f[0] ? ' selected' : '') + '>' + f[1] + '</option>';
          }).join('') + '</select>') +
      '</div>' +
      '<div class="c-field" style="margin-top:var(--s-3)"><label>Amenities</label>' +
        '<div class="x-facets" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));display:grid">' +
          AMENITIES.map(function (a) {
            return '<label class="x-facet"><input type="checkbox" data-c-amenity="' + a[0] + '"' + (draft.amenities.indexOf(a[0]) !== -1 ? ' checked' : '') + '><span>' + esc(a[1]) + '</span></label>';
          }).join('') +
        '</div></div>');
  }

  function field(label, control, help) {
    return '<div class="c-field"><label>' + esc(label) + '</label>' + control + (help ? '<small>' + help + '</small>' : '') + '</div>';
  }

  function sectionPhotos() {
    var shots = draft.photos.map(function (p, i) {
      var warn = p.quality && !p.quality.ok;
      return '<div class="c-shot">' +
        '<img src="' + p.url + '" alt="' + esc(p.label || 'Listing photograph') + '">' +
        (i === 0 ? '<span class="c-shot__flag c-shot__flag--cover">Cover</span>' : '') +
        (warn ? '<span class="c-shot__flag c-shot__flag--warn" title="' + esc(p.quality.issues.map(function (x) { return x.msg; }).join(' ')) + '">' + esc(p.quality.issues[0].k) + '</span>' : '') +
        '<div class="c-shot__bar">' +
          '<select data-c-photolabel="' + i + '">' + ROOM_LABELS.map(function (l) {
            return '<option' + (p.label === l ? ' selected' : '') + '>' + l + '</option>';
          }).join('') + '</select>' +
          (i > 0 ? '<button type="button" class="c-shot__rm" data-c-photocover="' + i + '" title="Make this the cover">★</button>' : '') +
          '<button type="button" class="c-shot__rm" data-c-photorm="' + i + '" aria-label="Remove photograph">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return sec('Photographs', 'Of this unit, not the building’s marketing shots. This is both the thing renters most often leave over and the cheapest fraud control we have — someone who cannot get into a property cannot photograph it.',
      '<label class="c-drop" id="c-drop">' +
        '<b>Drop photographs here, or choose files</b>' +
        'Four minimum. A bedroom, the bathroom, the kitchen and the common space beats eight angles of the same sofa. Each one is checked for blur, glare and darkness as it lands.' +
        '<input type="file" accept="image/*" multiple id="c-photos">' +
      '</label>' +
      (shots ? '<div class="c-shots">' + shots + '</div>' : '') +
      '<p class="v-note">Photographs stay in this browser until you publish. Nothing is uploaded from this screen.</p>');
  }

  function sectionDates(r) {
    var floor = r.minStayDays || 30;
    var w = windowDays();
    return sec('Dates and stay length', 'The window is what makes this listing findable by someone who needs March to June — and readable by an assistant answering that question on their behalf.',
      '<div class="c-row">' +
        field('Available from', '<input type="date" data-c="availableFrom" value="' + esc(draft.availableFrom) + '" min="' + todayISO() + '">') +
        field('Available until', '<input type="date" data-c="availableUntil" value="' + esc(draft.availableUntil) + '" min="' + esc(draft.availableFrom || todayISO()) + '">',
          w ? w + ' days open' : 'Set this. Without it the listing cannot answer a date-range search.') +
      '</div>' +
      '<div class="c-row">' +
        field('Minimum stay (months)', '<input type="number" min="1" max="24" data-c="minStayMonths" value="' + esc(draft.minStayMonths) + '">',
          'This market’s floor is ' + floor + ' days' + (r.minStaySrc ? ' — ' + esc(r.minStaySrc.label) : '') + '.') +
        field('Maximum stay (months)', '<input type="number" min="1" max="36" data-c="maxStayMonths" value="' + esc(draft.maxStayMonths) + '">') +
      '</div>' +
      (r.registrationRequired
        ? '<div class="c-row">' + field('Registration number', '<input type="text" data-c="registrationNumber" value="' + esc(draft.registrationNumber) + '" placeholder="Registry reference">',
            'Required on the listing here' + (r.registrationSrc ? ' — ' + esc(r.registrationSrc.label) : '') + '.') + '</div>'
        : ''));
  }

  function sectionMoney(cur, r) {
    var sym = symbolFor(cur);
    var rows = draft.fees.map(function (f, i) {
      return '<div class="c-fee">' +
        '<select data-c-feetype="' + i + '">' + FEE_TYPES.map(function (t) {
          return '<option value="' + t[0] + '"' + (f.type === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join('') + '</select>' +
        '<input type="number" min="0" step="5" data-c-feeamt="' + i + '" value="' + esc(f.amount) + '" aria-label="Amount">' +
        '<select data-c-feecad="' + i + '">' +
          '<option value="monthly"' + (f.cadence === 'monthly' ? ' selected' : '') + '>per month</option>' +
          '<option value="once"' + (f.cadence === 'once' ? ' selected' : '') + '>one-off</option>' +
        '</select>' +
        '<label style="font-size:var(--text-micro);color:var(--ink-3);display:flex;gap:0.3rem;align-items:center;white-space:nowrap">' +
          '<input type="checkbox" data-c-feereq="' + i + '"' + (f.mandatory ? ' checked' : '') + ' style="width:auto">required</label>' +
        '<button type="button" class="c-fee__rm" data-c-feerm="' + i + '" aria-label="Remove fee">✕</button>' +
      '</div>';
    }).join('');

    var depCap = r.depositCapMonths != null ? Math.round((Number(draft.price) || 0) * r.depositCapMonths) : null;

    return sec('Money', 'Itemise everything. The all-in figure is what renters compare on and what we sort by, so a fee left off here is a fee that makes your listing look worse, not better.',
      '<div class="c-row">' +
        field('Base rent (' + cur + ')', '<input type="number" min="0" step="25" data-c="price" value="' + esc(draft.price) + '">', 'In ' + cur + ' — ' + sym + ' is what this market charges in.') +
        field('Deposit (' + cur + ')', '<input type="number" min="0" step="25" data-c="deposit" value="' + esc(draft.deposit) + '">',
          depCap != null
            ? 'Capped at ' + money(depCap, cur) + ' here' + (r.depositSrc ? ' — ' + esc(r.depositSrc.label) : '') + '. RentLeaks never holds it; it goes direct to you.'
            : 'RentLeaks never holds this. It goes direct to you.') +
      '</div>' +
      '<div class="c-field"><label>Fees</label><div class="c-fees">' + rows + '</div>' +
        '<button type="button" class="btn btn--outline btn--sm" id="c-addfee" style="margin-top:var(--s-2);justify-self:start">Add a fee</button>' +
        (r.applicationFeeBanned ? '<small>Application fees are barred outright in this market, and so is any charge demanded before or at the start of the tenancy. Background and credit may be recovered up to ' + money(r.screeningFeeCap || 20, cur) + ', waived if the renter brings their own report from the last 30 days.</small>' : '') +
      '</div>' +
      '<div class="c-row" style="margin-top:var(--s-4)">' +
        field('Housing vouchers and subsidies', r.soiProtected
          ? '<input type="text" value="Accepted — required here" disabled>'
          : '<select data-c="vouchers"><option value="true"' + (draft.vouchers ? ' selected' : '') + '>Accepted</option><option value="false"' + (!draft.vouchers ? ' selected' : '') + '>Not set up for them</option></select>',
          r.soiProtected
            ? 'Source of income is protected in this market. Refusing a voucher, or applying an income multiple to the full rent rather than the renter’s share, is the violation platforms most often miss.'
            : 'Saying yes widens your pool considerably and costs nothing.') +
        field('Pets', '<select data-c="pets">' +
          [['none', 'No pets'], ['cats', 'Cats'], ['dogs', 'Dogs'], ['both', 'Cats and dogs']].map(function (p) {
            return '<option value="' + p[0] + '"' + (draft.pets === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
          }).join('') + '</select>', 'A pet policy is about the property. Assistance animals are not pets and are not covered by it.') +
      '</div>');
  }

  function sectionTakeover(r) {
    var remaining = draft.leaseEnd ? Math.max(0, Math.round((daysBetween(todayISO(), draft.leaseEnd) || 0) / 30)) : 0;
    return sec('The lease you are handing over', 'The three facts that decide whether a takeover completes or collapses. Settling them now is the whole difference.',
      '<div class="c-row">' +
        field('Lease ends', '<input type="date" data-c="leaseEnd" value="' + esc(draft.leaseEnd) + '" min="' + todayISO() + '">',
          remaining ? 'About ' + remaining + ' month' + (remaining === 1 ? '' : 's') + ' remaining.' : '') +
        field('Route', '<select data-c="takeoverType">' +
          '<option value="sublet"' + (draft.takeoverType === 'sublet' ? ' selected' : '') + '>Sublet — I stay on the lease</option>' +
          '<option value="assignment"' + (draft.takeoverType === 'assignment' ? ' selected' : '') + '>Assignment — I come off it entirely</option>' +
          '</select>', draft.takeoverType === 'assignment'
            ? 'An assignment needs written consent and it can usually be refused without a reason. There is no clock on this route.'
            : 'A sublet keeps you liable — and in some markets it is the only route where silence from the landlord eventually counts as a yes.') +
        field('Landlord consent', '<select data-c="consentStatus">' +
          [['granted', 'Granted in writing'], ['served', 'Requested, awaiting a reply'], ['pending', 'Not asked yet']].map(function (c) {
            return '<option value="' + c[0] + '"' + (draft.consentStatus === c[0] ? ' selected' : '') + '>' + c[1] + '</option>';
          }).join('') + '</select>', 'Shown on the listing either way. Renters would rather know now.') +
      '</div>' +
      '<p class="v-note"><b>What you may charge.</b> ' +
        (r.moveInFeesBarred && r.subLessorNamed
          ? 'Nothing for the handover itself — the rule barring charges at the start of a tenancy names sub-lessors, not only landlords. Background and credit up to ' + money(r.screeningFeeCap || 20, currencyFor(draft.cityId)) + ', and a deposit inside the cap. That is the lot.'
          : 'Keep it to rent, a lawful deposit and any screening cost. RentLeaks never collects a handover fee on your behalf in any market.') +
        (r.subletSurchargePct ? ' If this unit is rent-regulated, a sublet may carry at most a ' + r.subletSurchargePct + '% furnished surcharge over the legal rent — going over is profiteering, and in the leading case it cost the tenant the apartment outright.' : '') +
      '</p>');
  }

  function sectionAccess(r) {
    return sec('Getting in and around', 'Physical facts about the building. This is the one accessibility-adjacent filter that lowers fair-housing risk rather than creating it, because it describes a step rather than a person — and it is genuinely hard to find anywhere else.',
      '<div class="x-facets" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));display:grid">' +
        ACCESS.map(function (a) {
          return '<label class="x-facet"><input type="checkbox" data-c-access="' + a[0] + '"' + (draft.access.indexOf(a[0]) !== -1 ? ' checked' : '') + '><span>' + esc(a[1]) + '</span></label>';
        }).join('') +
      '</div>');
  }

  function sectionWords() {
    var hits = X.scanText ? X.scanText(draft.title + ' ' + draft.description) : [];
    return sec('Description', 'Write it for the person who will actually live there. The listings that convert say the awkward thing — the radiator, the 6am deliveries, the housemate who practises trumpet — before the viewing does.',
      '<div class="c-field">' +
        '<textarea data-c="description" rows="7" placeholder="Who else lives here. What is genuinely included. What the building is like at eight in the morning. What you would want to be told.">' + esc(draft.description) + '</textarea>' +
        '<small>' + draft.description.trim().length + ' characters</small>' +
      '</div>' +
      (hits.length
        ? '<div class="x-guard is-on"><b>This cannot be published.</b> “' + esc(hits[0]) + '” states a preference based on a protected characteristic, which is prohibited in a housing advertisement whoever wrote it. Describe the home, not the person you want in it — “two flights of stairs, no lift” is lawful and more useful than “no wheelchair”.</div>'
        : ''));
  }

  function aside(cur, r) {
    var cs = checks();
    var pct = completeness();
    var blocked = cs.filter(function (c) { return c.blocking && !c.ok; });
    var monthly = monthlyFees(), once = onceFees();

    return '' +
      '<div class="c-allin">' +
        '<span class="c-allin__k">All-in, per month</span>' +
        '<div class="c-allin__v">' + esc(money(allIn(), cur)) + '</div>' +
        '<div class="c-allin__rows">' +
          '<div class="c-allin__row"><span>Base rent</span><span>' + esc(money(draft.price, cur)) + '</span></div>' +
          '<div class="c-allin__row"><span>Monthly fees</span><span>' + esc(money(monthly, cur)) + '</span></div>' +
          (once ? '<div class="c-allin__row"><span>One-off</span><span>' + esc(money(once, cur)) + '</span></div>' : '') +
          (draft.deposit ? '<div class="c-allin__row"><span>Deposit (paid to you)</span><span>' + esc(money(draft.deposit, cur)) + '</span></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="c-meter">' +
        '<div class="c-meter__top"><span class="c-meter__pct">' + pct + '%</span>' +
        '<span style="font-size:var(--text-xs);color:var(--ink-3)">' + (blocked.length ? blocked.length + ' to fix' : 'ready') + '</span></div>' +
        '<span class="c-meter__bar"><span class="c-meter__fill"' + (blocked.length ? '' : ' data-tone="done"') + ' style="width:' + pct + '%"></span></span>' +
        '<ul class="c-checks">' +
          cs.map(function (c) {
            var st = c.ok ? '1' : (c.blocking ? 'block' : '0');
            return '<li class="c-check" data-ok="' + st + '">' +
              '<span class="c-check__m" aria-hidden="true">' + (c.ok ? '✓' : c.blocking ? '!' : '–') + '</span>' +
              '<span><b>' + esc(c.title) + '</b>' + esc(c.why) + '</span></li>';
          }).join('') +
        '</ul>' +
      '</div>' +
      '<div class="c-publish">' +
        '<button type="button" class="btn btn--primary btn--lg" id="c-publish"' + (blocked.length ? ' disabled' : '') + '>' +
          (blocked.length ? blocked.length + ' thing' + (blocked.length === 1 ? '' : 's') + ' to fix' : 'Publish listing') + '</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" id="c-preview">Preview as a renter</button>' +
        '<p class="v-note" style="margin-top:var(--s-2)">' +
          (isLeaseBreak()
            ? 'Lease-breaks publish free. Empty months help nobody.'
            : 'Listing fee applies once you publish. Nothing is charged to renters, ever.') +
        '</p>' +
      '</div>';
  }

  /* =======================================================================
     Binding
     ======================================================================= */

  var rerenderTimer = null;
  function touch(full) {
    saveDraft();
    if (full) { render(); return; }
    /* Light path: refresh only the sidebar while someone is typing, so the
       caret never moves. */
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(function () {
      var side = $('.c-aside');
      if (side) side.innerHTML = aside(currencyFor(draft.cityId), rulesNow());
      bindAside();
    }, 180);
  }

  function bind() {
    $$('[data-c]').forEach(function (el) {
      var key = el.getAttribute('data-c');
      var ev = (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'checkbox') ? 'change' : 'input';
      el.addEventListener(ev, function () {
        var val = el.type === 'checkbox' ? el.checked : el.value;
        if (key === 'vouchers') val = val === 'true';
        if (['beds', 'baths', 'sqft', 'price', 'deposit', 'minStayMonths', 'maxStayMonths'].indexOf(key) !== -1) {
          val = val === '' ? '' : Number(val);
        }
        draft[key] = val;
        /* Anything that changes the SHAPE of the form redraws it; plain text
           does not, so typing stays smooth. */
        var structural = ['cityId', 'housingType', 'availableFrom', 'takeoverType'].indexOf(key) !== -1;
        touch(structural);
      });
    });

    $$('input[name="c-role"]').forEach(function (el) {
      el.addEventListener('change', function () { draft.role = el.value; touch(true); });
    });

    $$('[data-c-amenity]').forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-c-amenity');
        var i = draft.amenities.indexOf(k);
        if (el.checked && i === -1) draft.amenities.push(k);
        if (!el.checked && i !== -1) draft.amenities.splice(i, 1);
        touch();
      });
    });

    $$('[data-c-access]').forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-c-access');
        var i = draft.access.indexOf(k);
        if (el.checked && i === -1) draft.access.push(k);
        if (!el.checked && i !== -1) draft.access.splice(i, 1);
        touch();
      });
    });

    bindFees();
    bindPhotos();
    bindAside();
  }

  function bindFees() {
    $$('[data-c-feetype]').forEach(function (el) {
      el.addEventListener('change', function () {
        var i = Number(el.getAttribute('data-c-feetype'));
        draft.fees[i].type = el.value;
        var meta = FEE_TYPES.filter(function (t) { return t[0] === el.value; })[0];
        if (meta) draft.fees[i].cadence = meta[2];
        touch(true);
      });
    });
    $$('[data-c-feeamt]').forEach(function (el) {
      el.addEventListener('input', function () {
        draft.fees[Number(el.getAttribute('data-c-feeamt'))].amount = Number(el.value || 0);
        touch();
      });
    });
    $$('[data-c-feecad]').forEach(function (el) {
      el.addEventListener('change', function () {
        draft.fees[Number(el.getAttribute('data-c-feecad'))].cadence = el.value;
        touch();
      });
    });
    $$('[data-c-feereq]').forEach(function (el) {
      el.addEventListener('change', function () {
        draft.fees[Number(el.getAttribute('data-c-feereq'))].mandatory = el.checked;
        touch();
      });
    });
    $$('[data-c-feerm]').forEach(function (el) {
      el.addEventListener('click', function () {
        draft.fees.splice(Number(el.getAttribute('data-c-feerm')), 1);
        touch(true);
      });
    });
    var add = $('#c-addfee');
    if (add) add.addEventListener('click', function () {
      draft.fees.push({ type: 'wifi', amount: 0, cadence: 'monthly', mandatory: true });
      touch(true);
    });
  }

  function bindPhotos() {
    var drop = $('#c-drop');
    var input = $('#c-photos');
    if (!drop || !input) return;

    function accept(files) {
      var list = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
      if (!list.length) return;
      var pending = list.length;
      list.slice(0, 20).forEach(function (f) {
        var url = URL.createObjectURL(f);
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          var scale = Math.min(1, 1600 / img.width);
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          /* Same analyser the verification desk uses, so a dark, blurry
             listing photo gets flagged exactly like a dark, blurry ID. */
          var q = VERIFY.analyse ? VERIFY.analyse(c, null) : null;
          draft.photos.push({ url: url, label: ROOM_LABELS[Math.min(draft.photos.length, ROOM_LABELS.length - 1)], quality: q, name: f.name });
          if (--pending === 0) touch(true);
        };
        img.onerror = function () { if (--pending === 0) touch(true); };
        img.src = url;
      });
    }

    input.addEventListener('change', function () { accept(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (ev) {
      if (ev.dataTransfer) accept(ev.dataTransfer.files);
    });

    $$('[data-c-photorm]').forEach(function (el) {
      el.addEventListener('click', function () {
        var i = Number(el.getAttribute('data-c-photorm'));
        try { URL.revokeObjectURL(draft.photos[i].url); } catch (e) {}
        draft.photos.splice(i, 1);
        touch(true);
      });
    });
    $$('[data-c-photocover]').forEach(function (el) {
      el.addEventListener('click', function () {
        var i = Number(el.getAttribute('data-c-photocover'));
        var p = draft.photos.splice(i, 1)[0];
        draft.photos.unshift(p);
        touch(true);
      });
    });
    $$('[data-c-photolabel]').forEach(function (el) {
      el.addEventListener('change', function () {
        draft.photos[Number(el.getAttribute('data-c-photolabel'))].label = el.value;
        touch();
      });
    });
  }

  function bindAside() {
    var pub = $('#c-publish');
    if (pub) pub.addEventListener('click', publish);
    var prev = $('#c-preview');
    if (prev) prev.addEventListener('click', function () {
      alert('Preview opens the renter-facing page for this draft. All-in ' +
        money(allIn(), currencyFor(draft.cityId)) + ' per month, ' +
        draft.photos.length + ' photographs, ' +
        (windowDays() ? windowDays() + ' days open' : 'no window set') + '.');
    });
  }

  function publish() {
    if (blockers().length) return;
    var cur = currencyFor(draft.cityId);
    var city = cityOf(draft.cityId) || {};
    var fees = {};
    draft.fees.forEach(function (f) { if (f.cadence === 'monthly') fees[f.type] = Number(f.amount) || 0; });

    var listing = {
      id: 'mine-' + Date.now().toString(36),
      type: 'rent',
      housingType: draft.housingType,
      title: draft.title,
      address: draft.address + (draft.unit ? ', #' + draft.unit : ''),
      neighborhood: draft.neighborhood,
      cityId: draft.cityId,
      cityName: city.name || '',
      state: city.state || '',
      country: city.country || 'US',
      currency: cur,
      price: Number(draft.price) || 0,
      allIn: allIn(),
      allInUsd: DATA.toUsd ? Math.round(DATA.toUsd(allIn(), cur)) : allIn(),
      fees: fees,
      deposit: Number(draft.deposit) || 0,
      beds: Number(draft.beds) || 0,
      baths: Number(draft.baths) || 0,
      sqft: Number(draft.sqft) || 0,
      lat: city.lat, lng: city.lng,
      minStayMonths: Number(draft.minStayMonths) || 1,
      maxStayMonths: Number(draft.maxStayMonths) || 12,
      availableFrom: draft.availableFrom,
      availableUntil: draft.availableUntil,
      leaseEnd: draft.leaseEnd || null,
      takeoverType: isLeaseBreak() ? draft.takeoverType : null,
      consentStatus: isLeaseBreak() ? draft.consentStatus : null,
      furnishedLevel: draft.furnishedLevel,
      amenities: draft.amenities,
      accessibility: draft.access,
      vouchersAccepted: !!draft.vouchers,
      pets: draft.pets !== 'none',
      registrationNumber: draft.registrationNumber || null,
      description: draft.description,
      specs: [draft.beds + ' bed', draft.baths + ' bath', draft.sqft ? draft.sqft + ' sqft' : null].filter(Boolean).join(' · '),
      image: draft.photos[0] ? draft.photos[0].url : '',
      images: draft.photos.map(function (p) { return p.url; }),
      gallery: draft.photos.map(function (p) { return { kind: 'photo', src: p.url, caption: p.label, alt: draft.title + ' — ' + p.label }; }),
      listedBy: draft.role,
      postedAt: new Date().toISOString(),
      location: (city.name || '') + ' · ' + draft.neighborhood
    };

    var mine = read('rl_my_listings', []);
    mine.unshift(listing);
    write('rl_my_listings', mine);

    var el = host();
    if (el) {
      el.innerHTML =
        '<div class="v-card" style="max-width:640px;margin:0 auto">' +
          '<span class="v-kicker">Published</span>' +
          '<h1 class="v-title">' + esc(draft.title) + ' is live</h1>' +
          '<p class="v-lede">All-in ' + esc(money(allIn(), cur)) + ' a month, open ' +
            (windowDays() || '—') + ' days from ' + esc(draft.availableFrom) + ', with ' + draft.photos.length + ' photographs. ' +
            'It carries the availability window, the itemised fees and the accessibility attributes, so it can answer a date-range search and be read properly by an assistant.</p>' +
          '<div class="v-actions">' +
            '<a class="btn btn--primary" href="rent.html?city=' + encodeURIComponent(draft.cityId) + '">See it in search</a>' +
            '<button type="button" class="btn btn--ghost" id="c-another">List another</button>' +
          '</div>' +
        '</div>';
      var again = $('#c-another');
      if (again) again.addEventListener('click', function () {
        draft.photos = [];
        draft.title = ''; draft.description = ''; draft.address = '';
        render();
      });
    }
  }

  /* =======================================================================
     Boot — take over #rl-list after the base wizard has rendered into it
     ======================================================================= */

  function boot() {
    if (!host()) return;
    if ((document.body.dataset.page || '') !== 'list' && !/list\.html/.test(location.pathname)) return;
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 140); });
  } else {
    setTimeout(boot, 140);
  }

  window.RENTLEAKS_COMPOSER = {
    version: '1.0.0',
    draft: function () { return draft; },
    checks: checks,
    blockers: blockers,
    allIn: allIn,
    render: render
  };
})();
