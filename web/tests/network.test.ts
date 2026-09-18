import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { accessKeyForPath, canAccess, EXPORT_ACCESS, GRANTABLE } from "../src/lib/access";
import { CATEGORY } from "../src/lib/books/core";
import { advise } from "../src/lib/ops/advisor";
import { reportLines } from "../src/lib/ops/report";
import {
  briefLines,
  feeCompare,
  GUIDE,
  GUIDE_CONSENT,
  GUIDES,
  parseGuide,
  ROSTER_SLOTS,
  canonicalDocument,
  canSignNow,
  envelopeStatus,
  feeEstimateCents,
  feeLabel,
  maskIp,
  matchScore,
  parseFeeValue,
  parsePartner,
  parseSearch,
  partnerAgreement,
  rankPartners,
  referralDue,
  searchScore,
  signatureMatches,
  splitCity,
  tenantAgreement,
  withinCap,
  type MatchPartner,
} from "../src/lib/network/core";
import { readLink, signLink } from "../src/lib/ops/links";

const TODAY = "2026-09-17";
const brief = {
  name: "Ana Lopez",
  email: "Ana@Example.com",
  phone: "+1 718 555 0101",
  city: "Brooklyn, NY",
  neighborhoods: "Williamsburg, Greenpoint",
  homeType: "apartment",
  buildingAge: "new",
  bedrooms: "1",
  budgetMax: "3,800",
  moveIn: "2026-10-15",
  term: "long",
  mustHaves: ["laundry", "pets", "bogus"],
  feeCapType: "months",
  feeCapValue: "1",
  consent: true,
};

test("tenant brief: cleaned, fair, capped", () => {
  const r = parseSearch(brief, TODAY);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.email, "ana@example.com");
  assert.equal(r.value.city, "Brooklyn");
  assert.equal(r.value.state, "NY");
  assert.deepEqual(r.value.neighborhoods, ["Williamsburg", "Greenpoint"]);
  assert.deepEqual(r.value.mustHaves, ["laundry", "pets"]);
  assert.equal(r.value.budgetMax, 3800);
  assert.equal(r.value.feeCapValue, 100);
  const bad = (over: Record<string, unknown>, field: string) => {
    const x = parseSearch({ ...brief, ...over }, TODAY);
    assert.ok(!x.ok, field);
    if (!x.ok) assert.equal(x.field, field);
  };
  bad({ name: "" }, "name");
  bad({ email: "x" }, "email");
  bad({ city: "Brooklyn" }, "state");
  bad({ budgetMax: "" }, "budgetMax");
  bad({ budgetMin: "5000" }, "budgetMin");
  bad({ moveIn: "2026-01-01" }, "moveIn");
  bad({ term: "mid", termMonths: "12" }, "termMonths");
  bad({ feeCapValue: "abc" }, "feeCapValue");
  bad({ notes: "Adults only please, no kids" }, "notes");
  bad({ consent: false }, "consent");
  const lines = new Map(briefLines(r.value));
  assert.match(lines.get("Broker fee cap")!, /one month's rent .*\$3,800/);
  assert.ok(![...lines.values()].join(" ").includes("Ana"), "the partner brief never carries the name");
  assert.ok(searchScore(r.value, TODAY) >= 70);
  assert.deepEqual(splitCity("Jersey City, nj"), { city: "Jersey City", state: "NJ" });
});

test("fees: parsing, estimates, caps, referral", () => {
  assert.equal(parseFeeValue("pct", "12.5%"), 1250);
  assert.equal(parseFeeValue("pct", "31"), null);
  assert.equal(parseFeeValue("months", "1"), 100);
  assert.equal(parseFeeValue("flat", "$2,500"), 250000);
  assert.equal(parseFeeValue("flat", "0"), null);
  assert.equal(feeEstimateCents("months", 100, 3000), 300000);
  assert.equal(feeEstimateCents("pct", 1500, 3000), 540000);
  assert.equal(feeEstimateCents("flat", 250000, 3000), 250000);
  assert.equal(feeLabel("months", 150), "1.5 months' rent");
  assert.equal(feeLabel("pct", 1200), "12% of first-year rent");
  const cap = { type: "months", value: 100 };
  assert.ok(withinCap({ type: "pct", value: 800 }, cap, 3000), "8% of a year (0.96 month) fits under one month");
  assert.ok(!withinCap({ type: "pct", value: 900 }, cap, 3000));
  assert.ok(withinCap({ type: "flat", value: 300000 }, cap, 3000));
  assert.ok(withinCap({ type: "flat", value: 9_000_000 }, { type: "none", value: 0 }, 3000));
  assert.equal(referralDue(360000, 2500), 90000);
  assert.equal(referralDue(-5, 2500), 0);
});

