"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field } from "@/lib/admin/flash";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/site";

const path = "/admin/ads";
const PLATFORMS = ["meta", "google", "tiktok", "reddit", "other"];
const STATUSES = ["planned", "active", "paused", "ended"];
const SOURCE: Record<string, string> = { meta: "fb_ad", google: "google_ad", tiktok: "tiktok_ad", reddit: "reddit_ad", other: "ad" };

function landingUrl(base: string, platform: string, utmCampaign: string) {
  const url = new URL(base);
  url.searchParams.set("src", platform === "meta" ? "fb_ad" : "web");
  url.searchParams.set("utm_source", platform === "meta" ? "facebook" : platform);
  url.searchParams.set("utm_medium", "paid");
  url.searchParams.set("utm_campaign", utmCampaign);
  return url.toString();
}

export async function saveAd(fd: FormData) {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const platform = PLATFORMS.includes(field(fd, "platform")) ? field(fd, "platform") : "meta";
  const status = STATUSES.includes(field(fd, "status")) ? field(fd, "status") : "planned";
  const num = (k: string) => Math.max(0, Math.round(Number(field(fd, k)) || 0));
  const common = {
    platform,
    status,
    objective: field(fd, "objective", 40) || "leads",
    dailyBudget: num("dailyBudget"),
    spend: num("spend"),
    startDate: field(fd, "startDate", 10) || null,
    endDate: field(fd, "endDate", 10) || null,
    note: field(fd, "note", 1000) || null,
  };
  if (id) {
    await prisma.adCampaign.update({ where: { id }, data: common });
    await audit(guard.user.id, "ad.edit", "ad", id, { spend: common.spend, status });
    revalidatePath(path);
    back(path, "ok", "Saved.");
  }
  const name = field(fd, "name", 120);
  if (name.length < 3) back(path, "err", "Name the campaign.");
  const utm = slugify(field(fd, "utm", 60) || name).slice(0, 60);
  if (!utm) back(path, "err", "Use letters or numbers in the name.");
  if (await prisma.adCampaign.findUnique({ where: { utmCampaign: utm } })) back(path, "err", `utm_campaign “${utm}” is already used.`);
  const base = field(fd, "landing", 300) || "https://rentleaks.com/facebook.html";
  let url: string;
  try {
    url = landingUrl(base, platform, utm);
  } catch {
    back(path, "err", "The landing page must be a full https:// URL.");
  }
  const created = await prisma.adCampaign.create({ data: { ...common, name, utmCampaign: utm, landingUrl: url } });
  await audit(guard.user.id, "ad.create", "ad", created.id, { name, platform, source: SOURCE[platform] });
  revalidatePath(path);
  back(path, "ok", `Created. Use the tracking link in your ${platform} ad so leads are attributed.`);
}

export async function deleteAd(fd: FormData) {
  const guard = await requireAdminAction();
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  await prisma.adCampaign.delete({ where: { id } }).catch(() => undefined);
  await audit(guard.user.id, "ad.delete", "ad", id);
  back(path, "ok", "Deleted. Leads keep their campaign tag.");
}
