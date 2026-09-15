/**
 * Listing creation and editing for the mobile composer.
 *
 * Mirrors createListingFromComposer (app/actions/listings.ts) step for step —
 * same sanitisers, same publication gate from lib/listing-rules.ts, same
 * forced source-of-income acceptance — but takes an explicit user id and
 * returns a result instead of redirecting, which is what an API needs.
 *
 * Every new listing starts `moderation: "pending"` (the column default), and
 * every edit puts the listing back there. Nothing reaches renters until the
 * founder account has looked at the current version.
 */
import type { City, Listing, Prisma } from "@prisma/client";
import { IMAGES } from "@/lib/catalog";
import { parseFees, parseList } from "@/lib/listing-evidence";
import { allInOf, blockersFor, monthlyFees, rulesFor, toUsd, type Fee, type ListingDraft } from "@/lib/listing-rules";
import { mediaFromDetail, sanitiseMediaUrls } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/site";

const TYPES = ["room", "coliving", "furnished", "short-term", "aparthotel", "lease-break"] as const;
const ROLES = ["owner", "manager", "tenant"];
const PRIVACY = ["full", "hide-unit", "street-only", "hidden"];
const STATUSES = ["active", "coming-soon", "paused"];
const PETS = ["none", "cats", "dogs", "cats-dogs", "case-by-case"];
const FURNISHED = ["fully", "partly", "unfurnished"];

export type ComposerInput = Record<string, unknown>;

export type GateCheck = { id: string; title: string; why: string };

export type ComposerResult =
  | { ok: true; id: string }
  | { ok: false; error: string; checks?: GateCheck[] };

function fees(input: unknown): Fee[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      type: String(f.type || "").slice(0, 32),
      amount: Math.max(0, Math.min(100_000, Number(f.amount) || 0)),
      cadence: f.cadence === "once" ? ("once" as const) : ("monthly" as const),
      mandatory: f.mandatory !== false,
    }))
    .filter((f) => !!f.type)
    .slice(0, 20);
}

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown) => Math.max(0, Number(v) || 0);

/**
 * Everything the composer sends, sanitised and run through the gate. Shared by
 * create and update so an edit can never carry a listing past a rule the
 * original submission would have failed.
 */
function build(raw: ComposerInput, city: City) {
  const housingType = TYPES.find((t) => t === raw.housingType) || "room";
  const feeList = fees(raw.fees);
  const photos = sanitiseMediaUrls(raw.photos, 24);
  const videos = sanitiseMediaUrls(raw.videos, 8);

  const draft: ListingDraft = {
    role: ROLES.includes(String(raw.role)) ? String(raw.role) : "owner",
    housingType,
    cityId: city.id,
    citySlug: city.slug,
    cityName: city.name,
    state: city.state,
    country: city.country,
    title: s(raw.title, 120),
    neighborhood: s(raw.neighborhood, 80),
    address: s(raw.address, 160),
    description: s(raw.description, 6000),
    price: num(raw.price),
    deposit: num(raw.deposit),
    fees: feeList,
    availableFrom: s(raw.availableFrom, 10),
    availableUntil: s(raw.availableUntil, 10),
    minStayMonths: Math.max(1, Number(raw.minStayMonths) || 1),
    maxStayMonths: Math.max(1, Number(raw.maxStayMonths) || 12),
    leaseEnd: s(raw.leaseEnd, 10) || undefined,
    consentStatus: s(raw.consentStatus, 20) || undefined,
    registrationNumber: s(raw.registrationNumber, 64),
    photoCount: photos.length,
  };

  /* The gate — authoritative copy. The app ran the same function already. */
  const blocked = blockersFor(draft);
  if (blocked.length) {
    return {
      ok: false as const,
      error: `${blocked[0].title}: ${blocked[0].why}`,
      checks: blocked.map(({ id, title, why }) => ({ id, title, why })),
    };
  }

  const rules = rulesFor({ cityId: city.id, citySlug: city.slug, cityName: city.name, state: city.state, country: city.country });
  const vouchersAccepted = rules.soiProtected ? true : raw.vouchers !== false;
  const allIn = allInOf(draft);
  const beds = num(raw.beds);
  const baths = num(raw.baths);
  const sqft = num(raw.sqft);

  /* Coordinates: the app may send a geocoded point from the device. Accept it
     only if it sits within ~60 km of the city centre; otherwise fall back to a
     deterministic offset, as the web composer does. */
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const near =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat - city.lat) < 0.55 && Math.abs(lng - city.lng) < 0.75;
  const jitter = (draft.title.length + draft.neighborhood.length) % 80;

  const unit = s(raw.unit, 16);
  const data = {
    cityId: city.id,
    housingType,
    title: draft.title,
    address: draft.address + (unit ? `, #${unit}` : ""),
    neighborhood: draft.neighborhood,
    price: draft.price,
    allIn,
    allInUsd: Math.round(toUsd(allIn, city.currency)),
    currency: city.currency,
    deposit: draft.deposit,
    beds,
    baths,
    sqft,
    lat: near ? lat : city.lat + (jitter - 40) / 1000,
    lng: near ? lng : city.lng + (jitter - 40) / 800,
    image: photos[0] || IMAGES[jitter % IMAGES.length],
    description: draft.description,
    minStayMonths: draft.minStayMonths,
    maxStayMonths: draft.maxStayMonths,
    availableFrom: draft.availableFrom,
    availableUntil: draft.availableUntil || null,
    furnishedLevel: FURNISHED.includes(String(raw.furnishedLevel)) ? String(raw.furnishedLevel) : "fully",
    noFee: !feeList.some((f) => f.type === "broker" && f.amount > 0),
    privateBath: raw.privateBath === true,
    workplaceReady: raw.workplaceReady === true,
    listedBy: draft.role,
    addressPrivacy: PRIVACY.includes(String(raw.addressPrivacy)) ? String(raw.addressPrivacy) : "street-only",
    status: STATUSES.includes(String(raw.status)) ? String(raw.status) : "active",
    vouchersAccepted,
    registrationNumber: draft.registrationNumber || null,
    consentStatus: housingType === "lease-break" ? draft.consentStatus || "pending" : null,
    leaseEnd: draft.leaseEnd || null,
    remainingMonths:
      housingType === "lease-break" && draft.leaseEnd
        ? Math.max(0, Math.round((Date.parse(`${draft.leaseEnd}T00:00:00Z`) - Date.now()) / (86_400_000 * 30)))
        : null,
    takeoverType: housingType === "lease-break" ? (raw.takeoverType === "assignment" ? "assignment" : "sublet") : null,
    accessibilityJson: JSON.stringify(Array.isArray(raw.access) ? raw.access.map(String).slice(0, 12) : []),
    feesJson: JSON.stringify(feeList),
    amenitiesJson: JSON.stringify(Array.isArray(raw.amenities) ? raw.amenities.map(String).slice(0, 24) : []),
    petsPolicy: PETS.includes(String(raw.pets)) ? String(raw.pets) : "none",
    utilitiesIncl: monthlyFees(feeList) === 0,
    detail: {
      photos,
      videos,
      videoUrl: videos[0] || null,
      tourUrl: typeof raw.tourUrl === "string" && /^https:\/\//i.test(raw.tourUrl) ? raw.tourUrl : null,
      specs: [`${beds} bed`, `${baths} bath`, sqft ? `${sqft} sqft` : null].filter(Boolean).join(" · "),
      source: "mobile",
    } satisfies Prisma.InputJsonValue,
  };

  return { ok: true as const, draft, data };
}

