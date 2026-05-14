import 'server-only';
import { fetchRestaurantsNear } from '@/lib/overpass';
import { rankRestaurants } from '@/lib/restaurant-scorer';

const KNOWN_LOCATIONS: Record<string, { lat: number; lon: number; label: string }> = {
  tunis: { lat: 36.8065, lon: 10.1815, label: 'Tunis centre' },
  'la marsa': { lat: 36.8782, lon: 10.3247, label: 'La Marsa' },
  ariana: { lat: 36.8625, lon: 10.1956, label: 'Ariana' },
  'sidi bou said': { lat: 36.8702, lon: 10.3417, label: 'Sidi Bou Saïd' },
  sousse: { lat: 35.8245, lon: 10.6346, label: 'Sousse' },
  sfax: { lat: 34.7406, lon: 10.7603, label: 'Sfax' },
  alger: { lat: 36.7538, lon: 3.0588, label: 'Alger' },
  oran: { lat: 35.6969, lon: -0.6331, label: 'Oran' },
  casablanca: { lat: 33.5731, lon: -7.5898, label: 'Casablanca' },
  marrakech: { lat: 31.6295, lon: -7.9811, label: 'Marrakech' },
  rabat: { lat: 34.0209, lon: -6.8416, label: 'Rabat' },
};

export async function findRestaurantsForChat({
  near,
  dietPrefs,
}: {
  near: string;
  dietPrefs?: string[];
}) {
  try {
    const location = resolveLocation(near);
    const cuisine = dietPrefs?.find((pref) => pref.trim().length > 0);
    const pois = await fetchRestaurantsNear({
      lat: location.lat,
      lon: location.lon,
      radius: 1_500,
      cuisine,
      timeoutMs: 8_000,
    });
    if (pois.length === 0) {
      return {
        location: location.label,
        locationApproximate: location.approximate,
        restaurants: [],
        note: 'Aucun restaurant trouvé via OpenStreetMap dans cette zone. La zone est peut-être peu couverte.',
      };
    }
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
  } catch (err) {
    console.error('[findRestaurantsForChat] error:', err);
    return {
      location: near,
      locationApproximate: true,
      restaurants: [],
      note: `Erreur lors de la récupération des restaurants: ${err instanceof Error ? err.message : 'erreur inconnue'}. Suggère à l'utilisateur d'essayer la page /restaurants directement.`,
    };
  }
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
