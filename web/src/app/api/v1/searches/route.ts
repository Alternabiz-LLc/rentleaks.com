import { prisma } from "@/lib/prisma";
import { fail, handle, ok, readJson, str } from "@/lib/v1/http";
import { coerceSearch } from "@/lib/v1/search";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

const MAX = 20;

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const items = await prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return ok({
    items: items.map((s) => ({
      id: s.id,
      label: s.label,
      query: s.query,
      alerts: s.alerts,
      createdAt: s.createdAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const count = await prisma.savedSearch.count({ where: { userId: user.id } });
  if (count >= MAX) return fail(400, "limit", `You can keep up to ${MAX} saved searches. Remove one first.`);
  const query = coerceSearch(body.query);
  const label = str(body.label, 80) || "Saved search";
  const row = await prisma.savedSearch.create({
    data: {
      userId: user.id,
      label,
      query: JSON.parse(JSON.stringify(query)),
      alerts: body.alerts !== false,
    },
  });
  return ok({ id: row.id, label: row.label, query: row.query, alerts: row.alerts }, 201);
});
