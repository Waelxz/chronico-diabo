import { NextResponse, type NextRequest } from 'next/server';
import { ensureHotelCacheIndexes, listCachedHotelsNear } from '@/lib/db/hotels';
import { rankHotels } from '@/lib/hotel-scorer';
import {
  fetchHotelsNear,
  HotelOverpassTimeoutError,
} from '@/lib/overpass-hotels';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_RADIUS = 1_500;
const MAX_RADIUS = 20_000;

type HotelsApiResponse = {
  hotels: Awaited<ReturnType<typeof rankHotels>>;
  source: 'live' | 'cache';
  warning?: string;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = parseCoordinate(params.get('lat'));
  const lon = parseCoordinate(params.get('lon'));
  const radius = parseRadius(params.get('radius'));

  if (lat === null || lon === null) {
    return NextResponse.json(
      { error: 'lat et lon sont obligatoires' },
      { status: 400 },
    );
  }

  await ensureHotelCacheIndexes().catch((err) =>
    console.warn('[hotels-api] ensure indexes failed:', err),
  );

  try {
    const liveHotels = await fetchHotelsNear({ lat, lon, radius });
    const hotels = await rankHotels({
      hotels: liveHotels,
      userLat: lat,
      userLon: lon,
    });

    return NextResponse.json({
      hotels,
      source: 'live',
    } satisfies HotelsApiResponse);
  } catch (err) {
    const cached = await listCachedHotelsNear(lat, lon, radius);
    const isTimeout = err instanceof HotelOverpassTimeoutError;

    if (cached.length > 0) {
      return NextResponse.json({
        hotels: cached,
        source: 'cache',
        warning: isTimeout
          ? 'Overpass a expiré; résultats chargés depuis le cache.'
          : 'Overpass est indisponible; résultats chargés depuis le cache.',
      } satisfies HotelsApiResponse);
    }

    console.error('[hotels-api] failed without cache:', err);
    return NextResponse.json(
      {
        hotels: [],
        source: 'cache',
        warning: isTimeout
          ? 'Overpass a expiré et aucun cache local ne correspond à cette zone.'
          : 'Impossible de charger les hôtels pour cette zone.',
      } satisfies HotelsApiResponse,
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
