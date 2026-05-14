import 'server-only';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getCachedRestaurantScore, upsertRestaurantScore } from '@/lib/db/restaurants';
import { distanceMeters } from '@/lib/geo';
import { getEnv } from '@/lib/env';
import { getChatModel } from '@/lib/llm';
import type {
  CarbLoadTier,
  RankedRestaurant,
  RestaurantPoi,
  RestaurantScore,
} from '@/lib/restaurants/types';

const ScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(12).max(260),
  carb_load_tier: z.enum(['low', 'medium', 'high']),
});
const SCORE_CONCURRENCY = 4;

export async function scoreRestaurant(
  poi: RestaurantPoi,
): Promise<RestaurantScore & { cacheHit: boolean; cachedAt?: Date }> {
  const cached = await getCachedRestaurantScore(poi.place_id);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const score = getEnv().OPENROUTER_API_KEY
    ? await scoreWithLlm(poi).catch((err) => {
        console.warn('[restaurant-scorer] LLM scoring failed, using heuristic:', err);
        return heuristicScore(poi);
      })
    : heuristicScore(poi);
  await upsertRestaurantScore(poi, score).catch((err) =>
    console.warn('[restaurant-scorer] cache upsert failed:', err),
  );
  return { ...score, cacheHit: false };
}

export async function rankRestaurants({
  restaurants,
  userLat,
  userLon,
  maxToScore = 6,
}: {
  restaurants: RestaurantPoi[];
  userLat: number;
  userLon: number;
  maxToScore?: number;
}): Promise<RankedRestaurant[]> {
  const selected = restaurants.slice(0, maxToScore);
  const scored: RankedRestaurant[] = [];
  for (let index = 0; index < selected.length; index += SCORE_CONCURRENCY) {
    const chunk = selected.slice(index, index + SCORE_CONCURRENCY);
    const chunkScored = await Promise.all(
      chunk.map(async (restaurant) => {
        const score = await scoreRestaurant(restaurant);
        return {
          ...restaurant,
          score: score.score,
          rationale: score.rationale,
          carb_load_tier: score.carb_load_tier,
          cacheHit: score.cacheHit,
          cachedAt: score.cachedAt?.toISOString(),
          distanceMeters: distanceMeters(userLat, userLon, restaurant.lat, restaurant.lon),
        };
      }),
    );
    scored.push(...chunkScored);
  }

  return scored.sort(
    (a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters,
  );
}

async function scoreWithLlm(poi: RestaurantPoi): Promise<RestaurantScore> {
  const { object } = await generateObject({
    model: getChatModel(),
    schema: ScoreSchema,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(15_000),
    system:
      'Tu es Diabo, assistant francophone pour personnes vivant avec le diabète au Maghreb. Tu évalues prudemment des restaurants à partir des tags publics disponibles. Tu ne poses pas de diagnostic médical.',
    prompt: [
      'Évalue si ce restaurant semble adapté à une personne diabétique.',
      'Réponds uniquement avec les champs JSON demandés.',
      'Critères: options grillées, légumes, protéines simples, portions contrôlables, cuisines très sucrées/frites/pains/pâtes/riz en excès.',
      `Nom: ${poi.name}`,
      `Cuisine: ${poi.cuisine.length > 0 ? poi.cuisine.join(', ') : 'non renseignée'}`,
      `Adresse: ${poi.address ?? 'non renseignée'}`,
      `Horaires: ${poi.opening_hours ?? 'non renseignés'}`,
    ].join('\n'),
  });
  return normalizeScore(object);
}

function heuristicScore(poi: RestaurantPoi): RestaurantScore {
  const cuisine = poi.cuisine.join(' ').toLowerCase();
  let score = 62;

  const favorable = ['grill', 'salad', 'seafood', 'fish', 'mediterranean', 'tunisian'];
  const moderate = ['pizza', 'pasta', 'italian', 'burger', 'sandwich', 'fast_food'];
  const heavy = ['dessert', 'ice_cream', 'cake', 'fried', 'chicken', 'asian', 'chinese'];

  for (const item of favorable) {
    if (cuisine.includes(item)) score += 8;
  }
  for (const item of moderate) {
    if (cuisine.includes(item)) score -= 10;
  }
  for (const item of heavy) {
    if (cuisine.includes(item)) score -= 14;
  }

  const clamped = clampScore(score);
  return {
    score: clamped,
    carb_load_tier: tierFromScore(clamped, cuisine),
    rationale:
      'Évaluation provisoire basée sur le type de cuisine disponible. Privilégiez une assiette avec légumes, protéines grillées et boissons sans sucre.',
  };
}

function normalizeScore(score: z.infer<typeof ScoreSchema>): RestaurantScore {
  return {
    score: clampScore(score.score),
    rationale: score.rationale.trim(),
    carb_load_tier: score.carb_load_tier,
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function tierFromScore(score: number, cuisine: string): CarbLoadTier {
  if (score >= 78) return 'low';
  if (score < 45 || /pizza|pasta|dessert|ice_cream|cake/.test(cuisine)) {
    return 'high';
  }
  return 'medium';
}
