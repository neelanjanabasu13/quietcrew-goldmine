// Each entry pairs a Google Places Table A type with natural UK search wording.
const categories = {
  "Restaurants and cafés": [["restaurant", "restaurants"], ["cafe", "cafés"]],
  "Bars and pubs": [["pub", "pubs"], ["bar", "bars"]],
  "Beauty and aesthetics": [["beauty_salon", "beauty salons"], ["skin_care_clinic", "aesthetics clinics"], ["nail_salon", "nail salons"], ["spa", "spas"]],
  Hair: [["hair_salon", "hair salons"], ["barber_shop", "barbers"], ["hair_care", "hairdressers"]],
  Fitness: [["gym", "gyms"], ["fitness_center", "fitness centres"], ["yoga_studio", "yoga studios"]],
  Dental: [["dentist", "dentists"], ["dental_clinic", "dental clinics"]],
  "Private healthcare": [["medical_clinic", "private medical clinics"], ["medical_center", "private medical centres"], ["doctor", "private doctors"], ["physiotherapist", "private physiotherapists"]],
  Veterinary: [["veterinary_care", "vets"]],
  Legal: [["lawyer", "solicitors"]],
  Accountancy: [["accounting", "accountants"]],
  "Estate agencies": [["real_estate_agency", "estate agents"]],
  Retail: [["store", "independent shops"]],
  "Home services": [["plumber", "plumbers"], ["electrician", "electricians"], ["roofing_contractor", "roofers"], ["locksmith", "locksmiths"], ["painter", "painters and decorators"]],
  Automotive: [["car_repair", "garages"], ["car_dealer", "car dealers"], ["tire_shop", "tyre shops"], ["car_wash", "car washes"]],
  Hospitality: [["hotel", "hotels"], ["bed_and_breakfast", "bed and breakfasts"], ["guest_house", "guest houses"], ["hostel", "hostels"], ["lodging", "places to stay"]],
};

export const supportedCategories = Object.keys(categories);

export function categorySearches(category, maxPages, budget = maxPages * 3) {
  const entries = Object.hasOwn(categories, category) ? categories[category] : undefined;
  if (!entries) throw new Error("Select a supported Goldmine business category.");
  const variants = entries.length === 1
    ? [entries[0], [entries[0][0], `local ${entries[0][1]}`], [entries[0][0], `independent ${entries[0][1]}`]]
    : entries;
  return variants.map(([type, term], index) => ({
    type,
    term,
    pages: Math.min(maxPages, Math.floor(budget / variants.length) + Number(index < budget % variants.length)),
  })).filter(({ pages }) => pages > 0);
}

export function matchesCategory(place, category) {
  const entries = Object.hasOwn(categories, category) ? categories[category] : [];
  const types = Array.isArray(place?.types) ? place.types : [];
  return entries.some(([type]) => types.includes(type) || place?.primaryType === type);
}

export function recommendationTerm(category) {
  const entries = Object.hasOwn(categories, category) ? categories[category] : undefined;
  if (!entries) throw new Error("Select a supported Goldmine business category.");
  if (category === "Restaurants and cafés") return "restaurants and cafés";
  if (category === "Bars and pubs") return "pubs and bars";
  if (category === "Home services") return "tradespeople for home repairs";
  return entries[0][1];
}
