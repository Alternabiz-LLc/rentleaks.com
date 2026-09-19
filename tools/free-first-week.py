#!/usr/bin/env python3
"""
First week free, on every new listing, ongoing.

Not a campaign with dates — a standing trial. That matters for the
implementation: there is no window to open and close, nothing to expire, and
no state to carry about when someone arrived. A new listing's first seven
days cost nothing; billing starts on day eight.

The trial covers the LISTING FEE only. A sponsored placement is a paid
promotion and is charged from day one, or the offer quietly becomes "free
advertising" rather than "free to list", which is a different and much more
expensive promise.

Run once from the repository root:

    python3 tools/free-first-week.py

Then rebuild: tools/generate-seo-pages.js, tools/build-locales.mjs,
tools/build-social-pages.py.
"""
import collections
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(rel, pairs):
    path = os.path.join(ROOT, rel)
    s = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        if old not in s:
            sys.exit(f"{rel}: anchor not found ->\n  {old[:150]!r}")
        s = s.replace(old, new, 1)
    io.open(path, "w", encoding="utf-8").write(s)
    print(f"  {rel}  ({len(pairs)})")


print("Composer")
edit("rentleaks-list.js", [
    ("""  var PLANS = {
    week:  { label: 'Weekly',  listing: 14, sponsored: 45,  per: 'week' },
    month: { label: 'Monthly', listing: 60, sponsored: 120, per: 'month' }
  };

  function planCost() {
    var pl = PLANS[draft.plan] || PLANS.week;
    var listing = pl.listing;
    var sponsored = draft.sponsored ? pl.sponsored : 0;
    return { plan: pl, listing: listing, sponsored: sponsored, total: listing + sponsored };
  }""",
     """  var PLANS = {
    week:  { label: 'Weekly',  listing: 14, sponsored: 45,  per: 'week' },
    month: { label: 'Monthly', listing: 60, sponsored: 120, per: 'month' }
  };

  /* The first seven days of a new listing are free, on every plan and every
     housing type. A standing trial rather than a campaign: there is no window
     to open and close, nothing to expire, and no arrival date to remember.

     It covers the LISTING FEE only. A sponsored placement is a paid promotion
     and is charged from day one — otherwise the offer stops being "free to
     list" and becomes "free advertising", which is a much larger promise than
     the one being made. */
  var FREE_TRIAL_DAYS = 7;

  function planCost() {
    var pl = PLANS[draft.plan] || PLANS.week;
    var listing = pl.listing;
    var sponsored = draft.sponsored ? pl.sponsored : 0;
    var trial = FREE_TRIAL_DAYS > 0;
    return {
      plan: pl,
      listing: listing,
      sponsored: sponsored,
      total: listing + sponsored,      // what recurs once the trial is over
      trial: trial,
      trialDays: FREE_TRIAL_DAYS,
      dueNow: trial ? sponsored : listing + sponsored
    };
  }"""),

    # The cost table: show what is due now and what recurs, as two figures.
    # One "total" cannot express a trial without misleading on one side of it.
    ("""        '<div class="c-allin__row" style="color:var(--ink-2)"><span>Listing, per ' + cost.plan.per + '</span><span>' + (cost.listing ? '$' + cost.listing : 'Free') + '</span></div>' +
        (cost.sponsored ? '<div class="c-allin__row" style="color:var(--ink-2)"><span>Sponsored placement</span><span>+$' + cost.sponsored + '</span></div>' : '') +
        '<div class="c-allin__row" style="font-weight:600;color:var(--ink);border-top:1px solid var(--x-rule);padding-top:0.4rem;margin-top:0.3rem"><span>Total per ' + cost.plan.per + '</span><span>' + (cost.total ? '$' + cost.total : 'Free') + '</span></div>' +
        '<div class="c-allin__row" style="color:var(--ink-3)"><span>What the renter pays us</span><span>Nothing</span></div>' +""",
     """        '<div class="c-allin__row" style="color:var(--ink-2)"><span>Listing, per ' + cost.plan.per + '</span><span>$' + cost.listing + '</span></div>' +
        (cost.trial ? '<div class="c-allin__row" style="color:var(--ink-2)"><span>First ' + cost.trialDays + ' days</span><span>Free</span></div>' : '') +
        (cost.sponsored ? '<div class="c-allin__row" style="color:var(--ink-2)"><span>Sponsored placement</span><span>+$' + cost.sponsored + '</span></div>' : '') +
        '<div class="c-allin__row" style="font-weight:600;color:var(--ink);border-top:1px solid var(--x-rule);padding-top:0.4rem;margin-top:0.3rem"><span>Due now</span><span>' + (cost.dueNow ? '$' + cost.dueNow : 'Nothing') + '</span></div>' +
        '<div class="c-allin__row" style="color:var(--ink-2)"><span>Then per ' + cost.plan.per + '</span><span>$' + cost.total + '</span></div>' +
        '<div class="c-allin__row" style="color:var(--ink-3)"><span>What the renter pays us</span><span>Nothing</span></div>' +"""),

    # Say it once, above the plan choice, so it is read before a price is.
    ("""      '<h3 style="font-size:var(--text-md);margin:var(--s-6) 0 var(--s-3);color:var(--ink)">What this costs you</h3>' +
      '<div class="c-plans">' +""",
     """      '<h3 style="font-size:var(--text-md);margin:var(--s-6) 0 var(--s-3);color:var(--ink)">What this costs you</h3>' +
      (cost.trial ? '<p class="v-note" style="margin:0 0 var(--s-3)"><b>Your first ' + cost.trialDays + ' days are free</b>, on any plan and any kind of listing. Billing starts on day ' + (cost.trialDays + 1) + ', and you can take the listing down before then and pay nothing.</p>' : '') +
      '<div class="c-plans">' +"""),

    ("""          '$' + planCost().total + ' per ' + planCost().plan.per + (draft.sponsored ? ', sponsored included' : '') + '. Nothing is charged to renters, ever.' +""",
     """          (planCost().trial
            ? 'Free for the first ' + planCost().trialDays + ' days, then $' + planCost().total + ' per ' + planCost().plan.per + (draft.sponsored ? ', sponsored included' : '') + '. Nothing is charged to renters, ever.'
            : '$' + planCost().total + ' per ' + planCost().plan.per + (draft.sponsored ? ', sponsored included' : '') + '. Nothing is charged to renters, ever.') +"""),
])

