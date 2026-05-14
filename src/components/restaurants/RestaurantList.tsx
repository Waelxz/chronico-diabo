'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RestaurantMap } from '@/components/restaurants/RestaurantMap';
import {
  carbTierLabel,
  scoreLabel,
  type RankedRestaurant,
  type RestaurantsApiResponse,
} from '@/lib/restaurants/types';

const TUNIS = { lat: 36.8065, lon: 10.1815 };

type SortKey = 'score' | 'distance' | 'name';

export function RestaurantList() {
  const [center, setCenter] = useState(TUNIS);
  const [radius, setRadius] = useState(1500);
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
      setSelectedPlaceId(data.restaurants[0]?.place_id ?? null);
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
    }, 0);
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
    return filtered.toSorted((a, b) => {
      if (sortKey === 'distance') return a.distanceMeters - b.distanceMeters;
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'fr');
      return b.score - a.score || a.distanceMeters - b.distanceMeters;
    });
  }, [minScore, restaurants, sortKey]);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-2">
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
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <datalist id="cuisine-options">
            {cuisineOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="distance"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Distance
          </label>
          <select
            id="distance"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value={800}>800 m</option>
            <option value={1500}>1,5 km</option>
            <option value={3000}>3 km</option>
            <option value={5000}>5 km</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="score"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
          >
            Score
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
            Minimum {minScore}/100
          </p>
        </div>

        <div className="space-y-2">
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
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="score">Score</option>
            <option value="distance">Distance</option>
            <option value="name">Nom</option>
          </select>
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Utiliser ma position
        </button>
      </aside>

      <div className="space-y-4">
        <RestaurantMap
          restaurants={visibleRestaurants}
          center={center}
          selectedPlaceId={selectedPlaceId}
          onSelect={setSelectedPlaceId}
        />

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

        <section className="space-y-3" aria-label="Liste des restaurants">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Restaurants classés
            </h2>
            <button
              type="button"
              onClick={() => void loadRestaurants()}
              disabled={loading}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
            >
              {loading ? 'Chargement…' : 'Actualiser'}
            </button>
          </div>

          {loading ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Recherche des restaurants autour de vous…
            </div>
          ) : visibleRestaurants.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Aucun restaurant trouvé dans cette zone
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.place_id}
                  restaurant={restaurant}
                  selected={restaurant.place_id === selectedPlaceId}
                  onSelect={() => setSelectedPlaceId(restaurant.place_id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RestaurantCard({
  restaurant,
  selected,
  onSelect,
}: {
  restaurant: RankedRestaurant;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm transition dark:bg-zinc-950 ${
        selected
          ? 'border-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {restaurant.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {restaurant.cuisine.length > 0
              ? restaurant.cuisine.join(', ')
              : 'Cuisine non renseignée'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(
            restaurant.score,
          )}`}
        >
          {restaurant.score}/100
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {scoreLabel(restaurant.score)}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {carbTierLabel(restaurant.carb_load_tier)}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {formatDistance(restaurant.distanceMeters)}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
        {restaurant.rationale}
      </p>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 rounded-md border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
      >
        Voir sur la carte
      </button>
    </article>
  );
}

function badgeClass(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (score >= 60) return 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-200';
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
