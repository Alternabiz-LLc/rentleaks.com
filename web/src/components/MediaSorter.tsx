"use client";

import { useRef, useState } from "react";

export type MediaKind = "photo" | "video";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  src: string;
  name: string;
  label: string;
  file?: File;
};

const PHOTO_LABELS = [
  "Bedroom",
  "Bathroom",
  "Kitchen",
  "Living room",
  "Workspace",
  "Building",
  "Outdoor",
  "Floor plan",
  "Other",
];

const VIDEO_LABELS = [
  "Walkthrough",
  "Bedroom",
  "Bathroom",
  "Kitchen",
  "Living room",
  "Building",
  "Outdoor",
  "Other",
];

function labelsFor(kind: MediaKind) {
  switch (kind) {
    case "photo":
      return PHOTO_LABELS;
    case "video":
      return VIDEO_LABELS;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function leadFor(kind: MediaKind) {
  switch (kind) {
    case "photo":
      return "Cover";
    case "video":
      return "Lead";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function acceptFor(kind: MediaKind) {
  switch (kind) {
    case "photo":
      return "image/jpeg,image/png,image/webp,image/gif";
    case "video":
      return "video/mp4,video/webm,video/quicktime";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function matches(kind: MediaKind, type: string) {
  switch (kind) {
    case "photo":
      return type.startsWith("image/");
    case "video":
      return type.startsWith("video/");
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ShotMedia({ item }: { item: MediaItem }) {
  switch (item.kind) {
    case "photo":
      return <img src={item.src} alt={item.label} />;
    case "video":
      return <video src={item.src} muted playsInline preload="metadata" />;
    default: {
      const _never: never = item.kind;
      return _never;
    }
  }
}

export function MediaSorter({
  kind,
  items,
  onChange,
  max,
  title,
  blurb,
}: {
  kind: MediaKind;
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  max: number;
  title: string;
  blurb: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const labels = labelsFor(kind);
  const lead = leadFor(kind);

  function addFiles(files: FileList | File[]) {
    const room = Math.max(0, max - items.length);
    const picked = Array.from(files)
      .filter((file) => matches(kind, file.type))
      .slice(0, room);
    if (!picked.length) return;
    onChange([
      ...items,
      ...picked.map((file, index) => ({
        id: newId(),
        kind,
        src: URL.createObjectURL(file),
        name: file.name,
        label: labels[Math.min(items.length + index, labels.length - 1)],
        file,
      })),
    ]);
  }

  function removeAt(index: number) {
    const item = items[index];
    if (item?.src.startsWith("blob:")) URL.revokeObjectURL(item.src);
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="c-media">
      <label
        className={over ? "c-drop is-over" : "c-drop"}
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
        }}
      >
        <b>{title}</b>
        {blurb}
        <input
          ref={inputRef}
          type="file"
          accept={acceptFor(kind)}
          multiple
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {items.length ? (
        <div className="c-shots">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={[
                "c-shot",
                item.kind === "video" ? "c-shot--video" : "",
                dragFrom === index ? "is-dragging" : "",
                target === index ? "is-target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable
              onDragStart={(event) => {
                setDragFrom(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setTarget(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setTarget(index);
              }}
              onDragLeave={() => setTarget((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const from = dragFrom ?? Number(event.dataTransfer.getData("text/plain"));
                onChange(moveItem(items, from, index));
                setDragFrom(null);
                setTarget(null);
              }}
            >
              <ShotMedia item={item} />
              {index === 0 ? <span className="c-shot__flag c-shot__flag--cover">{lead}</span> : null}
              <div className="c-shot__bar" onPointerDown={(event) => event.stopPropagation()}>
                <select
                  value={item.label}
                  aria-label="Room label"
                  onChange={(event) =>
                    onChange(items.map((row, i) => (i === index ? { ...row, label: event.target.value } : row)))
                  }
                >
                  {labels.map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="c-shot__rm"
                  disabled={index === 0}
                  aria-label="Move earlier"
                  onClick={() => onChange(moveItem(items, index, index - 1))}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="c-shot__rm"
                  disabled={index === items.length - 1}
                  aria-label="Move later"
                  onClick={() => onChange(moveItem(items, index, index + 1))}
                >
                  →
                </button>
                {index > 0 ? (
                  <button
                    type="button"
                    className="c-shot__rm"
                    title={`Make this the ${lead.toLowerCase()}`}
                    onClick={() => onChange(moveItem(items, index, 0))}
                  >
                    ★
                  </button>
                ) : null}
                <button type="button" className="c-shot__rm" aria-label="Remove" onClick={() => removeAt(index)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <p className="v-note">
        Drag to reorder — the first is the {lead.toLowerCase()}. Files stay in this browser until you publish.
        {items.length ? ` ${items.length} of ${max}.` : ""}
      </p>
    </div>
  );
}
