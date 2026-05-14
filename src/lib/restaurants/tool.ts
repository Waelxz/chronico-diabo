import 'server-only';
import { fetchRestaurantsNear } from '@/lib/overpass';
import { rankRestaurants } from '@/lib/restaurant-scorer';

const KNOWN_LOCATIONS: Record<string, { lat: number; lon: number; label: string }> = {
  tunis: { lat: 36.8065, lon: 10.1815, label: 'Tunis centre' },
  'la marsa': { lat: 36.8782, lon: 10.3247, label: 'La Marsa' },
  ariana: { lat: 36.8625, lon: 10.1956, label: 'Ariana' },
  'sidi bou said': { lat: 36.8702, lon: 10.3417, label: 'Sidi Bou Saïd' },
};

export async function findRestaurantsForChat({
  near,
  dietPrefs,
}: {
  near: string;
  dietPrefs?: string[];
}) {
  const location = resolveLocation(near);
  const cuisine = dietPrefs?.find((pref) => pref.trim().length > 0);
  const pois = await fetchRestaurantsNear({
    lat: location.lat,
    lon: location.lon,
    radius: 1_500,
    cuisine,
    timeoutMs: 8_000,
  });
  const ranked = await rankRestaurants({
    restaurants: pois,
    userLat: location.lat,
    userLon: location.lon,
    maxToScore: 8,
  });

  return {
    location: location.label,
    locationApproximate: location.approximate,
    restaurants: ranked.slice(0, 3).map((restaurant) => ({
      name: restaurant.name,
      cuisine: restaurant.cuisine.join(', ') || 'non renseignée',
      score: restaurant.score,
      carb_load_tier: restaurant.carb_load_tier,
      distanceMeters: restaurant.distanceMeters,
      rationale: restaurant.rationale,
    })),
  };
}

function resolveLocation(near: string): {
  lat: number;
  lon: number;
  label: string;
  approximate: boolean;
} {
  const trimmed = near.trim();
  const coordMatch = trimmed.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (coordMatch) {
    return {
      lat: Number(coordMatch[1]),
      lon: Number(coordMatch[2]),
      label: trimmed,
      approximate: false,
    };
  }

  const lowered = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(KNOWN_LOCATIONS)) {
    if (lowered.includes(key)) {
      return { ...value, approximate: false };
    }
  }

  return {
    lat: KNOWN_LOCATIONS.tunis.lat,
    lon: KNOWN_LOCATIONS.tunis.lon,
    label: 'Tunis centre',
    approximate: true,
  };
}
