"use client";

/**
 * Receipt uploader for a ledger line: drop files, pick them, paste a
 * screenshot, or take a photo on a phone. Photos are shrunk in the browser
 * first (smaller, EXIF/GPS dropped). On a new line the uploads wait as hidden
 * `receiptIds` and are attached when the form is saved; on an existing line
 * they attach straight away.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkPhoto } from "@/lib/image-resize";
import { Icon } from "./Icon";

export type ReceiptFile = { id: string; fileName: string; contentType: string; size: number };

type Item = ReceiptFile & { preview?: string; progress?: number; error?: string; key: string };

const MAX = 4 * 1024 * 1024;
const LIMIT = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.pdf";

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function upload(file: File, entryId: string | undefined, onProgress: (p: number) => void) {
  return new Promise<{ receipts?: ReceiptFile[]; rejected?: string[]; error?: string }>((resolve) => {
    const fd = new FormData();
    fd.append("files", file, file.name);
    if (entryId) fd.append("entryId", entryId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/receipts");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve((xhr.response as { receipts?: ReceiptFile[]; error?: string }) ?? { error: `Upload failed (${xhr.status}).` });
    xhr.onerror = () => resolve({ error: "Network error — try again." });
    xhr.send(fd);
  });
}

export function ReceiptDrop({ entryId, existing = [] }: { entryId?: string; existing?: ReceiptFile[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(() => existing.map((r) => ({ ...r, key: r.id })));
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const add = useCallback(
    async (files: File[]) => {
      const room = LIMIT - items.filter((x) => !x.error).length;
      const chosen = files.slice(0, Math.max(0, room));
      if (files.length > chosen.length) {
        setItems((list) => [...list, { key: `limit-${Date.now()}`, id: "", fileName: "", contentType: "", size: 0, error: `Up to ${LIMIT} receipts per line.` }]);
      }
      let attached = false;
      for (const raw of chosen) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const file = raw.type.startsWith("image/") ? await shrinkPhoto(raw) : raw;
        const preview = /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : undefined;
        if (preview) previews.current.push(preview);
        setItems((list) => [...list, { key, id: "", fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size, preview, progress: 0 }]);
        if (file.size > MAX) {
          patch(key, { error: "Over 4 MB — for a PDF, try “reduce file size”; photos are shrunk automatically.", progress: undefined, preview: undefined });
          continue;
        }
        const r = await upload(file, entryId, (p) => patch(key, { progress: p }));
        const saved = r.receipts?.[0];
        if (saved) {
          patch(key, { ...saved, progress: undefined });
          attached = true;
        } else {
          patch(key, { error: r.rejected?.[0] ?? r.error ?? "Upload failed.", progress: undefined, preview: undefined, contentType: "" });
        }
      }
      if (attached && entryId) router.refresh();
    },
    [entryId, items, router],
  );

  const remove = async (it: Item) => {
    if (it.id) {
      const res = await fetch(`/api/admin/receipts/${it.id}`, { method: "DELETE" }).catch(() => null);
      if (!res || !res.ok) {
        patch(it.key, { error: "Couldn't remove it — try again." });
        return;
      }
    }
    setItems((list) => list.filter((x) => x.key !== it.key));
    if (it.id && entryId) router.refresh();
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        void add(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [add]);

  const busy = items.some((x) => x.progress !== undefined);
  const good = items.filter((x) => x.id && !x.error);

  return (
    <div className="dk-receipts">
      <div
        className={`dk-receipts__zone${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void add([...e.dataTransfer.files]);
        }}
      >
        <Icon name="invoice" size={22} />
        <b>{busy ? "Uploading…" : "Drop receipts here"}</b>
        <small>or choose them · paste a screenshot (⌘V) · JPEG, PNG, WebP, HEIC or PDF up to 4 MB</small>
        <div className="dk-receipts__btns">
          <button type="button" className="dk-btn dk-btn--sm" onClick={() => pick.current?.click()}>
            <Icon name="plus" size={13} /> Choose files
          </button>
          <button type="button" className="dk-btn dk-btn--sm dk-receipts__cam" onClick={() => camera.current?.click()}>
            <Icon name="phone" size={13} /> Take a photo
          </button>
        </div>
        <input
          ref={pick}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void add([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void add([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {items.length ? (
        <ul className="dk-receipts__list" aria-live="polite">
          {items.map((it) => (
            <li key={it.key} className={it.error ? "is-error" : undefined}>
              {it.error && !it.fileName ? null : (
                <a
                  className="dk-receipts__thumb"
                  href={it.id ? `/api/admin/receipts/${it.id}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${it.fileName}`}
                  onClick={(e) => !it.id && e.preventDefault()}
                >
                  {it.preview || (it.id && it.contentType.startsWith("image/") && it.contentType !== "image/heic") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private receipt served by an authenticated route
                    <img src={it.preview ?? `/api/admin/receipts/${it.id}`} alt="" />
                  ) : (
                    <span>{it.contentType === "application/pdf" ? "PDF" : it.contentType === "image/heic" ? "HEIC" : it.error ? "!" : "FILE"}</span>
                  )}
                </a>
              )}
              <div>
                <b>{it.fileName || "Not added"}</b>
                {it.error ? <small className="dk-bad">{it.error}</small> : it.progress !== undefined ? <progress max={100} value={it.progress} /> : <small>{size(it.size)}</small>}
              </div>
              {it.id ? (
                <a className="dk-btn dk-btn--ghost dk-btn--sm" href={`/api/admin/receipts/${it.id}?download=1`} aria-label={`Download ${it.fileName}`}>
                  <Icon name="export" size={13} />
                </a>
              ) : null}
              {it.progress === undefined ? (
                <button type="button" className="dk-btn dk-btn--ghost dk-btn--sm" onClick={() => void remove(it)} aria-label={`Remove ${it.fileName || "message"}`}>
                  <Icon name="close" size={13} />
                </button>
              ) : null}
              {!entryId && it.id && !it.error ? <input type="hidden" name="receiptIds" value={it.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {entryId ? null : good.length ? <p className="dk-hint">{good.length === 1 ? "1 receipt is" : `${good.length} receipts are`} ready and will be attached when you save.</p> : null}
    </div>
  );
}
