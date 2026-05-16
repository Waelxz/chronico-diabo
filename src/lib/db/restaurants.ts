import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { boundingBox, distanceMeters } from '@/lib/geo';
import { getDb } from '@/lib/mongodb';
import type {
  CarbLoadTier,
  RankedRestaurant,
  RestaurantPoi,
  RestaurantScore,
} from '@/lib/restaurants/types';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
let recoCacheIndexesPromise: Promise<void> | null = null;

export type RecoCacheDoc = {
  _id: ObjectId;
  place_id: string;
  name: string;
  cuisine: string[];
  lat: number;
  lon: number;
  address?: string;
  opening_hours?: string;
  website?: string;
  phone?: string;
  rating?: number;
  userRatingCount?: number;
  description?: string;
  photoUrl?: string;
  photoAttributions?: string[];
  score: number;
  rationale: string;
  carb_load_tier: CarbLoadTier;
  cachedAt: Date;
};

async function recoCacheCol(): Promise<Collection<RecoCacheDoc> | null> {
  const db = await getDb();
  return db ? db.collection<RecoCacheDoc>('reco_cache') : null;
}

export async function ensureRecoCacheIndexes(): Promise<void> {
  if (recoCacheIndexesPromise) return recoCacheIndexesPromise;
  const col = await recoCacheCol();
  if (!col) return;
  recoCacheIndexesPromise = Promise.all([
    col.createIndex(
      { cachedAt: 1 },
      { name: 'cachedAt_ttl_30d', expireAfterSeconds: THIRTY_DAYS_SECONDS },
    ),
    col.createIndex({ place_id: 1 }, { name: 'place_id_unique', unique: true }),
    col.createIndex({ lat: 1, lon: 1 }, { name: 'lat_lon_lookup' }),
  ]).then(() => undefined);
  return recoCacheIndexesPromise;
}

export async function getCachedRestaurantScore(
  placeId: string,
): Promise<(RestaurantScore & { cachedAt: Date }) | null> {
  const col = await recoCacheCol();
  if (!col) return null;
  const doc = await col.findOne({ place_id: placeId });
  if (!doc) return null;
  return {
    score: doc.score,
    rationale: doc.rationale,
    carb_load_tier: doc.carb_load_tier,
    cachedAt: doc.cachedAt,
  };
}

export async function upsertRestaurantScore(
  poi: RestaurantPoi,
  score: RestaurantScore,
): Promise<void> {
  const col = await recoCacheCol();
  if (!col) return;
  await col.updateOne(
    { place_id: poi.place_id },
    {
      $set: {
        place_id: poi.place_id,
        name: poi.name,
        cuisine: poi.cuisine,
        lat: poi.lat,
        lon: poi.lon,
        address: poi.address,
        opening_hours: poi.opening_hours,
        website: poi.website,
        phone: poi.phone,
        rating: poi.rating,
        userRatingCount: poi.userRatingCount,
        description: poi.description,
        photoUrl: poi.photoUrl,
        photoAttributions: poi.photoAttributions,
        score: score.score,
        rationale: score.rationale,
        carb_load_tier: score.carb_load_tier,
        cachedAt: new Date(),
      },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
}

export async function listCachedRestaurantsNear({
  lat,
  lon,
  radius,
  cuisine,
  minScore = 0,
}: {
  lat: number;
  lon: number;
  radius: number;
  cuisine?: string;
  minScore?: number;
}): Promise<RankedRestaurant[]> {
  const col = await recoCacheCol();
  if (!col) return [];
  const box = boundingBox(lat, lon, radius);
  const docs = await col
    .find({
      lat: { $gte: box.minLat, $lte: box.maxLat },
      lon: { $gte: box.minLon, $lte: box.maxLon },
      score: { $gte: minScore },
    })
    .limit(100)
    .toArray();

  return docs
    .filter((doc) => !cuisine || matchesCuisine(doc.cuisine, cuisine))
    .map((doc) => ({
      place_id: doc.place_id,
      name: doc.name,
      cuisine: doc.cuisine,
      lat: doc.lat,
      lon: doc.lon,
      address: doc.address,
      opening_hours: doc.opening_hours,
      website: doc.website,
      phone: doc.phone,
      rating: doc.rating,
      userRatingCount: doc.userRatingCount,
      description: doc.description,
      photoUrl: doc.photoUrl,
      photoAttributions: doc.photoAttributions,
      score: doc.score,
      rationale: doc.rationale,
      carb_load_tier: doc.carb_load_tier,
      cachedAt: doc.cachedAt.toISOString(),
      cacheHit: true,
      distanceMeters: distanceMeters(lat, lon, doc.lat, doc.lon),
    }))
    .filter((doc) => doc.distanceMeters <= radius)
    .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters);
}

function matchesCuisine(cuisine: string[], filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return cuisine.some((item) => item.toLowerCase().includes(needle));
}