print("Front end")
edit("script.js", [
    ('<p class="pricing-note">One price for every listing type — rooms, co-living, furnished and lease-breaks alike. Renters are never charged.</p>',
     '<p class="pricing-note">Your first week is free, on every listing. After that, one price for every type — rooms, co-living, furnished and lease-breaks alike. Renters are never charged.</p>'),
    ("note.textContent = 'Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. One price, whatever you are listing.';",
     "note.textContent = 'Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. Your first week is free, whatever you are listing.';"),
])

print("Hand-written pages")
edit("index.html", [
    ('<span class="trust-bar__item">Lease Clock on every takeover</span>',
     '<span class="trust-bar__item">First week free on every listing</span>'),
])
edit("list.html", [
    ("<p>Rooms, operators and lease-breaks all get an All-in preview, so renters see the real number before they ask.</p>",
     "<p>Your first week is free, on every kind of listing. Rooms, operators and lease-breaks all get an All-in preview too, so renters see the real number before they ask.</p>"),
])
edit("faq.html", [
    ("<p itemprop=\"text\">Use List a place. Rooms, furnished apartments, co-living operators and lease-breaks all publish from the same wizard, on the same terms. Host plans live on For Professionals.</p>",
     "<p itemprop=\"text\">Use List a place. Rooms, furnished apartments, co-living operators and lease-breaks all publish from the same wizard, on the same terms. Your first week is free on any of them; billing starts on day eight, and taking the listing down before then costs nothing. Host plans live on For Professionals.</p>"),
])
edit("professionals.html", [
    ('<p class="pricing-note">Cancel anytime. Fair Housing applies to every host. We do not sell hotel-night inventory.</p>',
     '<p class="pricing-note">Your first week is free on every new listing. Cancel anytime. Fair Housing applies to every host. We do not sell hotel-night inventory.</p>'),
])

print("Generators")
edit("tools/generate-seo-pages.js", [
    ('"List rooms, co-living rooms, furnished apartments, 1-month+ stays and lease-breaks, each with all-in rent.",',
     '"Your first week is free on every listing. Post rooms, co-living rooms, furnished apartments, 1-month+ stays and lease-breaks, each with all-in rent.",'),
    ('"Tools for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break.",',
     '"Tools for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. First week free on every new listing.",'),
    ('"RentLeaks is housing, not hotels. Short-term means 30 days or more. Prices are All-in (base rent plus listed utilities, wifi, and cleaning). Every listing type is priced the same, lease-breaks included.",',
     '"RentLeaks is housing, not hotels. Short-term means 30 days or more. Prices are All-in (base rent plus listed utilities, wifi, and cleaning). Every listing type is priced the same, lease-breaks included, and the first week is free.",'),
])

print("Locale dictionaries")

