/**
 * Listing shapes for the mobile app.
 *
 * `toCard` is the lightweight row a feed or map renders. `toDetail` is the
 * full page, including the evidence layer computed by the SAME pure functions
 * the web listing page uses (lib/listing-evidence.ts) — the app never gets a
 * second, drifting copy of what "fee barred" or "3 of 5 checks" means.
 */
import type { City, Listing, Operator } from "@prisma/client";
import { listingGallery } from "@/lib/catalog";
import { evidenceFor, parseFees, parseList, type EvidenceListing } from "@/lib/listing-evidence";
import { mediaFromDetail } from "@/lib/media";
import { fmtMoney, typeLabel } from "@/lib/site";

export type CardRow = Listing & { city: City; operator?: Operator | null };

export function absolute(origin: string, src: string) {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return `${origin.replace(/\/$/, "")}${src.startsWith("/") ? "" : "/"}${src}`;
}

function gallery(row: CardRow, origin: string) {
  const media = mediaFromDetail(row.detail);
  return listingGallery({
    id: row.id,
    image: row.image,
    title: row.title,
    neighborhood: row.neighborhood,
    cityName: row.city.name,
    photos: media.photos,
    videos: media.videos,
  }).map((g) => ({
    ...g,
    src: absolute(origin, g.src),
    ...(g.kind === "video" && g.poster ? { poster: absolute(origin, g.poster) } : {}),
  }));
}

/**
 * The address a renter is allowed to see. The composer lets a lister choose
 * how much of it is public; the API honours that rather than shipping the full
 * string and trusting the client to hide it.
 */
export function publicAddress(row: Pick<Listing, "address" | "addressPrivacy" | "neighborhood">) {
  switch (row.addressPrivacy) {
    case "full":
      return row.address;
    case "hide-unit":
      return stripUnit(row.address);
    case "hidden":
      return row.neighborhood;
    case "street-only":
    default:
      return stripUnit(row.address.replace(/^\s*\d+[\w-]*\s+/, ""));
  }
}

/* The unit may sit at the end ("12 Main St, #4B") or in the middle of a full
   postal string ("12 Main St, #4B, Berlin, Germany"). Both go. */
function stripUnit(address: string) {
  return address.replace(/,?\s*(#|apt\.?|unit|suite)\s*[\w-]+(?=,|$)/gi, "").replace(/\s+,/g, ",").trim();
}

export function toCard(row: CardRow, origin: string) {
  const g = gallery(row, origin);
  const photos = g.filter((x) => x.kind === "photo").slice(0, 5).map((x) => x.src);
  return {
    id: row.id,
    title: row.title,
    housingType: row.housingType,
    typeLabel: typeLabel(row.housingType),
    neighborhood: row.neighborhood,
    cityId: row.cityId,
    cityName: row.city.name,
    country: row.city.country,
    currency: row.currency,
    price: row.price,
    allIn: row.allIn,
    allInUsd: row.allInUsd,
    deposit: row.deposit,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    lat: row.lat,
    lng: row.lng,
    image: photos[0] || absolute(origin, row.image),
    photos,
    availableFrom: row.availableFrom,
    availableUntil: row.availableUntil,
    minStayMonths: row.minStayMonths,
    maxStayMonths: row.maxStayMonths,
    furnishedLevel: row.furnishedLevel,
    verified: row.verified,
    noFee: row.noFee,
    sponsored: row.sponsored || row.featured,
    listedBy: row.listedBy,
    remainingMonths: row.remainingMonths,
    leaseEnd: row.leaseEnd,
    takeoverType: row.takeoverType,
    operatorName: row.operator?.name ?? null,
  };
}

export type MobileCard = ReturnType<typeof toCard>;

export function evidenceSubject(row: CardRow): EvidenceListing {
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    neighborhood: row.neighborhood,
    cityId: row.cityId,
    citySlug: row.city.slug,
    cityName: row.city.name,
    cityState: row.city.state,
    cityCountry: row.city.country,
    currency: row.currency,
    housingType: row.housingType,
    price: row.price,
    allIn: row.allIn,
    allInUsd: row.allInUsd,
    deposit: row.deposit,
    sqft: row.sqft,
    feesJson: row.feesJson,
    amenitiesJson: row.amenitiesJson,
    accessibilityJson: row.accessibilityJson,
    listedBy: row.listedBy,
    addressPrivacy: row.addressPrivacy,
    verified: row.verified,
    vouchersAccepted: row.vouchersAccepted,
    registrationNumber: row.registrationNumber,
    availableFrom: row.availableFrom,
    availableUntil: row.availableUntil,
    minStayMonths: row.minStayMonths,
    maxStayMonths: row.maxStayMonths,
    leaseEnd: row.leaseEnd,
    takeoverType: row.takeoverType,
    consentStatus: row.consentStatus,
    status: row.status,
    sponsored: row.sponsored,
    updatedAt: row.updatedAt,
  };
}

export function toDetail(
  row: CardRow & { host: { id: string; name: string; createdAt: Date; identity: { status: string } | null } },
  peers: Array<{ allInUsd: number; housingType: string; cityId: string }>,
  origin: string,
  hostStats: { listings: number; responseRate: number | null; medianReplyHours: number | null },
) {
  const subject = evidenceSubject(row);
  const evidence = evidenceFor(subject, peers, (n) => fmtMoney(n, row.currency));
  const d = (row.detail ?? {}) as Record<string, unknown>;
  return {
    ...toCard(row, origin),
    address: publicAddress(row),
    addressPrivacy: row.addressPrivacy,
    description: row.description,
    gallery: gallery(row, origin),
    amenities: parseList(row.amenitiesJson),
    accessibility: parseList(row.accessibilityJson),
    fees: parseFees(row.feesJson),
    petsPolicy: row.petsPolicy,
    privateBath: row.privateBath,
    workplaceReady: row.workplaceReady,
    utilitiesIncl: row.utilitiesIncl,
    vouchersAccepted: row.vouchersAccepted,
    registrationNumber: row.registrationNumber,
    consentStatus: row.consentStatus,
    tourUrl: typeof d.tourUrl === "string" ? d.tourUrl : null,
    specs: typeof d.specs === "string" ? d.specs : "",
    commuteNote: typeof d.commuteNote === "string" ? d.commuteNote : "",
    status: row.status,
    moderation: row.moderation,
    updatedAt: row.updatedAt.toISOString(),
    postedAt: row.postedAt.toISOString(),
    host: {
      id: row.host.id,
      firstName: row.host.name.split(/\s+/)[0] || "Host",
      memberSince: row.host.createdAt.toISOString().slice(0, 7),
      identity: row.host.identity?.status ?? "unverified",
      ...hostStats,
    },
    evidence: {
      ...evidence,
      rules: {
        cityName: evidence.rules.cityName,
        country: evidence.rules.country,
        region: evidence.rules.region,
        minStayDays: evidence.rules.minStayDays,
        depositCapMonths: evidence.rules.depositCapMonths,
        soiProtected: evidence.rules.soiProtected,
        registrationRequired: evidence.rules.registrationRequired,
        landlordAgentMayChargeTenant: evidence.rules.landlordAgentMayChargeTenant,
        unassessed: evidence.rules.unassessed,
        notes: evidence.rules.notes,
      },
    },
  };
}

export type MobileDetail = ReturnType<typeof toDetail>;
