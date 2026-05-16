'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Navigation } from 'lucide-react';
import type { MapPin } from '@/components/map/VectorMap';
import type { RankedHotel } from '@/lib/hotel-scorer';

const TUNIS = { lat: 36.8065, lon: 10.1815 };
const VectorMap = dynamic(
  () => import('@/components/map/VectorMap').then((mod) => mod.VectorMap),
  { ssr: false },
);
const RADIUS_OPTIONS = [800, 1500, 3000, 5000, 10000, 20000] as const;

type HotelsApiResponse = {
  hotels: RankedHotel[];
  source: 'live' | 'cache';
  warning?: string;
};

export function HotelList() {
  const [center, setCenter] = useState(TUNIS);
  const [radius, setRadius] = useState<typeof RADIUS_OPTIONS[number]>(1500);
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

  function expandRadius() {
    setRadius(5000);
    if (radius === 5000) {
      void loadHotels();
    }
  }

  const radiusIndex = Math.max(0, RADIUS_OPTIONS.indexOf(radius));

  return (
    <div className="space-y-5">
      <section
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="Filtres hôtels"
      >
        <div className="min-w-52 flex-1 space-y-2">
          <label
            htmlFor="hotel-distance"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Rayon de recherche
          </label>
          <input
            id="hotel-distance"
            type="range"
            min={0}
            max={RADIUS_OPTIONS.length - 1}
            step={1}
            value={radiusIndex}
            onChange={(event) => {
              setRadius(RADIUS_OPTIONS[Number(event.target.value)]);
            }}
            className="w-full accent-emerald-600"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Rayon {formatRadius(radius)}
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

      <section
        className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="Score minimum hotels"
      >
        <div className="max-w-sm space-y-2">
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
      </section>

      <VectorMap
        center={center}
        userPosition={center}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="diabo-skeleton h-24 rounded-xl"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : visibleHotels.length === 0 ? (
          <div className="diabo-surface flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Aucun hotel trouve
            </p>
            <button
              type="button"
              onClick={expandRadius}
              className="diabo-button-secondary"
            >
              Elargir le rayon
            </button>
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
  const [scoreReady, setScoreReady] = useState(false);
  const description = hotelDescription(hotel);
  const directionsUrl = googleDirectionsUrl(hotel.lat, hotel.lon);

  useEffect(() => {
    const timeout = window.setTimeout(() => setScoreReady(true), 50);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <article
      className={`overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10 dark:border-zinc-800/60 dark:bg-zinc-900 dark:hover:border-emerald-800 ${
        selected ? 'ring-2 ring-emerald-500' : ''
      }`}
    >
      <PlacePhoto
        alt={hotel.name}
        photoAttributions={hotel.photoAttributions}
        photoUrl={hotel.photoUrl}
      />
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
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

      <div className="mt-4 space-y-2 px-4">
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

      <div className="mt-4 px-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {formatDistance(hotel.distanceMeters)}
      </div>

      {hotel.address ? (
        <p className="mx-4 mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {hotel.address}
        </p>
      ) : null}

      <div className="mx-4 mb-4 mt-3 space-y-3">
        {description ? (
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {description}
          </p>
        ) : null}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-all duration-150 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
        >
          <Navigation className="size-4" aria-hidden />
          Itinéraire
        </a>
      </div>
    </article>
  );
}

function PlacePhoto({
  alt,
  photoAttributions,
  photoUrl,
}: {
  alt: string;
  photoAttributions?: string[];
  photoUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !failed;

  return (
    <figure>
      {showPhoto ? (
        <Image
          src={photoUrl ?? ''}
          alt={alt}
          width={640}
          height={360}
          className="h-36 w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-zinc-100 text-xs font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          Photo non disponible
        </div>
      )}
      {showPhoto && photoAttributions?.length ? (
        <figcaption className="truncate px-4 pt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
          Photo: {photoAttributions.join(', ')}
        </figcaption>
      ) : null}
    </figure>
  );
}

function hotelDescription(hotel: RankedHotel): string | null {
  if (hotel.description) return truncateText(hotel.description, 120);
  return `Type: ${hotelTypeLabel(hotel)}. Accès: ${accessibilityLabel(
    hotel.accessibility,
  ).toLowerCase()}.`;
}

function googleDirectionsUrl(lat: number, lon: number): string {
  const destination = `${lat},${lon}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination,
  )}`;
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
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

function formatRadius(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  const kilometers = meters / 1000;
  return `${Number.isInteger(kilometers) ? kilometers.toFixed(0) : kilometers.toFixed(1)}km`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
