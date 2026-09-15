/**
 * Renter passport — held by the renter, on this phone only.
 *
 * Nothing here is uploaded. It is encrypted at rest in the OS keychain /
 * keystore (expo-secure-store) and leaves the device only as a short text
 * summary the renter chooses to paste into a conversation. No document
 * images, no exact income — bands only — which keeps the platform out of the
 * business of holding the most sensitive data in a tenancy (brief §4.4).
 */
import { deleteSecure, getSecure, setSecure } from "@/lib/secure";

export type Passport = {
  firstName: string;
  household: number;
  employment: "employed" | "self-employed" | "student" | "contract" | "remote" | "retired" | "other";
  incomeBand: "" | "under-40k" | "40-60k" | "60-90k" | "90-130k" | "130k-plus";
  shareIncome: boolean;
  guarantor: boolean;
  pets: string;
  smoker: boolean;
  references: number;
  moveReason: string;
  intro: string;
  updatedAt: string;
};

const KEY = "rl.passport.v1";

export const EMPLOYMENT: Array<{ value: Passport["employment"]; label: string }> = [
  { value: "employed", label: "Employed" },
  { value: "self-employed", label: "Self-employed" },
  { value: "contract", label: "Contract / project" },
  { value: "remote", label: "Remote worker" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

export const INCOME: Array<{ value: Passport["incomeBand"]; label: string }> = [
  { value: "", label: "Prefer not to say" },
  { value: "under-40k", label: "Under $40k" },
  { value: "40-60k", label: "$40–60k" },
  { value: "60-90k", label: "$60–90k" },
  { value: "90-130k", label: "$90–130k" },
  { value: "130k-plus", label: "$130k+" },
];

export const emptyPassport = (): Passport => ({
  firstName: "",
  household: 1,
  employment: "employed",
  incomeBand: "",
  shareIncome: false,
  guarantor: false,
  pets: "",
  smoker: false,
  references: 0,
  moveReason: "",
  intro: "",
  updatedAt: new Date().toISOString(),
});

export async function loadPassport(): Promise<Passport | null> {
  try {
    const raw = await getSecure(KEY);
    return raw ? ({ ...emptyPassport(), ...JSON.parse(raw) } as Passport) : null;
  } catch {
    return null;
  }
}

export async function savePassport(p: Passport) {
  await setSecure(KEY, JSON.stringify({ ...p, intro: p.intro.slice(0, 400), moveReason: p.moveReason.slice(0, 120), updatedAt: new Date().toISOString() }));
}

export async function clearPassport() {
  await deleteSecure(KEY);
}

export function passportSummary(p: Passport, identityVerified?: boolean) {
  const lines = [
    "— Renter passport —",
    `${p.firstName || "Renter"} · ${p.household} ${p.household === 1 ? "person" : "people"}`,
    `Work: ${EMPLOYMENT.find((e) => e.value === p.employment)?.label ?? p.employment}`,
    p.shareIncome && p.incomeBand ? `Household income: ${INCOME.find((i) => i.value === p.incomeBand)?.label}` : null,
    p.guarantor ? "Guarantor available" : null,
    p.references ? `${p.references} reference${p.references === 1 ? "" : "s"} available on request` : null,
    p.pets ? `Pets: ${p.pets}` : "No pets",
    p.smoker ? "Smoker (outside only)" : "Non-smoker",
    identityVerified ? "ID verified on RentLeaks" : null,
    p.moveReason ? `Moving for: ${p.moveReason}` : null,
    p.intro ? `\n${p.intro}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}
