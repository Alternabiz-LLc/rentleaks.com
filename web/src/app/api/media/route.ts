import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

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

  const dir = path.join(process.cwd(), "public", "uploads", user.id);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/${user.id}/${name}` });
}
