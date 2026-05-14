'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap, Marker } from 'maplibre-gl';

export type MapPin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  score: number;
  selected?: boolean;
};

type Props = {
  center: { lat: number; lon: number };
  zoom?: number;
  pins: MapPin[];
  onSelect?: (id: string) => void;
  className?: string;
};

const MAPLIBRE_CSS_ID = 'maplibre-gl-css';

export function VectorMap({
  center,
  zoom = 13,
  pins,
  onSelect,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!document.getElementById(MAPLIBRE_CSS_ID)) {
      const link = document.createElement('link');
      link.id = MAPLIBRE_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const initialCenter = initialCenterRef.current;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [initialCenter.lon, initialCenter.lat],
        zoom: initialZoomRef.current,
      });
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.easeTo({
      center: [center.lon, center.lat],
      zoom,
      duration: 500,
    });
  }, [center.lat, center.lon, zoom]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    let cancelled = false;
    let activeMarkers: Marker[] = [];

    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !mapRef.current) return;

      const map = mapRef.current;
      markersRef.current.forEach((marker) => marker.remove());
      activeMarkers = pins.map((pin) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = String(Math.round(pin.score));
        element.ariaLabel = pin.label;
        element.style.width = '28px';
        element.style.height = '28px';
        element.style.borderRadius = '9999px';
        element.style.border = pin.selected
          ? '3px solid #10b981'
          : '2px solid rgba(255,255,255,0.9)';
        element.style.background = scoreColor(pin.score);
        element.style.color = '#fff';
        element.style.fontSize = '11px';
        element.style.fontWeight = '700';
        element.style.lineHeight = '1';
        element.style.boxShadow = '0 8px 18px rgba(15,23,42,0.25)';
        element.style.cursor = 'pointer';
        element.addEventListener('click', () => onSelect?.(pin.id));

        return new maplibregl.Marker({ element })
          .setLngLat([pin.lon, pin.lat])
          .addTo(map);
      });
      markersRef.current = activeMarkers;
    });

    return () => {
      cancelled = true;
      activeMarkers.forEach((marker) => marker.remove());
    };
  }, [onSelect, pins, ready]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full bg-zinc-100 dark:bg-zinc-900 ${className ?? ''}`}
      aria-label="Carte des lieux recommandés"
    />
  );
}

function scoreColor(score: number): string {
  if (score < 40) return '#ef4444';
  if (score <= 70) return '#f59e0b';
  return '#10b981';
}
