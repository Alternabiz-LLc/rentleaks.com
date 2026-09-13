"use server";

import { redirect } from "next/navigation";
import { IMAGES } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/site";
import { allInOf, blockersFor, monthlyFees, rulesFor, type Fee, type ListingDraft } from "@/lib/listing-rules";

const TYPES = ["room", "coliving", "furnished", "short-term", "aparthotel", "lease-break"] as const;

function pickType(value: string) {
  return TYPES.find((type) => type === value) || "room";
}

/* ------------------------------------------------------------------------
   The original form action, kept so the plain <form> path still works.
   ------------------------------------------------------------------------ */

export async function createListingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/list");

  const housingType = pickType(String(formData.get("housingType") || "room"));
  const cityId = String(formData.get("cityId") || "");
  const title = String(formData.get("title") || "").trim();
  const neighborhood = String(formData.get("neighborhood") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const price = Math.max(1, Number(formData.get("price") || 0));
  const utilities = Math.max(0, Number(formData.get("utilities") || 0));
  const beds = Math.max(1, Number(formData.get("beds") || 1));
  const baths = Math.max(1, Number(formData.get("baths") || 1));
  const sqft = Math.max(80, Number(formData.get("sqft") || 200));
  const minStayMonths = Math.max(1, Number(formData.get("minStayMonths") || 1));
  const availableFrom = String(formData.get("availableFrom") || "2026-09-15");
  const furnishedLevel = String(formData.get("furnishedLevel") || "fully");
  const description = String(formData.get("description") || "").trim();

  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city || !title || !neighborhood || !address || !description) {
    redirect("/list?error=invalid");
  }

  const jitter = (title.length + neighborhood.length) % 80;
  const listing = await prisma.listing.create({
    data: {
      id: `${cityId}-${housingType}-${slugify(title) || "stay"}-${Date.now().toString(36)}`,
      cityId,
      hostId: user.id,
      housingType,
      title,
      address,
      neighborhood,
      price,
      allIn: price + utilities,
      deposit: price,
      beds,
      baths,
      sqft,
      lat: city.lat + (jitter - 40) / 1000,
      lng: city.lng + (jitter - 40) / 800,
      image: IMAGES[jitter % IMAGES.length],
      description,
      minStayMonths,
      availableFrom,
      furnishedLevel,
      verified: false,
      noFee: true,
      featured: String(formData.get("featured") || "") === "1",
      amenitiesJson: JSON.stringify(["wifi", "workspace"]),
    },
  });

  redirect(`/listings/${listing.id}`);
}

/* ------------------------------------------------------------------------
   The composer path.

   The composer runs the same gate in the browser, but that copy is there so
   nobody wastes five minutes on a form that will be rejected. This one is the
   one that decides: anyone can post JSON at a server action, and a listing
   that breaches its market's fee, deposit or minimum-stay rules must not
   reach the catalogue because a client-side check was skipped.
   ------------------------------------------------------------------------ */

type ComposerPayload = {
  role?: string;
  housingType?: string;
  cityId?: string;
  cityName?: string;
  state?: string;
  country?: string;
  title?: string;
  neighborhood?: string;
  address?: string;
  unit?: string;
  addressPrivacy?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  furnishedLevel?: string;
  price?: number;
  deposit?: number;
  fees?: Fee[];
  availableFrom?: string;
  availableUntil?: string;
  minStayMonths?: number;
  maxStayMonths?: number;
  leaseEnd?: string;
  takeoverType?: string;
  consentStatus?: string;
  registrationNumber?: string;
  vouchers?: boolean;
  pets?: string;
  amenities?: string[];
  access?: string[];
  photos?: string[];
  videoUrl?: string;
  tourUrl?: string;
  description?: string;
  status?: string;
  scheduledAt?: string;
  sponsored?: boolean;
  plan?: string;
};

const ROLES = ["owner", "manager", "tenant"];
const PRIVACY = ["full", "hide-unit", "street-only", "hidden"];
const STATUSES = ["active", "coming-soon", "paused"];

