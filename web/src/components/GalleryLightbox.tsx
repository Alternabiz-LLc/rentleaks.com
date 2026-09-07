"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import type { GalleryItem } from "@/lib/catalog";

function stageMedia(item: GalleryItem) {
  switch (item.kind) {
    case "photo":
      return <img className="rl-lb__img" src={item.src} alt={item.alt} />;
    case "video":
      return (
        <video
          className="rl-lb__video"
          src={item.src}
          poster={item.poster}
          controls
          autoPlay
          playsInline
        />
      );
    default: {
      const _never: never = item;
      return _never;
    }
  }
}

export function GalleryLightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onIndex: (index: number) => void;
}) {
  const labelId = useId();
  const item = items[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("rl-lb-lock");
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove("rl-lb-lock");
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
      if (event.key === "ArrowRight") onIndex((index + 1) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  if (!item || typeof document === "undefined") return null;

  return createPortal(
    <div className="rl-lb is-open">
      <div className="rl-lb__shade" onClick={onClose} />
      <div className="rl-lb__panel" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <button type="button" className="rl-lb__close" onClick={onClose} aria-label="Close gallery">
          Close
        </button>
        <button
          type="button"
          className="rl-lb__nav rl-lb__nav--prev"
          aria-label="Previous"
          onClick={() => onIndex((index - 1 + items.length) % items.length)}
        >
          ‹
        </button>
        <button
          type="button"
          className="rl-lb__nav rl-lb__nav--next"
          aria-label="Next"
          onClick={() => onIndex((index + 1) % items.length)}
        >
          ›
        </button>
        <div className="rl-lb__stage">{stageMedia(item)}</div>
        <div className="rl-lb__meta">
          <p className="rl-lb__count">
            {index + 1} / {items.length}
          </p>
          <p className="rl-lb__cap" id={labelId}>
            {item.caption}
          </p>
        </div>
        <div className="rl-lb__film">
          {items.map((shot, i) => (
            <button
              key={`${shot.kind}-${shot.src}`}
              type="button"
              className={i === index ? "rl-lb__thumb is-on" : "rl-lb__thumb"}
              onClick={() => onIndex(i)}
              aria-label={shot.caption}
            >
              <img src={shot.kind === "video" ? shot.poster || shot.src : shot.src} alt="" />
              {shot.kind === "video" ? <span className="rl-lb__play">▶</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
