import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { StorageNotConfigured, storeUpload } from "@/lib/storage";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 64 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });

  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use JPEG, PNG, WebP, GIF, MP4, or WebM." }, { status: 400 });
  }

  const video = file.type.startsWith("video/");
  if (file.size > (video ? VIDEO_MAX : IMAGE_MAX)) {
    return NextResponse.json(
      { error: video ? "Videos need to be under 64 MB." : "Photos need to be under 8 MB." },
      { status: 400 },
    );
  }

  try {
    const url = await storeUpload(user.id, Buffer.from(await file.arrayBuffer()), file.type, ext);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StorageNotConfigured) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("media upload failed", err);
    return NextResponse.json({ error: "Could not save that file. Try again." }, { status: 502 });
  }
}
