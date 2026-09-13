"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Identity verification, server side.
 *
 * The important design decision is what is NOT here: no document upload, no
 * image column, no file on disk. The desk collects a name, a date of birth, a
 * document type and the attestations; the document itself is checked in the
 * browser against the selfie and then discarded. A product that promises to
 * discard documents after the match cannot also have a table full of them,
 * and the founder view deliberately shows status rather than anything to open.
 *
 * `status` moves unverified → pending → verified, and only a reviewer moves
 * the last step. Nothing a user submits sets their own account to verified;
 * if it did, the badge would mean "filled in a form".
 */

export type VerifyResult = { ok: true; status: string } | { ok: false; error: string };

const DOCS = ["passport", "driving-licence", "national-id", "residence-permit"] as const;

export async function submitVerification(input: {
  legalName: string;
  dateOfBirth: string;
  documentType: string;
  livenessPassed: boolean;
  addressConfirmed: boolean;
  attestations: string[];
}): Promise<VerifyResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to verify." };

  const legalName = input.legalName.trim().slice(0, 120);
  if (legalName.length < 3) return { ok: false, error: "Give the full name exactly as it appears on the document." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) return { ok: false, error: "Date of birth needs to be a real date." };

  /* Eighteen is the floor for signing a tenancy in every market here. */
  const age = (Date.now() - new Date(`${input.dateOfBirth}T00:00:00Z`).getTime()) / (365.25 * 86_400_000);
  if (!(age >= 18) || age > 120) return { ok: false, error: "That date of birth cannot be right." };

  if (!DOCS.includes(input.documentType as (typeof DOCS)[number])) {
    return { ok: false, error: "Choose the kind of document you checked." };
  }
  if (!input.livenessPassed) return { ok: false, error: "Finish the selfie check — it is what stops a stolen document being used." };

  await prisma.identityVerification.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: "pending",
      provider: "in-browser",
      legalName,
      dateOfBirth: input.dateOfBirth,
      documentType: input.documentType,
      livenessPassed: true,
      addressConfirmed: !!input.addressConfirmed,
      notes: input.attestations.join(", ").slice(0, 600),
    },
    update: {
      status: "pending",
      legalName,
      dateOfBirth: input.dateOfBirth,
      documentType: input.documentType,
      livenessPassed: true,
      addressConfirmed: !!input.addressConfirmed,
      notes: input.attestations.join(", ").slice(0, 600),
    },
  });

  revalidatePath("/verify");
  revalidatePath("/account");
  revalidatePath("/admin");
  return { ok: true, status: "pending" };
}
