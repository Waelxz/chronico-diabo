import 'server-only';
import { fetchGoogleRestaurantsNear } from '@/lib/places/google-places';
import type { RestaurantPoi } from '@/lib/restaurants/types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEFAULT_TIMEOUT_MS = 10_000;

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

export class OverpassTimeoutError extends Error {
  constructor() {
    super('[overpass] request timed out');
    this.name = 'OverpassTimeoutError';
  }
}

export async function fetchRestaurantsNear({
  lat,
  lon,
  radius,
  cuisine,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  lat: number;
  lon: number;
  radius: number;
  cuisine?: string;
  timeoutMs?: number;
}): Promise<RestaurantPoi[]> {
  const googleRestaurants = await fetchGoogleRestaurantsNear({
    lat,
    lon,
    radius,
    cuisine,
  }).catch((err) => {
    console.warn('[google-places] restaurants failed, falling back to Overpass:', err);
    return null;
  });
  if (googleRestaurants) return googleRestaurants;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const query = buildRestaurantQuery(lat, lon, radius);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'User-Agent': 'Chronico-Diabo/0.1 restaurants module',
      },
      body: query,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`[overpass] HTTP ${response.status}`);
    }
    const data = (await response.json()) as OverpassResponse;
    return normalizeElements(data.elements ?? [], cuisine);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new OverpassTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildRestaurantQuery(lat: number, lon: number, radius: number): string {
  return `
[out:json][timeout:12];
(
  node["amenity"="restaurant"](around:${Math.round(radius)},${lat},${lon});
  way["amenity"="restaurant"](around:${Math.round(radius)},${lat},${lon});
  relation["amenity"="restaurant"](around:${Math.round(radius)},${lat},${lon});
);
out center tags 60;
`;
}

function normalizeElements(
  elements: OverpassElement[],
  cuisineFilter?: string,
): RestaurantPoi[] {
  const seen = new Set<string>();
  const normalized: RestaurantPoi[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const cuisine = parseCuisine(tags.cuisine);
    if (cuisineFilter && !matchesCuisine(cuisine, cuisineFilter)) continue;

    const place_id = `${element.type}/${element.id}`;
    if (seen.has(place_id)) continue;
    seen.add(place_id);

    normalized.push({
      place_id,
      name: tags.name?.trim() || 'Restaurant sans nom',
      cuisine,
      lat,
      lon,
      address: formatAddress(tags),
      opening_hours: tags.opening_hours,
    });
  }

  return normalized;
}

function parseCuisine(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesCuisine(cuisine: string[], filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  return cuisine.some((item) => item.toLowerCase().includes(needle));
}

function formatAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : undefined;
}
