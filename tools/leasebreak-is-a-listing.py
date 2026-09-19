#!/usr/bin/env python3
"""
A lease-break is a listing.

It was carved out as free everywhere — a $0 tier on the pricing grid, a
hard-coded zero in the composer's cost function, and a "posting is free"
claim repeated across the home page, the footer, the FAQ, the type page,
llms.txt and all three locale dictionaries. This removes the carve-out: a
lease-break is priced, described and sold exactly like a room or a furnished
stay, because that is what it is.

Run once from the repository root:

    python3 tools/leasebreak-is-a-listing.py

Then rebuild: tools/generate-seo-pages.js, tools/build-locales.mjs,
tools/build-social-pages.py.

Every edit asserts its anchor before touching anything, so a half-applied
run is not possible: the script either finds all of them or stops.
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
            sys.exit(f"{rel}: anchor not found ->\n  {old[:140]!r}")
        s = s.replace(old, new, 1)
    io.open(path, "w", encoding="utf-8").write(s)
    print(f"  {rel}  ({len(pairs)} edit{'s' if len(pairs) != 1 else ''})")


print("Composer")
edit("rentleaks-list.js", [
    # The comment was the rationale for the carve-out. It goes with it.
    ("""  /* What the LISTER pays. Renters pay nothing, on any plan, ever — that is
     the whole monetisation position and it is why there is no renter-side
     fee anywhere in this composer. Lease-breaks publish free: an empty month
     helps nobody, and charging someone to escape a lease they cannot afford
     is the wrong business. */""",
     """  /* What the LISTER pays. Renters pay nothing, on any plan, ever — that is
     the whole monetisation position and it is why there is no renter-side
     fee anywhere in this composer.

     Every listing type is priced the same, lease-breaks included. A
     lease-break is a listing: it occupies the same slot in search, carries
     the same verification and compliance checks, and takes the same work to
     publish. Pricing it at zero said otherwise, and meant the cost function
     had a housing-type branch in it for no reason the billing could
     justify. */"""),
    ("    var listing = isLeaseBreak() ? 0 : pl.listing;",
     "    var listing = pl.listing;"),
    ("""            (isLeaseBreak() ? 'Free \\u2014 lease-breaks always are' : '$' + pl.listing + ' per ' + pl.per) +""",
     """            '$' + pl.listing + ' per ' + pl.per +"""),
    ("""          (isLeaseBreak()
            ? 'Lease-breaks publish free. Empty months help nobody.'
            : '$' + planCost().total + ' per ' + planCost().plan.per + (draft.sponsored ? ', sponsored included' : '') + '. Nothing is charged to renters, ever.') +""",
     """          '$' + planCost().total + ' per ' + planCost().plan.per + (draft.sponsored ? ', sponsored included' : '') + '. Nothing is charged to renters, ever.' +"""),
])

print("Product data")
edit("data.js", [
    ("promise: 'Lease Clock, takeover math, and free posting so good homes stay filled.'",
     "promise: 'Lease Clock, takeover math, and the remaining term shown before anyone has to ask.'"),
])

print("Front end")
edit("script.js", [
    ("blurb: 'See the Lease Clock, months left, and whether it is an assignment or a sublet. Posting a lease-break is free.',",
     "blurb: 'See the Lease Clock, months left, and whether it is an assignment or a sublet. It lists on the same terms as every other home.',"),
    ('<li><a href="${base}list.html?kind=lease-break">Post a lease-break free</a></li>',
     '<li><a href="${base}list.html?kind=lease-break">Post a lease-break</a></li>'),
    ('<div class="hero-proof__row"><span class="hero-proof__k">Lease-breaks posted free</span>',
     '<div class="hero-proof__row"><span class="hero-proof__k">Lease takeovers listed</span>'),
    ('<p class="pricing-note">Lease-break posts are free. Rooms and furnished stays can start free while we seed a city.</p>',
     '<p class="pricing-note">One price for every listing type — rooms, co-living, furnished and lease-breaks alike. Renters are never charged.</p>'),
    ("note.textContent = 'Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. Lease-break listings are free.';",
     "note.textContent = 'Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. One price, whatever you are listing.';"),
])

print("Generators")
edit("tools/generate-seo-pages.js", [
    ('description: "Take over a remaining lease in major U.S., Canadian and European cities. See the Lease Clock, months left, and assignment vs sublet. Posting a lease-break is free.",',
     'description: "Take over a remaining lease in major U.S., Canadian and European cities. See the Lease Clock, months left, and assignment vs sublet. A lease-break lists on the same terms as any other home.",'),
    ('"Post a lease-break for free. List rooms, co-living rooms, furnished apartments, and 1-month+ stays with all-in rent.",',
     '"List rooms, co-living rooms, furnished apartments, 1-month+ stays and lease-breaks, each with all-in rent.",'),
    ('"Tools for room hosts, co-living operators, furnished portfolios, and free lease-break posts.",',
     '"Tools for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break.",'),
    ('"list rental, coliving operator software, furnished apartment listing, free lease break post", "/professionals.html");',
     '"list rental, coliving operator software, furnished apartment listing, lease break post", "/professionals.html");'),
])

edit("tools/build-social-pages.py", [
    ('("Can I take over someone\'s lease?", "Yes. Lease-break posts are free, and each one shows the remaining term and whether',
     '("Can I take over someone\'s lease?", "Yes. Each lease-break shows the remaining term and whether'),
])

print("Hand-written pages")
edit("faq.html", [
    ("<p itemprop=\"text\">Use List a place. Lease-break posts are free. Rooms, furnished apartments, and co-living operators can publish from the same wizard. Host plans live on For Professionals.</p>",
     "<p itemprop=\"text\">Use List a place. Rooms, furnished apartments, co-living operators and lease-breaks all publish from the same wizard, on the same terms. Host plans live on For Professionals.</p>"),
])

edit("list.html", [
    ("<p>Lease-breaks are free — empty months help no one. Rooms and operators get an All-in preview so renters see the real number.</p>",
     "<p>Rooms, operators and lease-breaks all get an All-in preview, so renters see the real number before they ask.</p>"),
])

edit("professionals.html", [
    ("""              <span class="plan-card__badge">Free</span>
              <h3 class="plan-card__title">Lease-break</h3>
              <p class="plan-card__desc">Current tenants leaving early</p>
              <div class="plan-card__price"><span class="plan-card__amount">$0</span></div>""",
     """              <h3 class="plan-card__title">Lease-break</h3>
              <p class="plan-card__desc">Current tenants leaving early</p>
              <div class="plan-card__price"><span class="plan-card__amount">$60</span><span class="plan-card__period">/month</span></div>"""),
    ('<a href="list.html?kind=lease-break" class="btn btn--primary plan-card__cta">Post free</a>',
     '<a href="list.html?kind=lease-break" class="btn btn--primary plan-card__cta">Post a lease-break</a>'),
])

print("Locale dictionaries")

# ui keys: English source -> (fr, de, it). Replacing the value in place, and
# where the English key itself changed, retiring the old key.
RETIRE = [
    "Post a lease-break free",
    "Lease-breaks posted free",
    "See the Lease Clock, months left, and whether it is an assignment or a sublet. Posting a lease-break is free.",
    "Lease Clock, takeover math, and free posting so good homes stay filled.",
    "Lease-break posts are free. Rooms and furnished stays can start free while we seed a city.",
]
ADD = {
    "Post a lease-break": (
        "Publier une reprise de bail", "Nachmieter inserieren", "Pubblica un subentro"),
    "Lease takeovers listed": (
        "Reprises de bail publiées", "Inserierte Mietübernahmen", "Subentri pubblicati"),
    "See the Lease Clock, months left, and whether it is an assignment or a sublet. It lists on the same terms as every other home.": (
        "Consultez le compteur de bail, les mois restants et s'il s'agit d'une cession ou d'une sous-location. Elle se publie aux mêmes conditions que tout autre logement.",
        "Sehen Sie die Vertragsuhr, die verbleibenden Monate und ob es eine Vertragsübernahme oder eine Untermiete ist. Es wird zu denselben Bedingungen inseriert wie jede andere Wohnung.",
        "Guarda il contatore del contratto, i mesi che restano e se si tratta di cessione o di subaffitto. Si pubblica alle stesse condizioni di qualsiasi altra casa."),
    "Lease Clock, takeover math, and the remaining term shown before anyone has to ask.": (
        "Compteur de bail, calcul de la reprise et durée restante affichée avant même qu'on la demande.",
        "Vertragsuhr, die Rechnung zur Übernahme und die Restlaufzeit, bevor jemand danach fragen muss.",
        "Contatore del contratto, i conti del subentro e la durata residua mostrata prima che qualcuno la chieda."),
    "One price for every listing type — rooms, co-living, furnished and lease-breaks alike. Renters are never charged.": (
        "Un seul prix pour tous les types d'annonce — chambres, coliving, meublés et reprises de bail. Les locataires ne paient jamais.",
        "Ein Preis für jede Inseratsart — WG-Zimmer, Co-Living, möbliert und Nachmieter gleichermaßen. Mietern wird nie etwas berechnet.",
        "Un solo prezzo per ogni tipo di annuncio — stanze, co-living, arredati e subentri. Agli inquilini non viene mai addebitato nulla."),
    "Built for room hosts, co-living operators, furnished portfolios, and tenants posting a lease-break. One price, whatever you are listing.": (
        "Pensé pour les loueurs de chambres, les exploitants de coliving, les parcs de meublés et les locataires qui publient une reprise de bail. Un seul prix, quel que soit ce que vous publiez.",
        "Gemacht für Zimmeranbieter, Co-Living-Betreiber, möblierte Bestände und Mieter, die einen Nachmieter suchen. Ein Preis, was immer Sie inserieren.",
        "Pensato per chi affitta stanze, per i gestori di co-living, per i portafogli di arredati e per gli inquilini che pubblicano un subentro. Un solo prezzo, qualunque cosa tu pubblichi."),
    "Rooms, operators and lease-breaks all get an All-in preview, so renters see the real number before they ask.": (
        "Chambres, exploitants et reprises de bail obtiennent tous un aperçu du loyer tout compris, pour que les locataires voient le vrai chiffre avant même de demander.",
        "Zimmer, Betreiber und Nachmieter-Inserate bekommen alle eine Warmmiete-Vorschau, damit Mieter die echte Zahl sehen, bevor sie fragen.",
        "Stanze, gestori e subentri ottengono tutti un'anteprima del tutto compreso, così chi cerca vede il numero vero prima ancora di chiedere."),
    "Lease Clock on every takeover": (
        "Compteur de bail sur chaque reprise",
        "Vertragsuhr bei jeder Übernahme",
        "Contatore del contratto su ogni subentro"),
}

# Structured copy that is baked into the locale pages.
STRUCT = {
    "fr": {
        "types.lease-break.description":
            "Reprenez le bail d'un locataire qui part, à Paris, Lyon, Berlin, Londres, Amsterdam et dans les grandes villes nord-américaines. Compteur de bail, mois restants, cession ou sous-location. Une reprise de bail se publie aux mêmes conditions que tout autre logement.",
        "pages.index.hero.freeLeaseBreak": "Compteur de bail sur chaque reprise",
        "pages.index.hero.hint":
            "Vous hésitez sur le type ? <a href=\"match.html\">Lancez Stay DNA</a> · Appuyez sur <a href=\"#\" class=\"js-cmd\">⌘K</a> pour aller n'importe où · <a href=\"list.html?kind=lease-break\">Publiez une reprise de bail</a>",
        "pages.index.sections.hostTitle": "Vous partez plus tôt ? Publiez le reste de votre bail.",
        "pages.list.sub": "Chambres, exploitants et reprises de bail obtiennent tous un aperçu du loyer tout compris, pour que les locataires voient le vrai chiffre avant même de demander.",
        "pages.faq.items.5.a": "Passez par « Publier une annonce ». Chambres, appartements meublés, exploitants de coliving et reprises de bail publient tous depuis le même parcours, aux mêmes conditions. Les offres pour les hôtes sont sur la page Offres et outils.",
        "plan0.badge": "", "plan0.amount": "60 €", "plan0.period": "/mois",
        "plan0.cta": "Publier une reprise de bail",
    },
    "de": {
        "types.lease-break.description":
            "Übernehmen Sie einen laufenden Mietvertrag in Berlin, München, Hamburg, Frankfurt, Köln, Zürich, London, Paris und Amsterdam sowie in Nordamerika. Vertragsuhr, Restmonate, Vertragsübernahme oder Untermiete. Ein Nachmieter-Inserat läuft zu denselben Bedingungen wie jedes andere.",
        "pages.index.hero.freeLeaseBreak": "Vertragsuhr bei jeder Übernahme",
        "pages.index.hero.hint":
            "Unsicher, welche Wohnform? <a href=\"match.html\">Stay DNA starten</a> · <a href=\"#\" class=\"js-cmd\">⌘K</a> drücken, um überallhin zu springen · <a href=\"list.html?kind=lease-break\">Nachmieter inserieren</a>",
        "pages.index.sections.hostTitle": "Sie ziehen früher aus? Inserieren Sie den Rest des Vertrags.",
        "pages.list.sub": "Zimmer, Betreiber und Nachmieter-Inserate bekommen alle eine Warmmiete-Vorschau, damit Mieter die echte Zahl sehen, bevor sie fragen.",
        "pages.faq.items.5.a": "Über „Inserat aufgeben“. Zimmer, möblierte Wohnungen, Co-Living-Betreiber und Nachmieter-Inserate veröffentlichen alle über denselben Weg, zu denselben Bedingungen. Die Tarife für Anbieter stehen unter Tarife und Werkzeuge.",
        "plan0.badge": "", "plan0.amount": "60 €", "plan0.period": "/Monat",
        "plan0.cta": "Nachmieter inserieren",
    },
    "it": {
        "types.lease-break.description":
            "Subentra nel contratto di chi lascia casa, a Roma, Milano, Firenze, Torino, Berlino, Londra, Parigi e Amsterdam, oltre che in Nord America. Contatore del contratto, mesi residui, cessione o subaffitto. Un subentro si pubblica alle stesse condizioni di qualsiasi altro annuncio.",
        "pages.index.hero.freeLeaseBreak": "Contatore del contratto su ogni subentro",
        "pages.index.hero.hint":
            "Non sai quale tipo scegliere? <a href=\"match.html\">Avvia Stay DNA</a> · Premi <a href=\"#\" class=\"js-cmd\">⌘K</a> per andare ovunque · <a href=\"list.html?kind=lease-break\">Pubblica un subentro</a>",
        "pages.index.sections.hostTitle": "Parti prima? Pubblica quello che resta del contratto.",
        "pages.list.sub": "Stanze, gestori e subentri ottengono tutti un'anteprima del tutto compreso, così chi cerca vede il numero vero prima ancora di chiedere.",
        "pages.faq.items.5.a": "Da «Pubblica un annuncio». Stanze, appartamenti arredati, gestori di co-living e subentri pubblicano tutti dallo stesso percorso, alle stesse condizioni. I piani per gli host stanno in Piani e strumenti.",
        "plan0.badge": "", "plan0.amount": "60 €", "plan0.period": "/mese",
        "plan0.cta": "Pubblica un subentro",
    },
}


def dig(d, dotted):
    node = d
    parts = dotted.split(".")
    for p in parts[:-1]:
        node = node[int(p)] if p.isdigit() else node[p]
    return node, parts[-1]


for i, code in enumerate(("fr", "de", "it")):
    path = os.path.join(ROOT, "locales", f"{code}.json")
    d = json.loads(io.open(path, encoding="utf-8").read(),
                   object_pairs_hook=collections.OrderedDict)

    dropped = 0
    for k in RETIRE:
        if k in d["ui"]:
            del d["ui"][k]
            dropped += 1
    for en, trio in ADD.items():
        d["ui"][en] = trio[i]

    S = STRUCT[code]
    for dotted in ("types.lease-break.description", "pages.index.hero.freeLeaseBreak",
                   "pages.index.hero.hint", "pages.index.sections.hostTitle",
                   "pages.list.sub", "pages.faq.items.5.a"):
        node, last = dig(d, dotted)
        if last.isdigit():
            node[int(last)] = S[dotted]
        else:
            node[last] = S[dotted]

    plan = d["pages"]["professionals"]["plans"][0]
    plan["badge"] = S["plan0.badge"]
    plan["amount"] = S["plan0.amount"]
    plan["period"] = S["plan0.period"]
    plan["cta"] = S["plan0.cta"]

    io.open(path, "w", encoding="utf-8").write(
        json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print(f"  locales/{code}.json  -{dropped} retired, +{len(ADD)} added, 6 structured, 1 plan card")

print("\nDone. Now rebuild:")
print("  node tools/generate-seo-pages.js")
print("  node tools/build-locales.mjs")
print("  python3 tools/build-social-pages.py")
print("  node tools/check-locales.mjs")
