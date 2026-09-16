import { redirect } from "next/navigation";

/** Ends a form action by going back to `path` with a message in the URL. */
export function back(path: string, kind: "ok" | "err", message: string): never {
  const [beforeHash, hash = ""] = path.split("#");
  const [p, q = ""] = beforeHash.split("?");
  const params = new URLSearchParams(q);
  params.delete("ok");
  params.delete("err");
  params.set(kind, message.slice(0, 300));
  redirect(`${p}?${params.toString()}${hash ? `#${hash}` : ""}`);
}

export function field(fd: FormData, name: string, max = 500) {
  return String(fd.get(name) ?? "").trim().slice(0, max);
}

export function fields(fd: FormData, name: string) {
  return fd.getAll(name).map((v) => String(v)).filter(Boolean);
}

export function returnTo(fd: FormData, fallback: string) {
  const r = String(fd.get("returnTo") || "");
  return r.startsWith("/admin") ? r : fallback;
}
