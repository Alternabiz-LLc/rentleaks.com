import { audit, staffForRoute } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { receiptHeaders, sameOrigin } from "@/lib/books/receipts";

export const dynamic = "force-dynamic";

/** A receipt file, to Books users only. `?download=1` saves instead of opening. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await staffForRoute("books");
  if (!user) return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  const r = await prisma.receipt.findUnique({ where: { id } });
  if (!r) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(r.data), { headers: receiptHeaders(r, download) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await staffForRoute("books");
  if (!user) return new Response("Not found", { status: 404 });
  if (!sameOrigin(req)) return Response.json({ error: "Cross-site request refused." }, { status: 403 });
  const { id } = await ctx.params;
  const r = await prisma.receipt.findUnique({ where: { id }, select: { id: true, entryId: true, uploadedById: true } });
  if (!r) return Response.json({ ok: true });
  if (!r.entryId && r.uploadedById !== user.id) return Response.json({ error: "Not yours to remove." }, { status: 403 });
  await prisma.receipt.delete({ where: { id } });
  await audit(user.id, "books.receipt.delete", "ledger", r.entryId ?? "pending", { receipt: id });
  return Response.json({ ok: true });
}
