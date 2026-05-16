import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { getGooglePlacePhotoMediaUrl } from '@/lib/places/google-places';

export const runtime = 'nodejs';

type GooglePhotoMediaResponse = {
  photoUri?: string;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const photoName = params.get('name')?.trim();
  const maxWidthPx = parseDimension(params.get('maxWidthPx'), 640);
  const maxHeightPx = parseDimension(params.get('maxHeightPx'), 360);
  const apiKey = getEnv().GOOGLE_PLACES_API_KEY;

  if (!apiKey || !photoName?.startsWith('places/')) {
    return new Response(null, { status: 404 });
  }

  const response = await fetch(
    getGooglePlacePhotoMediaUrl({
      apiKey,
      maxHeightPx,
      maxWidthPx,
      photoName,
      skipHttpRedirect: true,
    }),
    { cache: 'no-store' },
  );

  if (!response.ok) {
    return new Response(null, { status: response.status });
  }

  const data = (await response.json()) as GooglePhotoMediaResponse;
  if (!data.photoUri) {
    return new Response(null, { status: 404 });
  }

  const photoResponse = await fetch(data.photoUri, { cache: 'no-store' });
  if (!photoResponse.ok) {
    return new Response(null, { status: photoResponse.status });
  }

  const headers = new Headers();
  const contentType = photoResponse.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=86400, s-maxage=86400');

  return new Response(photoResponse.body, {
    status: photoResponse.status,
    headers,
  });
}

function parseDimension(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(4800, Math.round(parsed)));
}
