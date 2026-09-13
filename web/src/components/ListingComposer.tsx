"use client";

/**
 * Listing composer.
 *
 * The React port of the static site's composer, against Postgres. Same staged
 * shape, same publication gate, same rules engine — the engine lives in
 * `@/lib/listing-rules` precisely so this component and the server action
 * cannot drift apart. The browser copy of the gate exists so nobody wastes
 * five minutes on a form that will be rejected; the server copy is the one
 * that decides, because a client-side check is not a check.
 *
 * Design rule carried over: a field exists because something downstream reads
 * it or a rule requires it. Nothing here asks a structured question about who
 * may live in the home — a drop-down on a protected characteristic is the line
 * a listings platform cannot cross — so the composer describes the property
 * and the free text is scanned for wording that cannot lawfully be published.
 */

import { useMemo, useState } from "react";
import {
  checkListing,
  rulesFor,
  scanText,
  allInOf,
  monthlyFees,
  type Check,
  type Fee,
  type ListingDraft,
} from "@/lib/listing-rules";

type City = { id: string; slug: string; name: string; state: string; country: string; currency: string };
type HousingType = { id: string; label: string };

const FEE_TYPES: Array<[string, string, "monthly" | "once"]> = [
  ["utilities", "Utilities", "monthly"],
  ["wifi", "Wi-Fi / internet", "monthly"],
  ["cleaning", "Cleaning", "monthly"],
  ["parking", "Parking", "monthly"],
  ["amenity", "Amenity fee", "monthly"],
  ["storage", "Storage", "monthly"],
  ["pet", "Pet rent", "monthly"],
  ["broker", "Broker fee", "once"],
  ["admin", "Admin fee", "once"],
  ["move_in", "Move-in fee", "once"],
  ["key", "Key fee", "once"],
];

const AMENITIES: Array<[string, string]> = [
  ["laundry-in-unit", "Laundry in unit"],
  ["laundry-in-building", "Laundry in building"],
  ["ac", "Air conditioning"],
  ["heating", "Heating included"],
  ["dishwasher", "Dishwasher"],
  ["elevator", "Lift"],
  ["workspace", "Desk / workspace"],
  ["bike-storage", "Bike storage"],
  ["gym", "Gym"],
  ["outdoor", "Balcony or garden"],
  ["parking", "Parking"],
];

/* Attributes of the PROPERTY, never of the person. This is the one
   accessibility-adjacent facet that lowers fair-housing risk rather than
   creating it, because it describes a step. */
const ACCESS: Array<[string, string]> = [
  ["step-free", "Step-free from the street to the door"],
  ["lift", "Lift to the floor"],
  ["wide-doors", "Doorways 32 inches / 81 cm or wider"],
  ["accessible-bath", "Roll-in shower or grab rails"],
  ["ground-floor", "Ground floor"],
];

const ADDRESS_PRIVACY: Array<[string, string, string]> = [
  ["full", "Full address", "Street, unit and all. Right for a vacant unit you want viewed quickly."],
  ["hide-unit", "Street, no unit number", "They can find the building; they cannot knock on your door."],
  ["street-only", "Street name only", "No house number. The default, and right for most rooms."],
  ["hidden", "Neighbourhood only", "Nothing but the area until you share it. Slows enquiries — worth it if you live there."],
];

const PLANS = {
  week: { label: "Weekly", listing: 14, sponsored: 45, per: "week" },
  month: { label: "Monthly", listing: 60, sponsored: 120, per: "month" },
} as const;

type PlanId = keyof typeof PLANS;

