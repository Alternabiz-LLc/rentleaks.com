"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "@/lib/listing-shapes";

const ListingMapInner = dynamic(() => import("./ListingMapInner"), {
  ssr: false,
  loading: () => <div className="rl-map-skel">Loading map…</div>,
});

export function ListingMap(props: {
  pins: MapPin[];
  selectedId?: string;
  zoom?: number;
  className?: string;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
}) {
  return <ListingMapInner {...props} />;
}
