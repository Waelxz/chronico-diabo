'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RankedHotel } from '@/lib/hotel-scorer';

const TUNIS = { lat: 36.8065, lon: 10.1815 };

type HotelsApiResponse = {
  hotels: RankedHotel[];
  source: 'live' | 'cache';
  warning?: string;
};

export function HotelList() {
  const [center, setCenter] = useState(TUNIS);
  const [radius, setRadius] = useState(2000);
  const [minScore, setMinScore] = useState(0);
  const [hotels, setHotels] = useState<RankedHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHotels = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);

    const params = new URLSearchParams({
      lat: String(center.lat),
      lon: String(center.lon),
      radius: String(radius),
    });

    try {
      const response = await fetch(`/api/places/hotels?${params}`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as HotelsApiResponse;
      if (!response.ok && data.hotels.length === 0) {
        throw new Error(data.warning ?? 'Chargement impossible');
      }
      setHotels(data.hotels);
      setWarning(data.warning ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger les hôtels",
      );
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }, [center.lat, center.lon, radius]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadHotels();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadHotels]);

  const visibleHotels = useMemo(
    () => hotels.filter((hotel) => hotel.score >= minScore),
    [hotels, minScore],
  );

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible dans ce navigateur.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => setError("Impossible d'obtenir votre position."),
      { enableHighAccuracy: true, timeout: 8_000 },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-2">
          <label
            htmlFor="hotel-distance"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Rayon de recherche
          </label>
          <select
            id="hotel-distance"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value={1000}>1 km</option>
            <option value={2000}>2 km</option>
            <option value={3500}>3,5 km</option>
            <option value={5000}>5 km</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="hotel-score"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Score minimum
          </label>
          <input
            id="hotel-score"
            type="range"
            min={0}
            max={100}
            step={10}
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
            className="w-full accent-emerald-600"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Minimum {minScore}/100
          </p>
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Utiliser ma position
        </button>
      </aside>

      <section className="space-y-4" aria-label="Liste des hôtels">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Hôtels classés
          </h2>
          <button
            type="button"
            onClick={() => void loadHotels()}
            disabled={loading}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
          >
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        {warning ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            {warning}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Recherche des hébergements autour de vous...
          </div>
        ) : visibleHotels.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Aucun hôtel trouvé dans cette zone.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleHotels.map((hotel) => (
              <HotelCard key={hotel.place_id} hotel={hotel} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HotelCard({ hotel }: { hotel: RankedHotel }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {hotel.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {hotel.stars
              ? `${'⭐'.repeat(hotel.stars)} · ${hotel.stars} étoiles`
              : 'Étoiles non renseignées'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(
            hotel.score,
          )}`}
        >
          {hotel.score}/100
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${accessibilityBadgeClass(
            hotel.accessibility,
          )}`}
        >
          {accessibilityLabel(hotel.accessibility)}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {formatDistance(hotel.distanceMeters)}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
        {hotel.rationale}
      </p>

      {hotel.address ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {hotel.address}
        </p>
      ) : null}
    </article>
  );
}

function accessibilityLabel(accessibility: RankedHotel['accessibility']): string {
  if (accessibility === 'good') return 'Accessibilité favorable';
  if (accessibility === 'moderate') return 'Accessibilité à vérifier';
  return 'Accessibilité inconnue';
}

function accessibilityBadgeClass(
  accessibility: RankedHotel['accessibility'],
): string {
  if (accessibility === 'good') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  }
  if (accessibility === 'moderate') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  }
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (score >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
