import { createHash } from "crypto";
import { audit, staffForRoute } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { cleanFileName, RECEIPT_MAX_BYTES, RECEIPTS_PER_LINE, sameOrigin, sniffReceipt } from "@/lib/books/receipts";

export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Upload receipt photos or PDFs (multipart, field "files"). With `entryId`
 * they attach to that ledger line; without, they wait to be attached when the
 * line is saved. Founder (Books access) only.
 */
export async function POST(req: Request) {
  const user = await staffForRoute("books");
  if (!user) return new Response("Not found", { status: 404 });
  if (!sameOrigin(req)) return json(403, { error: "Cross-site upload refused." });
  const length = Number(req.headers.get("content-length") || 0);
  if (length > RECEIPTS_PER_LINE * (RECEIPT_MAX_BYTES + 64_000)) return json(413, { error: "Too much at once — up to 10 files of 4 MB each." });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { error: "That upload couldn't be read." });
  }
  const entryId = String(form.get("entryId") || "").slice(0, 60) || null;
  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return json(400, { error: "Choose a photo or PDF." });
  if (entryId) {
    const entry = await prisma.ledgerEntry.findUnique({ where: { id: entryId }, select: { id: true } });
    if (!entry) return json(404, { error: "That line no longer exists." });
  }
  const already = entryId ? await prisma.receipt.count({ where: { entryId } }) : 0;
  if (already + files.length > RECEIPTS_PER_LINE) return json(400, { error: `A line holds up to ${RECEIPTS_PER_LINE} receipts.` });

  const saved: Array<{ id: string; fileName: string; contentType: string; size: number }> = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (file.size > RECEIPT_MAX_BYTES) {
      rejected.push(`${file.name}: over 4 MB`);
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffReceipt(bytes);
    if (!type) {
      rejected.push(`${file.name}: not a JPEG, PNG, WebP, HEIC or PDF`);
      continue;
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (entryId && (await prisma.receipt.findFirst({ where: { entryId, sha256 }, select: { id: true } }))) {
      rejected.push(`${file.name}: already attached`);
      continue;
    }
    const r = await prisma.receipt.create({
      data: { entryId, fileName: cleanFileName(file.name, type), contentType: type, size: bytes.length, sha256, data: bytes, uploadedById: user.id },
      select: { id: true, fileName: true, contentType: true, size: true },
    });
    saved.push(r);
  }
  if (saved.length) await audit(user.id, "books.receipt.upload", "ledger", entryId ?? "pending", { files: saved.length });
  return json(saved.length ? 200 : 400, { receipts: saved, rejected, error: saved.length ? undefined : rejected.join("; ") });
}
