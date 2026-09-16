/**
 * Shrinks listing photos in the browser before upload: longest side
 * PHOTO_MAX_EDGE, re-encoded as JPEG at PHOTO_QUALITY. A 3-5 MB phone photo
 * typically becomes 300-500 KB, which keeps storage and page weight low and
 * drops most EXIF (including GPS). Same values as the mobile app's composer.
 *
 * GIFs and videos are left alone, and so is any photo the browser can't
 * decode or that wouldn't get smaller.
 */
export const PHOTO_MAX_EDGE = 1920;
export const PHOTO_QUALITY = 0.8;

const RESIZABLE = /^image\/(jpeg|png|webp)$/i;

export function fitWithin(width: number, height: number, maxEdge = PHOTO_MAX_EDGE) {
  const long = Math.max(width, height);
  if (!(long > maxEdge)) return { width, height };
  const scale = maxEdge / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function shrinkPhoto(file: File): Promise<File> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;
  if (!RESIZABLE.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    /* JPEG has no transparency: put PNG cut-outs on white rather than black. */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = `${file.name.replace(/\.[^./]+$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
