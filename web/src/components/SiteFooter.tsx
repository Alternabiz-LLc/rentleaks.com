"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FEATURED_MONTHLY, FEATURED_WEEKLY, MONTHLY_PLAN, WEEKLY_PLAN } from "@/lib/billing";
import { CITIES } from "@/lib/catalog";

const COMPANY = {
  legalName: "Alternabiz LLC",
  product: "RentLeaks",
  address: null as string | null,
  email: null as string | null,
  phone: null as string | null,
  entityNumber: null as string | null,
  licence: null as string | null,
  facebook: "https://www.facebook.com/rentleakshq",
  messenger: "https://m.me/rentleakshq",
};

const FIND = [
  { href: "/stays?type=room", label: "Rooms" },
  { href: "/stays?type=coliving", label: "Co-living" },
  { href: "/stays?type=furnished", label: "Furnished apartments" },
  { href: "/stays?type=short-term", label: "1-month+ stays" },
  { href: "/stays?type=lease-break", label: "Lease-breaks" },
  { href: "/stays", label: "All stays" },
  { href: "/stays?view=map", label: "Search the map" },
];

const HOST_PAGES = [
  { href: "/list", label: "List a place" },
  { href: "/account", label: "Your listings" },
];

type InfoId = "verify" | "operators" | "agents" | "leasebreak" | "contact" | "works" | "markets" | "privacy" | "terms";

const HOST_MODALS: Array<{ id: InfoId; label: string }> = [
  { id: "verify", label: "Get verified" },
  { id: "operators", label: "For operators" },
  { id: "agents", label: "For agents and brokers" },
  { id: "leasebreak", label: "Lease-breaks post free" },
];

const COMPANY_MODALS: Array<{ id: InfoId; label: string }> = [
  { id: "contact", label: "Contact" },
  { id: "works", label: "How RentLeaks works" },
  { id: "markets", label: "All markets" },
  { id: "privacy", label: "Privacy" },
  { id: "terms", label: "Terms" },
];

const HASH: Record<InfoId, string> = {
  verify: "verify",
  operators: "operators",
  agents: "agents",
  leasebreak: "lease-breaks",
  contact: "contact",
  works: "how",
  markets: "markets",
  privacy: "privacy",
  terms: "terms",
};

function asInfoId(value: string): InfoId | null {
  switch (value) {
    case "verify":
    case "operators":
    case "agents":
    case "leasebreak":
    case "contact":
    case "works":
    case "markets":
    case "privacy":
    case "terms":
      return value;
    default:
      return null;
  }
}

