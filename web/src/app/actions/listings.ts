"use server";

import { redirect } from "next/navigation";
import { IMAGES } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/site";

const TYPES = ["room", "coliving", "furnished", "short-term", "lease-break"] as const;

function pickType(value: string) {
  return TYPES.find((type) => type === value) || "room";
}

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