ADD = {
    "First week free on every listing": (
        "Première semaine offerte sur chaque annonce",
        "Erste Woche kostenlos bei jedem Inserat",
        "Prima settimana gratis su ogni annuncio"),
    "Your first week is free, on every listing. After that, one price for every type — rooms, co-living, furnished and lease-breaks alike. Renters are never charged.": (
        "Votre première semaine est offerte, sur chaque annonce. Ensuite, un seul prix pour tous les types — chambres, coliving, meublés et reprises de bail. Les locataires ne paient jamais.",
        "Ihre erste Woche ist kostenlos, bei jedem Inserat. Danach ein Preis für jede Art — WG-Zimmer, Co-Living, möbliert und Nachmieter gleichermaßen. Mietern wird nie etwas berechnet.",
        "La tua prima settimana è gratis, su ogni annuncio. Poi un solo prezzo per ogni tipo — stanze, co-living, arredati e subentri. Agli inquilini non viene mai addebitato nulla."),
    "Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. Your first week is free, whatever you are listing.": (
        "Pensé pour les loueurs de chambres, les exploitants de coliving, les parcs de meublés et les locataires qui publient une reprise de bail. Votre première semaine est offerte, quel que soit ce que vous publiez.",
        "Gemacht für Zimmeranbieter, Co-Living-Betreiber, möblierte Bestände und Mieter, die einen Nachmieter suchen. Ihre erste Woche ist kostenlos, was immer Sie inserieren.",
        "Pensato per chi affitta stanze, per i gestori di co-living, per i portafogli di arredati e per gli inquilini che pubblicano un subentro. La tua prima settimana è gratis, qualunque cosa tu pubblichi."),
    "Your first week is free, on every kind of listing. Rooms, operators and lease-breaks all get an All-in preview too, so renters see the real number before they ask.": (
        "Votre première semaine est offerte, sur tous les types d'annonce. Chambres, exploitants et reprises de bail obtiennent aussi un aperçu du loyer tout compris, pour que les locataires voient le vrai chiffre avant même de demander.",
        "Ihre erste Woche ist kostenlos, bei jeder Art von Inserat. Zimmer, Betreiber und Nachmieter-Inserate bekommen außerdem eine Warmmiete-Vorschau, damit Mieter die echte Zahl sehen, bevor sie fragen.",
        "La tua prima settimana è gratis, su ogni tipo di annuncio. Stanze, gestori e subentri ottengono anche un'anteprima del tutto compreso, così chi cerca vede il numero vero prima ancora di chiedere."),
    "Due now": ("À payer maintenant", "Jetzt fällig", "Da pagare ora"),
    "Then per week": ("Puis par semaine", "Danach pro Woche", "Poi a settimana"),
    "Then per month": ("Puis par mois", "Danach pro Monat", "Poi al mese"),
    "First 7 days": ("7 premiers jours", "Erste 7 Tage", "Primi 7 giorni"),
    "Nothing is charged to renters, ever.": (
        "Les locataires ne paient jamais rien.",
        "Mietern wird niemals etwas berechnet.",
        "Agli inquilini non viene mai addebitato nulla."),
}

PATTERNS = {
    "fr": [
        (r"^Your first (\d+) days are free$", "Vos {1} premiers jours sont offerts"),
        (r"^First (\d+) days$", "{1} premiers jours"),
        (r"^Free for the first (\d+) days, then \$(\d+) per (week|month)\. Nothing is charged to renters, ever\.$",
         "Offert les {1} premiers jours, puis {2} $ par {3:t}. Les locataires ne paient jamais rien."),
    ],
    "de": [
        (r"^Your first (\d+) days are free$", "Ihre ersten {1} Tage sind kostenlos"),
        (r"^First (\d+) days$", "Erste {1} Tage"),
        (r"^Free for the first (\d+) days, then \$(\d+) per (week|month)\. Nothing is charged to renters, ever\.$",
         "Die ersten {1} Tage kostenlos, danach {2} $ pro {3:t}. Mietern wird niemals etwas berechnet."),
    ],
    "it": [
        (r"^Your first (\d+) days are free$", "I tuoi primi {1} giorni sono gratis"),
        (r"^First (\d+) days$", "Primi {1} giorni"),
        (r"^Free for the first (\d+) days, then \$(\d+) per (week|month)\. Nothing is charged to renters, ever\.$",
         "Gratis per i primi {1} giorni, poi {2} $ a {3:t}. Agli inquilini non viene mai addebitato nulla."),
    ],
}
UNITS = {
    "fr": {"week": "semaine", "month": "mois"},
    "de": {"week": "Woche", "month": "Monat"},
    "it": {"week": "settimana", "month": "mese"},
}

