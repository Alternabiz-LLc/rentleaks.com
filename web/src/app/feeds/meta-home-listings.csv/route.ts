/**
 * Meta home-listing catalog feed (CSV) for the RentLeaks Facebook Page.
 *
 *   GET /feeds/meta-home-listings.csv?key=$META_FEED_KEY
 *
 * Add this URL in Commerce Manager → Catalog (type: Home listings) → Data
 * sources → Data feed → scheduled. Meta then shows the homes on the Page's
 * catalog and can use them in Advantage+ catalog ads (Housing is a Special
 * Ad Category: no age, gender or ZIP targeting).
 *
 * Rules this feed holds to:
 *  - Only live listings: approved in review, not paused.
 *  - Never the seeded demo catalogue. Advertising sample homes as real ones
 *    would be exactly the scam signature the product exists to fight, so if
 *    the sample IDs cannot be loaded the feed refuses to serve.
 *  - Addresses respect the lister's privacy choice (street name only by
 *    default); the map point is the listing's stored lat/lng.
 *  - Rows without a postal code are skipped (Meta requires one) and counted
 *    in the X-RentLeaks-Skipped header, so the gap is visible.
 */
import { liveListingWhere } from "@/lib/billing";
import { loadCatalog } from "@/lib/catalog-source";
import { mediaFromDetail } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { absolute, publicAddress } from "@/lib/v1/listing-view";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "home_listing_id",
  "name",
  "availability",
  "description",
  "address.addr1",
  "address.city",
  "address.region",
  "address.country",
  "address.postal_code",
  "latitude",
  "longitude",
  "neighborhood[0]",
  "price",
  "url",
  "image[0].url",
  "image[1].url",
  "image[2].url",
  "image[3].url",
  "image[4].url",
  "listing_type",
  "property_type",
  "num_beds",
  "num_baths",
  "area_size",
  "area_unit",
  "furnish_type",
  "pet_policy",
] as const;

/* Postal codes the address string already carries, by country. */
const POSTAL: Record<string, RegExp> = {
  US: /\b(\d{5})(?:-\d{4})?\b/,
  CA: /\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/i,
  GB: /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/i,
  IE: /\b([AC-FHKNPRTV-Y]\d{2}|D6W)\s?([0-9AC-FHKNPRTV-Y]{4})\b/i,
  NL: /\b(\d{4})\s?([A-Z]{2})\b/i,
  CH: /\b(\d{4})\b/,
};
const FIVE_DIGIT = /\b(\d{5})\b/; // FR, ES, DE, IT

function postalCode(address: string, country: string) {
  const re = POSTAL[country] ?? FIVE_DIGIT;
  const m = re.exec(address);
  if (!m) return null;
  return m.slice(1).filter(Boolean).join(" ").toUpperCase();
}

function csv(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const PROPERTY: Record<string, string> = {
  room: "other",
  coliving: "other",
  furnished: "apartment",
  "short-term": "apartment",
  aparthotel: "apartment",
  "lease-break": "apartment",
};

const FURNISH: Record<string, string> = { fully: "furnished", partly: "semi-furnished", unfurnished: "unfurnished" };
const PETS: Record<string, string> = { none: "none", cats: "cat", dogs: "dog", "cats-dogs": "all" };

export async function GET(req: Request) {
  const expected = process.env.META_FEED_KEY;
  if (expected && new URL(req.url).searchParams.get("key") !== expected) {
    return new Response("Not found", { status: 404 });
  }

  let sampleIds: Set<string>;
  try {
    sampleIds = new Set(loadCatalog().listings.map((l) => l.id));
  } catch {
    return new Response("Feed unavailable: the sample catalogue could not be loaded, so sample homes cannot be excluded.", {
      status: 503,
    });
  }

  const rows = await prisma.listing.findMany({
    where: { AND: [await liveListingWhere(), { id: { notIn: [...sampleIds] } }] },
    include: { city: true },
    orderBy: { postedAt: "desc" },
    take: 5000,
  });

  const origin = appUrl().replace(/\/$/, "");
  const lines = [COLUMNS.join(",")];
  let skipped = 0;

  for (const r of rows) {
    const zip = postalCode(r.address, r.city.country);
    if (!zip) {
      skipped += 1;
      continue;
    }
    const media = mediaFromDetail(r.detail);
    const images = (media.photos.length ? media.photos : [r.image]).slice(0, 5).map((src) => absolute(origin, src));
    const record: Record<(typeof COLUMNS)[number], unknown> = {
      home_listing_id: r.id,
      name: r.title.slice(0, 150),
      availability: "for_rent",
      description: r.description.slice(0, 5000),
      "address.addr1": publicAddress(r) || r.neighborhood,
      "address.city": r.city.name,
      "address.region": r.city.state || r.city.name,
      "address.country": r.city.countryName,
      "address.postal_code": zip,
      latitude: r.lat,
      longitude: r.lng,
      "neighborhood[0]": r.neighborhood,
      price: `${r.allIn.toLocaleString("en-US")} ${r.currency}`,
      url: `${origin}/listings/${encodeURIComponent(r.id)}?utm_source=facebook&utm_medium=catalog`,
      "image[0].url": images[0] ?? "",
      "image[1].url": images[1] ?? "",
      "image[2].url": images[2] ?? "",
      "image[3].url": images[3] ?? "",
      "image[4].url": images[4] ?? "",
      listing_type: r.listedBy === "manager" ? "for_rent_by_agent" : "for_rent_by_owner",
      property_type: PROPERTY[r.housingType] ?? "other",
      num_beds: r.beds,
      num_baths: r.baths,
      area_size: r.sqft || "",
      area_unit: r.sqft ? "sq_ft" : "",
      furnish_type: FURNISH[r.furnishedLevel] ?? "",
      pet_policy: PETS[r.petsPolicy] ?? "",
    };
    lines.push(COLUMNS.map((c) => csv(record[c])).join(","));
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=900",
      "X-RentLeaks-Listed": String(lines.length - 1),
      "X-RentLeaks-Skipped": String(skipped),
    },
  });
}