function sanitiseFees(input: unknown): Fee[] {
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

function sanitiseUrls(input: unknown, limit: number) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter((u) => /^https:\/\//i.test(u))
    .slice(0, limit);
}

export async function createListingFromComposer(payload: string): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/list");

  let raw: ComposerPayload;
  try {
    raw = JSON.parse(payload) as ComposerPayload;
  } catch {
    return { error: "That draft could not be read. Try publishing again." };
  }

  const cityId = String(raw.cityId || "");
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) return { error: "Pick a city before publishing." };

  const housingType = pickType(String(raw.housingType || "room"));
  const fees = sanitiseFees(raw.fees);
  const photos = sanitiseUrls(raw.photos, 24);

  const draft: ListingDraft = {
    role: ROLES.includes(String(raw.role)) ? String(raw.role) : "owner",
    housingType,
    cityId,
    cityName: city.name,
    state: city.state,
    country: city.country,
    title: String(raw.title || "").trim().slice(0, 120),
    neighborhood: String(raw.neighborhood || "").trim().slice(0, 80),
    address: String(raw.address || "").trim().slice(0, 160),
    description: String(raw.description || "").trim().slice(0, 6000),
    price: Math.max(0, Number(raw.price) || 0),
    deposit: Math.max(0, Number(raw.deposit) || 0),
    fees,
    availableFrom: String(raw.availableFrom || "").slice(0, 10),
    availableUntil: String(raw.availableUntil || "").slice(0, 10),
    minStayMonths: Math.max(1, Number(raw.minStayMonths) || 1),
    maxStayMonths: Math.max(1, Number(raw.maxStayMonths) || 12),
    leaseEnd: String(raw.leaseEnd || "").slice(0, 10) || undefined,
    consentStatus: String(raw.consentStatus || "") || undefined,
    registrationNumber: String(raw.registrationNumber || "").slice(0, 64),
    photoCount: photos.length,
  };

  /* The gate. Same function the browser ran; this is the authoritative call. */
  const blocked = blockersFor(draft);
  if (blocked.length) {
    return { error: `${blocked[0].title}: ${blocked[0].why}` };
  }

  const rules = rulesFor({ cityId, cityName: city.name, state: city.state, country: city.country });

  /* Source-of-income protection is not a preference the lister gets to set.
     Where the market protects it, acceptance is forced on regardless of what
     the payload says. */
  const vouchersAccepted = rules.soiProtected ? true : raw.vouchers !== false;

  const allIn = allInOf(draft);
  const jitter = (draft.title.length + draft.neighborhood.length) % 80;
  const status = STATUSES.includes(String(raw.status)) ? String(raw.status) : "active";

  const listing = await prisma.listing.create({
    data: {
      id: `${cityId}-${housingType}-${slugify(draft.title) || "stay"}-${Date.now().toString(36)}`,
      cityId,
      hostId: user.id,
      housingType,
      title: draft.title,
      address: draft.address + (raw.unit ? `, #${String(raw.unit).slice(0, 16)}` : ""),
      neighborhood: draft.neighborhood,
      price: draft.price,
      allIn,
      allInUsd: allIn,
      currency: city.currency,
      deposit: draft.deposit,
      beds: Math.max(0, Number(raw.beds) || 0),
      baths: Math.max(0, Number(raw.baths) || 0),
      sqft: Math.max(0, Number(raw.sqft) || 0),
      lat: city.lat + (jitter - 40) / 1000,
      lng: city.lng + (jitter - 40) / 800,
      image: photos[0] || IMAGES[jitter % IMAGES.length],
      description: draft.description,
      minStayMonths: draft.minStayMonths,
      maxStayMonths: draft.maxStayMonths,
      availableFrom: draft.availableFrom,
      availableUntil: draft.availableUntil || null,
      furnishedLevel: String(raw.furnishedLevel || "fully"),
      verified: false,
      noFee: !fees.some((f) => f.type === "broker" && f.amount > 0),
      featured: false,

      listedBy: draft.role,
      addressPrivacy: PRIVACY.includes(String(raw.addressPrivacy)) ? String(raw.addressPrivacy) : "street-only",
      status,
      scheduledAt: String(raw.scheduledAt || "").slice(0, 10) || null,
      vouchersAccepted,
      registrationNumber: draft.registrationNumber || null,
      consentStatus: housingType === "lease-break" ? draft.consentStatus || "pending" : null,
      leaseEnd: draft.leaseEnd || null,
      takeoverType: housingType === "lease-break" ? String(raw.takeoverType || "sublet") : null,
      accessibilityJson: JSON.stringify(Array.isArray(raw.access) ? raw.access.slice(0, 12) : []),
      feesJson: JSON.stringify(fees),
      amenitiesJson: JSON.stringify(Array.isArray(raw.amenities) ? raw.amenities.slice(0, 24) : []),

      sponsored: raw.sponsored === true,
      plan: raw.plan === "month" ? "month" : "week",

      petsPolicy: String(raw.pets || "none"),
      utilitiesIncl: monthlyFees(fees) === 0,

      detail: {
        photos,
        videoUrl: typeof raw.videoUrl === "string" && /^https:\/\//i.test(raw.videoUrl) ? raw.videoUrl : null,
        tourUrl: typeof raw.tourUrl === "string" && /^https:\/\//i.test(raw.tourUrl) ? raw.tourUrl : null,
        specs: [
          `${Math.max(0, Number(raw.beds) || 0)} bed`,
          `${Math.max(0, Number(raw.baths) || 0)} bath`,
          raw.sqft ? `${raw.sqft} sqft` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    },
  });

  redirect(`/listings/${listing.id}`);
}
