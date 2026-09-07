"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPin } from "@/lib/listings";
import { money, typeLabel } from "@/lib/site";

function priceIcon(allIn: number, active: boolean) {
  return L.divIcon({
    className: active ? "rl-price-pin is-on" : "rl-price-pin",
    html: `<span>${money(allIn)}</span>`,
    iconSize: [78, 32],
    iconAnchor: [39, 32],
  });
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const node = map.getContainer();
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(node);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function FitPins({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const key = pins.map((pin) => pin.id).join(",");
  useEffect(() => {
    map.invalidateSize();
    if (!pins.length) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(pins.map((pin) => [pin.lat, pin.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
  }, [map, key, pins]);
  return null;
}

export default function ListingMapInner({
  pins,
  selectedId,
  zoom = 4,
  className = "",
  onHover,
  onSelect,
}: {
  pins: MapPin[];
  selectedId?: string;
  zoom?: number;
  className?: string;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
}) {
  const center: [number, number] = pins[0] ? [pins[0].lat, pins[0].lng] : [40.7128, -74.006];
  const icons = useMemo(
    () => Object.fromEntries(pins.map((pin) => [pin.id, priceIcon(pin.allIn, pin.id === selectedId)])),
    [pins, selectedId],
  );

  return (
    <div className={`rl-map ${className}`.trim()}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="rl-map__canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ResizeMap />
        <FitPins pins={pins} />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={icons[pin.id]}
            eventHandlers={{
              click: () => onSelect?.(pin.id),
              mouseover: () => onHover?.(pin.id),
              mouseout: () => onHover?.(null),
            }}
          >
            <Popup>
              <a className="rl-map-pop" href={pin.href}>
                <img src={pin.image} alt="" />
                <strong>{pin.title}</strong>
                <span>
                  {typeLabel(pin.housingType)} · {pin.neighborhood}, {pin.cityName}
                </span>
                <em>{money(pin.allIn)} all-in /mo</em>
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
