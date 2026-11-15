// Use an explicit boundary for Highgate until other neighbourhoods have agreed boundaries.
export function matchesDiscoveryArea(place, location) {
  if (!/^highgate(?:\s*,|\s*$)/i.test(location.trim())) return true;
  const components = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const postcode = components.find((part) => part.types?.includes("postal_code"))?.longText;
  const district = /^([A-Z]{1,2}\d[A-Z\d]?)(?:\s|$)/i;
  if (postcode) return district.exec(postcode.trim())?.[1]?.toUpperCase() === "N6";
  return /\bN6\s*\d[A-Z]{2}\b/i.test(String(place?.formattedAddress ?? ""));
}