const partner = (over: Partial<MatchPartner> = {}): MatchPartner => ({
  id: "p1",
  status: "active",
  licenseState: "NY",
  markets: ["Brooklyn"],
  specialties: ["apartments", "newdev"],
  languages: ["English", "Spanish"],
  capacity: 5,
  openLeads: 0,
  medianReplyMins: 30,
  offers: 10,
  accepted: 8,
  wins: 3,
  rating: 5,
  lastOfferedAt: null,
  ...over,
});
const search = { city: "Brooklyn", state: "NY", neighborhoods: ["Williamsburg"], homeType: "apartment", buildingAge: "new", term: "long", language: "Spanish", budgetMax: 3800 };
const NOW = Date.parse("2026-09-17T12:00:00Z");

test("matching: licence state, market and capacity gate; reasons explain the score", () => {
  const m = matchScore(search, partner(), NOW)!;
  assert.ok(m.score >= 80, `scored ${m.score}`);
  assert.ok(m.reasons.includes("Works Brooklyn"));
  assert.ok(m.reasons.includes("Speaks Spanish"));
  assert.equal(matchScore(search, partner({ licenseState: "NJ" }), NOW), null);
  assert.equal(matchScore(search, partner({ status: "paused" }), NOW), null);
  assert.equal(matchScore(search, partner({ markets: ["Queens"] }), NOW), null);
  assert.equal(matchScore(search, partner({ openLeads: 5 }), NOW), null);
  assert.ok(matchScore(search, partner({ markets: ["williamsburg"] }), NOW), "a neighborhood alone is enough");
  const ranked = rankPartners(search, [partner({ id: "slow", medianReplyMins: 2000, lastOfferedAt: NOW }), partner({ id: "fast" }), partner({ id: "far", markets: ["Bronx"] })], NOW, new Set(["x"]));
  assert.deepEqual(
    ranked.map((r) => r.p.id),
    ["fast", "slow"],
  );
  assert.deepEqual(rankPartners(search, [partner()], NOW, new Set(["p1"])), []);
});

test("partner application: licence, supervising broker, markets", () => {
  const app = { name: "Sam Rivera", email: "sam@brokerage.test", phone: "212 555 0199", brokerage: "Rivera Realty", licenseType: "salesperson", licenseNumber: "10401234567", licenseState: "ny", markets: "Brooklyn, Queens", specialties: ["apartments"], supervisorName: "Dana Park", supervisorEmail: "dana@brokerage.test", consent: "on" };
  const r = parsePartner(app, TODAY);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.licenseState, "NY");
  assert.deepEqual(r.value.markets, ["Brooklyn", "Queens"]);
  assert.deepEqual(r.value.languages, ["English"]);
  const bad = (over: Record<string, unknown>, field: string) => {
    const x = parsePartner({ ...app, ...over }, TODAY);
    assert.ok(!x.ok, field);
    if (!x.ok) assert.equal(x.field, field);
  };
  bad({ supervisorEmail: "" }, "supervisorEmail");
  bad({ supervisorEmail: "sam@brokerage.test" }, "supervisorEmail");
  bad({ licenseNumber: "x" }, "licenseNumber");
  bad({ licenseExpires: "2026-01-01" }, "licenseExpires");
  bad({ markets: "" }, "markets");
  bad({ specialties: ["nope"] }, "specialties");
  bad({ consent: false }, "consent");
  const broker = parsePartner({ ...app, licenseType: "broker", supervisorName: "", supervisorEmail: "" }, TODAY);
  assert.ok(broker.ok && broker.value.supervisorEmail === null, "a broker of record needs no supervisor");
});

const referrer = { name: "Alternabiz Realty LLC", licence: "10991234567", states: "NY", contact: "(212) 555-0100" };

test("tenant agreement: the clauses the law and the promise need", () => {
  const doc = tenantAgreement({
    date: TODAY,
    tenant: { name: "Ana Lopez", email: "ana@example.com" },
    partner: { name: "Sam Rivera", email: "sam@x.test", licenseType: "salesperson", licenseNumber: "10401234567", licenseState: "NY", brokerage: "Rivera Realty", supervisorName: "Dana Park" },
    search: { ...search, bedrooms: 1, moveIn: "2026-10-15", termMonths: 12, mustHaves: [] },
    fee: { type: "months", value: 100 },
    termDays: 90,
    referralPctBp: 2500,
    referrer,
  });
  const text = canonicalDocument(doc);
  for (const must of ["FARE Act", "DOS-1735-f", "No lease, no fee", "25% out of the fee", "does not increase what you pay", "never charges you a fee for a home they represent for the landlord", "fair-housing", "paper copy", "SHA-256", "90 days", "about $3,800"]) {
    assert.ok(text.includes(must), `missing: ${must}`);
  }
  assert.equal(doc.terms.feeEstimateCents, 380000);
  const nj = canonicalDocument(tenantAgreement({ ...{ date: TODAY, tenant: { name: "A B", email: "a@b.co" }, partner: { name: "S R", email: "s@x.co", licenseType: "broker", licenseNumber: "NJ12345", licenseState: "NJ", brokerage: "R", supervisorName: null }, search: { ...search, state: "NJ", city: "Hoboken", bedrooms: 0, moveIn: null, termMonths: null, mustHaves: [] }, fee: { type: "pct", value: 1000 }, termDays: 60, referralPctBp: 2000, referrer } }));
  assert.ok(!nj.includes("DOS-1735-f") && !nj.includes("FARE Act"), "New York-only clauses stay out of other states");
  assert.ok(nj.includes("a studio"));
});

