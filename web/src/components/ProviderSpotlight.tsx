import Link from "next/link";
import { providerCampaigns } from "@/lib/provider-sponsors";

/** Provider campaigns are booked by inquiry; this is an availability invitation, not a paid advertiser. */
export function ProviderSpotlight({ home = false, city, type }: { home?: boolean; city?: string; type?: string }) {
  const pack = home ? "portfolio" : "market";
  const campaigns = providerCampaigns({ home, city, type });
  if (campaigns.length) return <section className="provider-spotlight" aria-label="Sponsored providers"><div className="provider-spotlight__copy"><span className="provider-spotlight__eyebrow">Sponsored providers · paid placement</span><h2>Discover a provider’s portfolio</h2><p>Advertising does not confer verification. Check each home’s details and availability.</p></div><div className="provider-spotlight__campaigns">{campaigns.map((c) => <Link className="provider-campaign" key={c.href + c.name} href={new URL(c.href, "https://rentleaks.com").href}><span className="provider-campaign__initial" aria-hidden="true">{c.name.slice(0, 1)}</span><span><small>Sponsored</small><strong>{c.name}</strong><span>{c.headline}</span></span><span aria-hidden="true">↗</span></Link>)}</div></section>;
  return <section className={`provider-spotlight${home ? " provider-spotlight--home" : " provider-spotlight--search"}`} aria-label="Provider advertising availability">
    <div className="provider-spotlight__copy"><span className="provider-spotlight__eyebrow">Provider sponsorship · campaign availability</span><h2>{home ? "A bigger stage for your portfolio." : "Put your portfolio in this market’s spotlight."}</h2><p>For multi-unit landlords, property companies and co-living providers. One clearly labeled company showcase, separate from individual listing boosts.</p></div>
    <div className="provider-spotlight__offer"><span className="provider-spotlight__price">{home ? "$599" : "$299"}<small>/month · USD</small></span><p>{home ? "Homepage rotation + up to 3 market search areas" : "One market’s search spotlight"}</p><Link className="btn" href={`https://rentleaks.com/contact.html?topic=sponsorship&package=${pack}`}>Request availability ↗</Link><Link className="provider-spotlight__details" href="https://rentleaks.com/professionals.html#provider-sponsorship">Compare sponsorship packages</Link></div>
  </section>;
}
