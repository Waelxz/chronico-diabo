/**
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3000 LAT=36.8065 LON=10.1815 RADIUS=1500 node scripts/smoke-restaurants.mjs
 */

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const lat = process.env.LAT ?? '36.8065';
const lon = process.env.LON ?? '10.1815';
const radius = process.env.RADIUS ?? '1500';

const url = new URL('/api/places/restaurants', baseUrl);
url.searchParams.set('lat', lat);
url.searchParams.set('lon', lon);
url.searchParams.set('radius', radius);

let response;

try {
  response = await fetch(url);
} catch (error) {
  console.error(
    `Request failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

let payload = {};

try {
  payload = await response.json();
} catch {
  payload = {};
}

console.log(`HTTP ${response.status}`);
console.log(`source: ${payload.source ?? 'unknown'}`);

if (payload.warning) {
  console.log(`warning: ${payload.warning}`);
}

const restaurants = Array.isArray(payload.restaurants) ? payload.restaurants : [];

restaurants.slice(0, 3).forEach((restaurant, index) => {
  const cuisine = Array.isArray(restaurant.cuisine) && restaurant.cuisine.length > 0
    ? restaurant.cuisine.join(', ')
    : 'non renseignée';
  console.log(
    `${index + 1}. ${restaurant.name ?? 'Restaurant sans nom'} · ${restaurant.score ?? '?'
    }/100 · ${cuisine} · ${restaurant.distanceMeters ?? '?'}m`,
  );
});

if (response.status >= 500) {
  process.exit(1);
}