STRUCT = {
    "fr": {
        "list.description": "Votre première semaine est offerte sur chaque annonce. Publiez chambres, logements en coliving, appartements meublés, séjours d'un mois et plus et reprises de bail, chacun avec son loyer tout compris.",
        "professionals.description": "Des outils pour les loueurs de chambres, les exploitants de coliving, les parcs de meublés et les locataires qui publient une reprise de bail. Première semaine offerte sur chaque nouvelle annonce.",
        "professionals.note": "Votre première semaine est offerte sur chaque nouvelle annonce. Résiliable à tout moment. La non-discrimination au logement s'applique à tous les hôtes. Nous ne vendons pas de nuitées d'hôtel.",
        "index.freeWeek": "Première semaine offerte sur chaque annonce",
        "faq5": "Passez par « Publier une annonce ». Chambres, appartements meublés, exploitants de coliving et reprises de bail publient tous depuis le même parcours, aux mêmes conditions. Votre première semaine est offerte sur n'importe laquelle : la facturation commence le huitième jour, et retirer l'annonce avant ne coûte rien. Les offres pour les hôtes sont sur la page Offres et outils.",
    },
    "de": {
        "list.description": "Ihre erste Woche ist bei jedem Inserat kostenlos. Inserieren Sie WG-Zimmer, Co-Living-Zimmer, möblierte Wohnungen, Aufenthalte ab einem Monat und Nachmieter-Angebote, jedes mit seiner Warmmiete.",
        "professionals.description": "Werkzeuge für Zimmeranbieter, Co-Living-Betreiber, möblierte Bestände und Mieter, die einen Nachmieter suchen. Erste Woche bei jedem neuen Inserat kostenlos.",
        "professionals.note": "Ihre erste Woche ist bei jedem neuen Inserat kostenlos. Jederzeit kündbar. Diskriminierungsfreie Vermietung gilt für jeden Anbieter. Wir verkaufen keine Hotelnächte.",
        "index.freeWeek": "Erste Woche kostenlos bei jedem Inserat",
        "faq5": "Über „Inserat aufgeben“. Zimmer, möblierte Wohnungen, Co-Living-Betreiber und Nachmieter-Inserate veröffentlichen alle über denselben Weg, zu denselben Bedingungen. Ihre erste Woche ist bei jedem davon kostenlos: Die Abrechnung beginnt am achten Tag, und wer das Inserat vorher zurückzieht, zahlt nichts. Die Tarife für Anbieter stehen unter Tarife und Werkzeuge.",
    },
    "it": {
        "list.description": "La tua prima settimana è gratis su ogni annuncio. Pubblica stanze, camere in co-living, appartamenti arredati, soggiorni da un mese in su e subentri, ognuno con il suo affitto tutto compreso.",
        "professionals.description": "Strumenti per chi affitta stanze, per i gestori di co-living, per i portafogli di arredati e per gli inquilini che pubblicano un subentro. Prima settimana gratis su ogni nuovo annuncio.",
        "professionals.note": "La tua prima settimana è gratis su ogni nuovo annuncio. Disdici quando vuoi. Il divieto di discriminazione vale per ogni host. Non vendiamo notti d'albergo.",
        "index.freeWeek": "Prima settimana gratis su ogni annuncio",
        "faq5": "Da «Pubblica un annuncio». Stanze, appartamenti arredati, gestori di co-living e subentri pubblicano tutti dallo stesso percorso, alle stesse condizioni. La tua prima settimana è gratis su ognuno di essi: la fatturazione parte dall'ottavo giorno, e togliere l'annuncio prima non costa nulla. I piani per gli host stanno in Piani e strumenti.",
    },
}

for i, code in enumerate(("fr", "de", "it")):
    path = os.path.join(ROOT, "locales", f"{code}.json")
    d = json.loads(io.open(path, encoding="utf-8").read(),
                   object_pairs_hook=collections.OrderedDict)
    for en, trio in ADD.items():
        d["ui"][en] = trio[i]
    # "week"/"month" as bare words, so {3:t} inside the publish-note rule works.
    for en, word in UNITS[code].items():
        d["ui"].setdefault(en, word)
    have = {r["re"] for r in d["patterns"]}
    added = 0
    for regex, to in PATTERNS[code]:
        if regex not in have:
            d["patterns"].insert(0, collections.OrderedDict([("re", regex), ("to", to)]))
            added += 1
    S = STRUCT[code]
    d["pages"]["list"]["description"] = S["list.description"]
    d["pages"]["professionals"]["description"] = S["professionals.description"]
    d["pages"]["professionals"]["note"] = S["professionals.note"]
    d["pages"]["index"]["hero"]["freeLeaseBreak"] = S["index.freeWeek"]
    d["pages"]["faq"]["items"][5]["a"] = S["faq5"]
    io.open(path, "w", encoding="utf-8").write(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print(f"  locales/{code}.json  +{len(ADD)} strings, +{added} patterns, 5 structured")

print("\nDone. Rebuild:")
print("  node tools/generate-seo-pages.js && node tools/build-locales.mjs && python3 tools/build-social-pages.py")
