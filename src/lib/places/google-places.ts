import 'server-only';
import { getEnv } from '@/lib/env';
import type { HotelPoi } from '@/lib/overpass-hotels';
import type { RestaurantPoi } from '@/lib/restaurants/types';

const GOOGLE_PLACES_NEARBY_URL =
  'https://places.googleapis.com/v1/places:searchNearby';
const GOOGLE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.websiteUri',
].join(',');

type GoogleNearbyResponse = {
  places?: GooglePlace[];
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  currentOpeningHours?: GoogleOpeningHours;
  regularOpeningHours?: GoogleOpeningHours;
  websiteUri?: string;
};

type GoogleOpeningHours = {
  openNow?: boolean;
  weekdayDescriptions?: string[];
};

const CUISINE_TYPE_ALIASES: Record<string, string[]> = {
  africain: ['african_restaurant'],
  americain: ['american_restaurant'],
  asiatique: ['asian_restaurant'],
  barbecue: ['barbecue_restaurant'],
  burger: ['hamburger_restaurant'],
  cafe: ['cafe'],
  chinois: ['chinese_restaurant'],
  dessert: ['dessert_shop'],
  fastfood: ['fast_food_restaurant'],
  grill: ['barbecue_restaurant', 'steak_house'],
  indien: ['indian_restaurant'],
  italien: ['italian_restaurant'],
  japonais: ['japanese_restaurant', 'sushi_restaurant'],
  kebab: ['kebab_shop'],
  libanais: ['lebanese_restaurant'],
  mediterraneen: ['mediterranean_restaurant'],
  mexicain: ['mexican_restaurant'],
  oriental: ['middle_eastern_restaurant'],
  patisserie: ['pastry_shop'],
  pizza: ['pizza_restaurant'],
  poisson: ['seafood_restaurant'],
  salade: ['salad_shop'],
  sandwich: ['sandwich_shop'],
  seafood: ['seafood_restaurant'],
  sushi: ['sushi_restaurant'],
  thai: ['thai_restaurant'],
  tunisien: ['mediterranean_restaurant', 'middle_eastern_restaurant'],
  turc: ['turkish_restaurant'],
  vegan: ['vegan_restaurant'],
  vegetarien: ['vegetarian_restaurant'],
};
const LODGING_TYPES = [
  'hotel',
  'hostel',
  'guest_house',
  'bed_and_breakfast',
  'inn',
  'extended_stay_hotel',
] as const;

export async function fetchGoogleRestaurantsNear({
  lat,
  lon,
  radius,
  cuisine,
}: {
  lat: number;
  lon: number;
  radius: number;
  cuisine?: string;
}): Promise<RestaurantPoi[] | null> {
  const apiKey = getEnv().GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const requestedTypes = cuisine ? googleTypesForCuisine(cuisine) : [];
  const places = await searchNearby({
    apiKey,
    lat,
    lon,
    radius,
    includedTypes: requestedTypes.length > 0 ? requestedTypes : ['restaurant'],
  });
  return normalizeRestaurants(places, cuisine);
}

export async function fetchGoogleHotelsNear({
  lat,
  lon,
  radius,
}: {
  lat: number;
  lon: number;
  radius: number;
}): Promise<HotelPoi[] | null> {
  const apiKey = getEnv().GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const places = await searchNearby({
    apiKey,
    lat,
    lon,
    radius,
    includedTypes: [...LODGING_TYPES],
  });
  return normalizeHotels(places);
}

async function searchNearby({
  apiKey,
  includedTypes,
  lat,
  lon,
  radius,
}: {
  apiKey: string;
  includedTypes: string[];
  lat: number;
  lon: number;
  radius: number;
}): Promise<GooglePlace[]> {
  const response = await fetch(GOOGLE_PLACES_NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      languageCode: 'fr',
      regionCode: 'TN',
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius,
        },
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`[google-places] HTTP ${response.status}`);
  }

  const data = (await response.json()) as GoogleNearbyResponse;
  return data.places ?? [];
}

function normalizeRestaurants(
  places: GooglePlace[],
  cuisineFilter?: string,
): RestaurantPoi[] {
  return places
    .map<RestaurantPoi | null>((place) => {
      const location = readLocation(place);
      if (!place.id || !location) return null;
      const cuisine = cuisineLabels(place);
      if (cuisineFilter && !matchesCuisine(cuisine, place.types, cuisineFilter)) {
        return null;
      }
      const restaurant: RestaurantPoi = {
        place_id: `google:${place.id}`,
        name: place.displayName?.text?.trim() || 'Restaurant sans nom',
        cuisine,
        lat: location.lat,
        lon: location.lon,
      };
      const address = place.formattedAddress?.trim();
      const openingHours = formatOpeningHours(
        place.currentOpeningHours ?? place.regularOpeningHours,
      );
      if (address) restaurant.address = address;
      if (openingHours) restaurant.opening_hours = openingHours;
      return restaurant;
    })
    .filter((place): place is RestaurantPoi => place !== null);
}

function normalizeHotels(places: GooglePlace[]): HotelPoi[] {
  return places
    .map<HotelPoi | null>((place) => {
      const location = readLocation(place);
      if (!place.id || !location) return null;
      const hotel: HotelPoi = {
        place_id: `google:${place.id}`,
        name: place.displayName?.text?.trim() || 'Hebergement sans nom',
        lat: location.lat,
        lon: location.lon,
      };
      const address = place.formattedAddress?.trim();
      const website = place.websiteUri?.trim();
      if (address) hotel.address = address;
      if (website) hotel.website = website;
      return hotel;
    })
    .filter((place): place is HotelPoi => place !== null);
}

function readLocation(place: GooglePlace): { lat: number; lon: number } | null {
  const lat = place.location?.latitude;
  const lon = place.location?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return { lat, lon };
}

function cuisineLabels(place: GooglePlace): string[] {
  const types = [place.primaryType, ...(place.types ?? [])].filter(
    (type): type is string => Boolean(type),
  );
  const labels = types
    .filter((type) => type !== 'food' && type !== 'point_of_interest')
    .map(formatGoogleType)
    .filter(Boolean);
  return Array.from(new Set(labels.length > 0 ? labels : ['restaurant']));
}

function formatGoogleType(type: string): string {
  return type
    .replace(/_restaurant$/, '')
    .replace(/_/g, ' ')
    .trim();
}

function googleTypesForCuisine(cuisine: string): string[] {
  const normalized = normalizeToken(cuisine);
  return CUISINE_TYPE_ALIASES[normalized] ?? [];
}

function matchesCuisine(
  cuisine: string[],
  types: string[] | undefined,
  filter: string,
): boolean {
  const needle = normalizeToken(filter);
  if (!needle) return true;
  const haystack = [
    ...cuisine.map(normalizeToken),
    ...(types ?? []).map(normalizeToken),
  ];
  return haystack.some((item) => item.includes(needle));
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function formatOpeningHours(hours?: GoogleOpeningHours): string | undefined {
  if (!hours) return undefined;
  if (typeof hours.openNow === 'boolean') {
    return hours.openNow ? 'Ouvert maintenant' : 'Ferme maintenant';
  }
  return hours.weekdayDescriptions?.[0]?.trim() || undefined;
}
