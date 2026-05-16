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
  userPosition?: { lat: number; lon: number };
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
  userPosition,
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
      activeMarkers = [];
      if (userPosition) {
        const userElement = document.createElement('div');
        userElement.setAttribute('aria-label', 'Votre position');
        userElement.style.width = '18px';
        userElement.style.height = '18px';
        userElement.style.borderRadius = '9999px';
        userElement.style.background = '#2563eb';
        userElement.style.border = '3px solid #ffffff';
        userElement.style.boxShadow =
          '0 0 0 0 rgba(37,99,235,0.55), 0 6px 14px rgba(30,64,175,0.35)';
        userElement.style.animation = 'diabo-user-dot 1.8s ease-out infinite';

        const styleId = 'diabo-user-dot-style';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent =
            '@keyframes diabo-user-dot { 0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.55), 0 6px 14px rgba(30,64,175,0.35); } 70% { box-shadow: 0 0 0 14px rgba(37,99,235,0), 0 6px 14px rgba(30,64,175,0.35); } 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0), 0 6px 14px rgba(30,64,175,0.35); } }';
          document.head.appendChild(style);
        }

        activeMarkers.push(
          new maplibregl.Marker({ element: userElement })
            .setLngLat([userPosition.lon, userPosition.lat])
            .addTo(map),
        );
      }

      activeMarkers.push(...pins.map((pin) => {
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
        const popupContent = createPopupContent(pin, scoreText, distText);

        const popup = new maplibregl.Popup({
          offset: 20,
          closeButton: true,
          maxWidth: '220px',
        }).setDOMContent(popupContent);

        element.addEventListener('click', () => {
          onSelect?.(pin.id);
        });

        return new maplibregl.Marker({ element })
          .setLngLat([pin.lon, pin.lat])
          .setPopup(popup)
          .addTo(map);
      }));
      markersRef.current = activeMarkers;
    });

    return () => {
      cancelled = true;
      activeMarkers.forEach((marker) => marker.remove());
    };
  }, [onSelect, pins, ready, userPosition]);

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

function createPopupContent(
  pin: MapPin,
  scoreText: string,
  distText: string,
): HTMLElement {
  const root = document.createElement('div');
  root.style.fontFamily = 'system-ui,sans-serif';
  root.style.minWidth = '160px';
  root.style.padding = '4px 0';

  const title = document.createElement('p');
  title.style.margin = '0 0 4px';
  title.style.fontSize = '13px';
  title.style.fontWeight = '700';
  title.style.color = '#18181b';
  title.style.lineHeight = '1.3';
  title.textContent = pin.label;
  root.appendChild(title);

  if (pin.cuisine) {
    const cuisine = document.createElement('p');
    cuisine.style.margin = '0 0 6px';
    cuisine.style.fontSize = '11px';
    cuisine.style.color = '#52525b';
    cuisine.textContent = pin.cuisine;
    root.appendChild(cuisine);
  }

  const scoreRow = document.createElement('div');
  scoreRow.style.display = 'flex';
  scoreRow.style.alignItems = 'center';
  scoreRow.style.gap = '6px';
  scoreRow.style.marginBottom = '6px';

  const track = document.createElement('div');
  track.style.flex = '1';
  track.style.height = '6px';
  track.style.borderRadius = '9999px';
  track.style.background = '#e4e4e7';
  track.style.overflow = 'hidden';

  const fill = document.createElement('div');
  fill.style.height = '100%';
  fill.style.width = `${pin.score}%`;
  fill.style.background = scoreColor(pin.score);
  fill.style.borderRadius = '9999px';
  track.appendChild(fill);
  scoreRow.appendChild(track);

  const score = document.createElement('span');
  score.style.fontSize = '11px';
  score.style.fontWeight = '700';
  score.style.color = scoreColor(pin.score);
  score.textContent = `${scoreText}/10`;
  scoreRow.appendChild(score);
  root.appendChild(scoreRow);

  if (distText) {
    const distance = document.createElement('p');
    distance.style.margin = '0';
    distance.style.fontSize = '11px';
    distance.style.color = '#71717a';
    distance.textContent = `Distance : ${distText}`;
    root.appendChild(distance);
  }

  return root;
}
