import type { Source } from "@/lib/listing-rules";
import type {
  ComplianceRow,
  Deal,
  Evidence,
  EvidenceListing,
  FeeVerdict,
  PriceTruth,
  Takeover,
  Trust,
} from "@/lib/listing-evidence";
import { fmtMoney, money } from "@/lib/site";

/**
 * The evidence layer, rendered.
 *
 * Everything below draws on `listing-evidence.ts`, which computes only from
 * stored columns. Where a check has not been built, the panel says so rather
 * than showing a tick — a renter reads a green tick as a promise, and a
 * promise the platform cannot keep is the one thing a trust product must not
 * ship.
 *
 * Two currencies appear on this page and they are labelled. Money the renter
 * will actually pay is in the market's own currency; the distribution strip is
 * in US dollars, because that is the only axis on which a Berlin room and a
 * Toronto room can sit on the same line.
 */

function Cite({ src }: { src: Source | null }) {
  if (!src) return null;
  const body = (
    <>
      {src.label}
      {src.eff ? ` · in force ${src.eff}` : ""}
    </>
  );
  return src.url ? (
    <a className="x-cite" href={src.url} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <span className="x-cite">{body}</span>
  );
}

function PanelHead({ kicker, title, aside }: { kicker: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="x-panel__head">
      <div>
        <span className="x-panel__kicker">{kicker}</span>
        <h2 className="x-panel__title">{title}</h2>
      </div>
      {aside ? <p className="x-panel__aside">{aside}</p> : null}
    </div>
  );
}

/* --- price -------------------------------------------------------------- */

function alignAt(pct: number) {
  return pct <= 8 ? "start" : pct >= 92 ? "end" : undefined;
}

function PricePanel({ price, listing }: { price: PriceTruth; listing: EvidenceListing }) {
  const you = Math.max(0, Math.min(100, price.percentile));
  const scope =
    price.scope === "city"
      ? `${price.n} comparable ${listing.housingType.replace("-", " ")} listings in ${listing.cityName}`
      : `${price.n} comparable ${listing.housingType.replace("-", " ")} listings across every market — too few in ${listing.cityName} alone to say anything useful`;

  return (
    <section className="x-panel">
      <PanelHead
        kicker="Price truth"
        title="What this costs, set against the market"
        aside={<>{scope}. All-in figures, converted to US dollars so markets compare.</>}
      />

      <div className="x-truth__verdict">
        <span className="x-truth__headline" data-tone={price.tone}>
          {price.vsMedian > 0 ? "+" : ""}
          {price.vsMedian}%
        </span>
        <span className="x-truth__sub">
          against a median all-in of {money(price.p50)}. This home sits at the {you}
          {ordinal(you)} percentile
          {price.thin ? " of a thin pool — read it as a direction, not a verdict" : ""}.
        </span>
      </div>

      <div className="x-strip" aria-hidden="true">
        <span className="x-strip__track" />
        <span className="x-strip__band" style={{ left: "25%", width: "50%" }} />
        <span className="x-strip__tick" data-label={money(price.p10)} data-align="start" style={{ left: "10%" }} />
        <span className="x-strip__tick" data-label={money(price.p50)} style={{ left: "50%" }} />
        <span className="x-strip__tick" data-label={money(price.p90)} data-align="end" style={{ left: "90%" }} />
        <span
          className="x-strip__you"
          data-label={money(price.mine)}
          data-align={alignAt(you)}
          style={{ left: `${you}%` }}
        />
      </div>
      <p className="sr-only">
        This listing&rsquo;s all-in price of {money(price.mine)} sits at the {you}
        {ordinal(you)} percentile of {price.n} comparable listings. The middle half of the market runs from{" "}
        {money(price.p25)} to {money(price.p75)}.
      </p>

      <dl className="x-grid-3">
        <div className="x-stat">
          <dt>Median all-in</dt>
          <dd>
            {money(price.p50)}
            <small>Middle half runs {money(price.p25)}–{money(price.p75)}</small>
          </dd>
        </div>
        <div className="x-stat">
          <dt>This home</dt>
          <dd>
            {fmtMoney(listing.allIn, listing.currency)}
            <small>
              {listing.currency === "USD" ? "Base rent " : `${money(price.mine)} · base rent `}
              {fmtMoney(listing.price, listing.currency)}
            </small>
          </dd>
        </div>
        <div className="x-stat">
          <dt>Recurring fees on top of rent</dt>
          <dd>
            {price.feesAdd ? fmtMoney(price.feesAdd, listing.currency) : "None"}
            <small>{price.feesAdd ? `${price.feesPct}% above base rent` : "The headline number is the number"}</small>
          </dd>
        </div>
        {price.perSqftAnnual ? (
          <div className="x-stat">
            <dt>Per square foot, annual</dt>
            <dd>
              {fmtMoney(price.perSqftAnnual, listing.currency)}
              <small>{listing.sqft} sqft</small>
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="x-note">
        The percentile is computed from listings currently on RentLeaks, not from the whole market — it tells you where
        this sits among homes you could actually take, which is the comparison that decides anything. Asking rents are
        not signed rents.
      </p>
    </section>
  );
}

function ordinal(n: number) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] || "th";
}

