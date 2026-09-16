import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, leadSummary, messengerLink, parseLead } from "../src/lib/leads";

const TODAY = "2026-09-16";
const base = { name: "Ada Renter", email: " Ada@Example.com ", consent: true };

test("a match request needs only a name, an email and consent", () => {
  const r = parseLead({ ...base, kind: "match", cityId: "nyc", budgetMax: "2400", stayMonths: 3, source: "fb_button" }, TODAY);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.spam, false);
  assert.equal(r.lead.email, "ada@example.com");
  assert.equal(r.lead.budgetMax, 2400);
  assert.equal(r.lead.listingId, null);
  assert.equal(r.lead.source, "fb_button");
});

test("consent, a valid email and a known kind are required", () => {
  assert.deepEqual(pick(parseLead({ ...base, kind: "match", consent: false }, TODAY)), "consent");
  assert.deepEqual(pick(parseLead({ ...base, kind: "match", email: "nope" }, TODAY)), "email");
  assert.deepEqual(pick(parseLead({ ...base, kind: "rent-now" }, TODAY)), "kind");
  assert.deepEqual(pick(parseLead({ ...base, kind: "match", phone: "call me" }, TODAY)), "phone");
  assert.deepEqual(pick(parseLead({ ...base, kind: "match", name: "Win at www.example.com" }, TODAY)), "name");
});

test("a viewing needs a listing and at least one slot within 60 days", () => {
  assert.equal(pick(parseLead({ ...base, kind: "viewing", viewingSlots: [{ date: TODAY, window: "evening" }] }, TODAY)), "listingId");
  assert.equal(pick(parseLead({ ...base, kind: "viewing", listingId: "l1", viewingSlots: [] }, TODAY)), "viewingSlots");
  assert.equal(
    pick(parseLead({ ...base, kind: "viewing", listingId: "l1", viewingSlots: [{ date: "2026-09-15", window: "morning" }] }, TODAY)),
    "viewingSlots",
  );
  assert.equal(
    pick(parseLead({ ...base, kind: "viewing", listingId: "l1", viewingSlots: [{ date: addDays(TODAY, 61), window: "morning" }] }, TODAY)),
    "viewingSlots",
  );
  const r = parseLead(
    {
      ...base,
      kind: "viewing",
      listingId: "l1",
      viewingMode: "video",
      viewingSlots: [
        { date: "2026-09-18", window: "evening" },
        { date: "2026-09-18", window: "evening" },
        { date: "", window: "" },
        { date: "2026-09-20", window: "morning" },
      ],
    },
    TODAY,
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.lead.viewingSlots.length, 2, "duplicates and blank rows are dropped");
    assert.equal(r.lead.viewingMode, "video");
  }
});

test("a stay request needs both dates, in order, not in the past", () => {
  const stay = { ...base, kind: "stay", listingId: "l1" };
  assert.equal(pick(parseLead({ ...stay, moveIn: "2026-10-01" }, TODAY)), "moveOut");
  assert.equal(pick(parseLead({ ...stay, moveIn: "2026-09-01", moveOut: "2026-12-01" }, TODAY)), "moveIn");
  assert.equal(pick(parseLead({ ...stay, moveIn: "2026-10-01", moveOut: "2026-10-01" }, TODAY)), "moveOut");
  assert.equal(pick(parseLead({ ...stay, moveIn: "2026-02-30", moveOut: "2026-12-01" }, TODAY)), "moveIn");
  assert.ok(parseLead({ ...stay, moveIn: "2026-10-01", moveOut: "2027-01-01" }, TODAY).ok);
});

test("the honeypot is accepted quietly and flagged as spam", () => {
  const r = parseLead({ ...base, kind: "match", website: "http://spam.example" }, TODAY);
  assert.ok(r.ok && r.spam);
});

test("the summary and the Messenger link carry the request", () => {
  const r = parseLead(
    { ...base, kind: "viewing", listingId: "l1", viewingSlots: [{ date: "2026-09-18", window: "evening" }], message: "Is parking included?" },
    TODAY,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  const text = leadSummary(r.lead, { title: "Sunny room in Bushwick" });
  assert.match(text, /^Viewing request — Ada Renter/);
  assert.match(text, /Home: Sunny room in Bushwick/);
  assert.match(text, /2026-09-18 Evening/);
  assert.doesNotMatch(text, /ada@example\.com/, "contact details stay out of the summary");
  const link = new URL(messengerLink(text, "lead_abc"));
  assert.equal(link.origin + link.pathname, "https://m.me/rentleaks.official");
  assert.equal(link.searchParams.get("ref"), "lead_abc");
  assert.equal(link.searchParams.get("text"), text);
});

function pick(r: ReturnType<typeof parseLead>) {
  return r.ok ? "ok" : r.field;
}
