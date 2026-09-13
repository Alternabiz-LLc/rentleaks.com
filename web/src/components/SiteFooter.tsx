import Link from "next/link";
import { catalogOrigin } from "@/lib/site";

/**
 * The site footer.
 *
 * ------------------------------------------------------------------------
 * FILL THESE IN. Everything below that is `null` is deliberately blank: no
 * registered address, support line or company number exists anywhere in this
 * repository, and a footer is the one place on a housing site where an
 * invented detail does real damage — it is what a renter reads to decide
 * whether there is a company behind the listing at all, and what a regulator
 * reads first. Set a value and it renders; leave it null and nothing is said.
 * ------------------------------------------------------------------------
 */
const COMPANY = {
  legalName: "Alternabiz LLC",
  product: "RentLeaks",
  /** Registered address, one line. e.g. "123 Example St, Brooklyn, NY 11216" */
  address: null as string | null,
  /** Support address renters and hosts can actually reach. */
  email: null as string | null,
  phone: null as string | null,
  /** State entity number, if you want it shown. */
  entityNumber: null as string | null,
  /** Real-estate licence, where one is held and must be displayed. */
  licence: null as string | null,
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

const HOSTS = [
  { href: "/list", label: "List a place" },
  { href: "/account", label: "Your listings" },
];

export function SiteFooter() {
  const catalog = catalogOrigin();
  const year = new Date().getFullYear();

  const hostsExternal = [
    { href: `${catalog}/verify.html`, label: "Get verified" },
    { href: `${catalog}/operators.html`, label: "For operators" },
    { href: `${catalog}/professionals.html`, label: "For agents and brokers" },
  ];

  const company = [
    { href: `${catalog}/contact.html`, label: "Contact" },
    { href: `${catalog}/faq.html`, label: "How RentLeaks works" },
    { href: `${catalog}/cities.html`, label: "All markets" },
    { href: `${catalog}/privacy.html`, label: "Privacy" },
    { href: `${catalog}/terms.html`, label: "Terms" },
  ];

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

          {/* The single most useful sentence in this footer. Renters are
              defrauded by people impersonating platforms, so the platform
              should state plainly that it never takes money. */}
          <p className="rl-foot__claim">
            <b>RentLeaks never handles your money.</b> No deposit, no booking fee, no application fee — there is
            nothing to pay us, ever. Deposits and rent go direct to the landlord against a signed lease. Anyone asking
            you to pay RentLeaks is running a scam.
          </p>
        </div>

        <nav className="rl-foot__col" aria-labelledby="rl-foot-find">
          <h2 id="rl-foot-find">Find a home</h2>
          <ul>
            {FIND.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="rl-foot__col" aria-labelledby="rl-foot-host">
          <h2 id="rl-foot-host">List a home</h2>
          <ul>
            {HOSTS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
            {hostsExternal.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
            <li>
              <Link href="/list">
                Lease-breaks post free
              </Link>
            </li>
          </ul>
        </nav>

        <nav className="rl-foot__col" aria-labelledby="rl-foot-co">
          <h2 id="rl-foot-co">Company</h2>
          <ul>
            {company.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
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
            ) : null}
            {COMPANY.phone ? (
              <li>
                <a href={`tel:${COMPANY.phone.replace(/[^+\d]/g, "")}`}>{COMPANY.phone}</a>
              </li>
            ) : null}
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
    </footer>
  );
}
