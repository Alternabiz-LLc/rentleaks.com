"use client";

import { useState } from "react";
import type { GalleryItem } from "@/lib/catalog";
import { GalleryLightbox } from "./GalleryLightbox";

export function ListingGallery({ items }: { items: GalleryItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const photos = items.filter((item) => item.kind === "photo");
  const video = items.find((item) => item.kind === "video");
  const show = photos.slice(0, 4);
  const videoIndex = video ? items.indexOf(video) : 0;

  return (
    <>
      <div className="rl-mosaic">
        {show.map((item, i) => (
          <button
            key={item.src}
            type="button"
            className={i === 0 ? "rl-mosaic__cell rl-mosaic__cell--hero" : "rl-mosaic__cell"}
            onClick={() => setOpenIndex(items.indexOf(item))}
          >
            <img src={item.src} alt={item.alt} width={1400} height={933} />
            <span className="rl-mosaic__label">{item.caption}</span>
          </button>
        ))}
        {video ? (
          <button
            type="button"
            className="rl-mosaic__cell rl-mosaic__cell--video"
            onClick={() => setOpenIndex(videoIndex)}
          >
            <img src={video.poster || video.src} alt={video.alt} />
            <span className="rl-mosaic__play" aria-hidden="true">
              ▶
            </span>
            <span className="rl-mosaic__label">Video tour</span>
          </button>
        ) : null}
        <button type="button" className="rl-mosaic__all" onClick={() => setOpenIndex(0)}>
          Show all {items.length} photos & video
        </button>
      </div>
      {openIndex != null ? (
        <GalleryLightbox
          items={items}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndex={setOpenIndex}
        />
      ) : null}
    </>
  );
}