type Draft = {
  role: string;
  housingType: string;
  cityId: string;
  title: string;
  neighborhood: string;
  address: string;
  unit: string;
  addressPrivacy: string;
  beds: number;
  baths: number;
  sqft: number;
  furnishedLevel: string;
  price: number;
  deposit: number;
  fees: Fee[];
  availableFrom: string;
  availableUntil: string;
  minStayMonths: number;
  maxStayMonths: number;
  leaseEnd: string;
  takeoverType: string;
  consentStatus: string;
  registrationNumber: string;
  vouchers: boolean;
  pets: string;
  amenities: string[];
  access: string[];
  photos: string[];
  videoUrl: string;
  tourUrl: string;
  description: string;
  status: string;
  scheduledAt: string;
  sponsored: boolean;
  plan: PlanId;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ListingComposer({
  cities,
  housingTypes,
  action,
}: {
  cities: City[];
  housingTypes: HousingType[];
  action: (payload: string) => Promise<{ error?: string } | void>;
}) {
  const [stage, setStage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>({
    role: "owner",
    housingType: "room",
    cityId: cities[0]?.id || "nyc",
    title: "",
    neighborhood: "",
    address: "",
    unit: "",
    addressPrivacy: "street-only",
    beds: 1,
    baths: 1,
    sqft: 0,
    furnishedLevel: "fully",
    price: 1400,
    deposit: 0,
    fees: [{ type: "utilities", amount: 0, cadence: "monthly", mandatory: true }],
    availableFrom: todayISO(),
    availableUntil: "",
    minStayMonths: 1,
    maxStayMonths: 12,
    leaseEnd: "",
    takeoverType: "sublet",
    consentStatus: "pending",
    registrationNumber: "",
    vouchers: true,
    pets: "none",
    amenities: [],
    access: [],
    photos: [],
    videoUrl: "",
    tourUrl: "",
    description: "",
    status: "active",
    scheduledAt: "",
    sponsored: false,
    plan: "week",
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const city = useMemo(() => cities.find((c) => c.id === draft.cityId), [cities, draft.cityId]);
  const currency = city?.currency || "USD";
  const isLeaseBreak = draft.housingType === "lease-break";

  const rules = useMemo(
    () => rulesFor({ cityId: draft.cityId, citySlug: city?.slug, cityName: city?.name, state: city?.state, country: city?.country }),
    [draft.cityId, city],
  );

  const asDraft: ListingDraft = useMemo(
    () => ({
      role: draft.role,
      housingType: draft.housingType,
      cityId: draft.cityId,
      citySlug: city?.slug,
      cityName: city?.name,
      state: city?.state,
      country: city?.country,
      title: draft.title,
      neighborhood: draft.neighborhood,
      address: draft.address,
      description: draft.description,
      price: draft.price,
      deposit: draft.deposit,
      fees: draft.fees,
      availableFrom: draft.availableFrom,
      availableUntil: draft.availableUntil,
      minStayMonths: draft.minStayMonths,
      maxStayMonths: draft.maxStayMonths,
      leaseEnd: draft.leaseEnd,
      consentStatus: draft.consentStatus,
      registrationNumber: draft.registrationNumber,
      photoCount: draft.photos.length,
    }),
    [draft, city],
  );

  const checks: Check[] = useMemo(() => checkListing(asDraft), [asDraft]);
  const blockers = checks.filter((c) => c.blocking && !c.ok);
  const pct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(n || 0));
    } catch {
      return `${currency} ${Math.round(n || 0)}`;
    }
  };

  const stages = useMemo(() => {
    const s = [
      { id: "who", label: "Who & where" },
      { id: "home", label: "The home" },
      { id: "photos", label: "Photos" },
      { id: "money", label: "Dates & money" },
    ];
    if (isLeaseBreak) s.push({ id: "lease", label: "The lease" });
    s.push({ id: "review", label: "Review" });
    return s;
  }, [isLeaseBreak]);

  const now = stages[Math.min(stage, stages.length - 1)].id;

  const addressShown = () => {
    const street = draft.address.trim();
    const parts = (bits: Array<string | undefined>) => bits.filter(Boolean).join(", ");
    switch (draft.addressPrivacy) {
      case "full":
        return parts([street + (draft.unit ? `, #${draft.unit}` : ""), draft.neighborhood, city?.name]);
      case "hide-unit":
        return parts([street, draft.neighborhood, city?.name]);
      case "hidden":
        return parts([draft.neighborhood, city?.name]);
      default:
        return parts([street.replace(/^[\d\-\s]+/, "").trim(), draft.neighborhood, city?.name]);
    }
  };

  const cost = () => {
    const pl = PLANS[draft.plan];
    const listing = isLeaseBreak ? 0 : pl.listing;
    const sponsored = draft.sponsored ? pl.sponsored : 0;
    return { pl, listing, sponsored, total: listing + sponsored };
  };

  async function publish() {
    if (blockers.length) return;
    setSaving(true);
    setServerError(null);
    const res = await action(JSON.stringify({ ...draft, cityName: city?.name, state: city?.state, country: city?.country }));
    setSaving(false);
    if (res && "error" in res && res.error) setServerError(res.error);
  }

  /* --------------------------------------------------------------------- */

  const wordingHits = scanText(`${draft.title} ${draft.description}`);

  return (
    <div>
      <ol className="c-steps" aria-label="Listing progress">
        {stages.map((s, i) => {
          const state = i === stage ? "now" : i < stage ? "done" : "todo";
          return (
            <li className="c-step" data-state={state} key={s.id}>
              <button type="button" className="c-step__btn" onClick={() => setStage(i)}>
                <span className="c-step__dot" aria-hidden="true">{state === "done" ? "✓" : i + 1}</span>
                <span className="c-step__label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="c-shell">
        <div>
          {now === "who" && (
            <section className="c-section">
              <div className="c-section__head">
                <h2 className="c-section__title">Who and where</h2>
                <p className="c-section__sub">
                  Prices are held in the market&rsquo;s own currency and converted for whoever is browsing, so a Paris flat is never quoted in dollars.
                </p>
              </div>
              <div className="c-row">
                {(["owner", "manager", "tenant"] as const).map((r) => (
                  <label className={`v-role${draft.role === r ? " is-on" : ""}`} key={r}>
                    <input type="radio" name="role" checked={draft.role === r} onChange={() => set("role", r)} />
                    <span>
                      <b>{r === "owner" ? "I own it" : r === "manager" ? "I manage it" : "I am the tenant, leaving early"}</b>
                    </span>
                  </label>
                ))}
              </div>
              <div className="c-row">
                <Field label="Stay type">
                  <select value={draft.housingType} onChange={(e) => set("housingType", e.target.value)}>
                    {housingTypes.map((t) => (
                      <option value={t.id} key={t.id}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="City" help={`Priced in ${currency}.`}>
                  <select value={draft.cityId} onChange={(e) => set("cityId", e.target.value)}>
                    {cities.map((c) => (
                      <option value={c.id} key={c.id}>{c.name}{c.state ? `, ${c.state}` : ""}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Neighbourhood">
                  <input value={draft.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Bushwick" />
                </Field>
              </div>
              <div className="c-row">
                <Field label="Street address" help="Never shown in full. Sets the map pin, and is what an ownership document gets matched against.">
                  <input value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="294 Lenox Ave" autoComplete="street-address" />
                </Field>
                <Field label="Unit">
                  <input value={draft.unit} onChange={(e) => set("unit", e.target.value)} placeholder="5R" />
                </Field>
              </div>
              <Field label="Title" help={`${draft.title.length}/90`}>
                <input value={draft.title} maxLength={90} onChange={(e) => set("title", e.target.value)} placeholder="Private room with its own bath, two stops from the L" />
              </Field>
              <Field label="How much of the address renters see">
                <select value={draft.addressPrivacy} onChange={(e) => set("addressPrivacy", e.target.value)}>
                  {ADDRESS_PRIVACY.map(([v, l, d]) => (
                    <option value={v} key={v}>{l} — {d}</option>
                  ))}
                </select>
                <small>
                  Shown publicly as: <b>{addressShown() || "—"}</b>. We always hold the full address for the map pin and to match against your ownership document; this only controls display.
                </small>
              </Field>
            </section>
          )}

          {now === "home" && (
            <>
              <section className="c-section">
                <div className="c-section__head">
                  <h2 className="c-section__title">The home</h2>
                  <p className="c-section__sub">
                    Facts about the property. We never ask anything about who you want living in it — a structured question on that is the line a listings platform cannot cross.
                  </p>
                </div>
                <div className="c-row">
                  <Field label="Bedrooms"><input type="number" min={0} max={10} value={draft.beds} onChange={(e) => set("beds", Number(e.target.value))} /></Field>
                  <Field label="Bathrooms"><input type="number" min={0} max={10} step={0.5} value={draft.baths} onChange={(e) => set("baths", Number(e.target.value))} /></Field>
                  <Field label="Size (sq ft)"><input type="number" min={0} value={draft.sqft || ""} onChange={(e) => set("sqft", Number(e.target.value))} /></Field>
                  <Field label="Furnishing">
                    <select value={draft.furnishedLevel} onChange={(e) => set("furnishedLevel", e.target.value)}>
                      <option value="fully">Fully furnished</option>
                      <option value="partial">Partly furnished</option>
                      <option value="none">Unfurnished</option>
                    </select>
                  </Field>
                </div>
                <CheckGrid label="Amenities" options={AMENITIES} selected={draft.amenities} onToggle={(v) => set("amenities", toggle(draft.amenities, v))} />
              </section>

              <section className="c-section">
                <div className="c-section__head">
                  <h2 className="c-section__title">Getting in and around</h2>
                  <p className="c-section__sub">
                    Physical facts about the building. This is the one accessibility-adjacent filter that lowers fair-housing risk rather than creating it, because it describes a step rather than a person — and it is genuinely hard to find anywhere else.
                  </p>
                </div>
                <CheckGrid label="Access" options={ACCESS} selected={draft.access} onToggle={(v) => set("access", toggle(draft.access, v))} />
              </section>

              <section className="c-section">
                <div className="c-section__head">
                  <h2 className="c-section__title">Description</h2>
                  <p className="c-section__sub">
                    Write it for the person who will actually live there. The listings that convert say the awkward thing — the radiator, the 6am deliveries — before the viewing does.
                  </p>
                </div>
                <Field label="Description" help={`${draft.description.trim().length} characters`}>
                  <textarea rows={7} value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Who else lives here. What is genuinely included. What the building is like at eight in the morning." />
                </Field>
                {wordingHits.length > 0 && (
                  <div className="x-guard is-on">
                    <b>This cannot be published.</b> “{wordingHits[0]}” states a preference based on a protected characteristic, which is prohibited in a housing advertisement whoever wrote it. Describe the home, not the person you want in it — “two flights of stairs, no lift” is lawful and more useful than “no wheelchair”.
                  </div>
                )}
              </section>
            </>
          )}

          {now === "photos" && (
            <section className="c-section">
              <div className="c-section__head">
                <h2 className="c-section__title">Photographs</h2>
                <p className="c-section__sub">
                  Of this unit, not the building&rsquo;s marketing shots. Both the thing renters most often leave over and the cheapest fraud control we have — someone who cannot get into a property cannot photograph it.
                </p>
              </div>
              <div className="c-tips">
                <h3 className="c-tips__h">Nine minutes of photography is worth more than anything else on this page</h3>
                <p className="c-tips__lede">
                  Photographs are the first filter and usually the only one. A phone from the last five years is
                  plenty — what separates a listing that gets enquiries from one that does not is almost never the
                  camera.
                </p>
                <ol className="c-tips__list">
                  <li>
                    <b>Shoot in daylight, and turn every lamp on anyway.</b> Mid-morning or late afternoon, curtains
                    open. Mixed light beats a dark room. Never use the flash — it flattens the space and makes every
                    room look like an insurance claim.
                  </li>
                  <li>
                    <b>Stand in a corner, back to the wall.</b> From the doorway you photograph a wall; from the corner
                    you photograph the room. Hold the phone at chest height and keep it level — tilting up makes
                    ceilings loom and floors vanish.
                  </li>
                  <li>
                    <b>Landscape, always.</b> Rooms are wider than they are tall and every listing grid on the internet
                    is a landscape rectangle. A portrait photo gets cropped to its middle third.
                  </li>
                  <li>
                    <b>Tidy first, then shoot.</b> Clear the counters, make the bed, close the toilet lid, hide the
                    bins and the drying rack, take the shoes off the floor. This is fifteen minutes and it does more
                    for the price you can ask than any wording.
                  </li>
                  <li>
                    <b>Take the whole home, not the best bits.</b> The bedroom, the bathroom, the kitchen, the common
                    space, and the view from a window. Eight angles of the same sofa reads as though there is something
                    you are not showing — and renters assume the worst about the room you left out.
                  </li>
                  <li>
                    <b>Photograph the honest parts too.</b> The small bathroom, the shared kitchen, the stairs if there
                    is no lift. Someone who arrives to a surprise walks away and you have lost the viewing; someone who
                    knew and came anyway is there to sign.
                  </li>
                  <li>
                    <b>Lead with the room being let.</b> On a room listing that is the bedroom, not the building
                    lobby. The cover photo is the one decision that determines whether anyone sees the other eight.
                  </li>
                  <li>
                    <b>No stock, no agency renders, no photos of a different unit.</b> A duplicate or stock-looking
                    photograph is the most common reason a listing is declined here, and it is what every renter has
                    been trained by scams to look for.
                  </li>
                  <li>
                    <b>Then walk it on video.</b> Sixty seconds, front door to window, narrating nothing. It is the
                    single fastest way to prove the home exists and that you are in it — and it is what to offer when
                    someone asks to see the place before paying anything.
                  </li>
                </ol>
                <p className="c-tips__foot">
                  A person reviews every listing before it publishes. Photographs are what that review is mostly
                  looking at.
                </p>
              </div>
              <Field label="Photo URLs, one per line" help="Four minimum. A bedroom, the bathroom, the kitchen and the common space beats eight angles of the same sofa.">
                <textarea
                  rows={6}
                  value={draft.photos.join("\n")}
                  onChange={(e) => set("photos", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                  placeholder={"https://…\nhttps://…"}
                />
              </Field>
              {draft.photos.length > 0 && (
                <div className="c-shots">
                  {draft.photos.map((src, i) => (
                    <div className="c-shot" key={`${src}-${i}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Listing photograph ${i + 1}`} />
                      {i === 0 && <span className="c-shot__flag c-shot__flag--cover">Cover</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="c-row" style={{ marginTop: "var(--s-5)" }}>
                <Field label="Video walkthrough URL" help="A phone walkthrough beats a produced film, and it is what to offer when someone asks to see the place live before paying anything.">
                  <input type="url" value={draft.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://…" />
                </Field>
                <Field label="3D or virtual tour URL" help="Optional. It converts, but photographs come first.">
                  <input type="url" value={draft.tourUrl} onChange={(e) => set("tourUrl", e.target.value)} placeholder="https://…" />
                </Field>
              </div>
            </section>
          )}

          {now === "money" && (
            <>
              <section className="c-section">
                <div className="c-section__head">
                  <h2 className="c-section__title">Dates and stay length</h2>
                  <p className="c-section__sub">
                    The window is what makes this listing findable by someone who needs March to June — and readable by an assistant answering that question on their behalf.
                  </p>
                </div>
                <div className="c-row">
                  <Field label="Available from"><input type="date" value={draft.availableFrom} min={todayISO()} onChange={(e) => set("availableFrom", e.target.value)} /></Field>
                  <Field label="Available until" help="Without it the listing cannot answer a date-range search.">
                    <input type="date" value={draft.availableUntil} min={draft.availableFrom || todayISO()} onChange={(e) => set("availableUntil", e.target.value)} />
                  </Field>
                </div>
                <div className="c-row">
                  <Field label="Minimum stay (months)" help={`This market’s floor is ${rules.minStayDays} days${rules.minStaySrc ? ` — ${rules.minStaySrc.label}` : ""}.`}>
                    <input type="number" min={1} max={24} value={draft.minStayMonths} onChange={(e) => set("minStayMonths", Number(e.target.value))} />
                  </Field>
                  <Field label="Maximum stay (months)"><input type="number" min={1} max={36} value={draft.maxStayMonths} onChange={(e) => set("maxStayMonths", Number(e.target.value))} /></Field>
                </div>
                {rules.registrationRequired && (
                  <Field label="Registration number" help={`Required on the listing here${rules.registrationSrc ? ` — ${rules.registrationSrc.label}` : ""}.`}>
                    <input value={draft.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} placeholder="Registry reference" />
                  </Field>
                )}
              </section>

              <section className="c-section">
                <div className="c-section__head">
                  <h2 className="c-section__title">Money</h2>
                  <p className="c-section__sub">
                    Itemise everything. The all-in figure is what renters compare on and what we sort by, so a fee left off here makes your listing look worse, not better.
                  </p>
                </div>
                <div className="c-row">
                  <Field label={`Base rent (${currency})`}><input type="number" min={0} step={25} value={draft.price} onChange={(e) => set("price", Number(e.target.value))} /></Field>
                  <Field
                    label={`Deposit (${currency})`}
                    help={
                      rules.depositCapMonths != null
                        ? `Capped at ${money(draft.price * rules.depositCapMonths)} here${rules.depositSrc ? ` — ${rules.depositSrc.label}` : ""}. RentLeaks never holds it; it goes direct to you.`
                        : "RentLeaks never holds this. It goes direct to you."
                    }
                  >
                    <input type="number" min={0} step={25} value={draft.deposit || ""} onChange={(e) => set("deposit", Number(e.target.value))} />
                  </Field>
                </div>

                <Field label="Fees">
                  <div className="c-fees">
                    {draft.fees.map((f, i) => (
                      <div className="c-fee" key={i}>
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const meta = FEE_TYPES.find((t) => t[0] === e.target.value);
                            const next = [...draft.fees];
                            next[i] = { ...f, type: e.target.value, cadence: meta ? meta[2] : f.cadence };
                            set("fees", next);
                          }}
                        >
                          {FEE_TYPES.map(([v, l]) => <option value={v} key={v}>{l}</option>)}
                        </select>
                        <input type="number" min={0} step={5} value={f.amount} aria-label="Amount"
                          onChange={(e) => { const next = [...draft.fees]; next[i] = { ...f, amount: Number(e.target.value) }; set("fees", next); }} />
                        <select value={f.cadence}
                          onChange={(e) => { const next = [...draft.fees]; next[i] = { ...f, cadence: e.target.value as Fee["cadence"] }; set("fees", next); }}>
                          <option value="monthly">per month</option>
                          <option value="once">one-off</option>
                        </select>
                        <label style={{ fontSize: "var(--text-micro)", display: "flex", gap: "0.3rem", alignItems: "center", whiteSpace: "nowrap" }}>
                          <input type="checkbox" checked={f.mandatory} style={{ width: "auto" }}
                            onChange={(e) => { const next = [...draft.fees]; next[i] = { ...f, mandatory: e.target.checked }; set("fees", next); }} />
                          required
                        </label>
                        <button type="button" className="c-fee__rm" aria-label="Remove fee"
                          onClick={() => set("fees", draft.fees.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn--outline btn--sm" style={{ marginTop: "var(--s-2)", justifySelf: "start" }}
                    onClick={() => set("fees", [...draft.fees, { type: "wifi", amount: 0, cadence: "monthly", mandatory: true }])}>
                    Add a fee
                  </button>
                  {rules.applicationFeeBanned && (
                    <small>
                      Application fees are barred outright in this market, and so is any charge demanded before or at the start of the tenancy. Background and credit may be recovered up to {money(rules.screeningFeeCap || 20)}, waived if the renter brings their own report from the last 30 days.
                    </small>
                  )}
                </Field>

                <div className="c-row" style={{ marginTop: "var(--s-4)" }}>
                  <Field
                    label="Housing vouchers and subsidies"
                    help={
                      rules.soiProtected
                        ? "Source of income is protected in this market. Refusing a voucher, or applying an income multiple to the full rent rather than the renter’s share, is the violation platforms most often miss."
                        : "Saying yes widens your pool considerably and costs nothing."
                    }
                  >
                    {rules.soiProtected ? (
                      <input value="Accepted — required here" disabled readOnly />
                    ) : (
                      <select value={String(draft.vouchers)} onChange={(e) => set("vouchers", e.target.value === "true")}>
                        <option value="true">Accepted</option>
                        <option value="false">Not set up for them</option>
                      </select>
                    )}
                  </Field>
                  <Field label="Pets" help="A pet policy is about the property. Assistance animals are not pets and are not covered by it.">
                    <select value={draft.pets} onChange={(e) => set("pets", e.target.value)}>
                      <option value="none">No pets</option>
                      <option value="cats">Cats</option>
                      <option value="dogs">Dogs</option>
                      <option value="both">Cats and dogs</option>
                    </select>
                  </Field>
                </div>
              </section>
            </>
          )}

          {now === "lease" && (
            <section className="c-section">
              <div className="c-section__head">
                <h2 className="c-section__title">The lease you are handing over</h2>
                <p className="c-section__sub">The three facts that decide whether a takeover completes or collapses.</p>
              </div>
              <div className="c-row">
                <Field label="Lease ends"><input type="date" value={draft.leaseEnd} min={todayISO()} onChange={(e) => set("leaseEnd", e.target.value)} /></Field>
                <Field
                  label="Route"
                  help={draft.takeoverType === "assignment"
                    ? "An assignment needs written consent and can usually be refused without a reason. There is no clock on this route."
                    : "A sublet keeps you liable — and in some markets it is the only route where silence from the landlord eventually counts as a yes."}
                >
                  <select value={draft.takeoverType} onChange={(e) => set("takeoverType", e.target.value)}>
                    <option value="sublet">Sublet — I stay on the lease</option>
                    <option value="assignment">Assignment — I come off it entirely</option>
                  </select>
                </Field>
                <Field label="Landlord consent" help="Shown on the listing either way. Renters would rather know now.">
                  <select value={draft.consentStatus} onChange={(e) => set("consentStatus", e.target.value)}>
                    <option value="granted">Granted in writing</option>
                    <option value="served">Requested, awaiting a reply</option>
                    <option value="pending">Not asked yet</option>
                  </select>
                </Field>
              </div>
              {rules.moveInFeesBarred && rules.subLessorNamed && (
                <p className="v-note">
                  <b>What you may charge.</b> Nothing for the handover itself — the rule barring charges at the start of a tenancy names sub-lessors, not only landlords. Background and credit up to {money(rules.screeningFeeCap || 20)}, and a deposit inside the cap. That is the lot.
                  {rules.subletSurchargePct ? ` If this unit is rent-regulated, a sublet may carry at most a ${rules.subletSurchargePct}% furnished surcharge over the legal rent — going over is profiteering, and in the leading case it cost the tenant the apartment outright.` : ""}
                </p>
              )}
            </section>
          )}

          {now === "review" && (
            <section className="c-section">
              <div className="c-section__head">
                <h2 className="c-section__title">Review</h2>
                <p className="c-section__sub">This is what a renter sees first. Read it as though you were the one moving in.</p>
              </div>

              <article className="c-preview-card">
                <div className="c-preview-card__img">
                  {draft.photos[0]
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={draft.photos[0]} alt={draft.title} />
                    : <div className="c-preview-card__empty">No cover photograph</div>}
                  <span className="c-preview-card__badge">{housingTypes.find((t) => t.id === draft.housingType)?.label || draft.housingType}</span>
                </div>
                <div className="c-preview-card__body">
                  <p className="c-preview-card__price">{money(allInOf(asDraft))}<span>all-in /mo</span></p>
                  <p className="c-preview-card__sub">
                    Base {money(draft.price)}{monthlyFees(draft.fees) ? ` + ${money(monthlyFees(draft.fees))} fees` : " · no fees"}
                  </p>
                  <h3>{draft.title || "Untitled listing"}</h3>
                  <p className="c-preview-card__addr">{addressShown() || "—"}</p>
                  <p className="c-preview-card__specs">{draft.beds} bed · {draft.baths} bath{draft.sqft ? ` · ${draft.sqft} sqft` : ""}</p>
                  <div className="x-chiprow">
                    {draft.role === "owner" && <span className="x-chip x-chip--owner">By owner</span>}
                    {draft.vouchers && <span className="x-chip x-chip--voucher">Vouchers ok</span>}
                    {draft.access.includes("step-free") && <span className="x-chip x-chip--access">Step-free</span>}
                  </div>
                </div>
              </article>

              <h3 style={{ fontSize: "var(--text-md)", margin: "var(--s-6) 0 var(--s-3)" }}>What this costs you</h3>
              <div className="c-plans">
                {(Object.keys(PLANS) as PlanId[]).map((k) => (
                  <label className={`c-plan${draft.plan === k ? " is-on" : ""}`} key={k}>
                    <input type="radio" name="plan" checked={draft.plan === k} onChange={() => set("plan", k)} />
                    <span><b>{PLANS[k].label}</b>{isLeaseBreak ? "Free — lease-breaks always are" : `$${PLANS[k].listing} per ${PLANS[k].per}`}</span>
                  </label>
                ))}
              </div>
              <label className={`c-plan c-plan--addon${draft.sponsored ? " is-on" : ""}`}>
                <input type="checkbox" checked={draft.sponsored} onChange={(e) => set("sponsored", e.target.checked)} />
                <span>
                  <b>Sponsored placement — +${cost().pl.sponsored} per {cost().pl.per}</b>
                  Top of results in <b>{city?.name}</b>, and only there. A paid slot in a market the searcher is not looking at is worth nothing to you and is noise to them. It buys position, not a badge: promoted cards are labelled as sponsored, and the same verification and compliance checks apply.
                </span>
              </label>

              <div className="c-review-nums" style={{ marginTop: "var(--s-4)" }}>
                <div className="c-allin__row"><span>Listing, per {cost().pl.per}</span><span>{cost().listing ? `$${cost().listing}` : "Free"}</span></div>
                {cost().sponsored > 0 && <div className="c-allin__row"><span>Sponsored placement</span><span>+${cost().sponsored}</span></div>}
                <div className="c-allin__row" style={{ fontWeight: 600, borderTop: "1px solid var(--x-rule)", paddingTop: "0.4rem", marginTop: "0.3rem" }}>
                  <span>Total per {cost().pl.per}</span><span>{cost().total ? `$${cost().total}` : "Free"}</span>
                </div>
                <div className="c-allin__row"><span>What the renter pays us</span><span>Nothing</span></div>
              </div>

              <div className="c-row" style={{ marginTop: "var(--s-5)" }}>
                <Field label="Status" help="A listing you forget to pause is the one that wastes a renter’s afternoon.">
                  <select value={draft.status} onChange={(e) => set("status", e.target.value)}>
                    <option value="active">Live — taking enquiries</option>
                    <option value="coming-soon">Coming soon — visible, not yet bookable</option>
                    <option value="paused">Paused — hidden from search</option>
                  </select>
                </Field>
                <Field label="Go live on" help="Leave blank to publish now.">
                  <input type="date" value={draft.scheduledAt} min={todayISO()} onChange={(e) => set("scheduledAt", e.target.value)} />
                </Field>
              </div>

              {serverError && <div className="x-guard is-on"><b>Not published.</b> {serverError}</div>}
            </section>
          )}

          <div className="c-nav">
            {stage > 0 ? <button type="button" className="btn btn--ghost" onClick={() => setStage(stage - 1)}>Back</button> : <span />}
            {now === "review" ? (
              <button type="button" className="btn btn--primary btn--lg" disabled={!!blockers.length || saving} onClick={publish}>
                {saving ? "Publishing…" : blockers.length ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} to fix` : "Publish listing"}
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => setStage(stage + 1)}>Continue</button>
            )}
          </div>
        </div>

        <aside className="c-aside">
          <div className="c-allin">
            <span className="c-allin__k">All-in, per month</span>
            <div className="c-allin__v">{money(allInOf(asDraft))}</div>
            <div className="c-allin__rows">
              <div className="c-allin__row"><span>Base rent</span><span>{money(draft.price)}</span></div>
              <div className="c-allin__row"><span>Monthly fees</span><span>{money(monthlyFees(draft.fees))}</span></div>
              {draft.deposit > 0 && <div className="c-allin__row"><span>Deposit (paid to you)</span><span>{money(draft.deposit)}</span></div>}
            </div>
          </div>

          <div className="c-meter">
            <div className="c-meter__top">
              <span className="c-meter__pct">{pct}%</span>
              <span style={{ fontSize: "var(--text-xs)" }}>{blockers.length ? `${blockers.length} to fix` : "ready"}</span>
            </div>
            <span className="c-meter__bar">
              <span className="c-meter__fill" data-tone={blockers.length ? undefined : "done"} style={{ width: `${pct}%` }} />
            </span>
            <ul className="c-checks">
              {checks.map((c) => (
                <li className="c-check" data-ok={c.ok ? "1" : c.blocking ? "block" : "0"} key={c.id}>
                  <span className="c-check__m" aria-hidden="true">{c.ok ? "✓" : c.blocking ? "!" : "–"}</span>
                  <span><b>{c.title}</b>{c.why}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="c-field">
      <label>{label}</label>
      {children}
      {help && <small>{help}</small>}
    </div>
  );
}

function CheckGrid({
  label, options, selected, onToggle,
}: {
  label: string;
  options: Array<[string, string]>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="c-field" style={{ marginTop: "var(--s-3)" }}>
      <label>{label}</label>
      <div className="x-facets" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", display: "grid" }}>
        {options.map(([v, l]) => (
          <label className="x-facet" key={v}>
            <input type="checkbox" checked={selected.includes(v)} onChange={() => onToggle(v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
