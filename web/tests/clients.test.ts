import assert from "node:assert/strict";
import { test } from "node:test";
import { clientHealth, clientSuggestions, mergeTimeline, type ClientFacts } from "../src/lib/clients/account";
import { advise } from "../src/lib/ops/advisor";
import { reportLines, weekKey } from "../src/lib/ops/report";
import { RECIPES, TRIGGERS } from "../src/lib/ops/playbooks";

const base: ClientFacts = {
  role: "host",
  suspended: false,
  verified: true,
  daysSinceJoin: 40,
  daysSinceSignIn: 3,
  trialDaysLeft: null,
  listings: 2,
  live: 2,
  pending: 0,
  declined: 0,
  grade: "A",
  weakest: null,
  overdueInvoices: 0,
  openLeads: 0,
  unansweredLeads: 0,
  bookingsActive: 0,
  renewalSoon: false,
  flaggedMessages: 0,
  openReports: 0,
  lifetimeCents: 7000,
  hasContact: true,
  lastTouchDays: 5,
};

test("client health: transparent parts, capped, zero when suspended", () => {
  const h = clientHealth(base);
  assert.equal(h.score, 100);
  assert.ok(h.parts.every((p) => p.points !== 0));
  assert.equal(clientHealth({ ...base, suspended: true }).score, 0);
  const risky = clientHealth({ ...base, grade: "D", flaggedMessages: 2, openReports: 1, verified: false, daysSinceSignIn: 90, lifetimeCents: 0 });
  assert.ok(risky.score < 30, `risky host scored ${risky.score}`);
  const renter = clientHealth({ ...base, role: "renter", grade: null, listings: 0, live: 0, bookingsActive: 1 });
  assert.ok(renter.score >= 80);
});

test("client suggestions: trust and money first, role-specific moves after", () => {
  const s = clientSuggestions({ ...base, openReports: 1, overdueInvoices: 1, grade: "C", weakest: "speed" }, "u1", "a@b.co");
  assert.deepEqual(
    s.slice(0, 2).map((x) => x.id),
    ["trust", "invoice"],
  );
  assert.ok(s.some((x) => x.id === "nudge" && x.href === "/admin/hosts?open=u1"));
  assert.ok(clientSuggestions(base, "u1", "a@b.co").some((x) => x.id === "sponsor"));
  const newHost = clientSuggestions({ ...base, listings: 0, live: 0, grade: null, daysSinceJoin: 3, trialDaysLeft: 2 }, "u2", "n@b.co");
  assert.ok(newHost.some((x) => x.id === "nolisting"));
  assert.ok(newHost.some((x) => x.id === "trial"));
  const renter = clientSuggestions({ ...base, role: "renter", grade: null, listings: 0, live: 0, openLeads: 1, unansweredLeads: 1, renewalSoon: false }, "u3", "r+x@b.co");
  assert.ok(renter.some((x) => x.id === "match"));
  assert.ok(renter.find((x) => x.id === "lead")!.href!.includes("r%2Bx%40b.co"), "emails are URL-encoded");
  assert.ok(clientSuggestions({ ...base, hasContact: false }, "u", "e@x.co").some((x) => x.id === "crm"));
});

test("timeline: newest first, invalid dates dropped, limited", () => {
  const e = (iso: string, title: string) => ({ at: new Date(iso), kind: "note", title });
  const out = mergeTimeline([[e("2026-01-01", "a"), e("bad", "x")], [e("2026-03-01", "c"), e("2026-02-01", "b")]], 2);
  assert.deepEqual(
    out.map((x) => x.title),
    ["c", "b"],
  );
});

test("advisor: biggest impact first, quiet when nothing is wrong", () => {
  assert.deepEqual(advise({ emailReady: true, autopilot: true, freshness: true, playbooksOn: 2, medianReplyMins: 10, briefOff: false }), []);
  const a = advise({ emailReady: false, overdueInvoices: 2, medianReplyMins: 180, playbooksOn: 0, briefOff: true, topGap: { label: "rooms in Queens", gap: 4 } });
  assert.equal(a[0].id, "email");
  assert.equal(a[1].id, "overdue");
  assert.ok(a.find((x) => x.id === "speed")!.title.includes("3 hours"));
  assert.equal(a.find((x) => x.id === "speed")!.href, "/admin/playbooks", "no playbooks → suggest the alarm");
  assert.equal(a[a.length - 1].id, "brief");
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].impact >= a[i].impact);
  assert.ok(!advise({ shortlistsSent: 10, shortlistsOpened: 6 }).some((x) => x.id === "opens"));
  assert.ok(advise({ shortlistsSent: 10, shortlistsOpened: 1 }).some((x) => x.id === "opens"));
});

test("weekly report: readable lines and a Monday week key", () => {
  const lines = reportLines({ leads: 12, leadsBefore: 8, replyMins: 95, shortlists: 5, opened: 3, bookingsSigned: 1, newHosts: 2, newListings: 4, income: 50000, expenses: 20000, net: 30000, netBefore: 0 });
  const map = new Map(lines);
  assert.equal(map.get("Requests"), "12 (▲ 50% vs the week before)");
  assert.equal(map.get("Typical first reply"), "2 h");
  assert.equal(map.get("Net"), "$300 (new)");
  assert.equal(weekKey(new Date("2026-09-23T15:00:00Z")), "2026-09-21");
  assert.equal(weekKey(new Date("2026-09-21T13:00:00Z")), "2026-09-21");
});

test("playbooks: every new trigger has a recipe with a sensible wait", () => {
  for (const k of ["viewing_soon", "host_no_listing", "invoice_overdue", "payment_failed"] as const) {
    assert.ok(TRIGGERS[k], k);
    const r = RECIPES.find((x) => x.trigger === k);
    assert.ok(r, `recipe for ${k}`);
    assert.ok(r!.waitMinutes > 0);
  }
});