test("partner agreement: broker-to-broker referral fee, licence and conduct", () => {
  const doc = partnerAgreement({
    date: TODAY,
    partner: { name: "Sam Rivera", email: "sam@x.test", licenseType: "salesperson", licenseNumber: "10401234567", licenseState: "NY", brokerage: "Rivera Realty", supervisorName: "Dana Park", supervisorEmail: "dana@x.test" },
    referralPctBp: 2500,
    offerHours: 24,
    referrer,
  });
  const text = canonicalDocument(doc);
  for (const must of ["§ 442", "never by or to an individual salesperson", "25% of the gross fee", "within 24 hours", "12 months", "three years", "Dana Park", "fair-housing"]) assert.ok(text.includes(must), `missing: ${must}`);
});

test("documents: the fingerprint is stable and changes with any word", () => {
  const doc = { title: "T", sections: [{ heading: "1", body: "a" }], terms: { b: 2, a: 1 } };
  const h = (d: typeof doc) => createHash("sha256").update(canonicalDocument(d)).digest("hex");
  assert.equal(h(doc), h({ ...doc, terms: { a: 1, b: 2 } }), "term order doesn't matter");
  assert.notEqual(h(doc), h({ ...doc, sections: [{ heading: "1", body: "a." }] }));
  assert.notEqual(h(doc), h({ ...doc, terms: { a: 1, b: 3 } }));
});

test("signing: order, status, names and privacy", () => {
  const s = [
    { id: "t", order: 0, status: "signed" },
    { id: "p", order: 1, status: "viewed" },
    { id: "b", order: 2, status: "pending" },
  ];
  assert.ok(canSignNow(s, "p"));
  assert.ok(!canSignNow(s, "b"), "the broker of record signs after the agent");
  assert.ok(!canSignNow(s, "t"), "no signing twice");
  assert.equal(envelopeStatus(s, "sent"), "partial");
  assert.equal(envelopeStatus(s.map((x) => ({ ...x, status: "signed" })), "partial"), "completed");
  assert.equal(envelopeStatus([...s, { id: "d", order: 3, status: "declined" }], "partial"), "declined");
  assert.equal(envelopeStatus(s, "voided"), "voided");
  assert.equal(envelopeStatus([{ status: "pending" }], "sent"), "sent");
  assert.ok(signatureMatches("  ana   LÓPEZ ", "Ana López"));
  assert.ok(signatureMatches("ana lopez", "Ana Maria Lopez"), "first and last name is enough");
  assert.ok(!signatureMatches("A", "Ana Lopez"));
  assert.ok(!signatureMatches("Sam Rivera", "Ana Lopez"));
  assert.equal(maskIp("203.0.113.42"), "203.0.113.x");
  assert.equal(maskIp("2001:db8:85a3:0:0:8a2e:370:7334"), "2001:db8:85a3:…");
  assert.equal(maskIp(null), "—");
});

test("links: signed, typed and revocable by nonce", () => {
  const t = signLink(["g", "signer1", "nonceA"], new Date(NOW + 60_000), "k");
  assert.deepEqual(readLink(t, NOW, "k"), ["g", "signer1", "nonceA"]);
  assert.equal(readLink(t, NOW + 120_000, "k"), null, "expired");
  assert.equal(readLink(t, NOW, "other"), null, "forged");
  const other = signLink(["g", "signer2", "nonceA"], new Date(NOW + 60_000), "k");
  assert.equal(readLink(`${other.split(".")[0]}.${t.split(".")[1]}`, NOW, "k"), null, "a signature can't be moved to another payload");
});

test("access: the network module, exports and income category", () => {
  assert.ok(GRANTABLE.includes("network"));
  assert.equal(accessKeyForPath("/admin/referrals"), "network");
  for (const k of ["network-searches", "network-partners", "network-agreements", "network-deals"]) assert.equal(EXPORT_ACCESS[k], "network");
  assert.ok(!canAccess({ role: "staff", staffAccess: ["leads"] }, "network"));
  assert.equal(CATEGORY.get("referral_fees")?.kind, "income");
});

