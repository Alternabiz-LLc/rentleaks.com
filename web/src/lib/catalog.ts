export const IMAGES = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ccb?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80",
];

export const HOUSING_TYPES = [
  { id: "room", label: "Rooms" },
  { id: "coliving", label: "Co-living" },
  { id: "furnished", label: "Furnished" },
  { id: "short-term", label: "1-month+" },
  { id: "lease-break", label: "Lease-break" },
] as const;

export type HousingType = (typeof HOUSING_TYPES)[number]["id"];

export const CITIES = [
  { id: "nyc", name: "New York", state: "NY", rank: 1, featured: true, walk: 89, transit: 84, lat: 40.7128, lng: -74.006, avgRoom: 1450, avgFurnished: 4900, neighborhoods: ["Williamsburg", "Astoria", "Harlem", "Bushwick", "East Village"] },
  { id: "la", name: "Los Angeles", state: "CA", rank: 2, featured: true, walk: 69, transit: 52, lat: 34.0522, lng: -118.2437, avgRoom: 1250, avgFurnished: 3800, neighborhoods: ["Silver Lake", "Koreatown", "Culver City"] },
  { id: "chicago", name: "Chicago", state: "IL", rank: 3, featured: true, walk: 78, transit: 72, lat: 41.8781, lng: -87.6298, avgRoom: 950, avgFurnished: 2800, neighborhoods: ["Wicker Park", "Logan Square", "Lakeview"] },
  { id: "houston", name: "Houston", state: "TX", rank: 4, featured: false, walk: 48, transit: 36, lat: 29.7604, lng: -95.3698, avgRoom: 800, avgFurnished: 2200, neighborhoods: ["Montrose", "EaDo"] },
  { id: "phoenix", name: "Phoenix", state: "AZ", rank: 5, featured: false, walk: 42, transit: 34, lat: 33.4484, lng: -112.074, avgRoom: 750, avgFurnished: 2100, neighborhoods: ["Roosevelt Row", "Downtown"] },
  { id: "philadelphia", name: "Philadelphia", state: "PA", rank: 6, featured: true, walk: 74, transit: 67, lat: 39.9526, lng: -75.1652, avgRoom: 900, avgFurnished: 2500, neighborhoods: ["Fishtown", "Rittenhouse"] },
  { id: "san-antonio", name: "San Antonio", state: "TX", rank: 7, featured: false, walk: 40, transit: 30, lat: 29.4252, lng: -98.4946, avgRoom: 700, avgFurnished: 1800, neighborhoods: ["Pearl", "Southtown"] },
  { id: "san-diego", name: "San Diego", state: "CA", rank: 8, featured: true, walk: 56, transit: 44, lat: 32.7157, lng: -117.1611, avgRoom: 1200, avgFurnished: 3400, neighborhoods: ["North Park", "Little Italy"] },
  { id: "dallas", name: "Dallas", state: "TX", rank: 9, featured: false, walk: 47, transit: 38, lat: 32.7767, lng: -96.797, avgRoom: 850, avgFurnished: 2400, neighborhoods: ["Deep Ellum", "Uptown"] },
  { id: "jacksonville", name: "Jacksonville", state: "FL", rank: 10, featured: false, walk: 32, transit: 24, lat: 30.3322, lng: -81.6557, avgRoom: 650, avgFurnished: 1700, neighborhoods: ["Riverside", "San Marco"] },
  { id: "austin", name: "Austin", state: "TX", rank: 11, featured: true, walk: 45, transit: 35, lat: 30.2672, lng: -97.7431, avgRoom: 1100, avgFurnished: 3200, neighborhoods: ["East Austin", "South Congress"] },
  { id: "fort-worth", name: "Fort Worth", state: "TX", rank: 12, featured: false, walk: 38, transit: 28, lat: 32.7555, lng: -97.3308, avgRoom: 720, avgFurnished: 1900, neighborhoods: ["Near Southside", "West 7th"] },
  { id: "san-jose", name: "San Jose", state: "CA", rank: 13, featured: true, walk: 51, transit: 46, lat: 37.3382, lng: -121.8863, avgRoom: 1400, avgFurnished: 4000, neighborhoods: ["Japantown", "Willow Glen"] },
  { id: "columbus", name: "Columbus", state: "OH", rank: 14, featured: false, walk: 44, transit: 32, lat: 39.9612, lng: -82.9988, avgRoom: 700, avgFurnished: 1800, neighborhoods: ["Short North", "German Village"] },
  { id: "charlotte", name: "Charlotte", state: "NC", rank: 15, featured: false, walk: 36, transit: 30, lat: 35.2271, lng: -80.8431, avgRoom: 850, avgFurnished: 2300, neighborhoods: ["NoDa", "South End"] },
  { id: "indianapolis", name: "Indianapolis", state: "IN", rank: 16, featured: false, walk: 35, transit: 26, lat: 39.7684, lng: -86.1581, avgRoom: 650, avgFurnished: 1700, neighborhoods: ["Mass Ave", "Fountain Square"] },
  { id: "sf", name: "San Francisco", state: "CA", rank: 17, featured: true, walk: 88, transit: 80, lat: 37.7749, lng: -122.4194, avgRoom: 1600, avgFurnished: 5200, neighborhoods: ["Mission", "Hayes Valley"] },
  { id: "seattle", name: "Seattle", state: "WA", rank: 18, featured: true, walk: 74, transit: 60, lat: 47.6062, lng: -122.3321, avgRoom: 1200, avgFurnished: 3400, neighborhoods: ["Capitol Hill", "Ballard"] },
  { id: "denver", name: "Denver", state: "CO", rank: 19, featured: true, walk: 61, transit: 48, lat: 39.7392, lng: -104.9903, avgRoom: 1000, avgFurnished: 2800, neighborhoods: ["RiNo", "Capitol Hill"] },
  { id: "oklahoma-city", name: "Oklahoma City", state: "OK", rank: 20, featured: false, walk: 34, transit: 22, lat: 35.4676, lng: -97.5164, avgRoom: 600, avgFurnished: 1600, neighborhoods: ["Midtown", "Plaza District"] },
  { id: "nashville", name: "Nashville", state: "TN", rank: 21, featured: true, walk: 41, transit: 28, lat: 36.1627, lng: -86.7816, avgRoom: 950, avgFurnished: 2700, neighborhoods: ["East Nashville", "The Gulch"] },
  { id: "dc", name: "Washington", state: "DC", rank: 22, featured: true, walk: 77, transit: 71, lat: 38.9072, lng: -77.0369, avgRoom: 1300, avgFurnished: 3600, neighborhoods: ["Columbia Heights", "Navy Yard"] },
  { id: "el-paso", name: "El Paso", state: "TX", rank: 23, featured: false, walk: 40, transit: 28, lat: 31.7619, lng: -106.485, avgRoom: 550, avgFurnished: 1400, neighborhoods: ["Downtown", "Kern Place"] },
  { id: "boston", name: "Boston", state: "MA", rank: 24, featured: true, walk: 82, transit: 76, lat: 42.3601, lng: -71.0589, avgRoom: 1350, avgFurnished: 3800, neighborhoods: ["Somerville", "South End"] },
  { id: "las-vegas", name: "Las Vegas", state: "NV", rank: 25, featured: false, walk: 42, transit: 33, lat: 36.1699, lng: -115.1398, avgRoom: 800, avgFurnished: 2200, neighborhoods: ["Downtown", "Arts District"] },
  { id: "portland", name: "Portland", state: "OR", rank: 26, featured: true, walk: 67, transit: 52, lat: 45.5152, lng: -122.6784, avgRoom: 950, avgFurnished: 2600, neighborhoods: ["Alberta", "Division"] },
  { id: "detroit", name: "Detroit", state: "MI", rank: 27, featured: false, walk: 55, transit: 40, lat: 42.3314, lng: -83.0458, avgRoom: 650, avgFurnished: 1700, neighborhoods: ["Corktown", "Midtown"] },
  { id: "memphis", name: "Memphis", state: "TN", rank: 28, featured: false, walk: 38, transit: 24, lat: 35.1495, lng: -90.049, avgRoom: 600, avgFurnished: 1500, neighborhoods: ["Cooper-Young", "Downtown"] },
  { id: "louisville", name: "Louisville", state: "KY", rank: 29, featured: false, walk: 40, transit: 26, lat: 38.2527, lng: -85.7585, avgRoom: 650, avgFurnished: 1600, neighborhoods: ["NuLu", "Highlands"] },
  { id: "baltimore", name: "Baltimore", state: "MD", rank: 30, featured: false, walk: 68, transit: 55, lat: 39.2904, lng: -76.6122, avgRoom: 850, avgFurnished: 2200, neighborhoods: ["Hampden", "Fells Point"] },
  { id: "miami", name: "Miami", state: "FL", rank: 31, featured: true, walk: 78, transit: 58, lat: 25.7617, lng: -80.1918, avgRoom: 1200, avgFurnished: 3600, neighborhoods: ["Brickell", "Wynwood", "Miami Beach"] },
  { id: "london", name: "London", state: "England", rank: 32, featured: true, walk: 87, transit: 88, lat: 51.5074, lng: -0.1278, avgRoom: 1600, avgFurnished: 4200, neighborhoods: ["Shoreditch", "Hackney", "Camden"] },
  { id: "manchester", name: "Manchester", state: "England", rank: 33, featured: false, walk: 78, transit: 72, lat: 53.4808, lng: -2.2426, avgRoom: 850, avgFurnished: 2200, neighborhoods: ["Northern Quarter", "Ancoats"] },
  { id: "birmingham", name: "Birmingham", state: "England", rank: 34, featured: false, walk: 72, transit: 64, lat: 52.4862, lng: -1.8904, avgRoom: 750, avgFurnished: 1900, neighborhoods: ["Jewellery Quarter", "Digbeth"] },
  { id: "leeds", name: "Leeds", state: "England", rank: 35, featured: false, walk: 74, transit: 60, lat: 53.8008, lng: -1.5491, avgRoom: 700, avgFurnished: 1800, neighborhoods: ["Holbeck", "Headingley"] },
  { id: "bristol", name: "Bristol", state: "England", rank: 36, featured: false, walk: 76, transit: 58, lat: 51.4545, lng: -2.5879, avgRoom: 900, avgFurnished: 2300, neighborhoods: ["Montpelier", "Clifton"] },
  { id: "liverpool", name: "Liverpool", state: "England", rank: 37, featured: false, walk: 75, transit: 62, lat: 53.4084, lng: -2.9916, avgRoom: 700, avgFurnished: 1800, neighborhoods: ["Baltic Triangle", "Ropewalks"] },
  { id: "edinburgh", name: "Edinburgh", state: "Scotland", rank: 38, featured: true, walk: 84, transit: 70, lat: 55.9533, lng: -3.1883, avgRoom: 950, avgFurnished: 2500, neighborhoods: ["Leith", "Stockbridge", "Old Town"] },
  { id: "glasgow", name: "Glasgow", state: "Scotland", rank: 39, featured: false, walk: 80, transit: 74, lat: 55.8642, lng: -4.2518, avgRoom: 750, avgFurnished: 1900, neighborhoods: ["West End", "Finnieston"] },
  { id: "dublin", name: "Dublin", state: "Ireland", rank: 40, featured: true, walk: 82, transit: 68, lat: 53.3498, lng: -6.2603, avgRoom: 1300, avgFurnished: 3400, neighborhoods: ["Portobello", "Rathmines", "Docklands"] },
  { id: "cork", name: "Cork", state: "Ireland", rank: 41, featured: false, walk: 76, transit: 48, lat: 51.8985, lng: -8.4756, avgRoom: 900, avgFurnished: 2200, neighborhoods: ["Shandon", "City Centre"] },
  { id: "galway", name: "Galway", state: "Ireland", rank: 42, featured: false, walk: 80, transit: 42, lat: 53.2707, lng: -9.0568, avgRoom: 850, avgFurnished: 2000, neighborhoods: ["Latin Quarter", "Salthill"] },
  { id: "paris", name: "Paris", state: "France", rank: 43, featured: true, walk: 93, transit: 90, lat: 48.8566, lng: 2.3522, avgRoom: 1400, avgFurnished: 3800, neighborhoods: ["Le Marais", "Belleville", "Oberkampf"] },
  { id: "lyon", name: "Lyon", state: "France", rank: 44, featured: false, walk: 82, transit: 78, lat: 45.764, lng: 4.8357, avgRoom: 850, avgFurnished: 2300, neighborhoods: ["Croix-Rousse", "Vieux Lyon"] },
  { id: "marseille", name: "Marseille", state: "France", rank: 45, featured: false, walk: 74, transit: 62, lat: 43.2965, lng: 5.3698, avgRoom: 700, avgFurnished: 1900, neighborhoods: ["Le Panier", "Cours Julien"] },
  { id: "toulouse", name: "Toulouse", state: "France", rank: 46, featured: false, walk: 78, transit: 66, lat: 43.6047, lng: 1.4442, avgRoom: 750, avgFurnished: 2000, neighborhoods: ["Capitole", "Saint-Cyprien"] },
  { id: "nice", name: "Nice", state: "France", rank: 47, featured: false, walk: 80, transit: 58, lat: 43.7102, lng: 7.262, avgRoom: 950, avgFurnished: 2600, neighborhoods: ["Vieux Nice", "Liberation"] },
  { id: "madrid", name: "Madrid", state: "Spain", rank: 48, featured: true, walk: 88, transit: 86, lat: 40.4168, lng: -3.7038, avgRoom: 900, avgFurnished: 2500, neighborhoods: ["Malasaña", "Lavapiés", "Chueca"] },
  { id: "barcelona", name: "Barcelona", state: "Spain", rank: 49, featured: true, walk: 90, transit: 84, lat: 41.3874, lng: 2.1686, avgRoom: 1000, avgFurnished: 2800, neighborhoods: ["Gràcia", "Eixample", "El Born"] },
  { id: "valencia", name: "Valencia", state: "Spain", rank: 50, featured: false, walk: 86, transit: 72, lat: 39.4699, lng: -0.3763, avgRoom: 700, avgFurnished: 1900, neighborhoods: ["Ruzafa", "El Carmen"] },
  { id: "seville", name: "Seville", state: "Spain", rank: 51, featured: false, walk: 84, transit: 56, lat: 37.3891, lng: -5.9845, avgRoom: 650, avgFurnished: 1700, neighborhoods: ["Triana", "Alameda"] },
  { id: "amsterdam", name: "Amsterdam", state: "Netherlands", rank: 52, featured: true, walk: 91, transit: 82, lat: 52.3676, lng: 4.9041, avgRoom: 1400, avgFurnished: 3600, neighborhoods: ["De Pijp", "Jordaan", "Oud-West"] },
  { id: "rotterdam", name: "Rotterdam", state: "Netherlands", rank: 53, featured: false, walk: 80, transit: 78, lat: 51.9244, lng: 4.4777, avgRoom: 950, avgFurnished: 2500, neighborhoods: ["Kop van Zuid", "Delfshaven"] },
  { id: "the-hague", name: "The Hague", state: "Netherlands", rank: 54, featured: false, walk: 82, transit: 76, lat: 52.0705, lng: 4.3007, avgRoom: 1000, avgFurnished: 2600, neighborhoods: ["Zeeheldenkwartier", "Scheveningen"] },
  { id: "utrecht", name: "Utrecht", state: "Netherlands", rank: 55, featured: false, walk: 88, transit: 80, lat: 52.0907, lng: 5.1214, avgRoom: 1100, avgFurnished: 2800, neighborhoods: ["Wittevrouwen", "Lombok"] },
  { id: "zurich", name: "Zurich", state: "Switzerland", rank: 56, featured: true, walk: 86, transit: 88, lat: 47.3769, lng: 8.5417, avgRoom: 1800, avgFurnished: 4800, neighborhoods: ["Kreis 4", "Seefeld", "Langstrasse"] },
  { id: "geneva", name: "Geneva", state: "Switzerland", rank: 57, featured: false, walk: 82, transit: 80, lat: 46.2044, lng: 6.1432, avgRoom: 1700, avgFurnished: 4600, neighborhoods: ["Pâquis", "Carouge"] },
  { id: "basel", name: "Basel", state: "Switzerland", rank: 58, featured: false, walk: 84, transit: 82, lat: 47.5596, lng: 7.5886, avgRoom: 1400, avgFurnished: 3800, neighborhoods: ["Gundeldingen", "Kleinbasel"] },
  { id: "bern", name: "Bern", state: "Switzerland", rank: 59, featured: false, walk: 85, transit: 80, lat: 46.948, lng: 7.4474, avgRoom: 1300, avgFurnished: 3500, neighborhoods: ["Breitenrain", "Lorraine"] },
  { id: "berlin", name: "Berlin", state: "Germany", rank: 60, featured: true, walk: 86, transit: 85, lat: 52.52, lng: 13.405, avgRoom: 850, avgFurnished: 2400, neighborhoods: ["Kreuzberg", "Neukölln", "Prenzlauer Berg"] },
  { id: "munich", name: "Munich", state: "Germany", rank: 61, featured: false, walk: 82, transit: 84, lat: 48.1351, lng: 11.582, avgRoom: 1200, avgFurnished: 3200, neighborhoods: ["Schwabing", "Glockenbach"] },
  { id: "hamburg", name: "Hamburg", state: "Germany", rank: 62, featured: false, walk: 80, transit: 82, lat: 53.5511, lng: 9.9937, avgRoom: 950, avgFurnished: 2600, neighborhoods: ["Sternschanze", "Altona"] },
  { id: "frankfurt", name: "Frankfurt", state: "Germany", rank: 63, featured: false, walk: 78, transit: 80, lat: 50.1109, lng: 8.6821, avgRoom: 1000, avgFurnished: 2800, neighborhoods: ["Sachsenhausen", "Nordend"] },
  { id: "cologne", name: "Cologne", state: "Germany", rank: 64, featured: false, walk: 80, transit: 78, lat: 50.9375, lng: 6.9603, avgRoom: 850, avgFurnished: 2300, neighborhoods: ["Ehrenfeld", "Südstadt"] },
  { id: "rome", name: "Rome", state: "Italy", rank: 65, featured: true, walk: 84, transit: 68, lat: 41.9028, lng: 12.4964, avgRoom: 900, avgFurnished: 2600, neighborhoods: ["Trastevere", "Monti", "Testaccio"] },
  { id: "milan", name: "Milan", state: "Italy", rank: 66, featured: true, walk: 86, transit: 80, lat: 45.4642, lng: 9.19, avgRoom: 1100, avgFurnished: 3000, neighborhoods: ["Navigli", "Isola", "Brera"] },
  { id: "florence", name: "Florence", state: "Italy", rank: 67, featured: false, walk: 90, transit: 52, lat: 43.7696, lng: 11.2558, avgRoom: 850, avgFurnished: 2400, neighborhoods: ["Santo Spirito", "Oltrarno"] },
  { id: "naples", name: "Naples", state: "Italy", rank: 68, featured: false, walk: 78, transit: 60, lat: 40.8518, lng: 14.2681, avgRoom: 650, avgFurnished: 1700, neighborhoods: ["Chiaia", "Vomero"] },
  { id: "turin", name: "Turin", state: "Italy", rank: 69, featured: false, walk: 80, transit: 64, lat: 45.0703, lng: 7.6869, avgRoom: 700, avgFurnished: 1900, neighborhoods: ["San Salvario", "Vanchiglia"] },
] as const;

