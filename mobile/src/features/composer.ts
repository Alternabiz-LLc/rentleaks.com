/**
 * Composer state and the data the steps render. Draft is autosaved on this
 * device so a phone call or a crash mid-listing loses nothing.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EditableDraft } from "@/api/types";
import type { Fee } from "@/shared/listing-rules";

export type Photo = {
  /** Local file (before upload) or remote display URL (after). */
  uri: string;
  /** Server path once uploaded — what the composer payload sends. */
  path?: string;
  width?: number;
  height?: number;
  size?: number;
  status: "local" | "uploading" | "done" | "error";
  error?: string;
};

export type ComposerDraft = {
  role: "owner" | "manager" | "tenant";
  housingType: string;
  cityId: string;
  neighborhood: string;
  address: string;
  unit: string;
  addressPrivacy: "full" | "hide-unit" | "street-only" | "hidden";
  beds: number;
  baths: number;
  sqft: number;
  furnishedLevel: "fully" | "partly" | "unfurnished";
  privateBath: boolean;
  workplaceReady: boolean;
  pets: string;
  amenities: string[];
  access: string[];
  price: number;
  deposit: number;
  fees: Fee[];
  vouchers: boolean;
  registrationNumber: string;
  availableFrom: string;
  availableUntil: string;
  minStayMonths: number;
  maxStayMonths: number;
  leaseEnd: string;
  takeoverType: "sublet" | "assignment";
  consentStatus: "pending" | "granted" | "not-required";
  photos: Photo[];
  videos: string[];
  tourUrl: string;
  title: string;
  description: string;
  status: "active" | "coming-soon";
  /** Geocoded from the address on the phone; the server only keeps it if it is near the city. */
  lat?: number;
  lng?: number;
};

export const FEE_TYPES: Array<{ type: string; label: string; cadence: "monthly" | "once" }> = [
  { type: "utilities", label: "Utilities", cadence: "monthly" },
  { type: "wifi", label: "Wi-Fi / internet", cadence: "monthly" },
  { type: "cleaning", label: "Cleaning", cadence: "monthly" },
  { type: "parking", label: "Parking", cadence: "monthly" },
  { type: "amenity", label: "Amenity fee", cadence: "monthly" },
  { type: "storage", label: "Storage", cadence: "monthly" },
  { type: "pet", label: "Pet rent", cadence: "monthly" },
  { type: "broker", label: "Broker fee", cadence: "once" },
  { type: "admin", label: "Admin fee", cadence: "once" },
  { type: "move_in", label: "Move-in fee", cadence: "once" },
  { type: "key", label: "Key fee", cadence: "once" },
];

export const AMENITIES: Array<[string, string]> = [
  ["wifi", "Wi-Fi"],
  ["laundry-in-unit", "Laundry in unit"],
  ["laundry-in-building", "Laundry in building"],
  ["ac", "Air conditioning"],
  ["heating", "Heating included"],
  ["dishwasher", "Dishwasher"],
  ["elevator", "Lift"],
  ["workspace", "Desk / workspace"],
  ["bike-storage", "Bike storage"],
  ["gym", "Gym"],
  ["outdoor", "Balcony or garden"],
  ["parking", "Parking"],
];

/* Attributes of the PROPERTY, never of the person. */
export const ACCESS: Array<[string, string]> = [
  ["step-free", "Step-free entry"],
  ["lift", "Lift to the floor"],
  ["wide-doors", "Doorways 81 cm+"],
  ["accessible-bath", "Roll-in shower / grab rails"],
  ["ground-floor", "Ground floor"],
];

export const PRIVACY: Array<{ value: ComposerDraft["addressPrivacy"]; label: string; body: string }> = [
  { value: "street-only", label: "Street name only", body: "No house number. Right for most rooms." },
  { value: "hide-unit", label: "Street, no unit", body: "They can find the building, not your door." },
  { value: "full", label: "Full address", body: "Right for a vacant unit you want viewed quickly." },
  { value: "hidden", label: "Neighbourhood only", body: "Nothing until you share it. Worth it if you live there." },
];

export const PHOTO_TIPS = [
  ["sunny-outline", "Daylight, every lamp on", "Mid-morning or late afternoon, curtains open. Never the flash."],
  ["scan-outline", "Corner, chest height, level", "From the doorway you photograph a wall; from the corner, the room."],
  ["phone-landscape-outline", "Landscape, always", "Portrait photos get cropped to their middle third in every grid."],
  ["sparkles-outline", "Tidy first", "Counters clear, bed made, bins and drying rack out of shot."],
  ["grid-outline", "The whole home", "Bedroom, bath, kitchen, common space, the view. Missing rooms read as hiding something."],
  ["eye-outline", "The honest parts too", "Small bathroom, shared kitchen, the stairs. Surprises lose viewings."],
  ["star-outline", "Lead with the room being let", "The cover decides whether anyone sees the rest."],
  ["ban-outline", "No stock, no renders", "Duplicates and stock images are the top reason listings are declined."],
  ["videocam-outline", "Then walk it on video", "Sixty seconds, door to window — the fastest proof the home exists."],
] as const;

const KEY = "rl.composer.draft.v1";

export function blankDraft(role: ComposerDraft["role"] = "owner"): ComposerDraft {
  return {
    role,
    housingType: role === "tenant" ? "lease-break" : "room",
    cityId: "",
    neighborhood: "",
    address: "",
    unit: "",
    addressPrivacy: "street-only",
    beds: 1,
    baths: 1,
    sqft: 0,
    furnishedLevel: "fully",
    privateBath: false,
    workplaceReady: false,
    pets: "none",
    amenities: ["wifi"],
    access: [],
    price: 0,
    deposit: 0,
    fees: [],
    vouchers: true,
    registrationNumber: "",
    availableFrom: "",
    availableUntil: "",
    minStayMonths: 1,
    maxStayMonths: 12,
    leaseEnd: "",
    takeoverType: "sublet",
    consentStatus: "pending",
    photos: [],
    videos: [],
    tourUrl: "",
    title: "",
    description: "",
    status: "active",
  };
}

export async function loadDraft(): Promise<ComposerDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const d = { ...blankDraft(), ...(JSON.parse(raw) as Partial<ComposerDraft>) };
    /* Local files that never uploaded may be gone after a restart. */
    d.photos = d.photos.filter((p) => p.status === "done");
    return d;
  } catch {
    return null;
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;
/** Debounced: a keystroke per character should not be a disk write per character. */
export function saveDraft(d: ComposerDraft) {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
  }, 400);
}

/** A stored listing (from GET /host/listings/:id) as an editable draft. */
export function draftFromEditable(e: EditableDraft): ComposerDraft {
  return {
    ...blankDraft(e.role),
    ...e,
    photos: e.photos.map((p) => ({ uri: p.url, path: p.path, status: "done" as const })),
    videos: e.videos ?? [],
  };
}

export function clearDraft() {
  return AsyncStorage.removeItem(KEY).catch(() => {});
}

/** Basic, honest photo checks — what the device can measure without a model. */
export function photoWarnings(p: Photo, all: Photo[]) {
  const out: string[] = [];
  if (p.width && p.height) {
    if (Math.max(p.width, p.height) < 1200) out.push("Low resolution — under 1200 px on the long side.");
    if (p.height > p.width) out.push("Portrait — will be cropped in listing grids. Shoot landscape.");
  }
  if (p.size && p.width && all.some((o) => o !== p && o.size === p.size && o.width === p.width && o.height === p.height)) {
    out.push("Looks like a duplicate of another photo.");
  }
  return out;
}
