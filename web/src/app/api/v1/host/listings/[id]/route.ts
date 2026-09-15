import { prisma } from "@/lib/prisma";
import { fail, handle, ok, rateLimit, readJson } from "@/lib/v1/http";
import { toComposerDraft, updateFromComposer } from "@/lib/v1/composer";
import { absolute } from "@/lib/v1/listing-view";
import { pushToUsers } from "@/lib/v1/push";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "coming-soon", "paused"];

async function owned(req: Request, id: string) {
  const user = await requireUser(req);
  const listing = await prisma.listing.findUnique({ where: { id } });
  /* Ownership, on every path — same rule as app/actions/listing-admin.ts. */
  if (!listing || listing.hostId !== user.id) return null;
  return { user, listing };
}

/** The listing as the composer edits it, so a host can change anything from the phone. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const own = await owned(req, id);
  if (!own) return fail(404, "not_found", "That listing is not on this account.");
  const origin = new URL(req.url).origin;
  const draft = toComposerDraft(own.listing);
  return ok({
    draft: {
      ...draft,
      /* Stored paths stay relative (what the composer sends back); the app
         needs a display URL next to each one. */
      photos: draft.photos.map((p) => ({ path: p, url: absolute(origin, p) })),
    },
  });
});

/**
 * Edit through the composer. The payload is the same as a new listing; it is
 * sanitised and gated again, and the listing goes back into review with its
 * previous decision cleared.
 */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const own = await owned(req, id);
  if (!own) return fail(404, "not_found", "That listing is not on this account.");
  rateLimit(`compose:${own.user.id}`, 10, 60 * 60_000);
  const body = await readJson(req);
  const result = await updateFromComposer(id, own.user.id, body);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: { code: "gate", message: result.error }, checks: result.checks ?? [] }), {
      status: 422,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  }
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  void pushToUsers(
    admins.map((a) => a.id),
    { title: "Edited listing waiting for review", body: String(body.title || own.listing.title), data: { type: "review", listingId: id } },
  );
  return ok({ id, moderation: "pending" });
});

/**
 * The seller's switches. `status` is theirs; `moderation` is not, so pausing
 * and un-pausing can never walk a declined listing past review. A seller who
 * edits a declined listing's availability puts it back in the queue.
 */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const own = await owned(req, id);
  if (!own) return fail(404, "not_found", "That listing is not on this account.");
  const body = await readJson(req);

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(String(body.status))) return fail(400, "status", "Unknown status.");
    data.status = String(body.status);
  }
  if (typeof body.availableUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.availableUntil)) {
    data.availableUntil = body.availableUntil;
  }
  if (typeof body.availableFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.availableFrom)) {
    data.availableFrom = body.availableFrom;
  }
  if (!Object.keys(data).length) return fail(400, "nothing", "Nothing to change.");

  if (own.listing.moderation === "declined" && (data.availableFrom || data.availableUntil)) {
    data.moderation = "pending";
  }
  /* Touching the listing is also the "still available" confirmation that the
     trust ledger's freshness row reads from updatedAt. */
  await prisma.listing.update({ where: { id }, data });
  return ok({ ok: true });
});

/** Withdraw a listing permanently. Its enquiry threads go with it. */
export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const own = await owned(req, id);
  if (!own) return fail(404, "not_found", "That listing is not on this account.");
  await prisma.listing.delete({ where: { id } });
  return ok({ ok: true });
});