test("advisor and weekly report: the network lines", () => {
  const a = advise({ networkNoMatch: 1, networkToVerify: 2, networkToInvoice: 1, networkFeesDueCents: 80_000, networkWaitingSign: 3 });
  const net = a.filter((x) => x.key === "network");
  assert.deepEqual(
    net.map((x) => x.id),
    ["net-nomatch", "net-verify", "net-fees", "net-sign"],
  );
  assert.match(net[0].title, /1 tenant search with no broker/);
  assert.match(net[1].href, /status=verifying/);
  assert.match(net[2].body, /\$800/);
  assert.deepEqual(advise({ networkNoMatch: 0, networkToVerify: 0 }).filter((x) => x.key === "network"), []);
  const base = { leads: 1, leadsBefore: 1, replyMins: null, shortlists: 0, opened: 0, bookingsSigned: 0, newHosts: 0, newListings: 0, income: 0, expenses: 0, net: 0, netBefore: 0 };
  assert.ok(reportLines({ ...base, network: { searches: 4, signed: 2, leases: 1 } }).some(([k, v]) => k.startsWith("Broker network") && v === "4 / 2 / 1"));
  assert.ok(!reportLines(base).some(([k]) => k.startsWith("Broker network")));
});

test("guides: the lead magnets, their consent and the roster shape", () => {
  // The catalog is generated from tools/guides/*.json, so this checks its shape
  // rather than its length — adding a guide shouldn't break the suite.
  assert.ok(GUIDES.length >= 2, "at least one guide for each audience");
  for (const who of ["tenant", "partner"] as const) {
    assert.ok(GUIDES.some((g) => g.audience === who), `a ${who} guide exists`);
  }
  assert.deepEqual(
    GUIDES.map((g) => g.audience),
    [...GUIDES].sort((a, b) => (a.audience === b.audience ? 0 : a.audience === "tenant" ? -1 : 1)).map((g) => g.audience),
    "renters' guides come before partners'",
  );
  assert.equal(new Set(GUIDES.map((g) => g.id)).size, GUIDES.length, "ids are unique");
  for (const g of GUIDES) {
    assert.ok(g.file.endsWith(".pdf"), `${g.id} has a file`);
    assert.ok(g.inside.length >= 4, `${g.id} lists what's inside`);
    assert.ok(g.pages >= 1, `${g.id} knows its page count`);
    assert.ok(g.cta.trim().length > 0, `${g.id} has a button`);
    assert.equal(GUIDE.get(g.id), g);
  }
  // Every consent sentence says who makes contact and how to stop.
  for (const who of ["tenant", "partner"] as const) {
    assert.match(GUIDE_CONSENT[who], /contact me by email, phone or text/);
    assert.match(GUIDE_CONSENT[who], /stop at any time/);
  }
  assert.match(GUIDE_CONSENT.tenant, /referral partner brokers/);
  assert.equal(ROSTER_SLOTS, 10);

  const bad = parseGuide({ guideId: "renter-playbook", name: "Rae", email: "rae@example.com" });
  assert.equal(bad.ok, false);
  assert.equal(bad.ok === false && bad.field, "consent", "no tick box, no guide");

  const ok = parseGuide({ guideId: "renter-playbook", name: "Rae Thompson", email: " RAE@Example.com ", city: "Brooklyn, NY", consent: "on", source: "fb_ad", website: "" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.email, "rae@example.com");
    assert.equal(ok.value.audience, "tenant");
    assert.equal(ok.value.city, "Brooklyn, NY");
    assert.equal(ok.value.source, "fb_ad");
    assert.equal(ok.value.consentText, GUIDE_CONSENT.tenant, "the exact sentence is stored");
    assert.equal(ok.spam, false);
  }

  const noBrokerage = parseGuide({ guideId: "partner-kit", name: "Alex Agent", email: "alex@brokerage.com", consent: true });
  assert.equal(noBrokerage.ok === false && noBrokerage.field, "brokerage");
  const partner = parseGuide({ guideId: "partner-kit", name: "Alex Agent", email: "alex@brokerage.com", brokerage: "Harbor & Vine", licenseState: "ny", consent: true, website: "http://spam" });
  assert.ok(partner.ok && partner.spam, "the honeypot is caught, quietly");
  assert.equal(partner.ok && partner.value.licenseState, "NY");
  assert.equal(partner.ok && partner.value.consentText, GUIDE_CONSENT.partner);
  assert.equal(parseGuide({ guideId: "nope", name: "A", email: "a@b.co", consent: true }).ok, false);

  // The calculator on the page and the guide's table agree.
  const rows = feeCompare(3600);
  assert.deepEqual(
    rows.map((r) => r.cents),
    [360_000, 518_400, 648_000],
  );
  assert.equal(EXPORT_ACCESS["network-guides"], "network");
});
