const london = /,\s*London,\s*UK$/i;
const neighbourhoodTypes = ["neighborhood", "sublocality_level_2", "sublocality_level_1", "sublocality"];

export function areaLabel(scope) {
  return scope.replace(london, "");
}

export function containsLocation(rectangle, point) {
  return Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)
    && point.latitude >= rectangle.low.latitude && point.latitude <= rectangle.high.latitude
    && point.longitude >= rectangle.low.longitude && point.longitude <= rectangle.high.longitude;
}

function rectangleFromGeocode(bounds) {
  if (!bounds) return null;
  const point = ({ lat, lng } = {}) => ({ latitude: lat, longitude: lng });
  const rectangle = { low: point(bounds.southwest), high: point(bounds.northeast) };
  return containsLocation(rectangle, rectangle.low)
    && rectangle.low.latitude < rectangle.high.latitude
    && rectangle.low.longitude < rectangle.high.longitude ? rectangle : null;
}

function key(name) {
  return name.normalize("NFKC").replace(/’/g, "'").trim().toLowerCase();
}

export async function resolveAreaRectangle(scope, geocode) {
  const names = areaLabel(scope).split(/ and /i);
  const rectangles = await Promise.all(names.map(async (name) => {
    const results = await geocode(`${name}, London, UK`);
    for (const result of results) {
      const components = result.address_components ?? [];
      const named = components.some((component) => key(component.long_name) === key(name)
        && component.types.some((type) => neighbourhoodTypes.includes(type) || type === "locality" || type === "postal_town"));
      const inLondon = components.some((component) => key(component.long_name) === "london")
        || /\b(?:Greater )?London\b/i.test(result.formatted_address ?? "");
      if (!named || !inLondon || result.partial_match) continue;
      const rectangle = rectangleFromGeocode(result.geometry?.bounds)
        ?? rectangleFromGeocode(result.geometry?.viewport);
      if (rectangle) return rectangle;
    }
    throw new Error(`Google did not return a usable search area for ${name}.`);
  }));
  return {
    low: {
      latitude: Math.min(...rectangles.map((r) => r.low.latitude)),
      longitude: Math.min(...rectangles.map((r) => r.low.longitude)),
    },
    high: {
      latitude: Math.max(...rectangles.map((r) => r.high.latitude)),
      longitude: Math.max(...rectangles.map((r) => r.high.longitude)),
    },
  };
}

export function widenRectangle({ low, high }) {
  // Search up to roughly one kilometre further on each edge, with a smaller
  // expansion for small neighbourhoods.
  const latitude = Math.min(0.009, (high.latitude - low.latitude) / 2);
  const longitude = Math.min(0.014, (high.longitude - low.longitude) / 2);
  return {
    low: { latitude: low.latitude - latitude, longitude: low.longitude - longitude },
    high: { latitude: high.latitude + latitude, longitude: high.longitude + longitude },
  };
}

export function nearbyAreas(places, localScope) {
  const counts = new Map();
  const localNames = areaLabel(localScope).split(/ and /i).map(key);
  for (const place of places) {
    const components = place.addressComponents ?? [];
    const component = neighbourhoodTypes
      .map((type) => components.find((item) => item.types?.includes(type)))
      .find(Boolean);
    const name = component?.longText?.trim();
    if (!name || [...localNames, "london", "greater london"].includes(key(name))) continue;
    const scope = `${name}, London, UK`;
    counts.set(scope, (counts.get(scope) ?? 0) + 1);
  }
  return [...counts].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)).map(([scope]) => scope);
}

// Use an explicit boundary for Highgate until other neighbourhoods have agreed boundaries.
export function matchesLegacyArea(place, location) {
  if (!/^highgate(?:\s*,|\s*$)/i.test(location.trim())) return true;
  const components = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const postcode = components.find((part) => part.types?.includes("postal_code"))?.longText;
  const district = /^([A-Z]{1,2}\d[A-Z\d]?)(?:\s|$)/i;
  if (postcode) return district.exec(postcode.trim())?.[1]?.toUpperCase() === "N6";
  return /\bN6\s*\d[A-Z]{2}\b/i.test(String(place?.formattedAddress ?? ""));
}
