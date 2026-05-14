import 'server-only';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getCachedHotelScore, upsertHotelScore } from '@/lib/db/hotels';
import { getEnv } from '@/lib/env';
import { distanceMeters } from '@/lib/geo';
import { getChatModel } from '@/lib/llm';
import type { HotelPoi } from '@/lib/overpass-hotels';

const ScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(12).max(260),
  accessibility: z.enum(['good', 'moderate', 'unknown']),
});

export interface HotelScore {
  score: number;
  rationale: string;
  accessibility: 'good' | 'moderate' | 'unknown';
}

export type RankedHotel = HotelPoi &
  HotelScore & {
    distanceMeters: number;
    cacheHit: boolean;
    cachedAt?: string;
  };

export async function scoreHotel(
  poi: HotelPoi,
): Promise<HotelScore & { cacheHit: boolean; cachedAt?: Date }> {
  const cached = await getCachedHotelScore(poi.place_id);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const score = getEnv().OPENROUTER_API_KEY
    ? await scoreWithLlm(poi).catch((err) => {
        console.warn('[hotel-scorer] LLM scoring failed, using heuristic:', err);
        return heuristicScore(poi);
      })
    : heuristicScore(poi);

  await upsertHotelScore(poi, score).catch((err) =>
    console.warn('[hotel-scorer] cache upsert failed:', err),
  );

  return { ...score, cacheHit: false };
}

export async function rankHotels({
  hotels,
  userLat,
  userLon,
  maxToScore = 6,
}: {
  hotels: HotelPoi[];
  userLat: number;
  userLon: number;
  maxToScore?: number;
}): Promise<RankedHotel[]> {
  const selected = hotels.slice(0, maxToScore);
  const scored = await Promise.all(
    selected.map(async (hotel) => {
      const score = await scoreHotel(hotel);
      return {
        ...hotel,
        score: score.score,
        rationale: score.rationale,
        accessibility: score.accessibility,
        cacheHit: score.cacheHit,
        cachedAt: score.cachedAt?.toISOString(),
        distanceMeters: distanceMeters(userLat, userLon, hotel.lat, hotel.lon),
      };
    }),
  );

  return scored.sort(
    (a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters,
  );
}

async function scoreWithLlm(poi: HotelPoi): Promise<HotelScore> {
  const { object } = await generateObject({
    model: getChatModel(),
    schema: ScoreSchema,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(15_000),
    system:
      "Tu es Diabo, assistant francophone pour les personnes vivant avec le diabète au Maghreb. Tu évalues prudemment des hébergements à partir de métadonnées publiques, sans inventer d'équipements médicaux.",
    prompt: [
      "Évalue si cet hôtel semble raisonnablement adapté à un voyageur diabétique.",
      'Réponds uniquement avec les champs JSON demandés.',
      "Critères: accessibilité fauteuil si présente, niveau de confort, fiabilité apparente, possibilité de contact ou d'informations via site web.",
      `Nom: ${poi.name}`,
      `Adresse: ${poi.address ?? 'non renseignée'}`,
      `Étoiles: ${poi.stars ?? 'non renseignées'}`,
      `Site web: ${poi.website ?? 'non renseigné'}`,
      `Accès fauteuil: ${poi.wheelchair ?? 'non renseigné'}`,
    ].join('\n'),
  });

  return {
    score: clampScore(object.score),
    rationale: object.rationale.trim(),
    accessibility: object.accessibility,
  };
}

function heuristicScore(poi: HotelPoi): HotelScore {
  let score = 60;

  if ((poi.stars ?? 0) >= 3) score += 10;
  if (poi.wheelchair?.toLowerCase() === 'yes') score += 15;
  if (poi.website) score += 8;

  return {
    score: clampScore(score),
    accessibility: getAccessibility(poi.wheelchair),
    rationale:
      "Évaluation provisoire basée sur les informations OpenStreetMap disponibles. Vérifiez l'accès, les repas et la proximité des soins avant réservation.",
  };
}

function getAccessibility(value?: string): HotelScore['accessibility'] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'limited') return 'good';
  if (normalized === 'no') return 'moderate';
  return 'unknown';
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
