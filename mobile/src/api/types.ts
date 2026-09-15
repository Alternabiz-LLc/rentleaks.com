/** Shapes returned by /api/v1 — mirror web/src/lib/v1/*.ts. */
import type { Evidence } from "@/shared/listing-evidence";

export type Role = "renter" | "host" | "admin";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  identityStatus: "unverified" | "pending" | "verified" | "declined" | string;
  createdAt?: string;
};

export type Session = { token: string; expiresAt: string; user: User };

export type City = {
  id: string;
  slug: string;
  name: string;
  state: string;
  country: string;
  countryName: string;
  group: string;
  currency: string;
  lat: number;
  lng: number;
  featured: boolean;
  neighborhoods: string[];
  listingCount: number;
  avgRoom: number;
  avgFurnished: number;
};

export type Meta = {
  listings: number;
  rulesVersion: string | null;
  fx: { perUsd: Record<string, number>; updated: string };
  housingTypes: Array<{ id: string; label: string }>;
  cities: City[];
};

export type Card = {
  id: string;
  title: string;
  housingType: string;
  typeLabel: string;
  neighborhood: string;
  cityId: string;
  cityName: string;
  country: string;
  currency: string;
  price: number;
  allIn: number;
  allInUsd: number;
  deposit: number;
  beds: number;
  baths: number;
  sqft: number;
  lat: number;
  lng: number;
  image: string;
  photos: string[];
  availableFrom: string;
  availableUntil: string | null;
  minStayMonths: number;
  maxStayMonths: number;
  furnishedLevel: string;
  verified: boolean;
  noFee: boolean;
  sponsored: boolean;
  listedBy: string;
  remainingMonths: number | null;
  leaseEnd: string | null;
  takeoverType: string | null;
  operatorName: string | null;
  saved?: boolean;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number; hasMore: boolean };

export type GalleryItem =
  | { kind: "photo"; src: string; caption: string; alt: string }
  | { kind: "video"; src: string; caption: string; alt: string; poster?: string };

/** Evidence as JSON: Dates become strings and the rules object is trimmed. */
export type EvidenceJson = Omit<Evidence, "rules"> & {
  rules: {
    cityName: string;
    country: string;
    region: string;
    minStayDays: number;
    depositCapMonths: number | null;
    soiProtected: boolean;
    registrationRequired: boolean;
    landlordAgentMayChargeTenant: boolean;
    unassessed: boolean;
    notes: string[];
  };
};

export type Detail = Card & {
  address: string;
  addressPrivacy: string;
  description: string;
  gallery: GalleryItem[];
  amenities: string[];
  accessibility: string[];
  fees: Array<{ type: string; amount: number; cadence: "monthly" | "once"; mandatory: boolean }>;
  petsPolicy: string;
  privateBath: boolean;
  workplaceReady: boolean;
  utilitiesIncl: boolean;
  vouchersAccepted: boolean;
  registrationNumber: string | null;
  consentStatus: string | null;
  tourUrl: string | null;
  specs: string;
  commuteNote: string;
  status: string;
  moderation: string;
  updatedAt: string;
  postedAt: string;
  host: {
    id: string;
    firstName: string;
    memberSince: string;
    identity: string;
    listings: number;
    responseRate: number | null;
    medianReplyHours: number | null;
  };
  evidence: EvidenceJson;
};

export type DetailResponse = {
  listing: Detail;
  similar: Card[];
  viewer: { saved: boolean; conversationId: string | null; isOwner: boolean; canReview: boolean };
};

export type SavedCard = Card & { saved: true; savedAt: string; available: boolean };

export type SearchQuery = {
  city?: string;
  type?: string;
  q?: string;
  moveIn?: string;
  moveOut?: string;
  minUsd?: number;
  maxUsd?: number;
  beds?: number;
  furnished?: boolean;
  privateBath?: boolean;
  work?: boolean;
  noFee?: boolean;
  utilities?: boolean;
  verified?: boolean;
  pets?: boolean;
  vouchers?: boolean;
  sort?: "newest" | "price-asc" | "price-desc" | "move-in";
};

export type SavedSearch = { id: string; label: string; query: SearchQuery; alerts: boolean; createdAt: string };

export type ScamSignal = { key: string; label: string; advice: string };

export type InboxItem = {
  id: string;
  role: "renter" | "host";
  listing: { id: string; title: string; image: string; neighborhood: string; allIn: number; currency: string };
  counterpart: { id: string; firstName: string };
  lastMessage: { body: string; mine: boolean; at: string; flagged: boolean } | null;
  unread: boolean;
  lastMessageAt: string;
};

export type Message = { id: string; body: string; mine: boolean; at: string; signals: ScamSignal[]; pending?: boolean };

export type Thread = {
  id: string;
  role: "renter" | "host";
  blocked: boolean;
  archived: boolean;
  /** When the other party last opened the thread; null if never. */
  theirReadAt: string | null;
  listing: {
    id: string;
    title: string;
    image: string;
    neighborhood: string;
    cityName: string;
    allIn: number;
    currency: string;
    deposit: number;
    verified: boolean;
  };
  counterpart: { id: string; firstName: string; identity: string };
  messages: Message[];
};

export type HostListing = Card & {
  status: "active" | "coming-soon" | "paused" | string;
  moderation: "pending" | "approved" | "declined" | string;
  moderationNote: string | null;
  enquiries: number;
  saves: number;
  updatedAt: string;
};

export type Me = {
  user: User;
  counts: { saved: number; unread: number; listings: Record<string, number> };
};

export type QueueListing = Card & {
  address: string;
  description: string;
  submittedAt: string;
  host: { id: string; name: string; email: string; memberSince: string; identity: string };
  gate: Array<{ id: string; title: string; why: string }>;
};

export type QueueReport = {
  id: string;
  reason: string;
  note: string;
  reporter: string;
  listing: { id: string; title: string } | null;
  subjectUserId: string | null;
  messageId: string | null;
  createdAt: string;
};

/** What GET /host/listings/:id returns — the composer's own shape, photos with display URLs. */
export type EditableDraft = {
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
  fees: Array<{ type: string; amount: number; cadence: "monthly" | "once"; mandatory: boolean }>;
  vouchers: boolean;
  registrationNumber: string;
  availableFrom: string;
  availableUntil: string;
  minStayMonths: number;
  maxStayMonths: number;
  leaseEnd: string;
  takeoverType: "sublet" | "assignment";
  consentStatus: "pending" | "granted" | "not-required";
  photos: Array<{ path: string; url: string }>;
  videos: string[];
  tourUrl: string;
  title: string;
  description: string;
  status: "active" | "coming-soon";
  lat: number;
  lng: number;
  moderation: string;
  moderationNote: string | null;
};
