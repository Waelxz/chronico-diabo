'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap, Marker } from 'maplibre-gl';

export type MapPin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  score: number;
  distanceMeters?: number;
  cuisine?: string;
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
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [initialCenter.lon, initialCenter.lat],
        zoom: initialZoomRef.current,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }));
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
        element.ariaLabel = pin.label;

        const size = pin.selected ? '40px' : '34px';
        const scoreText = (pin.score / 10).toFixed(1);
        element.style.width = size;
        element.style.height = size;
        element.style.borderRadius = '9999px';
        element.style.border = pin.selected
          ? '3px solid #10b981'
          : '2px solid rgba(255,255,255,0.95)';
        element.style.background = scoreColor(pin.score);
        element.style.color = '#fff';
        element.style.fontSize = pin.selected ? '12px' : '11px';
        element.style.fontWeight = '700';
        element.style.lineHeight = '1';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.boxShadow = pin.selected
          ? '0 0 0 4px rgba(16,185,129,0.25), 0 8px 20px rgba(15,23,42,0.35)'
          : '0 4px 12px rgba(15,23,42,0.25)';
        element.style.cursor = 'pointer';
        element.style.transition = 'all 0.2s ease';
        element.textContent = scoreText;

        const distText = pin.distanceMeters != null
          ? pin.distanceMeters < 1000
            ? `${pin.distanceMeters} m`
            : `${(pin.distanceMeters / 1000).toFixed(1)} km`
          : '';
        const popupHTML = `
          <div style="font-family:system-ui,sans-serif;min-width:160px;padding:4px 0">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#18181b;line-height:1.3">${pin.label}</p>
            ${pin.cuisine ? `<p style="margin:0 0 6px;font-size:11px;color:#52525b">${pin.cuisine}</p>` : ''}
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <div style="flex:1;height:6px;border-radius:9999px;background:#e4e4e7;overflow:hidden">
                <div style="height:100%;width:${pin.score}%;background:${scoreColor(pin.score)};border-radius:9999px"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:${scoreColor(pin.score)}">${scoreText}/10</span>
            </div>
            ${distText ? `<p style="margin:0;font-size:11px;color:#71717a">📍 ${distText}</p>` : ''}
          </div>`;

        const popup = new maplibregl.Popup({
          offset: 20,
          closeButton: true,
          maxWidth: '220px',
        }).setHTML(popupHTML);

        element.addEventListener('click', () => {
          onSelect?.(pin.id);
        });

        return new maplibregl.Marker({ element })
          .setLngLat([pin.lon, pin.lat])
          .setPopup(popup)
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
      className={`w-full bg-zinc-100 dark:bg-zinc-900 ${className ?? ''}`}
      aria-label="Carte des lieux recommandés"
    />
  );
}

function scoreColor(score: number): string {
  if (score < 40) return '#ef4444';
  if (score <= 70) return '#f59e0b';
  return '#10b981';
}
