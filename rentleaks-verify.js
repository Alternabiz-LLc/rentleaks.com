/**
 * RentLeaks — Verification Desk
 * ---------------------------------------------------------------------------
 * A platform that handles no money has exactly one trust product: knowing who
 * the person letting the home is, and whether they can actually let it. This
 * is that flow.
 *
 * It answers four separate questions, and it keeps them separate, because
 * collapsing them into one "verified" badge is what makes the badge worthless:
 *
 *   1. Is this a real, valid identity document?      → guided ID capture
 *   2. Is the person holding it the person in it?    → selfie + active challenge
 *   3. Can they actually let this address?           → ownership documents
 *   4. Does someone at that address have the code?   → posted code
 *
 * PRIVACY POSTURE — this is load-bearing, not boilerplate.
 * Captured images live in memory for the length of the session and are never
 * written to localStorage, never uploaded, and never persisted anywhere. Only
 * the OUTCOME is kept: which checks passed, on what date. The images are wiped
 * on submit, on navigation, and on tab hide. In a production build the frames
 * would go straight to an identity vendor over TLS and be discarded after the
 * match; the point of holding nothing here is that the same promise the trust
 * ledger makes to renters is one the code actually keeps.
 *
 * The quality checks are real, not theatre. Blur is a Laplacian variance on the
 * captured frame; glare is the share of blown-out pixels; darkness is mean
 * luma; framing is edge density inside the guide versus outside. Bad captures
 * are the single largest cause of failed identity checks, so catching them
 * before submission is most of the value a capture UI adds.
 *
 * What this is NOT: a document authenticity check, a real biometric liveness
 * test, or a title search. Those need a vendor and a registry. The flow is
 * built so each step hands off cleanly to one.
 */
