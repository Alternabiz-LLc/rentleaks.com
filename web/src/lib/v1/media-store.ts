/**
 * Upload rules for the app. Same checks as /api/media; kept separate because
 * that route authenticates by cookie and this one by token. Where the bytes go
 * (object store or local disk) is decided in lib/storage.
 */
import { StorageNotConfigured, storeUpload } from "@/lib/storage";
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
  try {
    return await storeUpload(userId, Buffer.from(await file.arrayBuffer()), file.type, ext);
  } catch (err) {
    if (err instanceof StorageNotConfigured) throw new HttpError(503, "uploads_unavailable", err.message);
    throw err;
  }
}
