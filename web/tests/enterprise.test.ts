import assert from "node:assert/strict";
import { test } from "node:test";
import { accessKeyForPath, canAccess, EXPORT_ACCESS, GRANTABLE, PRESETS } from "../src/lib/access";
import { CATEGORY } from "../src/lib/books/core";
import {
  ADD_ONS,
  brokerComplete,
  brokerLine,
  COMPLIANCE_CHECKS,
  engagementValue,
  FAQ,
  licensedIn,
  monthName,
  occupancy,
  PACKAGES,
  parsePct,
  parseServiceRequest,
  pctLabel,
  requestScore,
  requestSummary,
  SERVICE,
  SERVICES,
  statementDue,
  statementMonth,
  statementTotals,
  suggestPackage,
  TRACKS,
} from "../src/lib/enterprise/catalog";
import { parseExpenseLines, parsePrices } from "../src/lib/enterprise/data";
import { advise } from "../src/lib/ops/advisor";
import { reportLines } from "../src/lib/ops/report";
import { RECIPES, TRIGGERS } from "../src/lib/ops/playbooks";

const ok = {
  name: "Dana Reyes",
  email: "Dana@Example.com",
  company: "Halsey Holdings",
  role: "company",
  propertyKind: "building",
  units: "24",
  buildings: "2",
  market: "Brooklyn, NY",
  services: ["management", "brokerage", "nope"],
  timeline: "30d",
  message: "Two walk-ups, 24 units. Current manager is retiring.",
  consent: true,
};

test("catalogue: every package points at real services and a track, ids unique", () => {
  assert.equal(new Set(PACKAGES.map((p) => p.id)).size, PACKAGES.length);
  assert.equal(new Set(SERVICES.map((s) => s.id)).size, SERVICES.length);
  for (const p of PACKAGES) {
    assert.ok(TRACKS.some((t) => t.id === p.track), p.id);
    assert.ok(p.services.length && p.services.every((s) => SERVICE.has(s)), p.id);
    assert.ok(p.includes.length >= 4 && p.tasks.length >= 5, `${p.id} has a real scope`);
    assert.doesNotMatch(`${p.basis} ${p.includes.join(" ")}`, /\$\d/, `${p.id} carries no invented price`);
  }
  for (const t of TRACKS) assert.ok(PACKAGES.filter((p) => p.track === t.id).length >= 2, t.id);
  for (const a of ADD_ONS) assert.ok(SERVICE.has(a.service), a.id);
  assert.ok(COMPLIANCE_CHECKS.length >= 6);
  // The RentLeaks floor and fair housing are part of the pitch.
  assert.ok(SERVICE.get("furnished")!.body.includes("30 days"));
  assert.ok(FAQ.some((f) => /owner who hires us/.test(f.a)));
  assert.ok(SERVICES.filter((s) => s.licensed).every((s) => ["brokerage", "management", "owners"].includes(s.track)));
});

test("request: valid input is cleaned; unknown services dropped; fair-housing shape", () => {
  const r = parseServiceRequest(ok);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.request.email, "dana@example.com");
  assert.equal(r.request.units, 24);
  assert.deepEqual(r.request.services, ["management", "brokerage"]);
  assert.equal(r.request.timeline, "30d");
  assert.equal(r.spam, false);
  // Nothing about the people who will live there.
  assert.deepEqual(Object.keys(r.request).filter((k) => /^(age|children|family|household|income|nationality|religion|disability|gender|sex|race)/i.test(k)), []);
});

test("request: refusals name the field", () => {
  const bad = (over: Record<string, unknown>, field: string) => {
    const r = parseServiceRequest({ ...ok, ...over });
    assert.ok(!r.ok, field);
    if (!r.ok) assert.equal(r.field, field);
  };
  bad({ name: "D" }, "name");
  bad({ email: "nope" }, "email");
  bad({ phone: "call me" }, "phone");
  bad({ units: "lots" }, "units");
  bad({ services: [], packageId: "" }, "services");
  bad({ market: "", address: "" }, "market");
  bad({ consent: false }, "consent");
});