(function () {
  'use strict';

  var STORE = { result: 'rl_verify_result' };

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function read(k, f) {
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(iso) {
    try { return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return iso; }
  }

  /* =======================================================================
     In-memory vault. Nothing here is ever serialised.
     ======================================================================= */

  var vault = {
    idFront: null,   // { blobUrl, w, h, quality }
    idBack: null,
    selfie: null,
    docs: []         // [{ name, size, type, kind, blobUrl }]
  };

  function wipe() {
    ['idFront', 'idBack', 'selfie'].forEach(function (k) {
      if (vault[k] && vault[k].blobUrl) { try { URL.revokeObjectURL(vault[k].blobUrl); } catch (e) {} }
      vault[k] = null;
    });
    vault.docs.forEach(function (d) { if (d.blobUrl) { try { URL.revokeObjectURL(d.blobUrl); } catch (e) {} } });
    vault.docs = [];
  }

  window.addEventListener('pagehide', wipe);
  document.addEventListener('visibilitychange', function () {
    /* Leaving the tab mid-flow should not leave a document sitting in memory
       behind a lock screen. */
    if (document.visibilityState === 'hidden') stopCamera();
  });

  /* =======================================================================
     Image quality — the part that decides whether a check succeeds
     ======================================================================= */

  /**
   * Laplacian variance over a downsampled grayscale frame. Low variance means
   * few sharp edges, which means blur. The threshold is empirical; it is set
   * permissive because a false reject is more annoying than a soft accept.
   */
  function analyse(canvas, guide) {
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var W = canvas.width, H = canvas.height;
    var img;
    try { img = ctx.getImageData(0, 0, W, H); } catch (e) { return null; }
    var px = img.data;

    // Downsample to grayscale on a fixed grid so the score is resolution-independent.
    var GW = 240, GH = Math.max(1, Math.round(GW * H / W));
    var gray = new Float32Array(GW * GH);
    var sum = 0, blown = 0, dark = 0, total = GW * GH;

    for (var y = 0; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var sx = Math.min(W - 1, Math.round(x * W / GW));
        var sy = Math.min(H - 1, Math.round(y * H / GH));
        var i = (sy * W + sx) * 4;
        var v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        gray[y * GW + x] = v;
        sum += v;
        if (v > 248) blown++;
        if (v < 26) dark++;
      }
    }

    var mean = sum / total;

    // Laplacian
    var lapSum = 0, lapSq = 0, n = 0;
    for (var yy = 1; yy < GH - 1; yy++) {
      for (var xx = 1; xx < GW - 1; xx++) {
        var c = gray[yy * GW + xx];
        var lap = (gray[(yy - 1) * GW + xx] + gray[(yy + 1) * GW + xx] +
                   gray[yy * GW + (xx - 1)] + gray[yy * GW + (xx + 1)] - 4 * c);
        lapSum += lap; lapSq += lap * lap; n++;
      }
    }
    var lapMean = n ? lapSum / n : 0;
    var variance = n ? (lapSq / n) - (lapMean * lapMean) : 0;

    // Edge density inside the guide rectangle vs the whole frame. A document
    // that fills the guide puts most of its edges inside it.
    var inside = 0, outside = 0;
    if (guide) {
      var gx0 = Math.round(guide.x * GW), gx1 = Math.round((guide.x + guide.w) * GW);
      var gy0 = Math.round(guide.y * GH), gy1 = Math.round((guide.y + guide.h) * GH);
      for (var y2 = 1; y2 < GH - 1; y2++) {
        for (var x2 = 1; x2 < GW - 1; x2++) {
          var c2 = gray[y2 * GW + x2];
          var e = Math.abs(gray[y2 * GW + (x2 + 1)] - c2) + Math.abs(gray[(y2 + 1) * GW + x2] - c2);
          if (e > 18) {
            if (x2 >= gx0 && x2 <= gx1 && y2 >= gy0 && y2 <= gy1) inside++; else outside++;
          }
        }
      }
    }

    var issues = [];
    if (variance < 55) issues.push({ k: 'blur', msg: 'Too soft. Hold still, or move a little further away and let it focus.' });
    if (blown / total > 0.055) issues.push({ k: 'glare', msg: 'Glare across the surface. Tilt it away from the light or move out of direct sun.' });
    if (mean < 62) issues.push({ k: 'dark', msg: 'Too dark to read. Find a brighter spot — daylight indoors is ideal.' });
    if (mean > 218) issues.push({ k: 'bright', msg: 'Washed out. Move away from the light source.' });
    if (guide && (inside + outside) > 0 && inside / (inside + outside) < 0.42) {
      issues.push({ k: 'framing', msg: 'Fill the frame. Bring it closer so the edges sit just inside the guide.' });
    }

    return {
      sharpness: Math.round(variance),
      brightness: Math.round(mean),
      glare: Math.round((blown / total) * 1000) / 10,
      framing: (inside + outside) ? Math.round((inside / (inside + outside)) * 100) : null,
      issues: issues,
      ok: issues.length === 0
    };
  }

  /* =======================================================================
     Camera
     ======================================================================= */

  var stream = null;
  var liveTimer = null;

  function stopCamera() {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    if (stream) {
      stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      stream = null;
    }
  }

  function cameraSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function startCamera(video, facing, onFail) {
    stopCamera();
    if (!cameraSupported()) { onFail('no-api'); return; }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    }).then(function (s) {
      stream = s;
      video.srcObject = s;
      video.play().catch(function () {});
    }).catch(function (err) {
      onFail(err && err.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    });
  }

  function grab(video) {
    var c = document.createElement('canvas');
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    return c;
  }

  function canvasToRecord(c, quality) {
    return new Promise(function (resolve) {
      c.toBlob(function (blob) {
        resolve({
          blobUrl: blob ? URL.createObjectURL(blob) : c.toDataURL('image/jpeg', 0.9),
          w: c.width, h: c.height, quality: quality, bytes: blob ? blob.size : 0
        });
      }, 'image/jpeg', 0.92);
    });
  }

  /* =======================================================================
     Steps
     ======================================================================= */

  var GUIDE_ID = { x: 0.08, y: 0.20, w: 0.84, h: 0.56 };     // ID-1 card, roughly 85.6 × 54 mm
  var GUIDE_FACE = { x: 0.26, y: 0.10, w: 0.48, h: 0.78 };

  /* Who is doing the verifying decides what evidence even exists. A departing
     tenant has no deed and never will; asking them for one is how a flow
     designed only for owners quietly locks out the whole lease-break side of
     the marketplace. */
  var ROLES = {
    owner: {
      label: 'I own this home',
      blurb: 'You hold title, or your company does.',
      docs: [
        ['deed', 'Deed or property tax record', 'The strongest single document. Your name against the record for this address.'],
        ['mortgage', 'Mortgage statement', 'Recent, showing the property address and your name.'],
        ['utility', 'Utility bill', 'Dated within the last 90 days, at the property address, in your name.'],
        ['hoa', 'HOA, co-op or condo statement', 'A maintenance or common-charge statement in your name.']
      ]
    },
    manager: {
      label: 'I manage it for the owner',
      blurb: 'An agent, a management company, or a leaseholder letting with permission.',
      docs: [
        ['mgmt', 'Management agreement', 'The pages naming you, the owner and this address.'],
        ['auth', 'Written authorisation from the owner', 'Signed and dated, naming this address.'],
        ['utility', 'Utility bill for the property', 'Where the account is in the management company’s name.']
      ]
    },
    subtenant: {
      label: 'I am the tenant, leaving early',
      blurb: 'A lease-break, a sublet or a takeover. You are not the owner and you do not need to be.',
      docs: [
        ['lease', 'Your lease', 'The pages that show your name as tenant, the address, the term dates, and the clause on subletting or assignment. Redact everything else.'],
        ['rider', 'Sublet or assignment rider', 'If your lease has one, or if the landlord issued a separate rider.'],
        ['utility', 'Utility bill in your name at this address', 'Corroborates that you actually live there — which the primary-residence rule requires.']
      ]
    }
  };

  /* Routes to a lawful sublet or assignment. The third one exists because a
     statutory clock is a real route to consent, and no platform tracks it. */
  var CONSENT_ROUTES = {
    written: {
      label: 'I have written consent from the landlord',
      blurb: 'A letter or email from the landlord or managing agent, naming the incoming person or approving the sublet in principle.',
      needsUpload: true
    },
    deemed: {
      label: 'I served a request and they never answered',
      blurb: 'Where the law treats silence as consent, the proof is the service and the date, not a reply. In New York, for a building of four or more units, thirty days from certified-mail service with no response is deemed consent to a sublease. Upload the certified-mail receipt and tell us when you sent it.',
      needsUpload: true
    },
    pending: {
      label: 'I have not asked yet',
      blurb: 'We will assemble the request packet for you from your listing. Nothing here blocks you publishing — the listing simply will not carry the consent badge, and renters will see that it does not.',
      needsUpload: false
    }
  };

  var state = {
    step: 0,
    challengeIndex: 0,
    codeEntered: '',
    addressLine: '',
    role: null,
    consentRoute: null,
    servedOn: '',
    disclosure: {},
    signature: ''
  };

  function roleMeta() { return ROLES[state.role] || ROLES.owner; }
  function isSub() { return state.role === 'subtenant'; }

  /* The step list is a function of the role, not a constant. */
  function buildSteps() {
    var out = [
      { id: 'intro',    label: 'Start' },
      { id: 'role',     label: 'Your role' },
      { id: 'id-front', label: 'ID front' },
      { id: 'id-back',  label: 'ID back' },
      { id: 'selfie',   label: 'Selfie' },
      { id: 'address',  label: isSub() ? 'Your lease' : 'Address' }
    ];
    if (isSub()) {
      out.push({ id: 'consent', label: 'Landlord consent' });
      out.push({ id: 'disclosure', label: 'Disclosure' });
    } else {
      out.push({ id: 'code', label: 'Posted code' });
    }
    out.push({ id: 'done', label: 'Result' });
    return out;
  }

  var steps = buildSteps();

  function root() { return $('#rl-verify'); }

  /* Step counters have to follow the branch, not a constant — the tenant path
     has one more step than the owner path. */
  function stepCount() { return steps.length - 2; }           // minus intro and result
  function stepNo(id) {
    for (var i = 0; i < steps.length; i++) if (steps[i].id === id) return i - 1;
    return 1;
  }
  function counter(id) { return 'Step ' + stepNo(id) + ' of ' + stepCount(); }

  function render() {
    var host = root();
    if (!host) return;
    stopCamera();
    var s = steps[state.step];
    host.innerHTML =
      '<div class="v-shell">' +
        stepper() +
        '<div class="v-stage" id="v-stage">' + view(s.id) + '</div>' +
        privacyBar() +
      '</div>';
    bind(s.id);
    var stage = $('#v-stage');
    if (stage) stage.focus({ preventScroll: true });
  }

  function stepper() {
    return '<ol class="v-steps" aria-label="Verification progress">' +
      steps.map(function (s, i) {
        var st = i < state.step ? 'done' : i === state.step ? 'now' : 'todo';
        return '<li class="v-step" data-state="' + st + '">' +
          '<span class="v-step__dot" aria-hidden="true">' + (st === 'done' ? '✓' : (i + 1)) + '</span>' +
          '<span class="v-step__label">' + esc(s.label) + '</span></li>';
      }).join('') + '</ol>';
  }

  function privacyBar() {
    return '<p class="v-privacy">' +
      '<strong>Nothing you capture here leaves this device.</strong> The photographs stay in memory for as long as this page is open, are never written to storage, never uploaded, and are wiped when you submit or navigate away. Only the result is kept — which checks passed, and the date. ' +
      '<button type="button" class="v-link" id="v-wipe">Wipe everything now</button></p>';
  }

  /* --- views ------------------------------------------------------------- */

  function view(id) {
    if (id === 'intro') return viewIntro();
    if (id === 'role') return viewRole();
    if (id === 'id-front') return viewCapture('front');
    if (id === 'id-back') return viewCapture('back');
    if (id === 'selfie') return viewSelfie();
    if (id === 'address') return viewAddress();
    if (id === 'consent') return viewConsent();
    if (id === 'disclosure') return viewDisclosure();
    if (id === 'code') return viewCode();
    return viewDone();
  }

  function viewRole() {
    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">First</span>' +
        '<h1 class="v-title">Which of these are you?</h1>' +
        '<p class="v-lede">This decides what we ask for next. There is no wrong answer and no hierarchy — a tenant leaving early is not a second-class lister here, they just hold different paper.</p>' +
        '<div class="v-roles">' +
          Object.keys(ROLES).map(function (k) {
            var r = ROLES[k];
            return '<label class="v-role' + (state.role === k ? ' is-on' : '') + '">' +
              '<input type="radio" name="v-role" value="' + k + '"' + (state.role === k ? ' checked' : '') + '>' +
              '<span><b>' + esc(r.label) + '</b>' + esc(r.blurb) + '</span></label>';
          }).join('') +
        '</div>' +
        '<div class="v-actions">' +
          '<button type="button" class="btn btn--ghost" data-v-back>Back</button>' +
          '<button type="button" class="btn btn--primary" data-v-next' + (state.role ? '' : ' disabled') + '>Continue</button>' +
        '</div>' +
      '</div>';
  }

  function viewConsent() {
    var route = state.consentRoute;
    var uploaded = vault.docs.filter(function (d) { return d.kind === 'consent' || d.kind === 'service'; });

    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">' + counter('consent') + '</span>' +
        '<h1 class="v-title">Does the landlord know?</h1>' +
        '<p class="v-lede">This is the question that kills lease takeovers, and it kills them late — after someone has viewed, applied and given notice on their own place. Settling it before the listing goes up is the whole point of asking now. A sublet without consent can be grounds to end the tenancy, and the person who inherits that problem is the renter you are handing the keys to.</p>' +
        '<div class="v-roles">' +
          Object.keys(CONSENT_ROUTES).map(function (k) {
            var c = CONSENT_ROUTES[k];
            return '<label class="v-role' + (route === k ? ' is-on' : '') + '">' +
              '<input type="radio" name="v-consent" value="' + k + '"' + (route === k ? ' checked' : '') + '>' +
              '<span><b>' + esc(c.label) + '</b>' + esc(c.blurb) + '</span></label>';
          }).join('') +
        '</div>' +
        (route === 'deemed'
          ? '<label class="v-field"><span>Date you served the request</span>' +
            '<input type="date" id="v-served" value="' + esc(state.servedOn) + '" max="' + todayISO() + '"></label>' +
            servedReadout()
          : '') +
        (route && CONSENT_ROUTES[route].needsUpload
          ? '<div class="v-docgrid">' +
              '<label class="v-docpick"><input type="file" accept="image/*,application/pdf" data-v-doc="' + (route === 'deemed' ? 'service' : 'consent') + '">' +
              '<span><b>' + (route === 'deemed' ? 'Certified-mail receipt or proof of service' : 'The landlord’s written consent') + '</b>' +
              (route === 'deemed' ? 'The receipt, the tracking record, or the returned green card.' : 'Letter, email or signed rider. A verbal yes is worth nothing here.') + '</span></label>' +
            '</div>' +
            (uploaded.length
              ? '<ul class="v-doclist">' + uploaded.map(function (d) {
                  return '<li class="v-doc"><span class="v-doc__mark" aria-hidden="true">✓</span>' +
                    '<span class="v-doc__body"><b>' + (d.kind === 'service' ? 'Proof of service' : 'Written consent') + '</b>' +
                    '<span>' + esc(d.name) + ' · ' + Math.round(d.size / 1024) + ' KB</span></span>' +
                    '<button type="button" class="v-link" data-v-rmdoc="' + vault.docs.indexOf(d) + '">Remove</button></li>';
                }).join('') + '</ul>'
              : '')
          : '') +
        (route === 'pending'
          ? '<p class="v-note"><b>We will build the packet.</b> Where the law sets out what a sublet request must contain, the desk on your listing assembles it — the term, the incoming person’s details, the reason, your address during the sublease, any co-tenant consent, and the proposed sublease attached to the original lease — and starts the clock on the day you post it. Serving it properly is what makes silence mean something later.</p>'
          : '') +
        '<div class="v-actions">' +
          '<button type="button" class="btn btn--ghost" data-v-back>Back</button>' +
          '<button type="button" class="btn btn--primary" data-v-next' + (route ? '' : ' disabled') + '>Continue</button>' +
        '</div>' +
      '</div>';
  }

  function servedReadout() {
    if (!state.servedOn) return '';
    var served = new Date(state.servedOn + 'T00:00:00');
    if (isNaN(served.getTime())) return '';
    var days = Math.floor((Date.now() - served.getTime()) / 86400000);
    var left = 30 - days;
    if (days < 0) return '';
    return '<div class="v-clock" data-state="' + (left <= 0 ? 'done' : 'run') + '">' +
      '<span class="v-clock__n">' + (left > 0 ? left : 0) + '</span>' +
      '<span>' + (left > 0
        ? 'days left in the decision window. Served ' + days + ' day' + (days === 1 ? '' : 's') + ' ago. If they do not answer, and the building qualifies, silence becomes consent on ' + esc(fmtDate(new Date(served.getTime() + 30 * 86400000).toISOString().slice(0, 10))) + '.'
        : 'The window closed ' + (days - 30) + ' day' + (days - 30 === 1 ? '' : 's') + ' ago with no answer recorded. Where silence is deemed consent, that is your consent — and the receipt above is the proof of it.') +
      '</span></div>';
  }

  var ATTESTATIONS = [
    ['primary', 'This is my primary residence and I intend to return to it.', 'Regulated sublets turn on this. Saying it when it is not true is how tenants lose the apartment outright.'],
    ['regulated', 'I have stated whether this unit is rent-regulated, and I know what that caps me at.', 'Where it is regulated, the rent to a subtenant is the legal regulated rent plus at most a small furnished allowance. Over that is profiteering — treble damages, and in the leading case an incurable ground for eviction.'],
    ['nofee', 'I am not charging any access, key, finder’s or takeover fee.', 'A charge demanded before or at the start of a tenancy is barred in some markets to sub-lessors by name, not only to landlords. RentLeaks does not collect one for you in any market.'],
    ['accurate', 'The rent, the term, the deposit and the fees on my listing are accurate and complete.', 'This is also the fee-disclosure duty: every charge the incoming person will owe has to be on the listing itself.'],
    ['consent', 'I will not hand over keys before the landlord’s consent is settled.', 'Either written, or the clock run out and documented.']
  ];

  function viewDisclosure() {
    var d = state.disclosure;
    var all = ATTESTATIONS.every(function (a) { return d[a[0]]; });
    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">' + counter('disclosure') + '</span>' +
        '<h1 class="v-title">Sign the disclosure</h1>' +
        '<p class="v-lede">Five statements. They are the ones that decide whether the person taking your lease ends up with a home or with a problem, and every one of them is a rule someone has lost an apartment over. Read them rather than clicking through.</p>' +
        '<div class="v-attest">' +
          ATTESTATIONS.map(function (a) {
            return '<label class="v-attest__row' + (d[a[0]] ? ' is-on' : '') + '">' +
              '<input type="checkbox" data-v-attest="' + a[0] + '"' + (d[a[0]] ? ' checked' : '') + '>' +
              '<span><b>' + esc(a[1]) + '</b>' + esc(a[2]) + '</span></label>';
          }).join('') +
        '</div>' +
        '<label class="v-field v-field--sign"><span>Type your full legal name to sign</span>' +
          '<input type="text" id="v-sign" value="' + esc(state.signature) + '" placeholder="Your full legal name" autocomplete="name" spellcheck="false"></label>' +
        '<p class="v-note">Signed ' + esc(fmtDate(todayISO())) + ' and kept for three years, which is what the disclosure rule requires where one applies. The incoming renter gets a copy at the same moment you do — a disclosure only one side holds is not a disclosure.</p>' +
        '<div class="v-actions">' +
          '<button type="button" class="btn btn--ghost" data-v-back>Back</button>' +
          '<button type="button" class="btn btn--primary" data-v-next' + (all && state.signature.trim().length > 2 ? '' : ' disabled') + '>Sign and finish</button>' +
        '</div>' +
      '</div>';
  }

  function viewIntro() {
    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">Verification desk</span>' +
        '<h1 class="v-title">Prove who you are, and that this place is yours to let</h1>' +
        '<p class="v-lede">RentLeaks never handles anyone’s money, so this is the whole of our trust product. It is also the only thing that reliably separates a real landlord from someone who copied your photographs off another site. It takes about four minutes and costs nothing — no application fee, no listing fee, no charge of any kind.</p>' +
        '<div class="v-what">' +
          '<div class="v-what__item"><span class="v-what__n">1</span><div><b>Scan your ID</b><p>Both sides of a passport, driving licence or national ID. We check the capture is readable before you send it.</p></div></div>' +
          '<div class="v-what__item"><span class="v-what__n">2</span><div><b>Take a selfie</b><p>Matched against the photograph on the document, with a short movement check so a still photo cannot pass.</p></div></div>' +
          '<div class="v-what__item"><span class="v-what__n">3</span><div><b>Show you can let it</b><p>Owners: a deed, tax record, mortgage statement or utility bill. Tenants leaving early: your lease, plus the landlord’s consent or proof you asked properly and the clock ran out. This is the check almost nobody runs, and it is the one that stops listing hijacking.</p></div></div>' +
          '<div class="v-what__item"><span class="v-what__n">4</span><div><b>Close the loop</b><p>Owners enter a code we post to the property — someone who cannot reach the building cannot pass it. Tenants sign a short disclosure instead, because the rules that bind a sublet are the ones people lose apartments over.</p></div></div>' +
        '</div>' +
        '<div class="v-badges-preview">' +
          '<div><span class="v-badge v-badge--id">ID verified</span><p>Steps 1 and 2. It says we know who you are.</p></div>' +
          '<div><span class="v-badge v-badge--listing">Listing verified</span><p>It says you can actually let this address. Different claim, separate badge — collapsing the two is what makes a “verified” tick meaningless.</p></div>' +
          '<div><span class="v-badge v-badge--consent">Consent on file</span><p>Lease-breaks only. It says the landlord has agreed, or was asked properly and let the decision window run out. This is the badge renters taking over a lease actually care about.</p></div>' +
        '</div>' +
        '<div class="v-actions"><button type="button" class="btn btn--primary btn--lg" data-v-next>Begin</button></div>' +
      '</div>';
  }

  function viewCapture(side) {
    var isFront = side === 'front';
    var held = isFront ? vault.idFront : vault.idBack;
    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">' + counter(isFront ? 'id-front' : 'id-back') + '</span>' +
        '<h1 class="v-title">' + (isFront ? 'The front of your ID' : 'The back of your ID') + '</h1>' +
        '<p class="v-lede">' + (isFront
          ? 'Passport, driving licence or national ID card. Lay it on a dark, matte surface in even light — a table by a window beats an overhead bulb, which throws glare straight back at the lens.'
          : 'The reverse, including the machine-readable strip if there is one. Skip this if your document is a passport photo page with nothing on the back.') +
        '</p>' +
        captureStage('id', GUIDE_ID, held) +
        '<div class="v-actions">' +
          '<button type="button" class="btn btn--ghost" data-v-back>Back</button>' +
          (!isFront ? '<button type="button" class="btn btn--ghost" data-v-skip>No back side</button>' : '') +
          '<button type="button" class="btn btn--primary" data-v-next' + (held ? '' : ' disabled') + '>Continue</button>' +
        '</div>' +
      '</div>';
  }

  var CHALLENGES = [
    { key: 'still',  prompt: 'Look straight at the camera and hold still' },
    { key: 'left',   prompt: 'Turn your head slowly to your left' },
    { key: 'closer', prompt: 'Move a little closer to the camera' }
  ];

  function viewSelfie() {
    var held = vault.selfie;
    var ch = CHALLENGES[Math.min(state.challengeIndex, CHALLENGES.length - 1)];
    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">' + counter('selfie') + '</span>' +
        '<h1 class="v-title">Now a photograph of you</h1>' +
        '<p class="v-lede">This gets matched against the picture on the document. The short movement check exists because a printed photograph held up to a lens does not move — it is the cheapest defence against the most common way these flows get spoofed.</p>' +
        '<div class="v-challenge" id="v-challenge"><span class="v-challenge__n">' + (state.challengeIndex + 1) + '/' + CHALLENGES.length + '</span>' + esc(ch.prompt) + '</div>' +
        captureStage('face', GUIDE_FACE, held) +
        '<div class="v-actions">' +
          '<button type="button" class="btn btn--ghost" data-v-back>Back</button>' +
          '<button type="button" class="btn btn--primary" data-v-next' + (held ? '' : ' disabled') + '>Continue</button>' +
        '</div>' +
      '</div>';
  }

  function captureStage(mode, guide, held) {
    if (held) {
      return '' +
        '<div class="v-shot">' +
          '<img src="' + held.blobUrl + '" alt="Captured image, held in memory only">' +
          '<div class="v-shot__meta">' +
            qualityReadout(held.quality) +
            '<button type="button" class="btn btn--outline btn--sm" data-v-retake>Retake</button>' +
          '</div>' +
        '</div>';
    }
    return '' +
      '<div class="v-cam" data-mode="' + mode + '">' +
        '<video id="v-video" playsinline muted autoplay></video>' +
        '<div class="v-guide' + (mode === 'face' ? ' v-guide--oval' : '') + '" style="left:' + (guide.x * 100) + '%;top:' + (guide.y * 100) + '%;width:' + (guide.w * 100) + '%;height:' + (guide.h * 100) + '%"></div>' +
        '<div class="v-hint" id="v-hint" role="status">Starting the camera…</div>' +
      '</div>' +
      '<div class="v-cam-actions">' +
        '<button type="button" class="btn btn--primary" id="v-shoot" disabled>Capture</button>' +
        '<label class="v-upload">Or choose a file' +
          '<input type="file" accept="image/*" id="v-file" ' + (mode === 'face' ? 'capture="user"' : 'capture="environment"') + '>' +
        '</label>' +
      '</div>' +
      '<div class="v-fallback" id="v-fallback" hidden></div>';
  }

  function qualityReadout(q) {
    if (!q) return '<span class="v-q v-q--ok">Accepted</span>';
    if (q.ok) {
      return '<span class="v-q v-q--ok">Readable</span>' +
        '<span class="v-q-detail">sharpness ' + q.sharpness + ' · brightness ' + q.brightness + ' · glare ' + q.glare + '%' + (q.framing != null ? ' · fill ' + q.framing + '%' : '') + '</span>';
    }
    return '<span class="v-q v-q--warn">Accepted with warnings</span>' +
      '<span class="v-q-detail">' + esc(q.issues.map(function (i) { return i.k; }).join(', ')) + '</span>';
  }

  function viewAddress() {
    var kinds = roleMeta().docs;
    var kindIds = kinds.map(function (k) { return k[0]; });
    var mine = vault.docs.filter(function (d) { return kindIds.indexOf(d.kind) !== -1; });

    var rows = mine.map(function (d) {
      var kind = kinds.filter(function (k) { return k[0] === d.kind; })[0];
      return '<li class="v-doc">' +
        '<span class="v-doc__mark" aria-hidden="true">✓</span>' +
        '<span class="v-doc__body"><b>' + esc(kind ? kind[1] : d.kind) + '</b>' +
        '<span>' + esc(d.name) + ' · ' + Math.round(d.size / 1024) + ' KB</span></span>' +
        '<button type="button" class="v-link" data-v-rmdoc="' + vault.docs.indexOf(d) + '">Remove</button></li>';
    }).join('');

    var sub = isSub();

    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">' + counter('address') + '</span>' +
        '<h1 class="v-title">' + (sub ? 'Upload your lease' : 'Show that you control the address') + '</h1>' +
        '<p class="v-lede">' + (sub
          ? 'You do not own this place and nobody expects you to. What proves you can let it is the lease itself — your name on it, this address on it, the term, and whatever it says about subletting or assignment. That last clause is the one worth reading before you go further; some leases bar it outright, and it is better to know now than after someone has given notice on their own flat.'
          : 'This is the check almost no rental platform runs, and it is the one that stops the most common fraud in this category — someone lifting photographs from a real listing and letting a home they have never been inside. One document is enough. Two makes the badge hold up if anyone ever questions it.') +
        '</p>' +
        '<label class="v-field"><span>The address you are verifying</span>' +
          '<input type="text" id="v-address" value="' + esc(state.addressLine) + '" placeholder="294 Lenox Ave, #5, New York, NY" autocomplete="street-address"></label>' +
        '<div class="v-docgrid">' +
          kinds.map(function (k) {
            return '<label class="v-docpick"><input type="file" accept="image/*,application/pdf" data-v-doc="' + k[0] + '">' +
              '<span><b>' + esc(k[1]) + '</b>' + esc(k[2]) + '</span></label>';
          }).join('') +
        '</div>' +
        (rows ? '<ul class="v-doclist">' + rows + '</ul>' : '') +
        '<p class="v-note">Redact whatever is not needed. We want the names, the address and the dates — an account number, a balance and a payment history are none of our business, and a document with them blacked out verifies exactly as well.' +
        (sub ? ' You do not need to upload the whole lease: the signature page, the page with the address and term, and the sublet clause are enough.' : '') +
        '</p>' +
        '<div class="v-actions">' +
          '<button type="button" class="btn btn--ghost" data-v-back>Back</button>' +
          '<button type="button" class="btn btn--primary" data-v-next' + (mine.length ? '' : ' disabled') + '>Continue</button>' +
        '</div>' +
      '</div>';
  }

  function viewCode() {
    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">' + counter('code') + '</span>' +
        '<h1 class="v-title">The code we post to the property</h1>' +
        '<p class="v-lede">We mail a six-character code to the address itself, addressed to the occupant. It takes a few days, and it is the only check in this flow that cannot be passed from anywhere in the world with a laptop and a stolen document. You can publish your listing before it arrives — it just will not carry the second badge until you enter it.</p>' +
        '<div class="v-codebox">' +
          '<label class="v-field"><span>Code from the card</span>' +
            '<input type="text" id="v-code" maxlength="7" placeholder="RL-4K9" value="' + esc(state.codeEntered) + '" autocomplete="one-time-code" spellcheck="false"></label>' +
          '<p class="v-note" style="margin:0">Posted to <b>' + esc(state.addressLine || 'the listing address') + '</b>. Not arrived yet? Continue without it and come back — the listing publishes either way.</p>' +
        '</div>' +
        '<div class="v-actions">' +
          '<button type="button" class="btn btn--ghost" data-v-back>Back</button>' +
          '<button type="button" class="btn btn--ghost" data-v-skip>It has not arrived yet</button>' +
          '<button type="button" class="btn btn--primary" data-v-next>Finish</button>' +
        '</div>' +
      '</div>';
  }

  function viewDone() {
    var r = read(STORE.result, null) || {};
    var idOk = !!r.identity, listingOk = !!r.listing, consentOk = !!r.consent;
    var sub = r.role === 'subtenant';
    var issued = [idOk, listingOk, sub ? consentOk : null].filter(function (x) { return x === true; }).length;
    var possible = sub ? 3 : 2;

    function row(ok, what, how) {
      return '<div class="v-result__row">' +
        '<span class="v-result__mark" data-ok="' + (ok ? '1' : '0') + '" aria-hidden="true">' + (ok ? '✓' : '–') + '</span>' +
        '<span><b>' + esc(what) + '</b><span>' + esc(how) + '</span></span></div>';
    }

    var consentHow = r.consentRoute === 'written'
      ? (r.consentDocs ? 'Written consent from the landlord, on file.' : 'Chosen, but no document uploaded.')
      : r.consentRoute === 'deemed'
        ? (r.windowClosed
            ? 'Served ' + esc(fmtDate(r.servedOn)) + ' with proof, and the decision window closed with no answer.'
            : 'Served ' + esc(fmtDate(r.servedOn || todayISO())) + '. The window has not closed yet — come back when it has.')
        : 'Not requested yet. The desk on your listing will assemble the packet and start the clock.';

    return '' +
      '<div class="v-card">' +
        '<span class="v-kicker">Result</span>' +
        '<h1 class="v-title">' + (issued === possible ? (possible === 3 ? 'All three badges issued' : 'Both badges issued') : issued ? issued + ' of ' + possible + ' badges issued' : 'Nothing issued yet') + '</h1>' +
        '<div class="v-badges">' +
          '<span class="v-badge v-badge--id' + (idOk ? '' : ' is-off') + '">ID verified</span>' +
          '<span class="v-badge v-badge--listing' + (listingOk ? '' : ' is-off') + '">' + (sub ? 'Lease on file' : 'Listing verified') + '</span>' +
          (sub ? '<span class="v-badge v-badge--consent' + (consentOk ? '' : ' is-off') + '">Consent on file</span>' : '') +
        '</div>' +
        '<div class="v-result">' +
          row(!!r.idDoc, 'Identity document captured', r.idDoc ? 'Front' + (r.idBack ? ' and back' : '') + ', quality checked before submission.' : 'Not completed.') +
          row(!!r.selfie, 'Selfie matched, with a movement check', r.selfie ? 'Passed the challenge sequence.' : 'Not completed.') +
          row(!!r.docs, sub ? 'Lease evidencing your tenancy' : 'Control of the address evidenced', r.docs ? r.docs + ' document' + (r.docs === 1 ? '' : 's') + ' against ' + (r.address || 'the listing address') + '.' : 'Not completed.') +
          (sub
            ? row(consentOk, 'Landlord consent settled', consentHow) +
              row(!!r.attested, 'Disclosure signed', r.attested ? 'Five statements attested and signed as ' + esc(r.signature || '—') + '. Kept three years; the incoming renter gets a copy.' : 'Not signed.')
            : row(!!r.code, 'Code posted to the property entered', r.code ? 'Entered and matched.' : 'Not yet — the card may still be in the post.')) +
        '</div>' +
        '<p class="v-note"><b>Everything you captured has been wiped.</b> What is kept is the four lines above and the date, ' + esc(fmtDate(r.at || todayISO())) + '. That is what renters see on your listings, and it is all we hold.</p>' +
        '<div class="v-actions">' +
          '<a class="btn btn--primary" href="list.html">Go to my listings</a>' +
          '<button type="button" class="btn btn--ghost" id="v-restart">Run it again</button>' +
        '</div>' +
      '</div>';
  }

  /* =======================================================================
     Binding
     ======================================================================= */

  function bind(id) {
    var host = root();

    var wipeBtn = $('#v-wipe', host);
    if (wipeBtn) wipeBtn.addEventListener('click', function () {
      wipe();
      state.challengeIndex = 0;
      render();
    });

    $$('[data-v-next]', host).forEach(function (b) {
      b.addEventListener('click', function () { advance(id); });
    });
    $$('[data-v-back]', host).forEach(function (b) {
      b.addEventListener('click', function () { state.step = Math.max(0, state.step - 1); render(); });
    });
    $$('[data-v-skip]', host).forEach(function (b) {
      b.addEventListener('click', function () { state.step = Math.min(steps.length - 1, state.step + 1); if (steps[state.step].id === 'done') finish(); else render(); });
    });
    $$('[data-v-retake]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var slot = id === 'id-front' ? 'idFront' : id === 'id-back' ? 'idBack' : 'selfie';
        if (vault[slot] && vault[slot].blobUrl) { try { URL.revokeObjectURL(vault[slot].blobUrl); } catch (e) {} }
        vault[slot] = null;
        state.challengeIndex = 0;
        render();
      });
    });

    if (id === 'id-front' || id === 'id-back' || id === 'selfie') bindCamera(id);
    if (id === 'address') bindAddress();
    if (id === 'code') bindCode();
    if (id === 'role') bindRole();
    if (id === 'consent') bindConsent();
    if (id === 'disclosure') bindDisclosure();

    var restart = $('#v-restart', host);
    if (restart) restart.addEventListener('click', function () {
      wipe(); state.step = 0; state.challengeIndex = 0; render();
    });
  }

  function bindCamera(id) {
    var slot = id === 'id-front' ? 'idFront' : id === 'id-back' ? 'idBack' : 'selfie';
    if (vault[slot]) return;   // showing the review state, no camera needed

    var isFace = id === 'selfie';
    var guide = isFace ? GUIDE_FACE : GUIDE_ID;
    var video = $('#v-video');
    var hint = $('#v-hint');
    var shoot = $('#v-shoot');
    var file = $('#v-file');
    var fallback = $('#v-fallback');
    if (!video) return;

    var lastFrame = null, motion = 0;

    function setHint(text, tone) {
      if (!hint) return;
      hint.textContent = text;
      hint.setAttribute('data-tone', tone || '');
    }

    startCamera(video, isFace ? 'user' : 'environment', function (why) {
      if (fallback) {
        fallback.hidden = false;
        fallback.innerHTML = '<p><b>' +
          (why === 'denied'
            ? 'Camera access was declined.'
            : why === 'no-api'
              ? 'This browser will not open a camera on this page.'
              : 'No camera available.') +
          '</b> Choose a file instead — a photograph you have already taken works exactly as well, and gets the same quality check.</p>';
      }
      var cam = $('.v-cam');
      if (cam) cam.setAttribute('data-dead', '1');
      setHint('Camera unavailable — use “choose a file” below.', 'warn');
      if (shoot) shoot.disabled = true;
    });

    /* Live coaching loop. Runs at 4fps on a small canvas; cheap enough not to
       heat the phone, frequent enough to feel responsive. */
    var probe = document.createElement('canvas');
    liveTimer = setInterval(function () {
      if (!video.videoWidth) return;
      probe.width = 320;
      probe.height = Math.round(320 * video.videoHeight / video.videoWidth);
      var pctx = probe.getContext('2d', { willReadFrequently: true });
      pctx.drawImage(video, 0, 0, probe.width, probe.height);

      if (isFace) {
        /* Frame differencing for the movement challenge. */
        try {
          var cur = pctx.getImageData(0, 0, probe.width, probe.height).data;
          if (lastFrame) {
            var diff = 0;
            for (var i = 0; i < cur.length; i += 40) {
              diff += Math.abs(cur[i] - lastFrame[i]);
            }
            motion = diff / (cur.length / 40);
          }
          lastFrame = cur.slice(0);
        } catch (e) { /* ignore */ }
      }

      var q = analyse(probe, guide);
      if (!q) return;

      if (isFace && state.challengeIndex < CHALLENGES.length - 1 && motion > 9) {
        state.challengeIndex++;
        var ch = $('#v-challenge');
        if (ch) {
          ch.innerHTML = '<span class="v-challenge__n">' + (state.challengeIndex + 1) + '/' + CHALLENGES.length + '</span>' +
            esc(CHALLENGES[state.challengeIndex].prompt);
          ch.setAttribute('data-advanced', '1');
          setTimeout(function () { ch.removeAttribute('data-advanced'); }, 600);
        }
      }

      if (q.ok) {
        setHint(isFace ? 'Good — capture when you are ready' : 'Sharp and well framed — capture', 'ok');
        if (shoot) shoot.disabled = false;
      } else {
        setHint(q.issues[0].msg, 'warn');
        /* Never hard-block: a soft accept beats a user who cannot get past
           the screen on an old phone camera. */
        if (shoot) shoot.disabled = false;
      }
    }, 250);

    if (shoot) shoot.addEventListener('click', function () {
      var c = grab(video);
      var q = analyse(c, guide);
      canvasToRecord(c, q).then(function (rec) {
        vault[slot] = rec;
        stopCamera();
        render();
      });
    });

    if (file) file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var url = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        var scale = Math.min(1, 1920 / img.width);
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var q = analyse(c, guide);
        canvasToRecord(c, q).then(function (rec) {
          try { URL.revokeObjectURL(url); } catch (e) {}
          vault[slot] = rec;
          stopCamera();
          render();
        });
      };
      img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} };
      img.src = url;
    });
  }

  function bindAddress() {
    var addr = $('#v-address');
    if (addr) addr.addEventListener('input', function () { state.addressLine = addr.value; });
    bindDocPickers();
  }

  function bindDocPickers() {
    $$('[data-v-doc]').forEach(function (input) {
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        if (f.size > 12 * 1024 * 1024) {
          alert('That file is over 12 MB. A photograph of the page is plenty — no need for a full scan.');
          input.value = '';
          return;
        }
        vault.docs.push({
          name: f.name, size: f.size, type: f.type,
          kind: input.getAttribute('data-v-doc'),
          blobUrl: URL.createObjectURL(f)
        });
        input.value = '';
        render();
      });
    });

    $$('[data-v-rmdoc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-v-rmdoc'));
        var d = vault.docs[i];
        if (d && d.blobUrl) { try { URL.revokeObjectURL(d.blobUrl); } catch (e) {} }
        vault.docs.splice(i, 1);
        render();
      });
    });
  }

  function bindRole() {
    $$('input[name="v-role"]').forEach(function (r) {
      r.addEventListener('change', function () {
        state.role = r.value;
        steps = buildSteps();
        render();
      });
    });
  }

  function bindConsent() {
    $$('input[name="v-consent"]').forEach(function (r) {
      r.addEventListener('change', function () { state.consentRoute = r.value; render(); });
    });
    var served = $('#v-served');
    if (served) served.addEventListener('change', function () { state.servedOn = served.value; render(); });
    bindDocPickers();
  }

  function bindDisclosure() {
    $$('[data-v-attest]').forEach(function (b) {
      b.addEventListener('change', function () {
        state.disclosure[b.getAttribute('data-v-attest')] = b.checked;
        render();
      });
    });
    var sign = $('#v-sign');
    if (sign) {
      sign.addEventListener('input', function () {
        state.signature = sign.value;
        var next = $('[data-v-next]');
        var all = ATTESTATIONS.every(function (a) { return state.disclosure[a[0]]; });
        if (next) next.disabled = !(all && state.signature.trim().length > 2);
      });
    }
  }

  function bindCode() {
    var code = $('#v-code');
    if (code) code.addEventListener('input', function () {
      code.value = code.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      state.codeEntered = code.value;
    });
  }

  function advance(id) {
    if (id === 'address') {
      var addr = $('#v-address');
      if (addr) state.addressLine = addr.value;
    }
    if (id === 'code' || id === 'disclosure') { finish(); return; }
    state.step = Math.min(steps.length - 1, state.step + 1);
    if (steps[state.step].id === 'done') finish();
    else render();
  }

  function finish() {
    var evidence = vault.docs.filter(function (d) { return d.kind !== 'consent' && d.kind !== 'service'; }).length;
    var consentDocs = vault.docs.filter(function (d) { return d.kind === 'consent' || d.kind === 'service'; }).length;

    /* Where silence is deemed consent, the clock having run IS the consent —
       provided service was documented. That is the whole point of asking for
       the receipt rather than for a reply. */
    var windowClosed = false;
    if (state.consentRoute === 'deemed' && state.servedOn) {
      var served = new Date(state.servedOn + 'T00:00:00');
      windowClosed = !isNaN(served.getTime()) && (Date.now() - served.getTime()) >= 30 * 86400000;
    }

    var result = {
      at: todayISO(),
      role: state.role,
      idDoc: !!vault.idFront,
      idBack: !!vault.idBack,
      selfie: !!vault.selfie,
      docs: evidence,
      address: state.addressLine || null,
      code: !!(state.codeEntered && state.codeEntered.length >= 5),
      consentRoute: state.consentRoute,
      consentDocs: consentDocs,
      servedOn: state.servedOn || null,
      windowClosed: windowClosed,
      signature: state.signature ? state.signature.trim() : null,
      attested: ATTESTATIONS.every(function (a) { return state.disclosure[a[0]]; })
    };

    result.identity = result.idDoc && result.selfie;
    result.listing = result.docs > 0;
    /* The consent badge is earned two ways and neither of them is "they said
       yes on the phone". */
    result.consent = !!(
      (state.consentRoute === 'written' && consentDocs > 0) ||
      (state.consentRoute === 'deemed' && consentDocs > 0 && windowClosed)
    );
    write(STORE.result, result);

    /* The images have done their job. They go now, before the result renders. */
    wipe();

    state.step = steps.length - 1;
    render();
  }

  /* =======================================================================
     Boot
     ======================================================================= */

  function boot() {
    if (!root()) return;
    var saved = read(STORE.result, null);
    state.addressLine = (saved && saved.address) || '';
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 80); });
  } else {
    setTimeout(boot, 80);
  }

  window.RENTLEAKS_VERIFY = {
    version: '1.0.0',
    analyse: analyse,
    result: function () { return read(STORE.result, null); },
    wipe: wipe,
    /* Exposed for tests: nothing image-shaped should ever be in storage. */
    vaultIsEmpty: function () {
      return !vault.idFront && !vault.idBack && !vault.selfie && !vault.docs.length;
    }
  };
})();
