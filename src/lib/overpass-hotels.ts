import 'server-only';
import { fetchGoogleHotelsNear } from '@/lib/places/google-places';

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

export interface HotelPoi {
  place_id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  stars?: number;
  website?: string;
  wheelchair?: string;
  description?: string;
  photoUrl?: string;
  photoAttributions?: string[];
}

export class HotelOverpassTimeoutError extends Error {
  constructor() {
    super('[overpass-hotels] request timed out');
    this.name = 'HotelOverpassTimeoutError';
  }
}

export async function fetchHotelsNear({
  lat,
  lon,
  radius,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  lat: number;
  lon: number;
  radius: number;
  timeoutMs?: number;
}): Promise<HotelPoi[]> {
  const googleHotels = await fetchGoogleHotelsNear({ lat, lon, radius }).catch(
    (err) => {
      console.warn('[google-places] hotels failed, falling back to Overpass:', err);
      return null;
    },
  );
  if (googleHotels) return googleHotels;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const query = buildHotelQuery(lat, lon, radius);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'User-Agent': 'Chronico-Diabo/0.1 hotels module',
      },
      body: query,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`[overpass-hotels] HTTP ${response.status}`);
    }
    const data = (await response.json()) as OverpassResponse;
    return normalizeElements(data.elements ?? []);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new HotelOverpassTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildHotelQuery(lat: number, lon: number, radius: number): string {
  return `
[out:json][timeout:12];
(
  node["tourism"~"^(hotel|hostel|guest_house)$"](around:${Math.round(radius)},${lat},${lon});
  way["tourism"~"^(hotel|hostel|guest_house)$"](around:${Math.round(radius)},${lat},${lon});
  relation["tourism"~"^(hotel|hostel|guest_house)$"](around:${Math.round(radius)},${lat},${lon});
  node["amenity"="hotel"](around:${Math.round(radius)},${lat},${lon});
  way["amenity"="hotel"](around:${Math.round(radius)},${lat},${lon});
  relation["amenity"="hotel"](around:${Math.round(radius)},${lat},${lon});
);
out center tags 80;
`;
}

function normalizeElements(elements: OverpassElement[]): HotelPoi[] {
  const seen = new Set<string>();
  const normalized: HotelPoi[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const place_id = `${element.type}/${element.id}`;
    if (seen.has(place_id)) continue;
    seen.add(place_id);

    normalized.push({
      place_id,
      name: tags.name?.trim() || 'Hébergement sans nom',
      lat,
      lon,
      address: formatAddress(tags),
      stars: parseStars(tags.stars),
      website: tags.website?.trim() || tags['contact:website']?.trim() || undefined,
      wheelchair: tags.wheelchair?.trim() || undefined,
    });
  }

  return normalized;
}

function parseStars(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
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
