export type CarbLoadTier = 'low' | 'medium' | 'high';

export type RestaurantPoi = {
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
  photoUrl?: string;
  photoAttributions?: string[];
};

export type RestaurantScore = {
  score: number;
  rationale: string;
  carb_load_tier: CarbLoadTier;
};

export type RankedRestaurant = RestaurantPoi &
  RestaurantScore & {
    distanceMeters: number;
    cachedAt?: string;
    cacheHit?: boolean;
  };

export type RestaurantsApiResponse = {
  restaurants: RankedRestaurant[];
  source: 'live' | 'cache';
  warning?: string;
};

export function carbTierLabel(tier: CarbLoadTier): string {
  if (tier === 'low') return 'Glucides faibles';
  if (tier === 'medium') return 'Glucides modérés';
  return 'Glucides élevés';
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Très adapté';
  if (score >= 60) return 'Adapté';
  if (score >= 40) return 'Peu adapté';
  return 'À éviter';
}
