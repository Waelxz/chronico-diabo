import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { boundingBox, distanceMeters } from '@/lib/geo';
import { getDb } from '@/lib/mongodb';
import type { HotelScore, RankedHotel } from '@/lib/hotel-scorer';
import type { HotelPoi } from '@/lib/overpass-hotels';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
let hotelCacheIndexesPromise: Promise<void> | null = null;

export type HotelCacheDoc = {
  _id: ObjectId;
  place_id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  stars?: number;
  website?: string;
  wheelchair?: string;
  score: number;
  rationale: string;
  accessibility: HotelScore['accessibility'];
  cachedAt: Date;
};

async function hotelCacheCol(): Promise<Collection<HotelCacheDoc> | null> {
  const db = await getDb();
  return db ? db.collection<HotelCacheDoc>('hotel_cache') : null;
}

export async function ensureHotelCacheIndexes(): Promise<void> {
  if (hotelCacheIndexesPromise) return hotelCacheIndexesPromise;
  const col = await hotelCacheCol();
  if (!col) return;
  hotelCacheIndexesPromise = Promise.all([
    col.createIndex(
      { cachedAt: 1 },
      { name: 'cachedAt_ttl_30d', expireAfterSeconds: THIRTY_DAYS_SECONDS },
    ),
    col.createIndex({ place_id: 1 }, { name: 'place_id_unique', unique: true }),
    col.createIndex({ lat: 1, lon: 1 }, { name: 'lat_lon_lookup' }),
  ]).then(() => undefined);
  return hotelCacheIndexesPromise;
}

export async function getCachedHotelScore(
  place_id: string,
): Promise<(HotelScore & { cachedAt: Date }) | null> {
  const col = await hotelCacheCol();
  if (!col) return null;
  const doc = await col.findOne({ place_id });
  if (!doc) return null;
  return {
    score: doc.score,
    rationale: doc.rationale,
    accessibility: doc.accessibility,
    cachedAt: doc.cachedAt,
  };
}

export async function upsertHotelScore(
  poi: HotelPoi,
  score: HotelScore,
): Promise<void> {
  const col = await hotelCacheCol();
  if (!col) return;
  await col.updateOne(
    { place_id: poi.place_id },
    {
      $set: {
        place_id: poi.place_id,
        name: poi.name,
        lat: poi.lat,
        lon: poi.lon,
        address: poi.address,
        stars: poi.stars,
        website: poi.website,
        wheelchair: poi.wheelchair,
        score: score.score,
        rationale: score.rationale,
        accessibility: score.accessibility,
        cachedAt: new Date(),
      },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
}

export async function listCachedHotelsNear(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<RankedHotel[]> {
  const col = await hotelCacheCol();
  if (!col) return [];
  const box = boundingBox(lat, lon, radiusMeters);
  const docs = await col
    .find({
      lat: { $gte: box.minLat, $lte: box.maxLat },
      lon: { $gte: box.minLon, $lte: box.maxLon },
    })
    .limit(100)
    .toArray();

  return docs
    .map((doc) => ({
      place_id: doc.place_id,
      name: doc.name,
      lat: doc.lat,
      lon: doc.lon,
      address: doc.address,
      stars: doc.stars,
      website: doc.website,
      wheelchair: doc.wheelchair,
      score: doc.score,
      rationale: doc.rationale,
      accessibility: doc.accessibility,
      cachedAt: doc.cachedAt.toISOString(),
      cacheHit: true,
      distanceMeters: distanceMeters(lat, lon, doc.lat, doc.lon),
    }))
    .filter((doc) => doc.distanceMeters <= radiusMeters)
    .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters);
}