export async function createFromComposer(userId: string, raw: ComposerInput): Promise<ComposerResult> {
  const cityId = s(raw.cityId, 64);
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) return { ok: false, error: "Pick a city before publishing." };

  const built = build(raw, city);
  if (!built.ok) return built;

  const listing = await prisma.listing.create({
    data: {
      id: `${cityId}-${built.data.housingType}-${slugify(built.draft.title) || "stay"}-${Date.now().toString(36)}`,
      hostId: userId,
      verified: false,
      featured: false,
      ...built.data,
    },
  });

  return { ok: true, id: listing.id };
}

/**
 * Edit an existing listing. The whole composer payload is re-sanitised and
 * re-gated, then the row is overwritten and sent back to review. The id,
 * host, posting date, verification and paid placement are never touched.
 */
export async function updateFromComposer(listingId: string, userId: string, raw: ComposerInput): Promise<ComposerResult> {
  const current = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, hostId: true } });
  if (!current || current.hostId !== userId) return { ok: false, error: "That listing is not on this account." };

  const cityId = s(raw.cityId, 64);
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) return { ok: false, error: "Pick a city before publishing." };

  const built = build(raw, city);
  if (!built.ok) return built;

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      ...built.data,
      moderation: "pending",
      moderationNote: null,
      moderatedAt: null,
      moderatedById: null,
    },
  });

  return { ok: true, id: listingId };
}

/**
 * A stored listing in the shape the app's composer edits: the inverse of
 * `build`, so a host can open a live listing, change a fee and resubmit.
 */
export function toComposerDraft(row: Listing) {
  const media = mediaFromDetail(row.detail);
  const d = (row.detail ?? {}) as Record<string, unknown>;
  const unitMatch = /,\s*#([^,]+)$/.exec(row.address);
  const photos = media.photos.length ? media.photos : row.image ? [row.image] : [];
  return {
    role: ROLES.includes(row.listedBy) ? row.listedBy : "owner",
    housingType: row.housingType,
    cityId: row.cityId,
    neighborhood: row.neighborhood,
    address: unitMatch ? row.address.slice(0, unitMatch.index) : row.address,
    unit: unitMatch ? unitMatch[1] : "",
    addressPrivacy: PRIVACY.includes(row.addressPrivacy) ? row.addressPrivacy : "street-only",
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    furnishedLevel: FURNISHED.includes(row.furnishedLevel) ? row.furnishedLevel : "fully",
    privateBath: row.privateBath,
    workplaceReady: row.workplaceReady,
    pets: row.petsPolicy,
    amenities: parseList(row.amenitiesJson),
    access: parseList(row.accessibilityJson),
    price: row.price,
    deposit: row.deposit,
    fees: parseFees(row.feesJson),
    vouchers: row.vouchersAccepted,
    registrationNumber: row.registrationNumber ?? "",
    availableFrom: row.availableFrom,
    availableUntil: row.availableUntil ?? "",
    minStayMonths: row.minStayMonths,
    maxStayMonths: row.maxStayMonths,
    leaseEnd: row.leaseEnd ?? "",
    takeoverType: row.takeoverType === "assignment" ? "assignment" : "sublet",
    consentStatus: row.consentStatus ?? "pending",
    photos,
    videos: media.videos,
    tourUrl: typeof d.tourUrl === "string" ? d.tourUrl : "",
    title: row.title,
    description: row.description,
    status: row.status === "coming-soon" ? "coming-soon" : "active",
    lat: row.lat,
    lng: row.lng,
    moderation: row.moderation,
    moderationNote: row.moderationNote,
  };
}
