/**
 * GENERATED — do not edit.
 *
 * Source: web/src/lib/rules.json
 * Rebuild: node tools/build-rules.mjs
 *
 * Edits here are lost on the next build. The rules live in one file so that a
 * change to a deposit cap or a minimum-stay floor cannot land on one half of
 * the product and not the other.
 */
window.RENTLEAKS_RULES = {
  "_comment": [
    "Canonical jurisdiction rules for RentLeaks. SINGLE SOURCE — edit only this file.",
    "",
    "Consumed by web/src/lib/listing-rules.ts (typed wrapper) and, via",
    "tools/build-rules.mjs, by rentleaks-rules.js which the static layer loads",
    "before rentleaks-x.js. The data is what drifts; the twenty-line merge",
    "function on each side does not, so the data is what gets shared.",
    "",
    "Rules resolve city -> region -> country -> defaults. Every entry carries the",
    "instrument it comes from and the date it took effect, so a stale rule is",
    "visible rather than silently wrong.",
    "",
    "This is research, not legal advice. Jurisdictions marked unassessed were not",
    "covered by the source research and are flagged rather than guessed."
  ],
  "version": "2026-09-13",
  "sources": {
    "fare": {
      "label": "NYC FARE Act, Local Law 119 of 2024",
      "eff": "2025-06-11",
      "url": "https://www.nyc.gov/site/dca/news/018-25/dcwp-the-fare-act-now-effect"
    },
    "fareDisclosure": {
      "label": "NYC Admin. Code § 20-699.22 — fee disclosure on every listing",
      "eff": "2025-06-11",
      "url": "https://www.nyc.gov/assets/dca/downloads/pdf/about/FAQ-Broker-Fees.pdf"
    },
    "ll18": {
      "label": "NYC Local Law 18 — short-term rental registration",
      "eff": "2023-09-05",
      "url": "https://www.nyc.gov/site/specialenforcement/registration-law/registration.page"
    },
    "gol7108": {
      "label": "NY General Obligations Law § 7-108 (HSTPA)",
      "eff": "2019-06-14",
      "url": "https://www.nysenate.gov/legislation/laws/GOB/7-108"
    },
    "rpl238a": {
      "label": "NY Real Property Law § 238-a — application and move-in charges",
      "eff": "2019-06-14",
      "url": "https://www.nysenate.gov/legislation/laws/RPP/238-A"
    },
    "rpl226b": {
      "label": "NY Real Property Law § 226-b — sublet and assignment",
      "eff": "1983-01-01",
      "url": "https://www.nysenate.gov/legislation/laws/RPP/226-B"
    },
    "rpl235f": {
      "label": "NY Real Property Law § 235-f — Roommate Law",
      "eff": "1983-01-01",
      "url": "https://sites.lawschool.cornell.edu/tenants-advocacy/family-and-other-occupants"
    },
    "rpl440": {
      "label": "NY Real Property Law §§ 440, 440-a — broker licensing",
      "eff": "1922-01-01",
      "url": "https://www.nysenate.gov/legislation/laws/RPP/440"
    },
    "rpl442e": {
      "label": "NY Real Property Law § 442-e — penalties for unlicensed brokerage",
      "eff": "1922-01-01",
      "url": "https://www.nysenate.gov/legislation/laws/RPP/442-E"
    },
    "rsc25256": {
      "label": "Rent Stabilization Code § 2525.6 — subletting",
      "eff": "1987-05-01",
      "url": "https://www.law.cornell.edu/regulations/new-york/9-NYCRR-2525.6"
    },
    "rsc25257": {
      "label": "Rent Stabilization Code § 2525.7 — occupants",
      "eff": "1987-05-01",
      "url": "https://www.law.cornell.edu/regulations/new-york/9-NYCRR-2525.7"
    },
    "nycSoi": {
      "label": "NYC Human Rights Law — source of income",
      "eff": "2008-03-01",
      "url": "https://www.nyc.gov/site/cchr/media/source-of-income.page"
    },
    "fcha": {
      "label": "NYC Fair Chance for Housing Act, Local Law 24 of 2024",
      "eff": "2025-01-01",
      "url": "https://www.hklaw.com/en/insights/publications/2025/02/new-york-citys-fair-chance-housing-law-restricts-criminal-background"
    },
    "ftcFees": {
      "label": "FTC Rule on Unfair or Deceptive Fees, 16 CFR Part 464",
      "eff": "2025-05-12",
      "url": "https://www.ftc.gov/business-guidance/resources/rule-unfair-or-deceptive-fees-frequently-asked-questions"
    },
    "fha": {
      "label": "Fair Housing Act advertising rules, 24 CFR § 100.75",
      "eff": "1989-01-23",
      "url": "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-I/part-100/subpart-B/section-100.75"
    },
    "fcra": {
      "label": "FCRA — using consumer reports for tenant screening",
      "eff": "1971-04-25",
      "url": "https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know"
    },
    "coHb1090": {
      "label": "Colorado HB25-1090 price transparency, C.R.S. § 6-1-737",
      "eff": "2026-01-01",
      "url": "https://leg.colorado.gov/bills/hb25-1090"
    },
    "mnTotal": {
      "label": "Minnesota \"Total Monthly Payment\" disclosure",
      "eff": "2024-01-01",
      "url": "https://winthrop.com/bold-perspectives/minnesotas-revamped-landlord-tenant-laws-top-10-things-all-residential-landlords-should-know/"
    },
    "seattleCrim": {
      "label": "Seattle Fair Chance Housing Ordinance",
      "eff": "2017-08-01",
      "url": "https://www.seattle.gov/civilrights/housing-rights/criminal-history-protections"
    },
    "esReg": {
      "label": "Spain Real Decreto 1312/2024 — Registro Único de Arrendamientos",
      "eff": "2025-07-01",
      "url": "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-26931"
    },
    "catSeason": {
      "label": "Catalonia Llei 11/2025 — seasonal and room rentals",
      "eff": "2026-01-01",
      "url": "https://www.cuatrecasas.com/en/spain/real-estate/art/catalonia-regulates-seasonal-rentals"
    },
    "itCin": {
      "label": "Italy CIN — Codice Identificativo Nazionale",
      "eff": "2024-09-02",
      "url": "https://fiscomania.com/cin-affitti-brevi/"
    },
    "deZweck": {
      "label": "Berlin Zweckentfremdungsverbot",
      "eff": "2014-05-01",
      "url": "https://www.berlin.de/sen/wohnen/rechtliches/zweckentfremdungsverbot/"
    },
    "frMobilite": {
      "label": "France bail mobilité (loi ELAN)",
      "eff": "2018-11-24",
      "url": "https://www.lodgis.com/en/owners/helpful-hints/bail-mobilite-the-new-contract-for-furnished-rentals/"
    },
    "nlGoed": {
      "label": "Netherlands Wet goed verhuurderschap",
      "eff": "2023-07-01",
      "url": "https://en.straatmankoster.nl/actueel/wet-goed-verhuurderschap"
    },
    "nlFixed": {
      "label": "Netherlands Fixed Lease Contracts Act",
      "eff": "2024-07-01",
      "url": "https://cms.law/en/nld/publication/the-fixed-lease-contracts-act-first-experiences-from-the-field"
    },
    "ukRra": {
      "label": "UK Renters’ Rights Act 2025",
      "eff": "2026-05-01",
      "url": "https://www.legislation.gov.uk/ukpga/2025/26/contents"
    },
    "euStr": {
      "label": "Regulation (EU) 2024/1028 — short-term rental data sharing",
      "eff": "2026-05-20",
      "url": "https://eur-lex.europa.eu/eli/reg/2024/1028/oj/eng"
    },
    "dsa": {
      "label": "EU Digital Services Act, Arts. 16–18 notice and action",
      "eff": "2024-02-17",
      "url": "https://www.cms-digitallaws.com/en/dsa/article-19/"
    },
    "gdpr": {
      "label": "GDPR Arts. 5, 6 and 22",
      "eff": "2018-05-25",
      "url": "https://eur-lex.europa.eu/eli/reg/2016/679/oj"
    },
    "toronto": {
      "label": "Toronto short-term rental by-law — 28-day threshold",
      "eff": "2019-09-10",
      "url": "https://www.keycafe.com/s/blog/understanding-torontos-short-term-rental-regulations"
    },
    "vancouver": {
      "label": "BC / Vancouver short-term rental rules — 30-day threshold",
      "eff": "2024-05-01",
      "url": "https://liv.rent/blog/landlords/vancouver-short-term-rental-rules/"
    },
    "montreal": {
      "label": "Québec tourist accommodation — 31-day threshold",
      "eff": "2023-09-01",
      "url": "https://lendcity.ca/blog/short-term-rental-regulations-across-canada-city-by-city-guide/"
    }
  },
  "defaults": {
    "minStayDays": 30,
    "minStaySrc": null,
    "depositCapMonths": null,
    "depositSrc": null,
    "appFeeCap": null,
    "appFeeCurrency": "USD",
    "appFeeSrc": null,
    "applicationFeeBanned": false,
    "applicationFeeSrc": null,
    "screeningFeeCap": null,
    "moveInFeesBarred": false,
    "moveInFeesSrc": null,
    "subLessorNamed": false,
    "landlordAgentMayChargeTenant": true,
    "tenantBrokerFeeSrc": null,
    "soiProtected": false,
    "soiSrc": null,
    "fairChance": false,
    "fairChanceSrc": null,
    "allInDisclosure": false,
    "allInSrc": null,
    "listingFeeDisclosureSrc": null,
    "registrationRequired": false,
    "registrationSrc": null,
    "subletSurchargePct": null,
    "subletSurchargeSrc": null,
    "roommateProportionateShare": false,
    "brokerLicenceSrc": null,
    "reusableReport": false,
    "contractType": null,
    "unassessed": false,
    "notes": []
  },
  "city": {
    "new-york": {
      "minStayDays": 30,
      "minStaySrc": "ll18",
      "depositCapMonths": 1,
      "depositSrc": "gol7108",
      "appFeeCap": 20,
      "appFeeCurrency": "USD",
      "appFeeSrc": "rpl238a",
      "applicationFeeBanned": true,
      "applicationFeeSrc": "rpl238a",
      "screeningFeeCap": 20,
      "moveInFeesBarred": true,
      "moveInFeesSrc": "rpl238a",
      "subLessorNamed": true,
      "landlordAgentMayChargeTenant": false,
      "tenantBrokerFeeSrc": "fare",
      "soiProtected": true,
      "soiSrc": "nycSoi",
      "fairChance": true,
      "fairChanceSrc": "fcha",
      "allInDisclosure": true,
      "allInSrc": "fare",
      "listingFeeDisclosureSrc": "fareDisclosure",
      "subletSurchargePct": 10,
      "subletSurchargeSrc": "rsc25256",
      "roommateProportionateShare": true,
      "brokerLicenceSrc": "rpl440",
      "reusableReport": true,
      "reusableSrc": "rpl238a",
      "contractType": "NY residential lease; sublet or assignment under § 226-b",
      "sublet": {
        "statute": "NY RPL § 226-b",
        "src": "rpl226b",
        "infoWindowDays": 10,
        "decisionWindowDays": 30,
        "silenceIsConsent": true,
        "appliesTo": "Buildings with four or more dwelling units",
        "assignmentNote": "Assignment needs the landlord’s written consent, which may be withheld without cause — the tenant’s remedy is release from the lease on 30 days’ notice. Subletting is the route that carries the deemed-consent clock."
      },
      "notes": [
        "A tenant may not be charged the broker fee when the landlord engaged the broker.",
        "Every fee a tenant will owe must be disclosed in the listing and in the lease.",
        "A consumer report the applicant supplies, dated within 30 days, must be accepted in place of a new screening fee."
      ]
    },
    "seattle": {
      "fairChance": true,
      "fairChanceSrc": "seattleCrim",
      "soiProtected": true,
      "soiSrc": "seattleCrim"
    },
    "chicago": {
      "fairChance": true,
      "fairChanceSrc": "fcha",
      "soiProtected": true
    },
    "denver": {
      "allInDisclosure": true,
      "allInSrc": "coHb1090",
      "soiProtected": true
    },
    "portland": {
      "fairChance": true,
      "soiProtected": true
    },
    "boston": {
      "soiProtected": true,
      "allInDisclosure": true,
      "allInSrc": "ftcFees"
    },
    "washington-dc": {
      "soiProtected": true,
      "fairChance": true
    },
    "barcelona": {
      "registrationRequired": true,
      "registrationSrc": "catSeason",
      "contractType": "Contracte de temporada — the temporary purpose must be documented in the contract",
      "notes": [
        "Catalonia’s seasonal and room-rental regime reaches mid-term lets, not only tourist lets. Rent caps can apply."
      ]
    },
    "berlin": {
      "minStayDays": 90,
      "minStaySrc": "deZweck",
      "registrationRequired": true,
      "registrationSrc": "deZweck",
      "contractType": "Zeitmietvertrag with a documented temporary purpose",
      "notes": [
        "Berlin’s misappropriation ban is the binding constraint, and the practical threshold sits near three months rather than 30 days."
      ]
    },
    "paris": {
      "contractType": "Bail mobilité — 1 to 10 months, non-renewable, no deposit permitted",
      "depositCapMonths": 0,
      "depositSrc": "frMobilite",
      "notes": [
        "The bail mobilité is only available to tenants in training, study, apprenticeship, professional assignment or temporary posting. Eligibility must be captured at application."
      ]
    },
    "amsterdam": {
      "minStayDays": 30,
      "depositCapMonths": 2,
      "depositSrc": "nlGoed",
      "landlordAgentMayChargeTenant": false,
      "tenantBrokerFeeSrc": "nlGoed",
      "notes": [
        "A stay of 30 days or more is a tenancy with full protection, and fixed terms are largely unavailable since July 2024."
      ]
    },
    "toronto": {
      "minStayDays": 28,
      "minStaySrc": "toronto"
    },
    "vancouver": {
      "minStayDays": 30,
      "minStaySrc": "vancouver"
    },
    "montreal": {
      "minStayDays": 31,
      "minStaySrc": "montreal"
    },
    "quebec-city": {
      "minStayDays": 31,
      "minStaySrc": "montreal"
    },
    "london": {
      "contractType": "Assured tenancy, periodic — fixed terms abolished",
      "allInDisclosure": true,
      "allInSrc": "ukRra",
      "notes": [
        "The advertised rent is a ceiling: accepting more than the stated rent is prohibited, and no more than one month’s rent may be taken in advance."
      ]
    }
  },
  "region": {
    "NY": {
      "depositCapMonths": 1,
      "depositSrc": "gol7108",
      "appFeeCap": 20,
      "appFeeSrc": "rpl238a",
      "reusableReport": true,
      "applicationFeeBanned": true,
      "applicationFeeSrc": "rpl238a",
      "screeningFeeCap": 20,
      "moveInFeesBarred": true,
      "moveInFeesSrc": "rpl238a",
      "subLessorNamed": true,
      "subletSurchargePct": 10,
      "subletSurchargeSrc": "rsc25256",
      "roommateProportionateShare": true,
      "brokerLicenceSrc": "rpl440"
    },
    "CO": {
      "allInDisclosure": true,
      "allInSrc": "coHb1090"
    },
    "MN": {
      "allInDisclosure": true,
      "allInSrc": "mnTotal"
    },
    "MA": {
      "soiProtected": true,
      "allInDisclosure": true,
      "allInSrc": "ftcFees"
    },
    "WA": {
      "fairChance": true,
      "fairChanceSrc": "seattleCrim",
      "soiProtected": true
    },
    "OR": {
      "fairChance": true,
      "soiProtected": true
    },
    "NJ": {
      "fairChance": true,
      "soiProtected": true
    },
    "CA": {
      "soiProtected": true,
      "allInDisclosure": true,
      "allInSrc": "ftcFees"
    },
    "CT": {
      "allInDisclosure": true,
      "allInSrc": "ftcFees",
      "soiProtected": true
    },
    "VA": {
      "allInDisclosure": true,
      "allInSrc": "ftcFees"
    },
    "DC": {
      "soiProtected": true,
      "fairChance": true
    },
    "England": {
      "contractType": "Assured tenancy, periodic",
      "allInDisclosure": true,
      "allInSrc": "ukRra"
    },
    "Scotland": {
      "contractType": "Private residential tenancy"
    },
    "ON": {
      "minStayDays": 28,
      "minStaySrc": "toronto"
    },
    "BC": {
      "minStayDays": 30,
      "minStaySrc": "vancouver"
    },
    "QC": {
      "minStayDays": 31,
      "minStaySrc": "montreal"
    }
  },
  "country": {
    "US": {
      "minStayDays": 30,
      "allInDisclosure": true,
      "allInSrc": "ftcFees",
      "screeningLaw": "fcra",
      "adLaw": "fha"
    },
    "CA": {
      "minStayDays": 30,
      "adLaw": "fha"
    },
    "GB": {
      "minStayDays": 30,
      "contractType": "Assured tenancy, periodic",
      "allInDisclosure": true,
      "allInSrc": "ukRra"
    },
    "IE": {
      "minStayDays": 30,
      "unassessed": true,
      "notes": [
        "Irish law was not assessed in the source research. Treat Dublin, Cork and Galway as unverified until counsel reviews."
      ]
    },
    "FR": {
      "minStayDays": 30,
      "contractType": "Bail mobilité or bail meublé",
      "registrationRequired": true,
      "registrationSrc": "euStr",
      "dataLaw": "gdpr"
    },
    "ES": {
      "minStayDays": 30,
      "registrationRequired": true,
      "registrationSrc": "esReg",
      "contractType": "Arrendamiento de temporada",
      "dataLaw": "gdpr"
    },
    "NL": {
      "minStayDays": 30,
      "depositCapMonths": 2,
      "depositSrc": "nlGoed",
      "landlordAgentMayChargeTenant": false,
      "tenantBrokerFeeSrc": "nlGoed",
      "dataLaw": "gdpr",
      "notes": [
        "Written, published, non-discriminatory selection criteria are required on every listing, and a rejected applicant is owed an explanation."
      ]
    },
    "DE": {
      "minStayDays": 30,
      "contractType": "Zeitmietvertrag",
      "registrationRequired": true,
      "registrationSrc": "euStr",
      "dataLaw": "gdpr"
    },
    "IT": {
      "minStayDays": 30,
      "registrationRequired": true,
      "registrationSrc": "itCin",
      "contractType": "Locazione transitoria",
      "dataLaw": "gdpr"
    },
    "CH": {
      "minStayDays": 30,
      "unassessed": true,
      "notes": [
        "Swiss law was not assessed in the source research. Treat Zurich, Geneva, Basel and Bern as unverified until counsel reviews."
      ]
    }
  },
  "eu": [
    "FR",
    "ES",
    "NL",
    "DE",
    "IT",
    "IE"
  ],
  "fx": {
    "_comment": "How many units of each currency one US dollar buys. A display and sorting convenience, not a settlement rate — nothing here charges anyone.",
    "updated": "2026-09",
    "perUsd": {
      "USD": 1,
      "CAD": 1.36,
      "EUR": 0.92,
      "GBP": 0.79,
      "CHF": 0.88
    },
    "byCountry": {
      "US": "USD",
      "CA": "CAD",
      "GB": "GBP",
      "IE": "EUR",
      "FR": "EUR",
      "ES": "EUR",
      "NL": "EUR",
      "DE": "EUR",
      "IT": "EUR",
      "CH": "CHF"
    }
  },
  "bannedTerms": [
    "no kids",
    "no children",
    "adults only",
    "no families",
    "child free",
    "childfree",
    "mature person only",
    "no wheelchair",
    "able bodied",
    "able-bodied",
    "no disabilities",
    "not suitable for disabled",
    "no service animals",
    "no foreigners",
    "americans only",
    "english speakers only",
    "christian only",
    "christians only",
    "muslim only",
    "no muslims",
    "jewish only",
    "whites only",
    "no immigrants",
    "no vouchers",
    "no section 8",
    "no section8",
    "no dss",
    "no housing benefit",
    "no cityfheps",
    "working professionals only",
    "employed only",
    "females only",
    "males only",
    "women only",
    "men only",
    "no gays",
    "straight only",
    "no couples"
  ]
};