export const HOST_PLANS = [
  { id: "lease-break", name: "Lease-break listing", amount: 0, kind: "host_plan" as const },
  { id: "room", name: "Room host", amount: 1900, kind: "host_plan" as const },
  { id: "furnished", name: "Furnished / 1-month+", amount: 4900, kind: "host_plan" as const },
  { id: "coliving", name: "Co-living operator", amount: 14900, kind: "host_plan" as const },
];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildSeedListings() {
  const types: HousingType[] = ["room", "coliving", "furnished", "short-term", "lease-break"];
  const listings: Array<{
    id: string;
    cityId: string;
    housingType: string;
    title: string;
    address: string;
    neighborhood: string;
    price: number;
    allIn: number;
    deposit: number;
    beds: number;
    baths: number;
    sqft: number;
    lat: number;
    lng: number;
    image: string;
    description: string;
    minStayMonths: number;
    availableFrom: string;
    furnishedLevel: string;
    amenitiesJson: string;
  }> = [];

  for (const city of CITIES) {
    const extra = city.id === "nyc" ? 1 : 0;
    for (const type of types) {
      const count = city.featured ? 1 + extra : 1;
      for (let i = 0; i < count; i++) {
        const seed = hash(`${city.id}-${type}-${i}`);
        const nhood = city.neighborhoods[seed % city.neighborhoods.length];
        const price = type === "room" || type === "coliving"
          ? city.avgRoom + (seed % 200)
          : Math.round(city.avgFurnished * (0.7 + (seed % 30) / 100));
        const utilities = seed % 2 === 0 ? 0 : 90;
        listings.push({
          id: `${city.id}-${type}-${i + 1}`,
          cityId: city.id,
          housingType: type,
          title: type === "lease-break"
            ? `${3 + (seed % 6)}-month lease takeover · ${nhood}`
            : type === "coliving"
              ? `Commonline · room in ${nhood}`
              : type === "room"
                ? `Private room in ${nhood}`
                : `${type === "short-term" ? "1-month+ stay" : "Furnished home"} · ${nhood}`,
          address: `${20 + (seed % 900)} Main St, ${city.name}, ${city.state}`,
          neighborhood: nhood,
          price,
          allIn: price + utilities,
          deposit: price,
          beds: type === "room" || type === "coliving" ? 1 : 1 + (seed % 2),
          baths: 1,
          sqft: 140 + (seed % 400),
          lat: city.lat + ((seed % 80) - 40) / 1000,
          lng: city.lng + ((seed % 80) - 40) / 800,
          image: IMAGES[seed % IMAGES.length],
          description: `Verified ${type} stay in ${nhood}, ${city.name}. Minimum stay 30 days. All-in rent includes listed utilities.`,
          minStayMonths: 1,
          availableFrom: "2026-09-15",
          furnishedLevel: type === "lease-break" && seed % 4 === 0 ? "partial" : "fully",
          amenitiesJson: JSON.stringify(["workspace", "laundry-in-building", "wifi"]),
        });
      }
    }
  }
  return listings;
}

