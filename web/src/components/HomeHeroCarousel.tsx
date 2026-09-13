"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BrowseListing, GalleryItem } from "@/lib/listings";
import { money, typeLabel } from "@/lib/site";

const SLIDE_MS = 6000;

function slideMedia(listing: BrowseListing, index: number): GalleryItem {
  const video = listing.gallery.find((item) => item.kind === "video");
  if (index % 3 === 1 && video) return video;
  return {
    kind: "photo",
    src: listing.image,
    caption: "Main photo",
    alt: `${listing.title} in ${listing.neighborhood}, ${listing.cityName}`,
  };
}

function SlideMedia({ item, active }: { item: GalleryItem; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || item.kind !== "video") return;
    if (active) {
      const play = node.play();
      if (play) play.catch(() => undefined);
      return;
    }
    node.pause();
  }, [active, item.kind]);

  switch (item.kind) {
    case "photo":
      return <img className="rl-hero-car__media" src={item.src} alt={item.alt} width={1920} height={1080} />;
    case "video":
      return (
        <video
          ref={videoRef}
          className="rl-hero-car__media"
          src={item.src}
          poster={item.poster}
          muted
          playsInline
          loop
          preload="none"
          aria-label={item.alt}
        />
      );
    default: {
      const _never: never = item;
      return _never;
    }
  }
}

export function HomeHeroCarousel({ slides }: { slides: BrowseListing[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setPaused(!entry.isIntersecting || document.hidden));
      },
      { threshold: 0.25 },
    );
    observer.observe(host);
    function onVisibility() {
      setPaused(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!slides.length) return null;

  function go(next: number) {
    setIndex((next + slides.length) % slides.length);
  }

  return (
    <div
      ref={hostRef}
      className="rl-hero-carousel"
      aria-label="Featured homes"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(index - 1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(index + 1);
        }
      }}
      onTouchStart={(event) => {
        touchX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touchX.current == null) return;
        const dx = event.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="rl-hero-car" role="group" aria-roledescription="carousel" aria-label="Featured homes">
        <div className="rl-hero-car__stage">
          {slides.map((listing, i) => {
            const media = slideMedia(listing, i);
            const on = i === index;
            return (
              <figure
                key={listing.id}
                className={on ? "rl-hero-car__slide is-active" : "rl-hero-car__slide"}
                aria-hidden={on ? undefined : true}
              >
                <SlideMedia item={media} active={on} />
                {media.kind === "video" ? <span className="rl-hero-car__kind">Video tour</span> : null}
                <span className="rl-hero-car__shade" aria-hidden="true" />
                <figcaption className="rl-hero-car__cap">
                  <span className="rl-hero-car__badge">
                    {typeLabel(listing.housingType)} · {listing.cityName}
                  </span>
                  <Link className="rl-hero-car__title" href={`/listings/${listing.id}`} tabIndex={on ? 0 : -1}>
                    {listing.title}
                  </Link>
                  <span className="rl-hero-car__price">
                    {money(listing.allIn)}
                    <em>all-in /mo</em>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
        <button type="button" className="rl-hero-car__nav rl-hero-car__nav--prev" aria-label="Previous home" onClick={() => go(index - 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button type="button" className="rl-hero-car__nav rl-hero-car__nav--next" aria-label="Next home" onClick={() => go(index + 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <div className="rl-hero-car__dots" role="tablist" aria-label="Choose a featured home">
          {slides.map((listing, i) => (
            <button
              key={listing.id}
              type="button"
              className={i === index ? "rl-hero-car__dot is-on" : "rl-hero-car__dot"}
              role="tab"
              aria-selected={i === index}
              aria-label={`${listing.cityName} — ${listing.title}`}
              onClick={() => go(i)}
            >
              <i />
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {slides[index]?.title}, {slides[index]?.cityName} — slide {index + 1} of {slides.length}
        </p>
      </div>
    </div>
  );
}
