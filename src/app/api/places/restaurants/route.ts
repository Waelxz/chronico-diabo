import { NextResponse, type NextRequest } from 'next/server';
import { ensureRecoCacheIndexes, listCachedRestaurantsNear } from '@/lib/db/restaurants';
import { fetchRestaurantsNear, OverpassTimeoutError } from '@/lib/overpass';
import { rankRestaurants } from '@/lib/restaurant-scorer';
import type { RestaurantsApiResponse } from '@/lib/restaurants/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_RADIUS = 1_500;
const MAX_RADIUS = 20_000;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = parseCoordinate(params.get('lat'));
  const lon = parseCoordinate(params.get('lon'));
  const radius = parseRadius(params.get('radius'));
  const cuisine = params.get('cuisine')?.trim() || undefined;

  if (lat === null || lon === null) {
    return NextResponse.json(
      { error: 'lat et lon sont obligatoires' },
      { status: 400 },
    );
  }

  await ensureRecoCacheIndexes().catch((err) =>
    console.warn('[restaurants-api] ensure indexes failed:', err),
  );

  try {
    const liveRestaurants = await fetchRestaurantsNear({
      lat,
      lon,
      radius,
      cuisine,
    });
    const restaurants = await rankRestaurants({
      restaurants: liveRestaurants,
      userLat: lat,
      userLon: lon,
    });
    return NextResponse.json({
      restaurants,
      source: 'live',
    } satisfies RestaurantsApiResponse);
  } catch (err) {
    const cached = await listCachedRestaurantsNear({
      lat,
      lon,
      radius,
      cuisine,
    });
    const isTimeout = err instanceof OverpassTimeoutError;
    if (cached.length > 0) {
      return NextResponse.json({
        restaurants: cached,
        source: 'cache',
        warning: isTimeout
          ? 'Overpass a expiré; résultats chargés depuis le cache.'
          : 'Overpass est indisponible; résultats chargés depuis le cache.',
      } satisfies RestaurantsApiResponse);
    }

    console.error('[restaurants-api] failed without cache:', err);
    return NextResponse.json(
      {
        restaurants: [],
        source: 'cache',
        warning: isTimeout
          ? 'Overpass a expiré et aucun cache local ne correspond à cette zone.'
          : 'Impossible de charger les restaurants pour cette zone.',
      } satisfies RestaurantsApiResponse,
      { status: isTimeout ? 504 : 502 },
    );
  }
}

function parseCoordinate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRadius(value: string | null): number {
  if (!value) return DEFAULT_RADIUS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RADIUS;
  return Math.min(Math.round(parsed), MAX_RADIUS);
}
