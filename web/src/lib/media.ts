export function isPublicMediaSrc(value: string) {
  return /^https:\/\//i.test(value) || /^\/uploads\/[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(value);
}

export function sanitiseMediaUrls(input: unknown, limit: number) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(isPublicMediaSrc)
    .slice(0, limit);
}

export function mediaFromDetail(detail: unknown) {
  if (!detail || typeof detail !== "object") return { photos: [] as string[], videos: [] as string[] };
  const data = detail as Record<string, unknown>;
  const photos = sanitiseMediaUrls(data.photos, 24);
  const videos = sanitiseMediaUrls(data.videos, 8);
  const fallback =
    typeof data.videoUrl === "string" && isPublicMediaSrc(data.videoUrl) ? [data.videoUrl] : [];
  return { photos, videos: videos.length ? videos : fallback };
}

export async function persistMediaFiles(
  items: Array<{ src: string; file?: File }>,
): Promise<string[]> {
  const urls: string[] = [];
  for (const item of items) {
    if (item.file) {
      const body = new FormData();
      body.append("file", item.file);
      const res = await fetch("/api/media", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Could not save a photo or video. Try a smaller file.");
      }
      urls.push(data.url);
      continue;
    }
    if (isPublicMediaSrc(item.src)) urls.push(item.src);
  }
  return urls;
}
