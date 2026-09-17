import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * A partner's headshot for the public roster. Only active partners are served,
 * so pausing or removing a partner takes their photo off the website too.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.networkPartner
    .findFirst({ where: { id, status: "active" }, select: { photoData: true, photoType: true, photoAt: true } })
    .catch(() => null);
  if (!p?.photoData || !p.photoType) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(p.photoData);
  return new Response(bytes, {
    headers: {
      "Content-Type": p.photoType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Last-Modified": (p.photoAt ?? new Date()).toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
