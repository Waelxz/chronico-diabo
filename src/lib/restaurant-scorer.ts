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
        const distance = distanceMeters(
          userLat,
          userLon,
          restaurant.lat,
          restaurant.lon,
        );
        const contextualScore = applyContextualRestaurantScore(
          score.score,
          restaurant,
          distance,
        );
        return {
          ...restaurant,
          score: contextualScore,
          rationale: score.rationale,
          carb_load_tier: tierFromScore(
            contextualScore,
            restaurant.cuisine.join(' ').toLowerCase(),
          ),
          cacheHit: score.cacheHit,
          cachedAt: score.cachedAt?.toISOString(),
          distanceMeters: distance,
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
      `Site web: ${poi.website ?? 'non renseignee'}`,
      `Contact: ${poi.phone ?? 'non renseigne'}`,
      `Note utilisateurs: ${formatRatingForPrompt(poi)}`,
    ].join('\n'),
  });
  return normalizeScore(object);
}

function heuristicScore(poi: RestaurantPoi): RestaurantScore {
  const cuisine = poi.cuisine.join(' ').toLowerCase();
  let score = 62;

  const lowCarbPreferred = [
    'barbecue',
    'fish',
    'grill',
    'mediterranean',
    'poisson',
    'salad',
    'salade',
    'seafood',
    'steak',
    'tunisian',
    'vegetarian',
  ];
  const moderate = ['burger', 'fast food', 'fast_food', 'italian', 'pizza', 'sandwich'];
  const heavy = [
    'asian',
    'cake',
    'chicken',
    'chinese',
    'dessert',
    'fried',
    'ice cream',
    'ice_cream',
    'pasta',
    'pastry',
  ];

  for (const item of lowCarbPreferred) {
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

/**
 * Ranking formula:
 * 1. Start from the cached food-fit score (LLM or heuristic), where low-carb
 *    cuisine cues such as grill, salad, seafood and Mediterranean increase the
 *    score, while carb-heavy/fried/sweet cuisines reduce it.
 * 2. Add trust signals: website +4, phone/contact +4, opening hours +6.
 * 3. Add user rating confidence: rating above 3.5 contributes up to +10, with
 *    enough reviews adding up to +4; weak ratings below 3.5 reduce the score.
 * 4. Add proximity for the current search only: <=800m +8, <=1.5km +6,
 *    <=3km +4, <=5km +2, and >10km -6.
 */
function applyContextualRestaurantScore(
  baseScore: number,
  poi: RestaurantPoi,
  distanceMetersValue: number,
): number {
  let score = baseScore;

  if (poi.website) score += 4;
  if (poi.phone) score += 4;
  if (poi.opening_hours) score += 6;

  if (typeof poi.rating === 'number') {
    score += Math.round((poi.rating - 3.5) * 6);
    if ((poi.userRatingCount ?? 0) >= 50) score += 4;
    else if ((poi.userRatingCount ?? 0) >= 10) score += 2;
  }

  if (distanceMetersValue <= 800) score += 8;
  else if (distanceMetersValue <= 1500) score += 6;
  else if (distanceMetersValue <= 3000) score += 4;
  else if (distanceMetersValue <= 5000) score += 2;
  else if (distanceMetersValue > 10000) score -= 6;

  return clampScore(score);
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

function formatRatingForPrompt(poi: RestaurantPoi): string {
  if (typeof poi.rating !== 'number') return 'non renseignee';
  const count = poi.userRatingCount ? ` (${poi.userRatingCount} avis)` : '';
  return `${poi.rating}/5${count}`;
}

function tierFromScore(score: number, cuisine: string): CarbLoadTier {
  if (
    /grill|salad|salade|seafood|fish|poisson|mediterranean|barbecue/.test(cuisine)
  ) {
    return 'low';
  }
  if (score >= 78) return 'low';
  if (score < 45 || /pizza|pasta|dessert|ice_cream|ice cream|cake/.test(cuisine)) {
    return 'high';
  }
  return 'medium';
}
