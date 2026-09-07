"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import type { BrowseListing } from "@/lib/listings";
import { formatDate, listingSpecs, money, remainingMonths, typeLabel } from "@/lib/site";
import { GalleryLightbox } from "./GalleryLightbox";

const SAVED_KEY = "rl-saved";

function readSaved() {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function ListingCard({
  listing,
  active,
  onHover,
}: {
  listing: BrowseListing;
  active?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const clock = remainingMonths(listing.title, listing.housingType, listing.minStayMonths);
  const extras = [
    listing.verified ? "Verified" : null,
    listing.noFee ? "No fee" : null,
    listing.furnishedLevel === "fully" ? "Furnished" : listing.furnishedLevel === "partial" ? "Partial furniture" : null,
    listing.amenities.includes("workspace") ? "Workspace" : null,
  ].filter(Boolean).slice(0, 3);
  const photos = listing.gallery.filter((item) => item.kind === "photo");
  const hasVideo = listing.gallery.some((item) => item.kind === "video");
  const thumbs = photos.slice(1, 4);

  useEffect(() => {
    setSaved(readSaved().includes(listing.id));
  }, [listing.id]);

  function toggleSave(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = readSaved().includes(listing.id)
      ? readSaved().filter((id) => id !== listing.id)
      : [...readSaved(), listing.id];
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(listing.id));
  }

  function openGallery(index: number) {
    setOpenIndex(index);
  }

  return (
    <article
      id={`stay-${listing.id}`}
      className={active ? "rl-stay is-on" : "rl-stay"}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="rl-stay__media">
        <button
          type="button"
          className="rl-stay__hero"
          onClick={() => openGallery(0)}
          aria-label={`Open gallery for ${listing.title}`}
        >
          <img src={listing.image} alt={`${listing.title} in ${listing.neighborhood}, ${listing.cityName}`} />
        </button>
        {thumbs.length ? (
          <div className="rl-stay__thumbs">
            {thumbs.map((shot) => (
              <button
                key={shot.src}
                type="button"
                className="rl-stay__thumb"
                onClick={() => openGallery(listing.gallery.indexOf(shot))}
                aria-label={shot.caption}
              >
                <img src={shot.src} alt="" />
              </button>
            ))}
          </div>
        ) : null}
        <span className="rl-stay__badge">{typeLabel(listing.housingType)}</span>
        {clock ? <span className="rl-clock">{clock} mo left</span> : null}
        {hasVideo ? <span className="rl-stay__vid">Video</span> : null}
        {photos.length > 1 ? (
          <button type="button" className="rl-stay__shots" onClick={() => openGallery(0)}>
            {photos.length} photos
          </button>
        ) : null}
      </div>
      <Link className="rl-stay__body" href={`/listings/${listing.id}`}>
        <p className="rl-stay__price">
          {money(listing.allIn)}
          <span> all-in /mo</span>
        </p>
        <p className="rl-base-rent">Base {money(listing.price)}/mo</p>
        <h2>{listing.title}</h2>
        <p className="rl-stay__where">
          {listing.cityName} · {listing.neighborhood}
        </p>
        <p className="rl-stay__specs">
          {listingSpecs(listing)} · from {formatDate(listing.availableFrom)}
        </p>
        {extras.length ? <p className="rl-card-meta">{extras.join(" · ")}</p> : null}
      </Link>
      <button
        type="button"
        className={saved ? "rl-stay__save is-on" : "rl-stay__save"}
        aria-label={saved ? "Unsave listing" : "Save listing"}
        onClick={toggleSave}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      {openIndex != null ? (
        <GalleryLightbox
          items={listing.gallery}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndex={setOpenIndex}
        />
      ) : null}
    </article>
  );
}