test("request: a package brings its services; honeypot marks spam; out-of-state inferred", () => {
  const r = parseServiceRequest({ ...ok, services: "", packageId: "ow-manage", website: "http://spam" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.spam, true);
  assert.ok(r.request.services.includes("remote") && r.request.services.includes("management"));
  assert.equal(r.request.outOfState, true);
  assert.equal(parseServiceRequest({ ...ok, packageId: "made-up" }).ok && (parseServiceRequest({ ...ok, packageId: "made-up" }) as { ok: true; request: { packageId: string | null } }).request.packageId, null);
});

test("request: summary, score and suggested package", () => {
  const r = parseServiceRequest(ok);
  assert.ok(r.ok);
  if (!r.ok) return;
  const s = requestSummary(r.request);
  assert.match(s, /Halsey Holdings/);
  assert.match(s, /24 units, 2 buildings/);
  assert.match(s, /Property management, Exclusive leasing/);
  assert.ok(!requestSummary(r.request, false).includes("retiring"), "the requester's copy leaves the note out");
  const score = requestScore(r.request);
  assert.ok(score.score >= 60, `scored ${score.score}`);
  assert.ok(score.parts.some((p) => p.label === "Licensed work (recurring fees)"));
  assert.equal(requestScore({ units: null, buildings: null, timeline: "exploring", services: ["media"], phone: null, company: null, message: "", outOfState: false }).score, 0);
  assert.equal(suggestPackage(r.request), "pm-full");
  assert.equal(suggestPackage({ services: ["remote"], propertyKind: "single", units: 1, outOfState: true }), "ow-lease");
  assert.equal(suggestPackage({ services: ["media"], propertyKind: "single", units: 1, outOfState: false }), "mk-launch");
  assert.equal(suggestPackage({ services: ["social"], propertyKind: "portfolio", units: 300, outOfState: false }), "mk-global");
  assert.equal(suggestPackage({ services: ["brokerage"], propertyKind: "single", units: 1, outOfState: false }), "br-placement");
  assert.equal(suggestPackage({ services: ["furnished"], propertyKind: "multi_room", units: 5, outOfState: false }), "pm-furnished");
});

test("money: fee models, percentages and owner statements", () => {
  assert.equal(parsePct("8"), 800);
  assert.equal(parsePct("8.25%"), 825);
  assert.equal(parsePct("101"), null);
  assert.equal(parsePct("-1"), null);
  assert.equal(pctLabel(800), "8%");
  assert.equal(pctLabel(850), "8.5%");
  assert.equal(pctLabel(825), "8.25%");
  const base = { amountCents: 0, pctBp: 0, units: 0, rentRollCents: 0 };
  assert.deepEqual(engagementValue({ ...base, feeModel: "monthly", amountCents: 150000 }), { monthly: 150000, once: 0 });
  assert.deepEqual(engagementValue({ ...base, feeModel: "per_unit", amountCents: 4900, units: 24 }), { monthly: 117600, once: 0 });
  assert.deepEqual(engagementValue({ ...base, feeModel: "percent", pctBp: 800, rentRollCents: 4_200_000 }), { monthly: 336000, once: 0 });
  assert.deepEqual(engagementValue({ ...base, feeModel: "commission", pctBp: 1000, rentRollCents: 300_000 }), { monthly: 0, once: 360000 });
  assert.deepEqual(engagementValue({ ...base, feeModel: "flat", amountCents: 90000 }), { monthly: 0, once: 90000 });
  assert.deepEqual(statementTotals({ collectedCents: 1_000_000, expensesCents: 50_000, pctBp: 800, flatFeeCents: 0 }), { fee: 80_000, net: 870_000 });
  assert.deepEqual(statementTotals({ collectedCents: 0, expensesCents: 20_000, pctBp: 800, flatFeeCents: 5_000 }), { fee: 5_000, net: -25_000 });
  assert.equal(occupancy(12, 9), 75);
  assert.equal(occupancy(0, 3), 0);
  assert.equal(occupancy(4, 9), 100);
});

test("statements: due for last month from the 5th, only for active buildings", () => {
  assert.equal(statementMonth("2026-09-17"), "2026-08");
  assert.equal(statementMonth("2026-01-03"), "2025-12");
  assert.equal(monthName("2026-08"), "August 2026");
  assert.equal(statementDue({ status: "active", lastMonth: null }, "2026-09-05"), true);
  assert.equal(statementDue({ status: "active", lastMonth: "2026-07" }, "2026-09-17"), true);
  assert.equal(statementDue({ status: "active", lastMonth: "2026-08" }, "2026-09-17"), false);
  assert.equal(statementDue({ status: "active", lastMonth: "2026-07" }, "2026-09-03"), false, "grace until the 5th");
  assert.equal(statementDue({ status: "onboarding", lastMonth: null }, "2026-09-17"), false);
  assert.deepEqual(parseExpenseLines('[{"label":"Plumber","amountCents":24000},{"label":1},"x"]'), [{ label: "Plumber", amountCents: 24000 }]);
  assert.deepEqual(parseExpenseLines("nope"), []);
});

test("licence: complete only with name, number, states and a way to reach the broker", () => {
  const b = { name: "Alternabiz Realty LLC", licence: "10991234567", states: "NY, NJ", phone: "(212) 555-0100", address: "", email: "" };
  assert.ok(brokerComplete(b));
  assert.ok(!brokerComplete({ ...b, phone: "" }));
  assert.ok(!brokerComplete({ ...b, licence: " " }));
  assert.match(brokerLine(b), /licensed real estate broker · Licence 10991234567 \(NY, NJ\) · \(212\) 555-0100/);
  assert.equal(brokerLine({ ...b, states: "" }), "");
  assert.ok(licensedIn(b, "ny"));
  assert.ok(!licensedIn(b, "CA"));
  assert.ok(!licensedIn({ ...b, states: "NYC" }, "NY"));
});

test("prices: only known packages, trimmed; bad JSON is ignored", () => {
  assert.deepEqual(parsePrices('{"mk-launch":"  from $900  / building ","nope":"x","br-placement":""}'), { "mk-launch": "from $900 / building" });
  assert.deepEqual(parsePrices("{oops"), {});
  assert.deepEqual(parsePrices(""), {});
});

test("access: enterprise is a grantable module with its own path and exports", () => {
  assert.ok(GRANTABLE.includes("enterprise"));
  assert.equal(accessKeyForPath("/admin/enterprise"), "enterprise");
  assert.equal(accessKeyForPath("/admin/enterprise?tab=portfolio"), "enterprise");
  for (const k of ["requests", "engagements", "properties", "statements"]) assert.equal(EXPORT_ACCESS[k], "enterprise");
  assert.ok(PRESETS.sales.access.includes("enterprise"));
  assert.ok(canAccess({ role: "staff", staffAccess: ["enterprise"] }, "enterprise"));
  assert.ok(!canAccess({ role: "staff", staffAccess: ["leads"] }, "enterprise"));
  assert.ok(!canAccess({ role: "host" }, "enterprise"));
  for (const c of ["commissions", "management_fees", "marketing_services"]) assert.equal(CATEGORY.get(c)?.kind, "income");
});

test("advisor, report and playbooks know about enterprise work", () => {
  const a = advise({ enterpriseWaiting: 2, brokerMissing: true, statementsDue: 1, statementMonth: "2026-08", engagementStepsLate: 3, emailReady: false });
  assert.deepEqual(
    a.slice(0, 3).map((x) => x.id),
    ["email", "enterprise", "licence"],
  );
  assert.ok(a.find((x) => x.id === "statements")!.title.includes("2026-08"));
  assert.deepEqual(
    a.filter((x) => x.key === "enterprise").map((x) => x.id),
    ["enterprise", "licence", "statements", "steps"],
  );
  assert.deepEqual(advise({ enterpriseWaiting: 0, brokerMissing: false, statementsDue: 0, engagementStepsLate: 0 }).filter((x) => x.key === "enterprise"), []);
  const n = { leads: 1, leadsBefore: 1, replyMins: 5, shortlists: 0, opened: 0, bookingsSigned: 0, newHosts: 0, newListings: 0, income: 0, expenses: 0, net: 0, netBefore: 0 };
  assert.ok(!reportLines(n).some(([k]) => k.startsWith("Enterprise")));
  assert.equal(new Map(reportLines({ ...n, enterprise: { requests: 4, signed: 1 } })).get("Enterprise requests / signed"), "4 / 1");
  for (const k of ["owner_request_waiting", "proposal_quiet"] as const) {
    assert.equal(TRIGGERS[k].key, "enterprise");
    assert.ok(RECIPES.some((r) => r.trigger === k));
  }
});
