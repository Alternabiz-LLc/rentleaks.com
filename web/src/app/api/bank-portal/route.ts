import { getCurrentUser } from "@/lib/auth";
import { chargebeeConfig, chargebeeRequest, safeHostedUrl } from "@/lib/chargebee/client";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/site";
import { handle, HttpError, ok, rateLimit, readJson, str } from "@/lib/v1/http";

export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "unauthorized", "Sign in to manage billing.");
  if (req.headers.get("origin") !== new URL(req.url).origin) throw new HttpError(403, "origin", "Open billing from your account.");
  const config = chargebeeConfig();
  if (!config) throw new HttpError(503, "billing_unavailable", "Bank billing is not configured.");
  await rateLimit(`bank-portal:${user.id}`, 10, 10 * 60_000);
  const body = await readJson(req);
  const row = await prisma.bankSubscription.findFirst({ where: { id: str(body.id, 100), userId: user.id } });
  if (!row?.customerId) throw new HttpError(404, "not_found", "No completed bank checkout was found.");
  const { portal_session } = await chargebeeRequest<{ portal_session: { access_url: string } }>("/portal_sessions", new URLSearchParams({ "customer[id]": row.customerId, redirect_url: `${appUrl()}/billing` }));
  return ok({ url: safeHostedUrl(portal_session.access_url, config.site) });
});
