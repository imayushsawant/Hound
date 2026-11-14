export interface CountryLocations {
  name: string;
  flag: string;
  cities: string[];
}

export const COUNTRIES: CountryLocations[] = [
  {
    name: "India",
    flag: "🇮🇳",
    cities: [
      "Bangalore",
      "Pune",
      "Mumbai",
      "Hyderabad",
      "Gurgaon",
      "Noida",
      "Delhi NCR",
      "Chennai",
      "Kolkata",
      "Ahmedabad",
      "Chandigarh",
      "Jaipur",
      "Kochi",
      "Trivandrum",
      "Indore",
      "Coimbatore",
    ],
  },
  {
    name: "United States",
    flag: "🇺🇸",
    cities: [
      "San Francisco / Bay Area",
      "New York, NY",
      "Seattle, WA",
      "Austin, TX",
      "Boston, MA",
      "Los Angeles, CA",
      "Chicago, IL",
      "Denver, CO",
      "Atlanta, GA",
      "San Diego, CA",
      "Washington, D.C.",
      "Dallas, TX",
    ],
  },
  {
    name: "United Kingdom",
    flag: "🇬🇧",
    cities: [
      "London",
      "Manchester",
      "Edinburgh",
      "Cambridge",
      "Bristol",
      "Birmingham",
      "Oxford",
    ],
  },
  {
    name: "Canada",
    flag: "🇨🇦",
    cities: [
      "Toronto",
      "Vancouver",
      "Montreal",
      "Ottawa",
      "Waterloo",
      "Calgary",
    ],
  },
  {
    name: "Germany",
    flag: "🇩🇪",
    cities: [
      "Berlin",
      "Munich",
      "Frankfurt",
      "Hamburg",
      "Cologne",
      "Stuttgart",
    ],
  },
  {
    name: "Singapore",
    flag: "🇸🇬",
    cities: [
      "Singapore",
    ],
  },
  {
    name: "Australia",
    flag: "🇦🇺",
    cities: [
      "Sydney",
      "Melbourne",
      "Brisbane",
      "Perth",
    ],
  },
  {
    name: "United Arab Emirates",
    flag: "🇦🇪",
    cities: [
      "Dubai",
      "Abu Dhabi",
    ],
  },
  {
    name: "Netherlands",
    flag: "🇳🇱",
    cities: [
      "Amsterdam",
      "Rotterdam",
      "Utrecht",
      "Eindhoven",
    ],
  },
  {
    name: "Ireland",
    flag: "🇮🇪",
    cities: [
      "Dublin",
      "Cork",
    ],
  },
  {
    name: "Switzerland",
    flag: "🇨🇭",
    cities: [
      "Zurich",
      "Geneva",
      "Lausanne",
    ],
  },
  {
    name: "Japan",
    flag: "🇯🇵",
    cities: [
      "Tokyo",
      "Osaka",
      "Kyoto",
    ],
  },
  {
    name: "France",
    flag: "🇫🇷",
    cities: [
      "Paris",
      "Lyon",
    ],
  },
  {
    name: "Sweden",
    flag: "🇸🇪",
    cities: [
      "Stockholm",
      "Gothenburg",
    ],
  },
  {
    name: "Poland",
    flag: "🇵🇱",
    cities: [
      "Warsaw",
      "Krakow",
    ],
  },
  {
    name: "Spain",
    flag: "🇪🇸",
    cities: [
      "Barcelona",
      "Madrid",
    ],
  },
  {
    name: "Israel",
    flag: "🇮🇱",
    cities: [
      "Tel Aviv",
      "Jerusalem",
    ],
  },
  {
    name: "Brazil",
    flag: "🇧🇷",
    cities: [
      "São Paulo",
      "Rio de Janeiro",
    ],
  },
];

const allCitiesSet = new Set<string>(
  COUNTRIES.flatMap((c) => c.cities),
);

export function isPredefinedCity(city: string): boolean {
  if (!city) return false;
  if (city === "Remote") return true;
  return allCitiesSet.has(city);
}

export function getOrderedCountries(selectedCountryName?: string): CountryLocations[] {
  const target = (selectedCountryName || "India").trim().toLowerCase();
  const matched = COUNTRIES.find((c) => c.name.toLowerCase() === target);
  const primary = matched || COUNTRIES[0]; // defaults to India
  const others = COUNTRIES.filter((c) => c.name.toLowerCase() !== primary.name.toLowerCase());
  return [primary, ...others];
}