function titleFor(id: InfoId) {
  switch (id) {
    case "verify":
      return "Get verified";
    case "operators":
      return "For operators";
    case "agents":
      return "For agents and brokers";
    case "leasebreak":
      return "Lease-breaks post free";
    case "contact":
      return "Contact";
    case "works":
      return "How RentLeaks works";
    case "markets":
      return "All markets";
    case "privacy":
      return "Privacy";
    case "terms":
      return "Terms";
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function InfoBody({
  id,
  onClose,
}: {
  id: InfoId;
  onClose: () => void;
}) {
  const [sent, setSent] = useState(false);
  const featured = CITIES.filter((city) => city.featured);
  const us = featured.filter((city) => city.rank <= 31);
  const eu = featured.filter((city) => city.rank > 31);

  switch (id) {
    case "works":
      return (
        <>
          <p>Flexible housing across the U.S. and Europe. Every price is All-in. Every stay starts at 30 days. RentLeaks never takes your rent or deposit.</p>
          <dl className="rl-info__faq">
            <div>
              <dt>What is All-in rent?</dt>
              <dd>Base rent plus the monthly extras we can see: utilities, wifi, and cleaning. Broker fees are called out as one-time. If a host hides a fee, report it.</dd>
            </div>
            <div>
              <dt>What does 1-month+ mean?</dt>
              <dd>A home you can take for at least 30 days. We do not list hotel nights or weekend stays.</dd>
            </div>
            <div>
              <dt>What is a lease-break?</dt>
              <dd>The current tenant needs to leave early. You take the remaining term. Confirm assignment vs sublet before you send money to the landlord.</dd>
            </div>
            <div>
              <dt>Room vs co-living?</dt>
              <dd>A room is a private bedroom in a shared home. Co-living is a building set up for housemates, often with cleaning and workspace.</dd>
            </div>
            <div>
              <dt>Does RentLeaks handle money?</dt>
              <dd>No. Deposits and rent go direct to the landlord against a signed lease. Anyone asking you to pay RentLeaks is running a scam.</dd>
            </div>
          </dl>
          <Link className="rl-cta" href="/stays" onClick={onClose}>
            Browse stays
          </Link>
        </>
      );
    case "contact":
      return sent ? (
        <p>Saved in this browser. Sign in so we can match it to your account. We do not ask you to wire money to RentLeaks.</p>
      ) : (
        <form
          className="rl-info__form"
          onSubmit={(event) => {
            event.preventDefault();
            setSent(true);
          }}
        >
          <p>Listings, operator onboarding, or something that failed Scam Shield. Do not send deposits here.</p>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Topic
            <select name="topic" defaultValue="renter">
              <option value="renter">Renter help</option>
              <option value="host">Host / operator</option>
              <option value="report">Report a listing</option>
              <option value="press">Press</option>
            </select>
          </label>
          <label>
            Message
            <textarea name="message" rows={4} required />
          </label>
          <button className="rl-cta" type="submit">
            Send
          </button>
        </form>
      );
    case "privacy":
      return (
        <>
          <p>Saved homes and browse notes can live in this browser so the product works without an extra account server. Do not store secrets you would not type into a form.</p>
          <p>We do not sell listing inquiry data. Fair Housing advertising rules apply to every host.</p>
          <p>When you create an account, we keep the email and name you give us so you can sign in, list a place, and message about a stay.</p>
        </>
      );
    case "terms":
      return (
        <>
          <p>RentLeaks is a discovery layer for flexible housing: rooms, co-living, furnished apartments, stays of 30 days or more, and lease takeovers. Listings are informational.</p>
          <p>You must verify availability, the legal right to assign or sublet, and payments with the host. RentLeaks is not a broker, landlord, or agent in any transaction listed here.</p>
          <p>Hosts agree not to discriminate under the Fair Housing Act. We may remove listings that look like hotel nights, bait pricing, or scams.</p>
        </>
      );
    case "verify":
      return (
        <>
          <p>Verification is a check in your browser. The document is discarded. There is no upload endpoint, and we do not ask you to pay RentLeaks to get a badge.</p>
          <p>Sign in, then open the verification desk. Hosts with a verified mark show that on stay cards.</p>
          <Link className="rl-cta" href="/verify" onClick={onClose}>
            Open verification
          </Link>
        </>
      );
    case "operators":
      return (
        <>
          <p>Co-living buildings, furnished portfolios, and room hosts list from the same form. Listing fee is {WEEKLY_PLAN.label} or {MONTHLY_PLAN.label}. Sponsored placement is extra — {FEATURED_WEEKLY.label} or {FEATURED_MONTHLY.label} — and shows under the homepage hero and in stay results.</p>
          <p>Lease-break posts stay free. RentLeaks never collects rent. Fair Housing applies to every listing.</p>
          <Link className="rl-cta" href="/list" onClick={onClose}>
            List a place
          </Link>
        </>
      );
    case "agents":
      return (
        <>
          <p>Brokers and agents can list on behalf of a host. The listing fee is still {WEEKLY_PLAN.label} or {MONTHLY_PLAN.label}. Sponsored placement is the same extra as operators.</p>
          <p>RentLeaks is not your brokerage. You stay responsible for Fair Housing copy, the lease, and money that goes to the landlord. We remove bait pricing and hotel-night inventory.</p>
          <Link className="rl-cta" href="/list" onClick={onClose}>
            List a place
          </Link>
        </>
      );
    case "leasebreak":
      return (
        <>
          <p>If you need to leave before the lease ends, post the remaining term for free. The card shows a lease clock, remaining months, and All-in rent.</p>
          <p>Confirm assignment vs sublet with your landlord. Rent and deposit go to them, not to RentLeaks.</p>
          <Link className="rl-cta" href="/list" onClick={onClose}>
            Post a lease-break
          </Link>
        </>
      );
    case "markets":
      return (
        <>
          <p>{CITIES.length} markets. Featured cities sit first; every city is on the stay search.</p>
          <p className="rl-info__label">United States</p>
          <ul className="rl-info__chips">
            {us.map((city) => (
              <li key={city.id}>
                <Link href={`/stays?city=${city.id}`} onClick={onClose}>
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="rl-info__label">Europe & Canada</p>
          <ul className="rl-info__chips">
            {eu.map((city) => (
              <li key={city.id}>
                <Link href={`/stays?city=${city.id}`} onClick={onClose}>
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link className="rl-ghost" href="/stays" onClick={onClose}>
            Search all stays
          </Link>
        </>
      );
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function FooterModal({
  id,
  onClose,
}: {
  id: InfoId;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div className="rl-info" role="presentation" onClick={onClose}>
      <div
        className="rl-info__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="rl-info__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id={titleId}>{titleFor(id)}</h2>
        <InfoBody id={id} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  const [open, setOpen] = useState<InfoId | null>(null);

  useEffect(() => {
    function fromHash() {
      const raw = window.location.hash.replace(/^#/, "");
      const mapped =
        raw === "lease-breaks"
          ? "leasebreak"
          : raw === "how"
            ? "works"
            : raw;
      setOpen(asInfoId(mapped));
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function openModal(id: InfoId) {
    setOpen(id);
    window.history.replaceState(null, "", `#${HASH[id]}`);
  }

  function closeModal() {
    setOpen(null);
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  return (
    <footer className="rl-foot">
      <div className="rl-foot__inner">
        <div className="rl-foot__brand">
          <Link className="rl-mark" href="/">
            <span>RL</span> RentLeaks
          </Link>
          <p className="rl-foot__blurb">
            Flexible housing across the U.S. and Europe — rooms, co-living, furnished apartments, month-plus stays and
            lease-breaks. Every price is all-in. Every stay starts at 30 days.
          </p>
          <p className="rl-foot__claim">
            <b>RentLeaks never handles your money.</b> No deposit, no booking fee, no application fee — there is
            nothing to pay us, ever. Deposits and rent go direct to the landlord against a signed lease. Anyone asking
            you to pay RentLeaks is running a scam.
          </p>
        </div>

        <nav className="rl-foot__col" aria-labelledby="rl-foot-find">
          <h2 id="rl-foot-find">Find a home</h2>
          <ul>
            {FIND.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="rl-foot__col" aria-labelledby="rl-foot-host">
          <h2 id="rl-foot-host">List a home</h2>
          <ul>
            {HOST_PAGES.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            {HOST_MODALS.map((item) => (
              <li key={item.id}>
                <button type="button" className="rl-foot__btn" onClick={() => openModal(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="rl-foot__col" aria-labelledby="rl-foot-co">
          <h2 id="rl-foot-co">Company</h2>
          <ul>
            {COMPANY_MODALS.map((item) => (
              <li key={item.id}>
                <button type="button" className="rl-foot__btn" onClick={() => openModal(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="rl-foot__col rl-foot__col--contact">
          <h2>{COMPANY.legalName}</h2>
          <ul>
            {COMPANY.address ? <li>{COMPANY.address}</li> : null}
            {COMPANY.email ? (
              <li>
                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </li>
            ) : (
              <li>
                <button type="button" className="rl-foot__btn" onClick={() => openModal("contact")}>
                  Contact the team
                </button>
              </li>
            )}
            {COMPANY.phone ? (
              <li>
                <a href={`tel:${COMPANY.phone.replace(/[^+\d]/g, "")}`}>{COMPANY.phone}</a>
              </li>
            ) : null}
            <li>
              <a href={`${COMPANY.facebook}?utm_source=rentleaks_app&utm_medium=footer`} target="_blank" rel="noopener">
                RentLeaks on Facebook
              </a>
            </li>
            <li>
              <a href={COMPANY.messenger} target="_blank" rel="noopener">
                Message us on Messenger
              </a>
            </li>
            {COMPANY.entityNumber ? <li>Entity no. {COMPANY.entityNumber}</li> : null}
            {COMPANY.licence ? <li>{COMPANY.licence}</li> : null}
          </ul>
        </div>
      </div>

      <div className="rl-foot__legal">
        <p>
          © {year} {COMPANY.legalName}. {COMPANY.product} is a listing platform, not a broker, landlord or agent in any
          transaction listed on it.
        </p>
        <p>
          <b>Equal housing opportunity.</b> Listings and messages here are subject to the Fair Housing Act and to local
          fair-housing law. We do not let anyone filter people by a protected characteristic, and we remove listings
          that advertise a preference.
        </p>
        <p>
          Local rules shown on listings — deposit caps, fee limits, minimum stays, sublet consent — cite the
          instrument and the date it took effect. They are research, not legal advice, and they change.
        </p>
      </div>
      {open ? <FooterModal id={open} onClose={closeModal} /> : null}
    </footer>
  );
}
