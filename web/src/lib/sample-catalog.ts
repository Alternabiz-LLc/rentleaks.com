/**
 * IDs of the sample catalogue shipped with the static site, so feeds can
 * leave those homes out. Read from the site's public listings.json (works on
 * any host, including Cloudflare Workers); falls back to the copy in the repo
 * when the site isn't reachable, e.g. in local development.
 */
import { catalogOrigin } from "./site";

function idsOf(data: unknown): Set<string> {
  const listings = (data as { listings?: Array<{ id?: unknown }> } | null)?.listings;
  if (!Array.isArray(listings) || listings.length === 0) throw new Error("listings.json has no listings");
  return new Set(listings.map((l) => l.id).filter((id): id is string => typeof id === "string"));
}

export async function sampleCatalogIds(): Promise<Set<string>> {
  try {
    const res = await fetch(`${catalogOrigin().replace(/\/$/, "")}/listings.json`, { cache: "no-store" });
    if (res.ok) return idsOf(await res.json());
  } catch {
    /* fall back to the repo copy */
  }
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  return idsOf(JSON.parse(await readFile(join(process.cwd(), "..", "listings.json"), "utf8")));
}
