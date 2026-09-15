import { isHost } from "@/lib/roles";
import { fail, handle, ok, rateLimit } from "@/lib/v1/http";
import { absolute } from "@/lib/v1/listing-view";
import { saveUpload } from "@/lib/v1/media-store";
import { requireUser } from "@/lib/v1/session";

export const dynamic = "force-dynamic";

/** Multipart `file`. Returns the stored path (what the composer sends back) and a display URL. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  if (!isHost(user)) return fail(403, "not_host", "Only hosting accounts upload listing media.");
  rateLimit(`upload:${user.id}`, 80, 60 * 60_000);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "no_file", "Choose a file.");
  const path = await saveUpload(user.id, file);
  return ok({ path, url: absolute(new URL(req.url).origin, path) }, 201);
});
