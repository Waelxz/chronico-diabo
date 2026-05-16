'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Navigation } from 'lucide-react';
import type { MapPin } from '@/components/map/VectorMap';
import {
  carbTierLabel,
  scoreLabel,
  type CarbLoadTier,
  type RankedRestaurant,
  type RestaurantsApiResponse,
} from '@/lib/restaurants/types';

const TUNIS = { lat: 36.8065, lon: 10.1815 };
const VectorMap = dynamic(
  () => import('@/components/map/VectorMap').then((mod) => mod.VectorMap),
  { ssr: false },
);

type SortKey = 'score' | 'distance' | 'name';
const RADIUS_OPTIONS = [800, 1500, 3000, 5000, 10000, 20000] as const;

export function RestaurantList() {
  const [center, setCenter] = useState(TUNIS);
  const [radius, setRadius] = useState<typeof RADIUS_OPTIONS[number]>(1500);
  const [cuisine, setCuisine] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [restaurants, setRestaurants] = useState<RankedRestaurant[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    const params = new URLSearchParams({
      lat: String(center.lat),
      lon: String(center.lon),
      radius: String(radius),
    });
    if (cuisine) params.set('cuisine', cuisine);

    try {
      const response = await fetch(`/api/places/restaurants?${params}`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as RestaurantsApiResponse;
      if (!response.ok && data.restaurants.length === 0) {
        throw new Error(data.warning ?? 'Chargement impossible');
      }
      setRestaurants(data.restaurants);
      setWarning(data.warning ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les restaurants',
      );
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [center.lat, center.lon, cuisine, radius]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRestaurants();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [loadRestaurants]);

  const cuisineOptions = useMemo(() => {
    const values = new Set<string>();
    restaurants.forEach((restaurant) =>
      restaurant.cuisine.forEach((item) => values.add(item)),
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [restaurants]);

  const visibleRestaurants = useMemo(() => {
    const filtered = restaurants.filter((restaurant) => restaurant.score >= minScore);
    return [...filtered].sort((a, b) => {
      if (sortKey === 'distance') return a.distanceMeters - b.distanceMeters;
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'fr');
      return b.score - a.score || a.distanceMeters - b.distanceMeters;
    });
  }, [minScore, restaurants, sortKey]);

  const mapPins = useMemo<MapPin[]>(
    () =>
      visibleRestaurants.map((restaurant) => ({
        id: restaurant.place_id,
        lat: restaurant.lat,
        lon: restaurant.lon,
        label: restaurant.name,
        score: restaurant.score,
        distanceMeters: restaurant.distanceMeters,
        cuisine: [restaurant.cuisine[0], restaurant.opening_hours].filter(Boolean).join(' · '),
        selected: selectedPlaceId === restaurant.place_id,
      })),
    [selectedPlaceId, visibleRestaurants],
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
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function expandRadius() {
    setRadius(5000);
    if (radius === 5000) {
      void loadRestaurants();
    }
  }

  const radiusIndex = Math.max(0, RADIUS_OPTIONS.indexOf(radius));

  return (
    <div className="space-y-5">
      <section
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="Filtres restaurants"
      >
        <div className="min-w-44 flex-1 space-y-2">
          <label
            htmlFor="cuisine"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Type de cuisine
          </label>
          <input
            id="cuisine"
            list="cuisine-options"
            value={cuisine}
            onChange={(event) => setCuisine(event.target.value)}
            placeholder="Tous"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <datalist id="cuisine-options">
            {cuisineOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div className="min-w-52 flex-1 space-y-2">
          <label
            htmlFor="distance"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Distance
          </label>
          <input
            id="distance"
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

        <div className="min-w-36 space-y-2">
          <label
            htmlFor="sort"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Trier par
          </label>
          <select
            id="sort"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="score">Score</option>
            <option value="distance">Distance</option>
            <option value="name">Nom</option>
          </select>
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
        aria-label="Score minimum restaurants"
      >
        <div className="max-w-sm space-y-2">
          <label
            htmlFor="score"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Score minimum
          </label>
          <input
            id="score"
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

      <VectorMap
        center={center}
        userPosition={center}
        pins={mapPins}
        onSelect={setSelectedPlaceId}
        className="h-96 overflow-hidden rounded-xl shadow-md"
      />

      <section className="space-y-4" aria-label="Liste des restaurants">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Restaurants classés
          </h2>
          <button
            type="button"
            onClick={() => void loadRestaurants()}
            disabled={loading}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-all duration-150 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
          >
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

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
        ) : visibleRestaurants.length === 0 ? (
          <div className="diabo-surface flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Aucun restaurant trouve dans ce rayon.
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
            {visibleRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.place_id}
                restaurant={restaurant}
                selected={selectedPlaceId === restaurant.place_id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RestaurantCard({
  restaurant,
  selected,
}: {
  restaurant: RankedRestaurant;
  selected: boolean;
}) {
  const [scoreReady, setScoreReady] = useState(false);
  const description = restaurantDescription(restaurant);
  const directionsUrl = googleDirectionsUrl(restaurant.lat, restaurant.lon);
  const cuisineLabel = restaurant.cuisine[0] ?? 'Cuisine non renseignée';

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
        alt={restaurant.name}
        photoAttributions={restaurant.photoAttributions}
        photoUrl={restaurant.photoUrl}
      />
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {restaurant.name}
          </h3>
          <span className="mt-2 inline-flex max-w-full rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            <span className="truncate">{cuisineLabel}</span>
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${carbBadgeClass(
            restaurant.carb_load_tier,
          )}`}
        >
          {carbTierLabel(restaurant.carb_load_tier)}
        </span>
      </div>

      <div className="mt-4 space-y-2 px-4">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-zinc-500 dark:text-zinc-400">
            Score diabète
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatScore(restaurant.score)}
            </span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${scoreBarClass(restaurant.score) === 'bg-emerald-500' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : scoreBarClass(restaurant.score) === 'bg-amber-500' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
              {scoreLabel(restaurant.score)}
            </span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${scoreBarClass(restaurant.score)}`}
            style={{ width: scoreReady ? `${restaurant.score}%` : '0%' }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-4 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {formatDistance(restaurant.distanceMeters)}
        </span>
        {restaurant.opening_hours ? (
          <span className="truncate pl-3 text-xs text-emerald-700 dark:text-emerald-300">
            🕐 {restaurant.opening_hours}
          </span>
        ) : null}
      </div>

      {restaurant.address ? (
        <p className="mt-1 truncate px-4 text-xs text-zinc-400 dark:text-zinc-500">
          📍 {restaurant.address}
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

function restaurantDescription(restaurant: RankedRestaurant): string | null {
  if (restaurant.description) return truncateText(restaurant.description, 120);
  const cuisine = restaurant.cuisine[0]?.trim();
  if (!cuisine) return null;
  return `Cuisine: ${cuisine}. Charge glucidique: ${carbTierLabel(
    restaurant.carb_load_tier,
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

function scoreBarClass(score: number): string {
  if (score < 40) return 'bg-red-500';
  if (score <= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function carbBadgeClass(tier: CarbLoadTier): string {
  if (tier === 'low') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  }
  if (tier === 'medium') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  }
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
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
