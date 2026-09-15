/**
 * Upload storage for the app. Same rules and the same public path shape as
 * /api/media (so lib/media.ts's `isPublicMediaSrc` accepts the result); kept
 * separate because that route authenticates by cookie and this one by token.
 *
 * Local disk is a development store. Before launch, swap `saveUpload` for an
 * object store (S3 / R2 / Supabase Storage) — see MOBILE-APP.md.
 */
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { HttpError } from "./http";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 64 * 1024 * 1024;

export async function saveUpload(userId: string, file: File) {
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(400, "bad_type", "Use a JPEG, PNG, WebP or HEIC photo, or an MP4/MOV video.");
  const video = file.type.startsWith("video/");
  if (file.size > (video ? VIDEO_MAX : IMAGE_MAX)) {
    throw new HttpError(400, "too_large", video ? "Videos need to be under 64 MB." : "Photos need to be under 8 MB.");
  }
  const safeUser = userId.replace(/[^a-z0-9_-]/gi, "");
  const dir = path.join(process.cwd(), "public", "uploads", safeUser);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${safeUser}/${name}`;
}
