"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field } from "@/lib/admin/flash";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/site";

const int = (v: string, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

export async function saveCity(fd: FormData) {
  const path = "/admin/markets";
  const guard = await requireAdminAction("markets");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const rank = int(field(fd, "rank"), 1, 9999);
  const avgRoom = int(field(fd, "avgRoom"), 0, 1_000_000);
  const avgFurnished = int(field(fd, "avgFurnished"), 0, 1_000_000);
  if (rank === null || avgRoom === null || avgFurnished === null) back(path, "err", "Rank and medians must be numbers.");
  await prisma.city.update({
    where: { id },
    data: { rank, avgRoom, avgFurnished, featured: fd.get("featured") === "on" },
  });
  await audit(guard.user.id, "city.edit", "city", id, { rank, avgRoom, avgFurnished });
  revalidatePath("/admin/markets");
  revalidatePath("/stays");
  back(path, "ok", `${id} saved.`);
}

export async function saveOperator(fd: FormData) {
  const path = "/admin/markets?tab=operators";
  const guard = await requireAdminAction("markets");
  if (!guard.ok) back(path, "err", guard.error);
  const existingId = field(fd, "id", 80);
  const name = field(fd, "name", 120);
  const kind = ["coliving", "portfolio", "landlord"].includes(field(fd, "kind")) ? field(fd, "kind") : "landlord";
  const tagline = field(fd, "tagline", 200);
  const scope = field(fd, "scope", 200);
  const since = int(field(fd, "since"), 1900, 2100);
  if (name.length < 2) back(path, "err", "Operator name is required.");
  if (existingId) {
    await prisma.operator.update({ where: { id: existingId }, data: { name, kind, tagline, scope, since } });
    await audit(guard.user.id, "operator.edit", "operator", existingId, { name });
    back(path, "ok", `${name} saved.`);
  }
  const slug = slugify(name);
  if (!slug) back(path, "err", "Use a name with letters or numbers.");
  if (await prisma.operator.findFirst({ where: { OR: [{ id: slug }, { slug }] } })) back(path, "err", "An operator with that name exists.");
  await prisma.operator.create({ data: { id: slug, slug, name, kind, tagline, scope, since } });
  await audit(guard.user.id, "operator.create", "operator", slug, { name });
  revalidatePath("/admin/markets");
  back(path, "ok", `${name} added.`);
}