export function money(centsOrDollars: number, alreadyDollars = true) {
  const n = alreadyDollars ? centsOrDollars : centsOrDollars / 100;
  return `$${Math.round(n).toLocaleString()}`;
}

export function leaseTerms(input: {
  listingTitle: string;
  address: string;
  city: string;
  renterName: string;
  hostName: string;
  startDate: string;
  endDate: string;
  monthlyAllIn: number;
  deposit: number;
  housingType: string;
}) {
  return `RENTLEAKS FLEXIBLE HOUSING AGREEMENT

This agreement is for a stay of 30 days or more. It is housing, not a hotel booking.

Property: ${input.listingTitle}
Address: ${input.address}, ${input.city}
Stay type: ${input.housingType}
Resident: ${input.renterName}
Host: ${input.hostName}
Term: ${input.startDate} through ${input.endDate}
Monthly All-in rent: $${input.monthlyAllIn.toLocaleString()}
Security deposit: $${input.deposit.toLocaleString()}

1. Occupancy. Resident may occupy the premises for the term above. Minimum stay is 30 days.
2. Payments. All-in rent covers the amounts disclosed on the listing. Broker fees, if any, are separate.
3. Identity. Both parties warrant that identity verification on RentLeaks is complete or in progress before move-in.
4. Fair Housing. The parties agree to comply with the Fair Housing Act and applicable local law.
5. Lease-break / assignment. If this is a takeover, host warrants they have the legal right to assign or sublet.
6. Condition. Resident will return the premises in substantially the same condition, normal wear excepted.
7. E-sign. Typed signatures below are intended as electronic signatures under the ESIGN Act.

This draft is a working instrument for the RentLeaks platform. Counsel should review before relying on it in a dispute.`;
}