/* --- the deal + fees ---------------------------------------------------- */

const FEE_STATE: Record<FeeVerdict["state"], { cls: string; word: string }> = {
  ok: { cls: "x-verdict--pass", word: "Lawful" },
  capped: { cls: "x-verdict--pass", word: "Within cap" },
  over: { cls: "x-verdict--fail", word: "Over cap" },
  barred: { cls: "x-verdict--fail", word: "Not permitted" },
};

function DealPanel({
  deal,
  fees,
  listing,
}: {
  deal: Deal;
  fees: FeeVerdict[];
  listing: EvidenceListing;
}) {
  const problems = fees.filter((f) => f.state === "barred" || f.state === "over");

  return (
    <section className="x-panel">
      <PanelHead
        kicker="The deal"
        title={deal.label}
        aside={<>Who you are dealing with decides which fee rules bind, so it is stated before the money is.</>}
      />
      <p className="x-desk__lede">{deal.blurb}</p>

      {problems.length ? (
        <div className="x-flags">
          {problems.map((f) => (
            <div className="x-flag" key={`flag-${f.key}`}>
              <span>
                <strong>{f.label} of {fmtMoney(f.amount, listing.currency)}.</strong> {f.why}{" "}
                <Cite src={f.src} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="x-flags">
          <div className="x-flag x-flag--ok">
            <span>
              <strong>Every charge on this listing is lawful in this market.</strong> Checked against the rules below,
              not asserted. Anything demanded later that is not on this page is a reason to walk.
            </span>
          </div>
        </div>
      )}

      <div className="x-rules" style={{ marginTop: "var(--s-5)" }}>
        {fees.length === 0 ? (
          <p className="x-note" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
            No fees declared beyond the rent. That is the claim on the listing; get it in the lease.
          </p>
        ) : (
          fees.map((f) => {
            const state = FEE_STATE[f.state];
            return (
              <div className="x-rule-row" key={f.key}>
                <span className="x-rule-row__k">
                  <b>
                    {f.label}{" "}
                    <span className={`x-verdict ${state.cls}`}>{state.word}</span>
                  </b>
                  {f.why} <Cite src={f.src} />
                </span>
                <span className="x-rule-row__v">
                  {f.amount ? fmtMoney(f.amount, listing.currency) : "None"}
                  {f.amount && f.cadence === "monthly" ? " /mo" : ""}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

/* --- trust -------------------------------------------------------------- */

const MARK: Record<Trust["rows"][number]["state"], string> = {
  pass: "✓",
  warn: "!",
  none: "–",
  "not-run": "·",
};

function TrustPanel({ trust, deal }: { trust: Trust; deal: Deal }) {
  return (
    <section className="x-panel">
      <PanelHead
        kicker="Trust ledger"
        title="What has actually been checked"
        aside={<>A receipt, not a badge. Checks we do not run are listed as not run.</>}
      />

      {/* Deliberately a count and not a score out of a hundred. A percentage
          taken over only the checks that ran would read 100 on a listing whose
          address has never been verified, and no caption undoes a big round
          number. */}
      <div className="x-score">
        <span className="x-score__value">{trust.passed}</span>
        <span className="x-score__of">
          of {trust.scored} check{trust.scored === 1 ? "" : "s"} run
        </span>
        <span className="x-score__label">
          {trust.notRun} further check{trust.notRun === 1 ? "" : "s"} we do not perform yet. They are listed below as
          not run rather than counted as passed.
        </span>
      </div>

      <div className="x-ledger">
        {trust.rows.map((r) => (
          <div className="x-ledger__row" key={r.key}>
            <span
              className="x-ledger__mark"
              data-state={r.state === "not-run" ? "none" : r.state}
              aria-hidden="true"
            >
              {MARK[r.state]}
            </span>
            <span className="x-ledger__what">
              {r.what}
              <span className="x-ledger__how">{r.how}</span>
            </span>
            <span className="x-ledger__when">
              {r.state === "not-run" ? "not run" : r.state === "pass" ? "passed" : r.state === "warn" ? "stale" : "none"}
            </span>
          </div>
        ))}
      </div>

      <div className="x-pay">
        <h3 className="x-pay__title">How to pay, and who to</h3>
        <p className="x-pay__lede">
          RentLeaks holds no money. There is no escrow, no booking fee and no deposit account here — your deposit and
          first month go <b>direct to {deal.byDepartingTenant ? "the departing tenant or the building’s owner" : deal.byOwner ? "the owner" : "the landlord or their managing agent"}</b>, against a
          signed lease. That means the platform cannot claw a payment back for you, so the rail you choose is the only
          protection you get.
        </p>
        <ul className="x-rails">
          <li className="x-rail x-rail--ok">
            <span className="x-rail__mark" aria-hidden="true">✓</span>
            <span>
              <b>Bank transfer or cheque to a named account, after signing</b>
              The name on the account should match the name on the lease and the verified ID. A mismatch is the single
              most reliable sign of a diverted payment.
            </span>
          </li>
          <li className="x-rail x-rail--ok">
            <span className="x-rail__mark" aria-hidden="true">✓</span>
            <span>
              <b>Card, where the landlord offers it</b>
              Costs a processing fee and buys you a chargeback route. On a large deposit that trade is often worth it.
            </span>
          </li>
          <li className="x-rail x-rail--no">
            <span className="x-rail__mark" aria-hidden="true">✕</span>
            <span>
              <b>Never: wire to a personal account before viewing, gift cards, crypto, cash app to a stranger</b>
              These are irreversible by design, which is exactly why every rental scam asks for them.
            </span>
          </li>
          <li className="x-rail x-rail--no">
            <span className="x-rail__mark" aria-hidden="true">✕</span>
            <span>
              <b>Never: a payment to “RentLeaks”</b>
              We never ask renters for money, for any reason. Anyone who does is not us.
            </span>
          </li>
        </ul>
        <p className="x-pay__foot">
          See the home, meet the person, read the lease, then pay. In that order. No lawful landlord needs money before
          you have stood in the room.
        </p>
      </div>
    </section>
  );
}

/* --- local rules -------------------------------------------------------- */

function RulesPanel({
  rows,
  cityName,
  notes,
}: {
  rows: ComplianceRow[];
  cityName: string;
  notes: string[];
}) {
  if (!rows.length) return null;
  return (
    <section className="x-panel">
      <PanelHead
        kicker="Local rules"
        title={`What ${cityName || "this market"} allows`}
        aside={<>Each line cites the instrument and the date it took effect. Research, not legal advice.</>}
      />
      <div className="x-rules">
        {rows.map((r) => (
          <div className="x-rule-row" key={r.k}>
            <span className="x-rule-row__k">
              <b>
                {r.k}{" "}
                <span className={`x-verdict ${r.pass ? "x-verdict--pass" : "x-verdict--fail"}`}>
                  {r.pass ? "Compliant" : "Breach"}
                </span>
              </b>
              {r.detail} <Cite src={r.src} />
            </span>
            <span className="x-rule-row__v">{r.value}</span>
          </div>
        ))}
      </div>
      {notes.length ? (
        <p className="x-note">
          {notes.join(" ")}
        </p>
      ) : null}
    </section>
  );
}

/* --- affordability ------------------------------------------------------ */

function AffordPanel({
  afford,
  listing,
  vouchers,
  soi,
  soiSrc,
}: {
  afford: Evidence["afford"];
  listing: EvidenceListing;
  vouchers: boolean;
  soi: boolean;
  soiSrc: Source | null;
}) {
  return (
    <section className="x-panel">
      <PanelHead
        kicker="What it takes to qualify"
        title="The income the door asks for"
        aside={<>Arithmetic on the posted price. Every landlord screens differently; these are the two conventions you will meet.</>}
      />
      <div className="x-afford__out">
        <div className="x-afford__line">
          <span>All-in monthly</span>
          <strong>{fmtMoney(afford.monthly, listing.currency)}</strong>
        </div>
        <div className="x-afford__line">
          <span>Gross monthly income the screen asks for</span>
          <strong>{fmtMoney(afford.monthlyGross, listing.currency)}</strong>
        </div>
        <div className="x-afford__line x-afford__line--total">
          <span>Gross annual income — 40× the rent, i.e. 30% of gross</span>
          <strong>{fmtMoney(afford.annualGross, listing.currency)}</strong>
        </div>
        <div className="x-afford__line">
          <span>If you need a guarantor, they are usually held to 80×</span>
          <strong>{fmtMoney(afford.guarantorAnnual, listing.currency)}</strong>
        </div>
      </div>
      <p className="x-note">
        &ldquo;40× the rent&rdquo; and &ldquo;spend no more than 30% of your gross&rdquo; are the same test written two
        ways — twelve months divided by 0.30 is forty — so there is one threshold here, not two to choose between. What
        it does not account for is tax: at that income the rent is closer to 40% of what actually lands in your
        account, which is the number worth checking before you pay for a credit report.
        {soi ? (
          <>
            {" "}
            <b>{vouchers ? "Housing vouchers accepted." : "This listing has not stated a voucher position."}</b>{" "}
            Refusing a lawful source of income is unlawful in this market, and a voucher counts toward the income test.{" "}
            <Cite src={soiSrc} />
          </>
        ) : null}
      </p>
    </section>
  );
}

/* --- takeover ----------------------------------------------------------- */

function TakeoverPanel({ takeover, listing }: { takeover: Takeover; listing: EvidenceListing }) {
  const sublet = takeover.mode === "sublet";
  const consentDone = takeover.consent === "written";

  return (
    <section className="x-panel">
      <PanelHead
        kicker="Takeover desk"
        title={sublet ? "Taking over as a subtenant" : "Taking the lease by assignment"}
        aside={
          <>
            {takeover.remainingMonths
              ? `${takeover.remainingMonths} month${takeover.remainingMonths === 1 ? "" : "s"} left on the lease`
              : "Lease end not stated"}
          </>
        }
      />
      <p className="x-desk__lede">
        {sublet ? (
          <>
            A sublet leaves the original tenant on the hook to the landlord and makes you their subtenant, not the
            landlord&rsquo;s. You get the room; they keep the liability — and the right to end it.
          </>
        ) : (
          <>
            An assignment moves the lease itself to you: the departing tenant walks away clean and you deal with the
            landlord directly, on their terms. It needs the landlord&rsquo;s written consent, and consent may be
            refused without a reason.
          </>
        )}
      </p>

      <div className="x-track">
        <div className="x-step" data-state={consentDone ? "done" : "live"}>
          <div className="x-step__head">
            <span className="x-step__title">The landlord&rsquo;s consent</span>
            <span className="x-step__clock">
              {consentDone ? "in hand" : takeover.consent === "deemed" ? "deemed" : "not yet"}
            </span>
          </div>
          <p className="x-step__body">
            {consentDone
              ? "Written consent has been uploaded to this listing. Ask to see it before you pay anything — a takeover without it can be terminated with you in the room."
              : takeover.clockApplies
                ? "Not yet in hand. The statutory route below is what turns silence into consent; until one of those two things happens, nothing here is binding."
                : "Not yet in hand. Do not pay a deposit against a takeover the landlord has not agreed to in writing."}
            {takeover.statute ? (
              <>
                {" "}
                <code>{takeover.statute}</code>
                {takeover.appliesTo ? ` · ${takeover.appliesTo}` : ""}
              </>
            ) : null}
          </p>
        </div>

        {takeover.clockApplies ? (
          <>
            <div className="x-step">
              <div className="x-step__head">
                <span className="x-step__title">Tenant asks, landlord may request more</span>
                <span className="x-step__clock">{takeover.infoWindowDays} days</span>
              </div>
              <p className="x-step__body">
                After the written request, the landlord has {takeover.infoWindowDays} days to ask for further
                information about you. That request restarts nothing — it sits inside the window below.
              </p>
            </div>
            <div className="x-step">
              <div className="x-step__head">
                <span className="x-step__title">Silence becomes consent</span>
                <span className="x-step__clock">{takeover.decisionWindowDays} days</span>
              </div>
              <p className="x-step__body">
                If the landlord neither consents nor refuses within {takeover.decisionWindowDays} days of the request,
                consent is deemed given. This is the mechanism that makes most lawful sublets possible, and it runs on
                dates — so keep the request, the postmark and every reply.
              </p>
            </div>
          </>
        ) : takeover.assignmentNote ? (
          <div className="x-step">
            <div className="x-step__head">
              <span className="x-step__title">No deemed-consent clock applies</span>
              <span className="x-step__clock">assignment</span>
            </div>
            <p className="x-step__body">{takeover.assignmentNote}</p>
          </div>
        ) : null}

        <div className="x-step">
          <div className="x-step__head">
            <span className="x-step__title">Money, and what may be asked for</span>
            <span className="x-step__clock">before keys</span>
          </div>
          <p className="x-step__body">
            {takeover.accessFeeAllowed
              ? "An access or transfer fee is permitted in this market, but only if it is disclosed on the listing rather than produced at signing."
              : "No access, transfer, key or admin fee may be charged here — the statute names sub-lessors as well as landlords, so a departing tenant cannot levy one either."}
            {takeover.depositCapMonths != null
              ? ` The deposit is capped at ${takeover.depositCapMonths} month${takeover.depositCapMonths === 1 ? "" : "s"} of rent.`
              : ""}
            {takeover.screeningCap != null
              ? ` Background and credit checks are capped at ${money(takeover.screeningCap)}.`
              : ""}{" "}
            <Cite src={takeover.accessFeeSrc} />
          </p>
        </div>

        {takeover.surchargePct != null ? (
          <div className="x-step">
            <div className="x-step__head">
              <span className="x-step__title">The furnished surcharge, and its teeth</span>
              <span className="x-step__clock">{takeover.surchargePct}% cap</span>
            </div>
            <p className="x-step__body">
              On a regulated unit let furnished, the sublessor may add at most {takeover.surchargePct}% to the legal
              rent. Charging more is a rent overcharge — recoverable at treble damages, and in the sublet context it
              has cost tenants the apartment itself. Ask what the legal rent is and do the arithmetic.{" "}
              <Cite src={takeover.surchargeSrc} />
            </p>
          </div>
        ) : null}
      </div>

      <ul className="x-packet">
        <li>The signed lease you are taking over, in full — not a summary.</li>
        <li>The landlord&rsquo;s written consent, or the dated request that started the clock.</li>
        <li>A rent ledger showing the account is current. Arrears follow the apartment, not the person who left.</li>
        <li>
          Photographs of the condition today, dated. The deposit you pay {listing.listedBy === "tenant" ? "the departing tenant" : "the landlord"} is
          returned against this, and RentLeaks does not hold it.
        </li>
      </ul>
    </section>
  );
}

/* --- availability ------------------------------------------------------- */

function WindowPanel({ evidence, listing }: { evidence: Evidence; listing: EvidenceListing }) {
  const w = evidence.window;
  return (
    <section className="x-panel">
      <PanelHead
        kicker="Availability"
        title="The window this home is actually free"
        aside={<>A listing without an end date cannot answer a date-range search, so we ask for one.</>}
      />
      <dl className="x-grid-3">
        <div className="x-stat">
          <dt>Free from</dt>
          <dd>{friendly(w.from)}</dd>
        </div>
        <div className="x-stat">
          <dt>Free until</dt>
          <dd>
            {w.until ? friendly(w.until) : "Open-ended"}
            <small>{w.days ? `${w.days}-day window` : "No end date given"}</small>
          </dd>
        </div>
        <div className="x-stat">
          <dt>Minimum stay</dt>
          <dd>
            {w.minDays} days
            <small>
              {evidence.rules.minStayDays > listing.minStayMonths * 30
                ? `Market floor of ${evidence.rules.minStayDays} days applies`
                : `Set by the host`}
            </small>
          </dd>
        </div>
      </dl>
      <div className="x-chiprow">
        <span className="x-chip x-chip--owner">{evidence.deal.short}</span>
        {listing.vouchersAccepted ? <span className="x-chip x-chip--voucher">Vouchers accepted</span> : null}
        {listing.consentStatus === "written" ? (
          <span className="x-chip x-chip--consent">Landlord consent on file</span>
        ) : listing.consentStatus ? (
          <span className="x-chip x-chip--pending">Consent {listing.consentStatus}</span>
        ) : null}
        {evidence.accessibility.map((a) => (
          <span className="x-chip x-chip--access" key={a}>
            {a}
          </span>
        ))}
      </div>
    </section>
  );
}

function friendly(iso: string | null) {
  if (!iso) return "Flexible";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* --- the whole thing ---------------------------------------------------- */

export function ListingEvidence({
  evidence,
  listing,
}: {
  evidence: Evidence;
  listing: EvidenceListing;
}) {
  return (
    <div className="rl-evidence">
      <WindowPanel evidence={evidence} listing={listing} />
      {evidence.price ? <PricePanel price={evidence.price} listing={listing} /> : null}
      <DealPanel deal={evidence.deal} fees={evidence.fees} listing={listing} />
      {evidence.takeover ? <TakeoverPanel takeover={evidence.takeover} listing={listing} /> : null}
      <TrustPanel trust={evidence.trust} deal={evidence.deal} />
      <RulesPanel rows={evidence.compliance} cityName={listing.cityName} notes={evidence.rules.notes} />
      <AffordPanel
        afford={evidence.afford}
        listing={listing}
        vouchers={listing.vouchersAccepted}
        soi={evidence.rules.soiProtected}
        soiSrc={evidence.rules.soiSrc}
      />
      <p className="x-note">
        Rules shown here resolve city → region → country and each carries the instrument it comes from. They are
        research, not legal advice, and they change — if a citation looks stale against what you have been told, trust
        the instrument and tell us.
      </p>
    </div>
  );
}
