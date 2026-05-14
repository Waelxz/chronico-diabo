'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MapPin } from '@/components/map/VectorMap';
import type { RankedHotel } from '@/lib/hotel-scorer';

const TUNIS = { lat: 36.8065, lon: 10.1815 };
const VectorMap = dynamic(
  () => import('@/components/map/VectorMap').then((mod) => mod.VectorMap),
  { ssr: false },
);

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
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
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
        err instanceof Error ? err.message : 'Impossible de charger les hôtels',
      );
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }, [center.lat, center.lon, radius]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadHotels();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [loadHotels]);

  const visibleHotels = useMemo(
    () => hotels.filter((hotel) => hotel.score >= minScore),
    [hotels, minScore],
  );

  const mapPins = useMemo<MapPin[]>(
    () =>
      visibleHotels.map((hotel) => ({
        id: hotel.place_id,
        lat: hotel.lat,
        lon: hotel.lon,
        label: hotel.name,
        score: hotel.score,
        distanceMeters: hotel.distanceMeters,
        cuisine: hotel.stars ? `${hotel.stars} étoile${hotel.stars > 1 ? 's' : ''}` : 'Hébergement',
        selected: selectedPlaceId === hotel.place_id,
      })),
    [selectedPlaceId, visibleHotels],
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
    <div className="space-y-5">
      <section
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="Filtres hôtels"
      >
        <div className="min-w-40 space-y-2">
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
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value={1000}>1 km</option>
            <option value={2000}>2 km</option>
            <option value={3500}>3,5 km</option>
            <option value={5000}>5 km</option>
          </select>
        </div>

        <div className="min-w-44 flex-1 space-y-2">
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
            Minimum {formatScore(minScore)}
          </p>
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-emerald-700"
        >
          Utiliser ma position
        </button>
      </section>

      <VectorMap
        center={center}
        pins={mapPins}
        onSelect={setSelectedPlaceId}
        className="h-96 overflow-hidden rounded-xl shadow-md"
      />

      <section className="space-y-4" aria-label="Liste des hôtels">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Hôtels classés
          </h2>
          <button
            type="button"
            onClick={() => void loadHotels()}
            disabled={loading}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-all duration-150 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleHotels.map((hotel) => (
              <HotelCard
                key={hotel.place_id}
                hotel={hotel}
                selected={selectedPlaceId === hotel.place_id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HotelCard({
  hotel,
  selected,
}: {
  hotel: RankedHotel;
  selected: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [scoreReady, setScoreReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setScoreReady(true), 50);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <article
      className={`rounded-lg border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10 dark:border-zinc-800/60 dark:bg-zinc-900 dark:hover:border-emerald-800 ${
        selected ? 'ring-2 ring-emerald-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {hotel.name}
          </h3>
          <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {hotelTypeLabel(hotel)}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${accessibilityBadgeClass(
            hotel.accessibility,
          )}`}
        >
          {accessibilityLabel(hotel.accessibility)}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-zinc-500 dark:text-zinc-400">
            Score diabète
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">
            {formatScore(hotel.score)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${scoreBarClass(hotel.score)}`}
            style={{ width: scoreReady ? `${hotel.score}%` : '0%' }}
          />
        </div>
      </div>

      <div className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {formatDistance(hotel.distanceMeters)}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={`mt-3 text-left text-sm leading-6 text-zinc-600 dark:text-zinc-300 ${
          expanded ? '' : 'line-clamp-2'
        }`}
      >
        {hotel.rationale}
      </button>

      {hotel.address ? (
        <p className="mt-3 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {hotel.address}
        </p>
      ) : null}
    </article>
  );
}

function hotelTypeLabel(hotel: RankedHotel): string {
  if (hotel.stars) return `${hotel.stars} étoile${hotel.stars > 1 ? 's' : ''}`;
  return 'Hébergement';
}

function accessibilityLabel(accessibility: RankedHotel['accessibility']): string {
  if (accessibility === 'good') return 'Accès favorable';
  if (accessibility === 'moderate') return 'À vérifier';
  return 'Accès inconnu';
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

function scoreBarClass(score: number): string {
  if (score < 40) return 'bg-red-500';
  if (score <= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function formatScore(score: number): string {
  return `${(score / 10).toFixed(1).replace('.', ',')}/10`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
