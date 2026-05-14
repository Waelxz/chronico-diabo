'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  carbTierLabel,
  scoreLabel,
  type RankedRestaurant,
} from '@/lib/restaurants/types';

type RestaurantMapProps = {
  restaurants: RankedRestaurant[];
  center: { lat: number; lon: number };
  selectedPlaceId?: string | null;
  onSelect?: (placeId: string) => void;
};

type LeafletMap = {
  setView: (coords: [number, number], zoom: number) => void;
  remove: () => void;
};

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
  remove: () => void;
  bindPopup?: (html: string) => LeafletLayer;
  on?: (event: string, handler: () => void) => LeafletLayer;
  openPopup?: () => void;
};

type LeafletApi = {
  map: (element: HTMLElement, options: { zoomControl: boolean }) => LeafletMap;
  tileLayer: (
    url: string,
    options: { attribution: string; maxZoom: number },
  ) => LeafletLayer;
  marker: (
    coords: [number, number],
    options: { icon: unknown; title: string },
  ) => LeafletLayer;
  divIcon: (options: {
    className: string;
    html: string;
    iconSize: [number, number];
    iconAnchor: [number, number];
    popupAnchor: [number, number];
  }) => unknown;
};

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

const LEAFLET_CSS_ID = 'leaflet-css';
const LEAFLET_SCRIPT_ID = 'leaflet-script';

export function RestaurantMap({
  restaurants,
  center,
  selectedPlaceId,
  onSelect,
}: RestaurantMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletLayer>>(new Map());
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (!cancelled) setLeafletReady(true);
      })
      .catch((err) => console.warn('[RestaurantMap] Leaflet failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!leafletReady || !containerRef.current || !window.L || mapRef.current) {
      return;
    }
    const map = window.L.map(containerRef.current, { zoomControl: true });
    window.L
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      })
      .addTo(map);
    map.setView([center.lat, center.lon], 14);
    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lon, leafletReady]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = window.L;
    if (!map || !leaflet) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    map.setView([center.lat, center.lon], restaurants.length > 0 ? 14 : 13);

    restaurants.forEach((restaurant) => {
      const marker = leaflet
        .marker([restaurant.lat, restaurant.lon], {
          icon: leaflet.divIcon({
            className: 'diabo-score-marker',
            html: markerHtml(restaurant.score, restaurant.place_id === selectedPlaceId),
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18],
          }),
          title: restaurant.name,
        })
        .bindPopup?.(popupHtml(restaurant))
        .addTo(map);
      marker?.on?.('click', () => onSelect?.(restaurant.place_id));
      if (marker) markersRef.current.set(restaurant.place_id, marker);
    });
  }, [center.lat, center.lon, onSelect, restaurants, selectedPlaceId]);

  useEffect(() => {
    const selected = selectedPlaceId ? markersRef.current.get(selectedPlaceId) : null;
    selected?.openPopup?.();
  }, [selectedPlaceId]);

  const fallback = useMemo(
    () =>
      restaurants.map((restaurant) => (
        <button
          key={restaurant.place_id}
          type="button"
          onClick={() => onSelect?.(restaurant.place_id)}
          className="text-left text-xs text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          {restaurant.name} · {restaurant.score}/100
        </button>
      )),
    [onSelect, restaurants],
  );

  return (
    <section className="flex min-h-[30rem] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Restaurants adaptés au diabète
        </h2>
      </header>
      <div className="relative min-h-[26rem] flex-1">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        {!leafletReady ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Chargement de la carte…
          </div>
        ) : null}
        {leafletReady && restaurants.length === 0 ? (
          <div className="absolute inset-x-4 top-4 z-10 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            Aucun restaurant trouvé dans cette zone
          </div>
        ) : null}
        {!leafletReady && restaurants.length > 0 ? (
          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            {fallback}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();

  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(LEAFLET_SCRIPT_ID) as
      | HTMLScriptElement
      | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function markerHtml(score: number, selected: boolean): string {
  const color = markerColor(score);
  const ring = selected ? 'box-shadow:0 0 0 4px rgba(14,165,233,.35);' : '';
  return `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:${color};color:white;border:2px solid white;font:700 12px system-ui;${ring}">${Math.round(score)}</span>`;
}

function popupHtml(restaurant: RankedRestaurant): string {
  return [
    `<strong>${escapeHtml(restaurant.name)}</strong>`,
    `<br/>Score: ${restaurant.score}/100 · ${scoreLabel(restaurant.score)}`,
    `<br/>${carbTierLabel(restaurant.carb_load_tier)}`,
    `<br/><span>${escapeHtml(restaurant.rationale)}</span>`,
  ].join('');
}

function markerColor(score: number): string {
  if (score >= 80) return '#059669';
  if (score >= 60) return '#65a30d';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
