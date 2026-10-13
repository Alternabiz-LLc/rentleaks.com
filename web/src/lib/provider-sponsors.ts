import registry from "./provider-sponsorships.json";

export type Campaign = { name: string; headline: string; href: string; approved: boolean; startsAt: string; endsAt: string; homepage?: boolean; cityIds: string[]; types?: string[] };
export function providerCampaigns({ home, city, type }: { home?: boolean; city?: string; type?: string }, campaigns: Campaign[] = registry.campaigns as Campaign[], now = Date.now()) {
  const active = campaigns.filter((c) => {
    let url: URL;
    try { url = new URL(c.href, "https://rentleaks.com"); } catch { return false; }
    return url.protocol === "https:" && url.hostname === "rentleaks.com" && !url.username && !url.password && !url.port && c.approved === true && c.name && c.headline && Date.parse(c.startsAt) <= now && Date.parse(c.endsAt) > now && (home ? c.homepage === true : Boolean(city && c.cityIds?.includes(city))) && (!c.types?.length || !type || c.types.includes(type));
  });
  const offset = active.length ? Math.floor(now / 86400000) % active.length : 0;
  return active.slice(offset).concat(active.slice(0, offset)).slice(0, 3);
}
