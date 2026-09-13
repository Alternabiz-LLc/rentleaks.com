/**
 * RentLeaks — Flexible housing catalog
 * Rooms · Co-living · Furnished · 1-month+ · Lease-break
 * U.S. cities plus major markets in the UK, Ireland, France, Spain, Netherlands, Switzerland, Germany, and Italy
 */
(function () {
  const IMG = (id) => 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=1400&q=80';
  const GALLERY_POOL = {
    bedroom: [
      { src: IMG('photo-1616594039964-ae9021a400a0'), label: 'Bedroom' },
      { src: IMG('photo-1540518614846-7eded433c457'), label: 'Bedroom' },
      { src: IMG('photo-1505693416388-ac5ce068fe85'), label: 'Bedroom' },
      { src: IMG('photo-1522771739844-6a9f6d5f14af'), label: 'Bedroom' },
      { src: IMG('photo-1560185127-6ed189bf02f4'), label: 'Bedroom' },
      { src: IMG('photo-1505691938895-1758d7feb511'), label: 'Bedroom' }
    ],
    bathroom: [
      { src: IMG('photo-1552321554-5fefe8c9ef14'), label: 'Bathroom' },
      { src: IMG('photo-1584622650111-993a426fbf0a'), label: 'Bathroom' },
      { src: IMG('photo-1600566752355-35792bedcfea'), label: 'Bathroom' }
    ],
    kitchen: [
      { src: IMG('photo-1556912172-45b7abe8b7e1'), label: 'Kitchen' },
      { src: IMG('photo-1556909114-f6e7ad7d3136'), label: 'Kitchen' },
      { src: IMG('photo-1554995207-c18c203602cb'), label: 'Kitchen' }
    ],
    living: [
      { src: IMG('photo-1502672260266-1c1ef2d93688'), label: 'Living room' },
      { src: IMG('photo-1512918728675-ed5a9ecdebfd'), label: 'Living room' },
      { src: IMG('photo-1560448204-e02f11c3d0e2'), label: 'Living room' },
      { src: IMG('photo-1522708323590-d24dbb6b0267'), label: 'Living room' }
    ],
    workspace: [
      { src: IMG('photo-1486312338219-ce68d2c6f44d'), label: 'Workspace' },
      { src: IMG('photo-1593642532400-2682810df593'), label: 'Workspace' },
      { src: IMG('photo-1536376072261-38c75010e6c9'), label: 'Workspace' }
    ],
    exterior: [
      { src: IMG('photo-1574362848149-11496d93a7c7'), label: 'Building' },
      { src: IMG('photo-1486406146926-c627a92ad1ab'), label: 'Building' },
      { src: IMG('photo-1449824913935-59a10b8d2000'), label: 'Street' },
      { src: IMG('photo-1502005229762-cf1b2da7c5d6'), label: 'Neighborhood' }
    ]
  };
  const IMAGES = [].concat(
    GALLERY_POOL.bedroom, GALLERY_POOL.living, GALLERY_POOL.kitchen,
    GALLERY_POOL.workspace, GALLERY_POOL.exterior
  ).map((p) => p.src);
  const VIDEOS = [
    { src: 'https://videos.pexels.com/video-files/3773486/3773486-hd_1920_1080_30fps.mp4', caption: 'Walkthrough of the room and common spaces' },
    { src: 'https://videos.pexels.com/video-files/7578544/7578544-hd_1280_720_30fps.mp4', caption: 'Host video tour — kitchen, bath, and bedroom' },
    { src: 'https://videos.pexels.com/video-files/7578552/7578552-hd_1280_720_30fps.mp4', caption: 'Furnished walkthrough' },
    { src: 'https://videos.pexels.com/video-files/6498514/6498514-hd_1280_720_25fps.mp4', caption: 'Bedroom and light tour' },
    { src: 'https://videos.pexels.com/video-files/7578541/7578541-hd_1920_1080_30fps.mp4', caption: 'Apartment video tour' }
  ];

  const HOUSING_TYPES = [
    {
      id: 'room',
      label: 'Rooms',
      short: 'Room',
      href: 'rooms.html',
      blurb: 'A private bedroom in a shared home. Split rent, keep your own door.',
      promise: 'Housemate profiles, private-bath filter, and vibe tags before you tour.'
    },
    {
      id: 'coliving',
      label: 'Co-living',
      short: 'Co-living',
      href: 'coliving.html',
      blurb: 'Designed buildings with community, cleaning, and flexible terms.',
      promise: 'Bed-level inventory, events, and all-in rent — not a mystery house share.'
    },
    {
      id: 'furnished',
      label: 'Furnished',
      short: 'Furnished',
      href: 'furnished.html',
      blurb: 'Move in with a suitcase. Furniture, kitchen, and workspace included.',
      promise: 'Furniture inventory on every listing. No “bring your own bed” surprises.'
    },
    {
      id: 'short-term',
      label: '1-month+',
      short: '1-month+',
      href: 'short-term.html',
      blurb: 'Mid-term apartments. 30-day minimum — homes, not hotel nights.',
      promise: 'Stay length is a first-class filter. Built for relos, contracts, and pilots.'
    },
    {
      id: 'aparthotel',
      label: 'Aparthotel',
      short: 'Aparthotel',
      href: 'aparthotel.html',
      blurb: 'Serviced apartments from hotel operators — housekeeping in, nightly rates out.',
      promise: 'Hotel groups can list here, but only stays of 30 days or more. Still no nightly bookings.'
    },
    {
      id: 'lease-break',
      label: 'Lease-break',
      short: 'Lease-break',
      href: 'lease-break.html',
      blurb: 'Take over a remaining lease. See days left, assignment vs sublet.',
      promise: 'Lease Clock, takeover math, and free posting so good homes stay filled.'
    }
  ];

  const CITIES = [
    { id: 'nyc', name: 'New York', state: 'NY', rank: 1, featured: true, walk: 89, transit: 84, avgRoom: 1450, avgFurnished: 4900, neighborhoods: ['Williamsburg', 'Astoria', 'Harlem', 'Financial District', 'Bushwick', 'Upper East Side', 'Crown Heights', 'Long Island City', 'East Village', 'Park Slope'], streets: ['Bedford Ave', '30th Ave', 'Lenox Ave', 'Fulton St', 'Metropolitan Ave', '2nd Ave', 'Franklin Ave', 'Jackson Ave'] },
    { id: 'la', name: 'Los Angeles', state: 'CA', rank: 2, featured: true, walk: 69, transit: 52, avgRoom: 1250, avgFurnished: 3800, neighborhoods: ['Silver Lake', 'Koreatown', 'Culver City', 'Los Feliz', 'Downtown', 'Echo Park'], streets: ['Sunset Blvd', 'Wilshire Blvd', 'Vermont Ave', 'Santa Monica Blvd'] },
    { id: 'chicago', name: 'Chicago', state: 'IL', rank: 3, featured: true, walk: 78, transit: 72, avgRoom: 950, avgFurnished: 2800, neighborhoods: ['Wicker Park', 'Logan Square', 'Lakeview', 'South Loop', 'Lincoln Park'], streets: ['Milwaukee Ave', 'North Ave', 'Halsted St', 'Michigan Ave'] },
    { id: 'houston', name: 'Houston', state: 'TX', rank: 4, featured: false, walk: 48, transit: 36, avgRoom: 800, avgFurnished: 2200, neighborhoods: ['Montrose', 'EaDo', 'The Heights', 'Midtown'], streets: ['Westheimer Rd', 'Main St', 'Washington Ave'] },
    { id: 'phoenix', name: 'Phoenix', state: 'AZ', rank: 5, featured: false, walk: 42, transit: 34, avgRoom: 750, avgFurnished: 2100, neighborhoods: ['Roosevelt Row', 'Arcadian', 'Downtown', 'Camelback East'], streets: ['Roosevelt St', 'Central Ave', 'Camelback Rd'] },
    { id: 'philadelphia', name: 'Philadelphia', state: 'PA', rank: 6, featured: true, walk: 74, transit: 67, avgRoom: 900, avgFurnished: 2500, neighborhoods: ['Fishtown', 'Graduate Hospital', 'Rittenhouse', 'Northern Liberties'], streets: ['Frankford Ave', 'South St', 'Walnut St'] },
    { id: 'san-antonio', name: 'San Antonio', state: 'TX', rank: 7, featured: false, walk: 40, transit: 30, avgRoom: 700, avgFurnished: 1800, neighborhoods: ['Pearl', 'Southtown', 'Alamo Heights'], streets: ['Broadway', 'St Marys St', 'Grayson St'] },
    { id: 'san-diego', name: 'San Diego', state: 'CA', rank: 8, featured: true, walk: 56, transit: 44, avgRoom: 1200, avgFurnished: 3400, neighborhoods: ['North Park', 'Little Italy', 'Pacific Beach', 'East Village'], streets: ['30th St', 'India St', 'Garnet Ave'] },
    { id: 'dallas', name: 'Dallas', state: 'TX', rank: 9, featured: false, walk: 47, transit: 38, avgRoom: 850, avgFurnished: 2400, neighborhoods: ['Deep Ellum', 'Uptown', 'Oak Cliff', 'Bishop Arts'], streets: ['Elm St', 'McKinney Ave', 'Jefferson Blvd'] },
    { id: 'jacksonville', name: 'Jacksonville', state: 'FL', rank: 10, featured: false, walk: 32, transit: 24, avgRoom: 650, avgFurnished: 1700, neighborhoods: ['Riverside', 'San Marco', 'Downtown'], streets: ['Park St', 'Hendricks Ave', 'Bay St'] },
    { id: 'austin', name: 'Austin', state: 'TX', rank: 11, featured: true, walk: 45, transit: 35, avgRoom: 1100, avgFurnished: 3200, neighborhoods: ['East Austin', 'South Congress', 'Domain', 'Zilker'], streets: ['East 6th St', 'Congress Ave', 'South Lamar'] },
    { id: 'fort-worth', name: 'Fort Worth', state: 'TX', rank: 12, featured: false, walk: 38, transit: 28, avgRoom: 720, avgFurnished: 1900, neighborhoods: ['Near Southside', 'West 7th', 'Downtown'], streets: ['Magnolia Ave', 'West 7th St', 'Main St'] },
    { id: 'san-jose', name: 'San Jose', state: 'CA', rank: 13, featured: true, walk: 51, transit: 46, avgRoom: 1400, avgFurnished: 4000, neighborhoods: ['Japantown', 'Willow Glen', 'Downtown', 'Santana Row'], streets: ['Jackson St', 'Lincoln Ave', 'Santa Clara St'] },
    { id: 'columbus', name: 'Columbus', state: 'OH', rank: 14, featured: false, walk: 44, transit: 32, avgRoom: 700, avgFurnished: 1800, neighborhoods: ['Short North', 'German Village', 'Clintonville'], streets: ['High St', 'Livingston Ave', 'Indianola Ave'] },
    { id: 'charlotte', name: 'Charlotte', state: 'NC', rank: 15, featured: false, walk: 36, transit: 30, avgRoom: 850, avgFurnished: 2300, neighborhoods: ['NoDa', 'South End', 'Plaza Midwood'], streets: ['North Davidson', 'South Blvd', 'Central Ave'] },
    { id: 'indianapolis', name: 'Indianapolis', state: 'IN', rank: 16, featured: false, walk: 35, transit: 26, avgRoom: 650, avgFurnished: 1700, neighborhoods: ['Mass Ave', 'Fountain Square', 'Broad Ripple'], streets: ['Massachusetts Ave', 'Virginia Ave', 'College Ave'] },
    { id: 'sf', name: 'San Francisco', state: 'CA', rank: 17, featured: true, walk: 88, transit: 80, avgRoom: 1600, avgFurnished: 5200, neighborhoods: ['Mission', 'Hayes Valley', 'Soma', 'Noe Valley', 'Inner Sunset'], streets: ['Valencia St', 'Hayes St', 'Folsom St', '24th St'] },
    { id: 'seattle', name: 'Seattle', state: 'WA', rank: 18, featured: true, walk: 74, transit: 60, avgRoom: 1200, avgFurnished: 3400, neighborhoods: ['Capitol Hill', 'Ballard', 'Fremont', 'Belltown'], streets: ['Broadway', 'Ballard Ave', 'Fremont Ave'] },
    { id: 'denver', name: 'Denver', state: 'CO', rank: 19, featured: true, walk: 61, transit: 48, avgRoom: 1000, avgFurnished: 2800, neighborhoods: ['RiNo', 'Capitol Hill', 'Highlands', 'LoDo'], streets: ['Larimer St', 'Colfax Ave', 'Tejon St'] },
    { id: 'oklahoma-city', name: 'Oklahoma City', state: 'OK', rank: 20, featured: false, walk: 34, transit: 22, avgRoom: 600, avgFurnished: 1600, neighborhoods: ['Midtown', 'Plaza District', 'Automobile Alley'], streets: ['Western Ave', 'Classen Blvd', 'Broadway'] },
    { id: 'nashville', name: 'Nashville', state: 'TN', rank: 21, featured: true, walk: 41, transit: 28, avgRoom: 950, avgFurnished: 2700, neighborhoods: ['East Nashville', 'The Gulch', 'Germantown', '12 South'], streets: ['Gallatin Ave', '11th Ave', '3rd Ave'] },
    { id: 'dc', name: 'Washington', state: 'DC', rank: 22, featured: true, walk: 77, transit: 71, avgRoom: 1300, avgFurnished: 3600, neighborhoods: ['Columbia Heights', 'Navy Yard', 'Adams Morgan', 'Shaw', 'Petworth'], streets: ['14th St NW', 'M St SE', 'U St NW', 'Georgia Ave'] },
    { id: 'el-paso', name: 'El Paso', state: 'TX', rank: 23, featured: false, walk: 40, transit: 28, avgRoom: 550, avgFurnished: 1400, neighborhoods: ['Downtown', 'Kern Place', 'Sunset Heights'], streets: ['Mesa St', 'Oregon St', 'Rim Rd'] },
    { id: 'boston', name: 'Boston', state: 'MA', rank: 24, featured: true, walk: 82, transit: 76, avgRoom: 1350, avgFurnished: 3800, neighborhoods: ['Somerville', 'Jamaica Plain', 'South End', 'Allston', 'Seaport'], streets: ['Highland Ave', 'Centre St', 'Tremont St', 'Congress St'] },
    { id: 'las-vegas', name: 'Las Vegas', state: 'NV', rank: 25, featured: false, walk: 42, transit: 33, avgRoom: 800, avgFurnished: 2200, neighborhoods: ['Downtown', 'Arts District', 'Summerlin', 'Henderson'], streets: ['Fremont St', 'Charleston Blvd', 'Sahara Ave'] },
    { id: 'portland', name: 'Portland', state: 'OR', rank: 26, featured: true, walk: 67, transit: 52, avgRoom: 950, avgFurnished: 2600, neighborhoods: ['Alberta', 'Division', 'Pearl', 'Mississippi'], streets: ['Alberta St', 'Division St', 'NW 13th'] },
    { id: 'detroit', name: 'Detroit', state: 'MI', rank: 27, featured: false, walk: 55, transit: 40, avgRoom: 650, avgFurnished: 1700, neighborhoods: ['Corktown', 'Midtown', 'Downtown', 'New Center'], streets: ['Michigan Ave', 'Woodward Ave', 'Cass Ave'] },
    { id: 'memphis', name: 'Memphis', state: 'TN', rank: 28, featured: false, walk: 38, transit: 24, avgRoom: 600, avgFurnished: 1500, neighborhoods: ['Cooper-Young', 'Downtown', 'Crosstown'], streets: ['Cooper St', 'Main St', 'Poplar Ave'] },
    { id: 'louisville', name: 'Louisville', state: 'KY', rank: 29, featured: false, walk: 40, transit: 26, avgRoom: 650, avgFurnished: 1600, neighborhoods: ['NuLu', 'Highlands', 'Germantown'], streets: ['Market St', 'Bardstown Rd', 'Goss Ave'] },
    { id: 'baltimore', name: 'Baltimore', state: 'MD', rank: 30, featured: false, walk: 68, transit: 55, avgRoom: 850, avgFurnished: 2200, neighborhoods: ['Hampden', 'Fells Point', 'Mount Vernon', 'Canton'], streets: ['The Avenue', 'Broadway', 'Charles St'] },
    { id: 'miami', name: 'Miami', state: 'FL', rank: 31, featured: true, launch: true, walk: 78, transit: 58, avgRoom: 1200, avgFurnished: 3600, neighborhoods: ['Brickell', 'Wynwood', 'Coconut Grove', 'Miami Beach', 'Little Havana'], streets: ['Brickell Ave', 'NW 2nd Ave', 'Grand Ave', 'Ocean Dr'] },
    { id: 'london', name: 'London', state: 'England', rank: 32, featured: true, country: 'GB', countryName: 'United Kingdom', group: 'United Kingdom', walk: 87, transit: 88, avgRoom: 1600, avgFurnished: 4200, neighborhoods: ['Shoreditch', 'Hackney', 'Camden', 'Brixton', 'Islington', 'Peckham', 'Notting Hill'], streets: ['Brick Lane', 'Upper St', 'Columbia Rd', 'Coldharbour Ln', 'Kingsland Rd'] },
    { id: 'manchester', name: 'Manchester', state: 'England', rank: 33, featured: false, country: 'GB', countryName: 'United Kingdom', group: 'United Kingdom', walk: 78, transit: 72, avgRoom: 850, avgFurnished: 2200, neighborhoods: ['Northern Quarter', 'Ancoats', 'Deansgate', 'Chorlton'], streets: ['Oldham St', 'Deansgate', 'Oxford Rd', 'Thomas St'] },
    { id: 'birmingham', name: 'Birmingham', state: 'England', rank: 34, featured: false, country: 'GB', countryName: 'United Kingdom', group: 'United Kingdom', walk: 72, transit: 64, avgRoom: 750, avgFurnished: 1900, neighborhoods: ['Jewellery Quarter', 'Digbeth', 'Moseley', 'Harborne'], streets: ['New St', 'Broad St', 'Corporation St', 'Warstone Ln'] },
    { id: 'leeds', name: 'Leeds', state: 'England', rank: 35, featured: false, country: 'GB', countryName: 'United Kingdom', group: 'United Kingdom', walk: 74, transit: 60, avgRoom: 700, avgFurnished: 1800, neighborhoods: ['Holbeck', 'Headingley', 'City Centre', 'Chapel Allerton'], streets: ['Briggate', 'Headingley Ln', 'The Calls', 'Meanwood Rd'] },
    { id: 'bristol', name: 'Bristol', state: 'England', rank: 36, featured: false, country: 'GB', countryName: 'United Kingdom', group: 'United Kingdom', walk: 76, transit: 58, avgRoom: 900, avgFurnished: 2300, neighborhoods: ['Montpelier', 'Clifton', 'Bedminster', 'Stokes Croft'], streets: ['Park St', 'Whiteladies Rd', 'Gloucester Rd', 'North St'] },
    { id: 'liverpool', name: 'Liverpool', state: 'England', rank: 37, featured: false, country: 'GB', countryName: 'United Kingdom', group: 'United Kingdom', walk: 75, transit: 62, avgRoom: 700, avgFurnished: 1800, neighborhoods: ['Baltic Triangle', 'Georgian Quarter', 'Ropewalks', 'Anfield'], streets: ['Hope St', 'Bold St', 'Duke St', 'Seel St'] },
    { id: 'edinburgh', name: 'Edinburgh', state: 'Scotland', rank: 38, featured: true, country: 'GB', countryName: 'United Kingdom', group: 'Scotland', walk: 84, transit: 70, avgRoom: 950, avgFurnished: 2500, neighborhoods: ['Old Town', 'New Town', 'Leith', 'Stockbridge', 'Marchmont'], streets: ['Royal Mile', 'Leith Walk', 'Princes St', 'Raeburn Pl'] },
    { id: 'glasgow', name: 'Glasgow', state: 'Scotland', rank: 39, featured: false, country: 'GB', countryName: 'United Kingdom', group: 'Scotland', walk: 80, transit: 74, avgRoom: 750, avgFurnished: 1900, neighborhoods: ['West End', 'Merchant City', 'Finnieston', 'Southside'], streets: ['Byres Rd', 'Sauchiehall St', 'Argyle St', 'Great Western Rd'] },
    { id: 'dublin', name: 'Dublin', state: 'Ireland', rank: 40, featured: true, country: 'IE', countryName: 'Ireland', group: 'Ireland', walk: 82, transit: 68, avgRoom: 1300, avgFurnished: 3400, neighborhoods: ['Portobello', 'Rathmines', 'Stoneybatter', 'Docklands', 'Temple Bar'], streets: ['South Circular Rd', 'Dame St', 'Grand Canal St', 'Manor St'] },
    { id: 'cork', name: 'Cork', state: 'Ireland', rank: 41, featured: false, country: 'IE', countryName: 'Ireland', group: 'Ireland', walk: 76, transit: 48, avgRoom: 900, avgFurnished: 2200, neighborhoods: ['Shandon', 'City Centre', 'Blackrock', 'Douglas'], streets: ['St Patrick St', 'Washington St', 'MacCurtain St', 'South Mall'] },
    { id: 'galway', name: 'Galway', state: 'Ireland', rank: 42, featured: false, country: 'IE', countryName: 'Ireland', group: 'Ireland', walk: 80, transit: 42, avgRoom: 850, avgFurnished: 2000, neighborhoods: ['Latin Quarter', 'Salthill', 'Newcastle', 'Claddagh'], streets: ['Shop St', 'Salthill Rd', 'University Rd', 'Quay St'] },
    { id: 'paris', name: 'Paris', state: 'France', rank: 43, featured: true, country: 'FR', countryName: 'France', group: 'France', walk: 93, transit: 90, avgRoom: 1400, avgFurnished: 3800, neighborhoods: ['Le Marais', 'Canal Saint-Martin', 'Belleville', 'Montmartre', 'Oberkampf', 'Bastille'], streets: ['Rue de Rivoli', 'Blvd de Belleville', 'Rue des Martyrs', 'Rue Oberkampf'] },
    { id: 'lyon', name: 'Lyon', state: 'France', rank: 44, featured: false, country: 'FR', countryName: 'France', group: 'France', walk: 82, transit: 78, avgRoom: 850, avgFurnished: 2300, neighborhoods: ['Croix-Rousse', 'Vieux Lyon', 'Part-Dieu', 'Guillotière'], streets: ['Rue de la République', 'Cours Vitton', 'Rue Mercière', 'Cours Gambetta'] },
    { id: 'marseille', name: 'Marseille', state: 'France', rank: 45, featured: false, country: 'FR', countryName: 'France', group: 'France', walk: 74, transit: 62, avgRoom: 700, avgFurnished: 1900, neighborhoods: ['Le Panier', 'Cours Julien', 'Vieux-Port', 'La Plaine'], streets: ['La Canebière', 'Rue Sainte', 'Cours Julien', 'Rue de la République'] },
    { id: 'toulouse', name: 'Toulouse', state: 'France', rank: 46, featured: false, country: 'FR', countryName: 'France', group: 'France', walk: 78, transit: 66, avgRoom: 750, avgFurnished: 2000, neighborhoods: ['Capitole', 'Saint-Cyprien', 'Carmes', 'Compans'], streets: ['Rue d Alsace-Lorraine', 'Allées Jean Jaurès', 'Rue du Taur', 'Place Saint-Pierre'] },
    { id: 'nice', name: 'Nice', state: 'France', rank: 47, featured: false, country: 'FR', countryName: 'France', group: 'France', walk: 80, transit: 58, avgRoom: 950, avgFurnished: 2600, neighborhoods: ['Vieux Nice', 'Liberation', 'Cimiez', 'Port'], streets: ['Promenade des Anglais', 'Rue de France', 'Ave Jean Médecin', 'Rue Bonaparte'] },
    { id: 'madrid', name: 'Madrid', state: 'Spain', rank: 48, featured: true, country: 'ES', countryName: 'Spain', group: 'Spain', walk: 88, transit: 86, avgRoom: 900, avgFurnished: 2500, neighborhoods: ['Malasaña', 'Lavapiés', 'Salamanca', 'Chueca', 'La Latina'], streets: ['Gran Vía', 'Calle Fuencarral', 'Calle de Atocha', 'Calle de Hortaleza'] },
    { id: 'barcelona', name: 'Barcelona', state: 'Spain', rank: 49, featured: true, country: 'ES', countryName: 'Spain', group: 'Spain', walk: 90, transit: 84, avgRoom: 1000, avgFurnished: 2800, neighborhoods: ['Gràcia', 'Eixample', 'El Born', 'Poblenou', 'El Raval'], streets: ['Passeig de Gràcia', 'Carrer de Consell de Cent', 'Carrer de Verdi', 'Rambla del Poblenou'] },
    { id: 'valencia', name: 'Valencia', state: 'Spain', rank: 50, featured: false, country: 'ES', countryName: 'Spain', group: 'Spain', walk: 86, transit: 72, avgRoom: 700, avgFurnished: 1900, neighborhoods: ['Ruzafa', 'El Carmen', 'Benimaclet', 'Cabanyal'], streets: ['Calle Colón', 'Avenida del Puerto', 'Carrer de Russafa', 'Calle de Sagunto'] },
    { id: 'seville', name: 'Seville', state: 'Spain', rank: 51, featured: false, country: 'ES', countryName: 'Spain', group: 'Spain', walk: 84, transit: 56, avgRoom: 650, avgFurnished: 1700, neighborhoods: ['Triana', 'Alameda', 'Santa Cruz', 'Nervión'], streets: ['Calle Sierpes', 'Calle Betis', 'Alameda de Hércules', 'Av de la Constitución'] },
    { id: 'amsterdam', name: 'Amsterdam', state: 'Netherlands', rank: 52, featured: true, country: 'NL', countryName: 'Netherlands', group: 'Netherlands', walk: 91, transit: 82, avgRoom: 1400, avgFurnished: 3600, neighborhoods: ['De Pijp', 'Jordaan', 'Oud-West', 'Noord', 'Oost'], streets: ['Albert Cuypstraat', 'Haarlemmerstraat', 'Kinkerstraat', 'Javastraat'] },
    { id: 'rotterdam', name: 'Rotterdam', state: 'Netherlands', rank: 53, featured: false, country: 'NL', countryName: 'Netherlands', group: 'Netherlands', walk: 80, transit: 78, avgRoom: 950, avgFurnished: 2500, neighborhoods: ['Kop van Zuid', 'Centrum', 'Delfshaven', 'Kralingen'], streets: ['Witte de Withstraat', 'Coolsingel', 'West-Kruiskade', 'Oostzeedijk'] },
    { id: 'the-hague', name: 'The Hague', state: 'Netherlands', rank: 54, featured: false, country: 'NL', countryName: 'Netherlands', group: 'Netherlands', walk: 82, transit: 76, avgRoom: 1000, avgFurnished: 2600, neighborhoods: ['Zeeheldenkwartier', 'Statenkwartier', 'Centrum', 'Scheveningen'], streets: ['Denneweg', 'Spui', 'Frederik Hendriklaan', 'Noordeinde'] },
    { id: 'utrecht', name: 'Utrecht', state: 'Netherlands', rank: 55, featured: false, country: 'NL', countryName: 'Netherlands', group: 'Netherlands', walk: 88, transit: 80, avgRoom: 1100, avgFurnished: 2800, neighborhoods: ['Wittevrouwen', 'Lombok', 'Centrum', 'Oost'], streets: ['Oudegracht', 'Voorstraat', 'Kanaalstraat', 'Nachtegaalstraat'] },
    { id: 'zurich', name: 'Zurich', state: 'Switzerland', rank: 56, featured: true, country: 'CH', countryName: 'Switzerland', group: 'Switzerland', walk: 86, transit: 88, avgRoom: 1800, avgFurnished: 4800, neighborhoods: ['Kreis 4', 'Kreis 5', 'Wiedikon', 'Seefeld', 'Langstrasse'], streets: ['Langstrasse', 'Bahnhofstrasse', 'Europaallee', 'Seefeldstrasse'] },
    { id: 'geneva', name: 'Geneva', state: 'Switzerland', rank: 57, featured: false, country: 'CH', countryName: 'Switzerland', group: 'Switzerland', walk: 82, transit: 80, avgRoom: 1700, avgFurnished: 4600, neighborhoods: ['Pâquis', 'Carouge', 'Eaux-Vives', 'Plainpalais'], streets: ['Rue de Lausanne', 'Rue du Rhône', 'Rue de Carouge', 'Rue des Eaux-Vives'] },
    { id: 'basel', name: 'Basel', state: 'Switzerland', rank: 58, featured: false, country: 'CH', countryName: 'Switzerland', group: 'Switzerland', walk: 84, transit: 82, avgRoom: 1400, avgFurnished: 3800, neighborhoods: ['Gundeldingen', 'St. Johann', 'Altstadt', 'Kleinbasel'], streets: ['Freie Strasse', 'Clarastrasse', 'Gundeldingerstrasse', 'Feldbergstrasse'] },
    { id: 'bern', name: 'Bern', state: 'Switzerland', rank: 59, featured: false, country: 'CH', countryName: 'Switzerland', group: 'Switzerland', walk: 85, transit: 80, avgRoom: 1300, avgFurnished: 3500, neighborhoods: ['Breitenrain', 'Lorraine', 'Kirchenfeld', 'Matte'], streets: ['Marktgasse', 'Spitalgasse', 'Lorrainestrasse', 'Thunstrasse'] },
    { id: 'berlin', name: 'Berlin', state: 'Germany', rank: 60, featured: true, country: 'DE', countryName: 'Germany', group: 'Germany', walk: 86, transit: 85, avgRoom: 850, avgFurnished: 2400, neighborhoods: ['Kreuzberg', 'Neukölln', 'Prenzlauer Berg', 'Mitte', 'Friedrichshain', 'Wedding'], streets: ['Oranienstraße', 'Kastanienallee', 'Karl-Marx-Allee', 'Weserstraße'] },
    { id: 'munich', name: 'Munich', state: 'Germany', rank: 61, featured: false, country: 'DE', countryName: 'Germany', group: 'Germany', walk: 82, transit: 84, avgRoom: 1200, avgFurnished: 3200, neighborhoods: ['Schwabing', 'Glockenbach', 'Maxvorstadt', 'Haidhausen'], streets: ['Leopoldstraße', 'Müllerstraße', 'Türkenstraße', 'Weißenburger Str'] },
    { id: 'hamburg', name: 'Hamburg', state: 'Germany', rank: 62, featured: false, country: 'DE', countryName: 'Germany', group: 'Germany', walk: 80, transit: 82, avgRoom: 950, avgFurnished: 2600, neighborhoods: ['Sternschanze', 'St. Pauli', 'Altona', 'Winterhude'], streets: ['Schanzenstraße', 'Reeperbahn', 'Ottenser Hauptstraße', 'Osterstraße'] },
    { id: 'frankfurt', name: 'Frankfurt', state: 'Germany', rank: 63, featured: false, country: 'DE', countryName: 'Germany', group: 'Germany', walk: 78, transit: 80, avgRoom: 1000, avgFurnished: 2800, neighborhoods: ['Sachsenhausen', 'Nordend', 'Bornheim', 'Ostend'], streets: ['Schweizer Straße', 'Berger Straße', 'Oeder Weg', 'Hanauer Landstraße'] },
    { id: 'cologne', name: 'Cologne', state: 'Germany', rank: 64, featured: false, country: 'DE', countryName: 'Germany', group: 'Germany', walk: 80, transit: 78, avgRoom: 850, avgFurnished: 2300, neighborhoods: ['Ehrenfeld', 'Belgisches Viertel', 'Südstadt', 'Deutz'], streets: ['Aachener Straße', 'Ehrenstraße', 'Bonner Straße', 'Deutzer Freiheit'] },
    { id: 'rome', name: 'Rome', state: 'Italy', rank: 65, featured: true, country: 'IT', countryName: 'Italy', group: 'Italy', walk: 84, transit: 68, avgRoom: 900, avgFurnished: 2600, neighborhoods: ['Trastevere', 'Monti', 'Testaccio', 'San Lorenzo', 'Prati'], streets: ['Via del Corso', 'Viale Trastevere', 'Via Nazionale', 'Via dei Serpenti'] },
    { id: 'milan', name: 'Milan', state: 'Italy', rank: 66, featured: true, country: 'IT', countryName: 'Italy', group: 'Italy', walk: 86, transit: 80, avgRoom: 1100, avgFurnished: 3000, neighborhoods: ['Navigli', 'Porta Venezia', 'Isola', 'Porta Romana', 'Brera'], streets: ['Corso Buenos Aires', 'Via Tortona', 'Corso Como', 'Via Ripamonti'] },
    { id: 'florence', name: 'Florence', state: 'Italy', rank: 67, featured: false, country: 'IT', countryName: 'Italy', group: 'Italy', walk: 90, transit: 52, avgRoom: 850, avgFurnished: 2400, neighborhoods: ['Santo Spirito', 'Santa Croce', 'San Lorenzo', 'Oltrarno'], streets: ['Via de Tornabuoni', 'Via Guicciardini', 'Borgo San Frediano', 'Via dei Neri'] },
    { id: 'naples', name: 'Naples', state: 'Italy', rank: 68, featured: false, country: 'IT', countryName: 'Italy', group: 'Italy', walk: 78, transit: 60, avgRoom: 650, avgFurnished: 1700, neighborhoods: ['Chiaia', 'Vomero', 'Centro Storico', 'Posillipo'], streets: ['Via Toledo', 'Via dei Mille', 'Via Chiaia', 'Via Scarlatti'] },
    { id: 'turin', name: 'Turin', state: 'Italy', rank: 69, featured: false, country: 'IT', countryName: 'Italy', group: 'Italy', walk: 80, transit: 64, avgRoom: 700, avgFurnished: 1900, neighborhoods: ['San Salvario', 'Vanchiglia', 'Crocetta', 'Centro'], streets: ['Via Po', 'Via Roma', 'Corso Vittorio Emanuele', 'Via Mazzini'] },
    { id: 'toronto', name: 'Toronto', state: 'ON', rank: 70, featured: true, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 61, transit: 78, avgRoom: 1150, avgFurnished: 2900, neighborhoods: ['Kensington Market', 'Liberty Village', 'Leslieville', 'The Annex', 'Queen West', 'Riverdale', 'The Junction', 'Little Italy'], streets: ['Queen St W', 'Dundas St W', 'Ossington Ave', 'Bloor St W', 'College St'] },
    { id: 'montreal', name: 'Montreal', state: 'QC', rank: 71, featured: true, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 65, transit: 67, avgRoom: 850, avgFurnished: 2100, neighborhoods: ['Le Plateau', 'Mile End', 'Griffintown', 'Villeray', 'Verdun', 'Rosemont'], streets: ['Boulevard Saint-Laurent', 'Rue Saint-Denis', 'Avenue du Mont-Royal', 'Rue Notre-Dame O'] },
    { id: 'vancouver', name: 'Vancouver', state: 'BC', rank: 72, featured: true, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 80, transit: 74, avgRoom: 1200, avgFurnished: 3100, neighborhoods: ['Mount Pleasant', 'Kitsilano', 'Gastown', 'Yaletown', 'Commercial Drive', 'West End'], streets: ['Main St', 'Commercial Dr', 'West 4th Ave', 'Granville St', 'Davie St'] },
    { id: 'calgary', name: 'Calgary', state: 'AB', rank: 73, featured: true, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 48, transit: 56, avgRoom: 800, avgFurnished: 2000, neighborhoods: ['Kensington', 'Inglewood', 'Beltline', 'Bridgeland', 'Mission'], streets: ['17 Ave SW', 'Kensington Rd NW', '9 Ave SE', '4 St SW'] },
    { id: 'ottawa', name: 'Ottawa', state: 'ON', rank: 74, featured: false, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 54, transit: 67, avgRoom: 900, avgFurnished: 2200, neighborhoods: ['The Glebe', 'Westboro', 'ByWard Market', 'Hintonburg', 'Sandy Hill'], streets: ['Bank St', 'Wellington St W', 'Elgin St', 'Preston St'] },
    { id: 'edmonton', name: 'Edmonton', state: 'AB', rank: 75, featured: false, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 51, transit: 56, avgRoom: 700, avgFurnished: 1750, neighborhoods: ['Old Strathcona', 'Oliver', 'Garneau', 'Downtown', 'Ritchie'], streets: ['Whyte Ave', 'Jasper Ave', '124 St NW', '104 St NW'] },
    { id: 'quebec-city', name: 'Quebec City', state: 'QC', rank: 76, featured: false, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 51, transit: 52, avgRoom: 650, avgFurnished: 1600, neighborhoods: ['Saint-Roch', 'Montcalm', 'Saint-Jean-Baptiste', 'Limoilou'], streets: ['Rue Saint-Joseph E', 'Grande Allee E', 'Avenue Cartier', '3e Avenue'] },
    { id: 'winnipeg', name: 'Winnipeg', state: 'MB', rank: 77, featured: false, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 55, transit: 51, avgRoom: 650, avgFurnished: 1550, neighborhoods: ['Osborne Village', 'Exchange District', 'Wolseley', 'Corydon'], streets: ['Osborne St', 'Corydon Ave', 'Portage Ave', 'Main St'] },
    { id: 'hamilton', name: 'Hamilton', state: 'ON', rank: 78, featured: false, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 52, transit: 45, avgRoom: 800, avgFurnished: 1900, neighborhoods: ['Westdale', 'Durand', 'Corktown', 'Ainslie Wood'], streets: ['Locke St S', 'James St N', 'King St E', 'Ottawa St N'] },
    { id: 'halifax', name: 'Halifax', state: 'NS', rank: 79, featured: false, country: 'CA', countryName: 'Canada', group: 'Canada', walk: 60, transit: 45, avgRoom: 850, avgFurnished: 2000, neighborhoods: ['North End', 'South End', 'Downtown', 'Dartmouth'], streets: ['Spring Garden Rd', 'Gottingen St', 'Barrington St', 'Quinpool Rd'] }
  ];

  function slugify(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  const TYPE_FILES = {
    room: 'rooms.html',
    coliving: 'coliving.html',
    furnished: 'furnished.html',
    'short-term': 'short-term.html',
    aparthotel: 'aparthotel.html',
    'lease-break': 'lease-break.html'
  };
  const CITY_GEO = {
    nyc: { lat: 40.7128, lng: -74.006 },
    la: { lat: 34.0522, lng: -118.2437 },
    chicago: { lat: 41.8781, lng: -87.6298 },
    houston: { lat: 29.7604, lng: -95.3698 },
    phoenix: { lat: 33.4484, lng: -112.074 },
    philadelphia: { lat: 39.9526, lng: -75.1652 },
    'san-antonio': { lat: 29.4252, lng: -98.4946 },
    'san-diego': { lat: 32.7157, lng: -117.1611 },
    dallas: { lat: 32.7767, lng: -96.797 },
    jacksonville: { lat: 30.3322, lng: -81.6557 },
    austin: { lat: 30.2672, lng: -97.7431 },
    'fort-worth': { lat: 32.7555, lng: -97.3308 },
    'san-jose': { lat: 37.3382, lng: -121.8863 },
    columbus: { lat: 39.9612, lng: -82.9988 },
    charlotte: { lat: 35.2271, lng: -80.8431 },
    indianapolis: { lat: 39.7684, lng: -86.1581 },
    sf: { lat: 37.7749, lng: -122.4194 },
    seattle: { lat: 47.6062, lng: -122.3321 },
    denver: { lat: 39.7392, lng: -104.9903 },
    'oklahoma-city': { lat: 35.4676, lng: -97.5164 },
    nashville: { lat: 36.1627, lng: -86.7816 },
    dc: { lat: 38.9072, lng: -77.0369 },
    'el-paso': { lat: 31.7619, lng: -106.485 },
    boston: { lat: 42.3601, lng: -71.0589 },
    'las-vegas': { lat: 36.1699, lng: -115.1398 },
    portland: { lat: 45.5152, lng: -122.6784 },
    detroit: { lat: 42.3314, lng: -83.0458 },
    memphis: { lat: 35.1495, lng: -90.049 },
    louisville: { lat: 38.2527, lng: -85.7585 },
    baltimore: { lat: 39.2904, lng: -76.6122 },
    miami: { lat: 25.7617, lng: -80.1918 },
    london: { lat: 51.5074, lng: -0.1278 },
    manchester: { lat: 53.4808, lng: -2.2426 },
    birmingham: { lat: 52.4862, lng: -1.8904 },
    leeds: { lat: 53.8008, lng: -1.5491 },
    bristol: { lat: 51.4545, lng: -2.5879 },
    liverpool: { lat: 53.4084, lng: -2.9916 },
    edinburgh: { lat: 55.9533, lng: -3.1883 },
    glasgow: { lat: 55.8642, lng: -4.2518 },
    dublin: { lat: 53.3498, lng: -6.2603 },
    cork: { lat: 51.8985, lng: -8.4756 },
    galway: { lat: 53.2707, lng: -9.0568 },
    paris: { lat: 48.8566, lng: 2.3522 },
    lyon: { lat: 45.764, lng: 4.8357 },
    marseille: { lat: 43.2965, lng: 5.3698 },
    toulouse: { lat: 43.6047, lng: 1.4442 },
    nice: { lat: 43.7102, lng: 7.262 },
    madrid: { lat: 40.4168, lng: -3.7038 },
    barcelona: { lat: 41.3874, lng: 2.1686 },
    valencia: { lat: 39.4699, lng: -0.3763 },
    seville: { lat: 37.3891, lng: -5.9845 },
    amsterdam: { lat: 52.3676, lng: 4.9041 },
    rotterdam: { lat: 51.9244, lng: 4.4777 },
    'the-hague': { lat: 52.0705, lng: 4.3007 },
    utrecht: { lat: 52.0907, lng: 5.1214 },
    zurich: { lat: 47.3769, lng: 8.5417 },
    geneva: { lat: 46.2044, lng: 6.1432 },
    basel: { lat: 47.5596, lng: 7.5886 },
    bern: { lat: 46.948, lng: 7.4474 },
    berlin: { lat: 52.52, lng: 13.405 },
    munich: { lat: 48.1351, lng: 11.582 },
    hamburg: { lat: 53.5511, lng: 9.9937 },
    frankfurt: { lat: 50.1109, lng: 8.6821 },
    cologne: { lat: 50.9375, lng: 6.9603 },
    rome: { lat: 41.9028, lng: 12.4964 },
    milan: { lat: 45.4642, lng: 9.19 },
    florence: { lat: 43.7696, lng: 11.2558 },
    naples: { lat: 40.8518, lng: 14.2681 },
    turin: { lat: 45.0703, lng: 7.6869 },
    toronto: { lat: 43.6532, lng: -79.3832 },
    montreal: { lat: 45.5019, lng: -73.5674 },
    vancouver: { lat: 49.2827, lng: -123.1207 },
    calgary: { lat: 51.0447, lng: -114.0719 },
    ottawa: { lat: 45.4215, lng: -75.6972 },
    edmonton: { lat: 53.5461, lng: -113.4938 },
    'quebec-city': { lat: 46.8139, lng: -71.208 },
    winnipeg: { lat: 49.8951, lng: -97.1384 },
    hamilton: { lat: 43.2557, lng: -79.8711 },
    halifax: { lat: 44.6488, lng: -63.5752 }
  };

  const TRANSIT = {
    nyc: [
      { id: 'L', name: 'L', system: 'NYC Subway', color: '#A7A9AC', path: [[40.74, -74.002], [40.735, -73.991], [40.717, -73.957], [40.7, -73.912]] },
      { id: 'G', name: 'G', system: 'NYC Subway', color: '#6CBE45', path: [[40.747, -73.945], [40.715, -73.952], [40.69, -73.951]] },
      { id: '6', name: '6', system: 'NYC Subway', color: '#00933C', path: [[40.804, -73.937], [40.78, -73.958], [40.735, -73.99], [40.713, -74.004]] },
      { id: 'A', name: 'A', system: 'NYC Subway', color: '#0039A6', path: [[40.811, -73.953], [40.768, -73.982], [40.732, -74.0], [40.692, -73.99]] },
      { id: '7', name: '7', system: 'NYC Subway', color: '#B933AD', path: [[40.755, -74.002], [40.755, -73.987], [40.753, -73.977], [40.747, -73.945]] }
    ],
    chicago: [
      { id: 'Red', name: 'Red', system: 'CTA', color: '#C60C30', path: [[41.984, -87.659], [41.91, -87.649], [41.879, -87.628], [41.831, -87.631]] },
      { id: 'Blue', name: 'Blue', system: 'CTA', color: '#00A1DE', path: [[41.977, -87.904], [41.875, -87.641], [41.874, -87.627]] },
      { id: 'Brown', name: 'Brown', system: 'CTA', color: '#62361B', path: [[41.967, -87.689], [41.91, -87.649], [41.879, -87.626]] }
    ],
    sf: [
      { id: 'BART', name: 'BART', system: 'BART', color: '#0099D8', path: [[37.79, -122.397], [37.779, -122.419], [37.752, -122.419], [37.722, -122.447]] },
      { id: 'N', name: 'N Judah', system: 'Muni', color: '#003399', path: [[37.793, -122.396], [37.77, -122.447], [37.76, -122.509]] }
    ],
    boston: [
      { id: 'Red', name: 'Red', system: 'MBTA', color: '#DA291C', path: [[42.396, -71.142], [42.365, -71.104], [42.356, -71.062], [42.33, -71.057]] },
      { id: 'Orange', name: 'Orange', system: 'MBTA', color: '#ED8B00', path: [[42.374, -71.075], [42.356, -71.063], [42.33, -71.096]] },
      { id: 'Green', name: 'Green', system: 'MBTA', color: '#00843D', path: [[42.352, -71.125], [42.356, -71.063], [42.36, -71.058]] }
    ],
    dc: [
      { id: 'Red', name: 'Red', system: 'Metro', color: '#BF0D3E', path: [[38.943, -77.018], [38.907, -77.022], [38.898, -77.022], [38.885, -76.995]] },
      { id: 'Yellow', name: 'Yellow', system: 'Metro', color: '#FFD100', path: [[38.921, -77.042], [38.897, -77.022], [38.877, -77.016]] },
      { id: 'Blue', name: 'Blue', system: 'Metro', color: '#009CDE', path: [[38.886, -77.022], [38.895, -77.022], [38.9, -77.05]] }
    ],
    la: [
      { id: 'B', name: 'B', system: 'Metro', color: '#EB131B', path: [[34.168, -118.377], [34.102, -118.326], [34.049, -118.258]] },
      { id: 'A', name: 'A', system: 'Metro', color: '#0072BC', path: [[34.049, -118.258], [34.033, -118.161], [33.942, -118.133]] },
      { id: 'E', name: 'E', system: 'Metro', color: '#FDB913', path: [[34.018, -118.491], [34.049, -118.258]] }
    ],
    miami: [
      { id: 'Metrorail', name: 'Metrorail', system: 'MDT', color: '#F47321', path: [[25.79, -80.19], [25.775, -80.196], [25.746, -80.262]] },
      { id: 'Metromover', name: 'Metromover', system: 'MDT', color: '#00A3E0', path: [[25.779, -80.19], [25.772, -80.19], [25.765, -80.192]] }
    ],
    seattle: [
      { id: '1', name: '1 Line', system: 'Link', color: '#1E9B5A', path: [[47.662, -122.314], [47.62, -122.321], [47.598, -122.328]] }
    ],
    denver: [
      { id: 'A', name: 'A', system: 'RTD', color: '#57C1E8', path: [[39.769, -104.847], [39.753, -104.999]] },
      { id: 'W', name: 'W', system: 'RTD', color: '#009270', path: [[39.74, -105.08], [39.753, -104.999]] }
    ],
    philadelphia: [
      { id: 'MFL', name: 'Market-Frankford', system: 'SEPTA', color: '#0078C6', path: [[39.956, -75.182], [39.952, -75.164], [39.97, -75.125]] },
      { id: 'BSL', name: 'Broad Street', system: 'SEPTA', color: '#F58220', path: [[40.023, -75.149], [39.952, -75.164], [39.917, -75.169]] }
    ],
    austin: [
      { id: 'Red', name: 'Red Line', system: 'CapMetro', color: '#C8102E', path: [[30.334, -97.72], [30.267, -97.743]] }
    ],
    london: [
      { id: 'Central', name: 'Central', system: 'TfL', color: '#E32017', path: [[51.515, -0.176], [51.515, -0.142], [51.518, -0.082], [51.512, -0.056]] },
      { id: 'Northern', name: 'Northern', system: 'TfL', color: '#000000', path: [[51.556, -0.138], [51.53, -0.123], [51.503, -0.114], [51.474, -0.089]] },
      { id: 'Elizabeth', name: 'Elizabeth', system: 'TfL', color: '#6950A1', path: [[51.507, -0.188], [51.508, -0.125], [51.518, -0.081]] }
    ],
    edinburgh: [
      { id: 'Tram', name: 'Tram', system: 'Edinburgh Trams', color: '#8B1D41', path: [[55.95, -3.36], [55.948, -3.21], [55.953, -3.19]] }
    ],
    dublin: [
      { id: 'Luas-Red', name: 'Luas Red', system: 'Luas', color: '#E30613', path: [[53.347, -6.29], [53.347, -6.26], [53.334, -6.23]] },
      { id: 'Luas-Green', name: 'Luas Green', system: 'Luas', color: '#00A650', path: [[53.349, -6.26], [53.333, -6.258], [53.3, -6.246]] }
    ],
    paris: [
      { id: 'M1', name: 'M1', system: 'RATP', color: '#FFCD00', path: [[48.865, 2.29], [48.869, 2.333], [48.853, 2.369]] },
      { id: 'M4', name: 'M4', system: 'RATP', color: '#BB4B9B', path: [[48.88, 2.355], [48.853, 2.346], [48.833, 2.331]] },
      { id: 'RER-A', name: 'RER A', system: 'RATP', color: '#E3051C', path: [[48.892, 2.24], [48.875, 2.326], [48.844, 2.373]] }
    ],
    madrid: [
      { id: 'L1', name: 'L1', system: 'Metro Madrid', color: '#0097D0', path: [[40.466, -3.69], [40.42, -3.702], [40.39, -3.66]] },
      { id: 'L6', name: 'L6', system: 'Metro Madrid', color: '#9B9812', path: [[40.447, -3.692], [40.42, -3.72], [40.406, -3.678]] }
    ],
    barcelona: [
      { id: 'L3', name: 'L3', system: 'TMB', color: '#00A651', path: [[41.419, 2.14], [41.387, 2.17], [41.375, 2.178]] },
      { id: 'L5', name: 'L5', system: 'TMB', color: '#0072BC', path: [[41.384, 2.13], [41.393, 2.166], [41.42, 2.186]] }
    ],
    amsterdam: [
      { id: '52', name: '52 Noord/Zuid', system: 'GVB', color: '#F9B000', path: [[52.402, 4.932], [52.378, 4.901], [52.347, 4.891]] },
      { id: 'T2', name: 'Tram 2', system: 'GVB', color: '#E30613', path: [[52.377, 4.897], [52.365, 4.883], [52.355, 4.868]] }
    ],
    zurich: [
      { id: 'S', name: 'S-Bahn', system: 'ZVV', color: '#1D4289', path: [[47.42, 8.55], [47.378, 8.54], [47.35, 8.52]] },
      { id: 'T11', name: 'Tram 11', system: 'VBZ', color: '#00A19A', path: [[47.39, 8.52], [47.377, 8.54], [47.36, 8.56]] }
    ],
    berlin: [
      { id: 'U1', name: 'U1', system: 'BVG', color: '#7DAD4C', path: [[52.499, 13.336], [52.499, 13.418], [52.507, 13.454]] },
      { id: 'U8', name: 'U8', system: 'BVG', color: '#224F86', path: [[52.554, 13.388], [52.52, 13.412], [52.478, 13.43]] },
      { id: 'S41', name: 'Ringbahn', system: 'S-Bahn', color: '#AD5937', path: [[52.526, 13.369], [52.52, 13.412], [52.505, 13.469]] }
    ],
    rome: [
      { id: 'A', name: 'Metro A', system: 'ATAC', color: '#F7A800', path: [[41.906, 12.447], [41.902, 12.496], [41.891, 12.511]] },
      { id: 'B', name: 'Metro B', system: 'ATAC', color: '#0072BC', path: [[41.94, 12.5], [41.902, 12.496], [41.86, 12.478]] }
    ],
    milan: [
      { id: 'M1', name: 'M1', system: 'ATM', color: '#E30613', path: [[45.49, 9.15], [45.465, 9.19], [45.452, 9.205]] },
      { id: 'M2', name: 'M2', system: 'ATM', color: '#00A651', path: [[45.49, 9.21], [45.465, 9.19], [45.44, 9.17]] }
    ]
  };


  /* ---------------------------------------------------------------------
   * Currency
   * -------------------------------------------------------------------
   * Every listing's price is stored in its OWN market's currency — a
   * Toronto room is 1150 CAD, a Paris room is 1400 EUR. Mixing those in one
   * list would make sorting and budget filters meaningless, so the UI
   * converts everything into a single display currency the visitor picks.
   *
   * FX_PER_USD is how many units of each currency one US dollar buys. These
   * are STATIC APPROXIMATIONS, not live rates — fine for ranking and rough
   * comparison, not for quoting an exact amount. Swap this object for a
   * rates feed when exact figures matter.
   * ------------------------------------------------------------------- */
  const FX_PER_USD = { USD: 1, CAD: 1.36, EUR: 0.92, GBP: 0.79, CHF: 0.88 };
  const FX_UPDATED = '2026-09';

  const CURRENCY_BY_COUNTRY = {
    US: 'USD', CA: 'CAD', GB: 'GBP', IE: 'EUR', FR: 'EUR', ES: 'EUR',
    NL: 'EUR', DE: 'EUR', IT: 'EUR', CH: 'CHF'
  };

  function currencyForCountry(code) {
    return CURRENCY_BY_COUNTRY[code] || 'USD';
  }

  /** Convert between any two supported currencies. */
  function convert(amount, from, to) {
    const a = Number(amount) || 0;
    const f = FX_PER_USD[from] || 1;
    const t = FX_PER_USD[to] || 1;
    if (f === t) return a;
    return (a / f) * t;
  }

  function toUsd(amount, from) {
    return convert(amount, from, 'USD');
  }

  /** Format an amount in its own currency — used for alt text and any
   *  string baked into the catalog, which must not assume dollars. */
  function fmt(amount, currency) {
    var cur = currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: cur,
        minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(Math.round(Number(amount) || 0));
    } catch (e) {
      return '$' + Math.round(Number(amount) || 0).toLocaleString();
    }
  }

  CITIES.forEach((c) => {
    if (!c.country) {
      c.country = 'US';
      c.countryName = 'United States';
      c.group = 'United States';
    }
    c.slug = c.id === 'dc' ? 'washington-dc' : slugify(c.name);
    const geo = CITY_GEO[c.id];
    if (geo) { c.lat = geo.lat; c.lng = geo.lng; }
    c.transitLines = TRANSIT[c.id] || [];
    c.currency = currencyForCountry(c.country);
  });

  const COLIVING_BRANDS = [
    { name: 'Commonline', events: true, cleaning: 'weekly', coworking: true },
    { name: 'Outpost House', events: true, cleaning: 'biweekly', coworking: true },
    { name: 'Kinship', events: true, cleaning: 'weekly', coworking: false },
    { name: 'Harbor & Hall', events: true, cleaning: 'weekly', coworking: true },
    { name: 'Relay Living', events: false, cleaning: 'weekly', coworking: true }
  ];

  const VIBES = ['quiet-professional', 'social', 'creative', 'early-riser', 'night-owl', 'mixed'];
  const OCCUPATIONS = ['product designer', 'nurse', 'grad student', 'software engineer', 'chef', 'consultant', 'teacher', 'film editor', 'analyst', 'founder'];
  const FIRST = ['Ava', 'Milo', 'Priya', 'Jordan', 'Sofia', 'Kai', 'Elena', 'Marcus', 'Nina', 'Leo', 'Amara', 'Owen'];
  const FURNITURE = ['bed + mattress', 'desk + chair', 'dresser', 'sofa', 'dining table', 'cookware', 'TV', 'lamps', 'blackout curtains', 'monitor arm'];
  const AMENITIES = ['laundry-in-unit', 'laundry-in-building', 'dishwasher', 'elevator', 'gym', 'roof-deck', 'bike-storage', 'doorman', 'ac', 'workspace', 'pets', 'parking', 'pool', 'package-room'];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function pick(arr, seed) {
    if (!arr || !arr.length) return undefined;
    const i = Math.abs(Number(seed) || 0) % arr.length;
    return arr[i];
  }
  function pickN(arr, n, seed) {
    const out = [];
    for (let i = 0; i < n && i < arr.length; i++) out.push(arr[(seed + i * 3) % arr.length]);
    return [...new Set(out)];
  }
  function jitter(base, seed, spread) {
    const n = (seed % (spread * 2 + 1)) - spread;
    return Math.max(400, Math.round((base + n) / 25) * 25);
  }
  function dateFrom(seed, startDays, span) {
    const d = new Date('2026-09-07T12:00:00');
    d.setDate(d.getDate() + (seed % span) + startDays);
    return d.toISOString().slice(0, 10);
  }
  function addMonths(iso, months) {
    const d = new Date(iso + 'T12:00:00');
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }
  function monthsBetween(a, b) {
    const da = new Date(a);
    const db = new Date(b);
    return Math.max(1, Math.round((db - da) / (1000 * 60 * 60 * 24 * 30)));
  }

  function typeLabel(type) {
    return (HOUSING_TYPES.find((t) => t.id === type) || { label: type }).label;
  }


  /* ---------------------------------------------------------------------
   * Operators
   * -------------------------------------------------------------------
   * Anyone listing here can hold more than one home and gets a boutique — a
   * branded storefront at /operators/<slug>.html carrying their whole
   * portfolio. Three kinds, because they behave differently:
   *
   *   coliving   national brands running purpose-built buildings
   *   portfolio  furnished / mid-term operators, regional
   *   landlord   individuals renting rooms, scoped to one city
   *
   * Lease-breaks are deliberately excluded: the person leaving is not an
   * operator and should not get a storefront.
   * ------------------------------------------------------------------- */
  const PORTFOLIO_BRANDS = [
    { name: 'Marlow & Co', tagline: 'Furnished homes for people in motion.', since: 2016 },
    { name: 'Northbound Stays', tagline: 'Mid-term apartments, no hotel nonsense.', since: 2018 },
    { name: 'Copperline Residences', tagline: 'Design-led furnished living, month to month.', since: 2015 },
    { name: 'Halcyon Housing', tagline: 'Calm, complete, move-in ready.', since: 2019 },
    { name: 'Fielder & Sons', tagline: 'A family portfolio, kept properly.', since: 2004 },
    { name: 'Alder Property Group', tagline: 'Long-term care for short-term stays.', since: 2011 }
  ];

  const HOTEL_BRANDS = [
    { name: 'Ledger House', tagline: 'Serviced apartments, monthly only.', since: 2017 },
    { name: 'Meridian Residences', tagline: 'Hotel service, tenancy terms.', since: 2013 },
    { name: 'Anchor & Key Suites', tagline: 'Housekeeping in, nightly rates out.', since: 2020 },
    { name: 'Solstice Stay', tagline: 'A front desk and a real lease.', since: 2018 }
  ];

  const COLIVING_TAGLINES = {
    'Commonline': 'Buildings that feel like a neighbourhood.',
    'Outpost House': 'Land somewhere that already works.',
    'Kinship': 'Rooms with people worth knowing.',
    'Harbor & Hall': 'Considered co-living, quietly run.',
    'Relay Living': 'Move in Friday, belong by Sunday.'
  };

  const LANDLORD_BIOS = [
    'Rents a handful of rooms in the neighbourhood and answers messages personally.',
    'Keeps a small portfolio nearby and handles every viewing themselves.',
    'A local owner who prefers long relationships to quick turnovers.',
    'Manages a few homes on the same few streets, and lives close by.'
  ];

  function operatorSlugOf(name) {
    return slugify(name);
  }

  /** Deterministic operator for a listing. Returns null for lease-breaks. */
  function operatorFor(city, type, seed, building) {
    if (type === 'lease-break') return null;

    if (type === 'coliving' && building && building.brand) {
      return {
        id: 'op-' + operatorSlugOf(building.brand),
        name: building.brand,
        kind: 'coliving',
        tagline: COLIVING_TAGLINES[building.brand] || 'Purpose-built co-living.',
        since: 2014 + (hash(building.brand) % 8),
        scope: 'national'
      };
    }

    if (type === 'aparthotel') {
      const b = HOTEL_BRANDS[hash(city.group + '|hotel') % HOTEL_BRANDS.length];
      return {
        id: 'op-' + operatorSlugOf(b.name),
        name: b.name,
        kind: 'hotel',
        tagline: b.tagline,
        since: b.since,
        scope: 'regional'
      };
    }

    if (type === 'furnished' || type === 'short-term') {
      const brand = PORTFOLIO_BRANDS[hash(city.group + '|' + type) % PORTFOLIO_BRANDS.length];
      return {
        id: 'op-' + operatorSlugOf(brand.name),
        name: brand.name,
        kind: 'portfolio',
        tagline: brand.tagline,
        since: brand.since,
        scope: 'regional'
      };
    }

    // Rooms: a small number of individual landlords per city.
    const perCity = 1;
    const n = seed % perCity;
    const first = pick(FIRST, hash(city.id + 'landlord') + n * 7);
    const last = pick(['Lee', 'Nguyen', 'Patel', 'Garcia', 'Kim', 'Ross', 'Okafor', 'Moreau'], hash(city.id) + n * 3);
    const name = first + ' ' + last;
    return {
      id: 'op-' + operatorSlugOf(name) + '-' + city.id,
      name: name,
      kind: 'landlord',
      tagline: LANDLORD_BIOS[(hash(name) + n) % LANDLORD_BIOS.length],
      since: 2012 + ((hash(name) + n) % 12),
      scope: city.name
    };
  }

  function buildListing(city, type, index) {
    const seed = hash(city.id + '-' + type + '-' + index);
    const nhood = pick(city.neighborhoods, seed);
    const streets = city.streets && city.streets.length ? city.streets : ["Main St"];
    const street = pick(streets, seed >> 3) || "Main St";
    const num = 20 + (seed % 1800);
    const unit = (seed % 18) + 1;
    const rooms = ['bedroom', 'bathroom', 'kitchen', 'living', 'workspace', 'exterior'];
    const photoPicks = rooms.map((key, i) => pick(GALLERY_POOL[key], seed + i * 17));
    photoPicks.push(pick(GALLERY_POOL.bedroom, seed + 41));
    photoPicks.push(pick(GALLERY_POOL.living, seed + 53));
    const seenSrc = {};
    const uniquePhotos = photoPicks.filter((p) => {
      if (seenSrc[p.src]) return false;
      seenSrc[p.src] = true;
      return true;
    });
    const videoPick = VIDEOS[seed % VIDEOS.length];
    const image = uniquePhotos[0].src;
    let availableFrom = dateFrom(seed, 0, 45);
    const hostType = type === 'coliving' ? 'operator' : type === 'lease-break' ? 'current-tenant' : (seed % 3 === 0 ? 'landlord' : 'host');
    const vibe = pick(VIBES, seed);
    const pets = pick(['none', 'cats', 'dogs', 'both', 'none'], seed >> 2);
    const verified = seed % 5 !== 0;
    const workspace = seed % 3 !== 1;
    let privateBath = type === 'furnished' || type === 'short-term' || seed % 3 === 0;
    let roommates = type === 'furnished' || type === 'short-term' ? 0 : 1 + (seed % 3);
    const amenityCount = 4 + (seed % 5);
    const amenities = pickN(AMENITIES, amenityCount, seed);
    if (workspace && !amenities.includes('workspace')) amenities.push('workspace');
    if (pets !== 'none' && !amenities.includes('pets')) amenities.push('pets');

    let price;
    let beds = 1;
    let baths = privateBath ? 1 : 1;
    let sqft = 140 + (seed % 90);
    let minStay = 1;
    let maxStay = 12;
    let leaseEnd = null;
    let remainingMonths = null;
    let takeoverType = null;
    let furnishedLevel = 'fully';
    let broker = 0;
    let utilities = 0;
    let wifi = 0;
    let cleaning = 0;
    let building = null;
    let housemates = [];
    let title;
    let description;

    if (type === 'room') {
      price = jitter(city.avgRoom, seed, 220);
      beds = 1;
      baths = privateBath ? 1 : 1;
      sqft = 110 + (seed % 70);
      minStay = seed % 4 === 0 ? 3 : 1;
      maxStay = 12;
      furnishedLevel = seed % 5 === 0 ? 'partial' : 'fully';
      utilities = seed % 2 === 0 ? 0 : 75;
      wifi = seed % 3 === 0 ? 0 : 40;
      title = privateBath
        ? 'Private room + bath in ' + nhood
        : 'Sunny private room in ' + nhood + ' share';
      housemates = Array.from({ length: roommates }, (_, i) => ({
        name: pick(FIRST, seed + i * 11),
        ageRange: pick(['24–28', '27–32', '30–36', '22–26'], seed + i),
        occupation: pick(OCCUPATIONS, seed + i * 5),
        vibe: pick(VIBES, seed + i * 7)
      }));
      description = 'A real bedroom with a door that closes — not a living-room carve-out. Housemates are screened and shown on the listing. Common spaces are shared; your rent is the room only.';
    } else if (type === 'coliving') {
      const brand = pick(COLIVING_BRANDS, seed);
      price = jitter(Math.round(city.avgRoom * 1.15), seed, 180);
      beds = 1;
      baths = seed % 2 === 0 ? 1 : 0.5;
      privateBath = baths === 1;
      sqft = 130 + (seed % 80);
      minStay = 1;
      maxStay = 18;
      utilities = 0;
      wifi = 0;
      cleaning = seed % 2 === 0 ? 0 : 49;
      building = {
        name: brand.name + ' ' + nhood,
        brand: brand.name,
        roomsAvailable: 2 + (seed % 6),
        cleaning: brand.cleaning,
        events: brand.events,
        coworking: brand.coworking
      };
      title = brand.name + ' · ' + (privateBath ? 'studio-style room' : 'classic room') + ' in ' + nhood;
      housemates = Array.from({ length: 3 }, (_, i) => ({
        name: pick(FIRST, seed + i * 13),
        ageRange: pick(['23–29', '26–34'], seed + i),
        occupation: pick(OCCUPATIONS, seed + i * 3),
        vibe: pick(VIBES, seed + i * 9)
      }));
      description = building.name + ' is a designed co-living building: furnished rooms, shared kitchen and lounge, ' + brand.cleaning + ' cleaning, and ' + (brand.events ? 'resident events' : 'a quieter house culture') + '. Inventory is per-room, not “call for availability.”';
    } else if (type === 'furnished') {
      beds = 1 + (seed % 3);
      baths = beds === 1 ? 1 : 1 + (seed % 2);
      sqft = 480 + beds * 180 + (seed % 120);
      price = jitter(Math.round(city.avgFurnished * (0.7 + beds * 0.18)), seed, 350);
      minStay = seed % 3 === 0 ? 2 : 1;
      maxStay = 12;
      furnishedLevel = 'fully';
      utilities = seed % 3 === 0 ? 0 : 120;
      wifi = 0;
      broker = city.id === 'nyc' && seed % 4 === 0 ? Math.round(price * 0.12) : 0;
      title = beds + ' bed furnished ' + (beds === 1 ? 'apartment' : 'home') + ' in ' + nhood;
      roommates = 0;
      description = 'Fully furnished and kitchen-ready. Furniture is inventoried so you know what “furnished” means. Ideal for relocations, traveling clinicians, and anyone who refuses a mattress-on-the-floor month.';
    } else if (type === 'short-term') {
      beds = 1 + (seed % 2);
      baths = 1;
      sqft = 420 + beds * 140 + (seed % 100);
      price = jitter(Math.round(city.avgFurnished * (0.75 + beds * 0.12)), seed, 300);
      minStay = 1;
      maxStay = seed % 2 === 0 ? 6 : 9;
      furnishedLevel = 'fully';
      utilities = 0;
      wifi = 0;
      title = '1-month+ furnished stay · ' + nhood;
      roommates = 0;
      description = 'Minimum stay is 30 days — this is housing, not a weekend rental. Utilities and wifi are listed in All-in Rent. Built for contract work, apartment hunting buffers, and city pilots.';
    } else if (type === 'aparthotel') {
      // A serviced apartment let by the month. The 30-day floor is not a
      // default here, it is the reason this type is allowed to exist.
      beds = seed % 3 === 0 ? 0 : 1;
      baths = 1;
      sqft = 320 + (seed % 220);
      price = jitter(Math.round(city.avgFurnished * 0.82), seed, 300);
      furnishedLevel = 'fully';
      utilities = 0;
      wifi = 0;
      cleaning = 120 + (seed % 90);
      privateBath = true;
      roommates = 0;
      minStay = 1;
      maxStay = 6 + (seed % 7);
      availableFrom = dateFrom(seed, 2, 24);
      title = (beds === 0 ? 'Serviced studio' : 'Serviced 1-bed') + ' · ' + nhood;
      description = 'A serviced apartment let by the month, not the night. Weekly housekeeping, linen and utilities are inside All-in Rent. Minimum stay is 30 days — this operator cannot take nightly bookings here.';
    } else {
      beds = 1 + (seed % 3);
      baths = beds === 1 ? 1 : 1 + (seed % 2);
      sqft = 500 + beds * 160 + (seed % 140);
      price = jitter(Math.round(city.avgFurnished * (0.55 + beds * 0.12)), seed, 280);
      remainingMonths = 3 + (seed % 8);
      availableFrom = dateFrom(seed, 3, 21);
      leaseEnd = addMonths(availableFrom, remainingMonths);
      minStay = remainingMonths;
      maxStay = remainingMonths;
      takeoverType = seed % 3 === 0 ? 'sublet' : 'assignment';
      furnishedLevel = seed % 4 === 0 ? 'unfurnished' : seed % 3 === 0 ? 'partial' : 'fully';
      utilities = 85;
      wifi = 40;
      broker = 0;
      title = remainingMonths + '-month lease takeover · ' + nhood;
      roommates = 0;
      description = 'The current tenant needs to leave early. You take the remaining ' + remainingMonths + ' months as a ' + takeoverType + '. RentLeaks shows the Lease Clock, remaining term, and takeover math so you are not guessing.';
    }

    const noFee = broker === 0;
    const furniture = furnishedLevel === 'unfurnished' ? [] : pickN(FURNITURE, furnishedLevel === 'partial' ? 4 : 8, seed);
    const allIn = price + utilities + wifi + cleaning;
    const deposit = type === 'coliving' ? Math.round(price * 0.5) : price;
    const postedAt = dateFrom(seed >> 1, -18, 20);
    const categories = [type];
    if (furnishedLevel !== 'unfurnished') categories.push('furnished');
    if (minStay <= 1 && type !== 'lease-break') categories.push('short-term');
    if (type === 'lease-break') categories.push('lease-break');
    if (noFee) categories.push('no-fee');
    if (pets !== 'none') categories.push('pet-friendly');
    if (minStay <= 1 && type !== 'lease-break') categories.push('month-to-month');

    const specs = type === 'room' || type === 'coliving'
      ? (privateBath ? 'Private bath' : 'Shared bath') + ' · ' + roommates + ' housemate' + (roommates === 1 ? '' : 's') + ' · ' + sqft + ' sqft'
      : beds + ' bed · ' + baths + ' bath · ' + sqft + ' sqft';
    const addressLine = num + ' ' + street + ', #' + unit + ', ' + city.name + ', ' + city.state;
    description += ' Address: ' + addressLine + '. ' + specs + '. Available ' + availableFrom + '. All-in $' + allIn + '/mo. 30-day minimum.';

    const operator = operatorFor(city, type, seed, building);

    return {
      id: city.id + '-' + type + '-' + (index + 1),
      type: 'rent',
      housingType: type,
      title,
      address: addressLine,
      neighborhood: nhood,
      cityId: city.id,
      cityName: city.name,
      state: city.state,
      country: city.country || 'US',
      countryName: city.countryName || 'United States',
      price,
      priceSuffix: '/mo',
      fees: { broker, utilities, wifi, cleaning, parking: seed % 7 === 0 ? 150 : 0 },
      allIn,
      currency: currencyForCountry(city.country || 'US'),
      allInUsd: Math.round(toUsd(allIn, currencyForCountry(city.country || 'US'))),
      deposit,
      lastMonth: type === 'lease-break' ? 0 : 0,
      beds,
      baths,
      sqft,
      lat: (city.lat || 40.71) + ((seed % 80) - 40) / 1000,
      lng: (city.lng || -74) + ((seed % 80) - 40) / 800,
      specs,
      privateBath,
      roommates,
      housemates,
      furnishedLevel,
      furniture,
      minStayMonths: minStay,
      maxStayMonths: maxStay,
      availableFrom,
      leaseEnd,
      remainingMonths,
      takeoverType,
      utilitiesIncluded: [
        utilities === 0 ? 'utilities' : null,
        wifi === 0 ? 'wifi' : null,
        cleaning === 0 && type === 'coliving' ? 'cleaning' : null
      ].filter(Boolean),
      amenities,
      workplaceReady: workspace,
      pets,
      verified,
      noFee,
      scamShield: verified,
      images: uniquePhotos.map((p) => p.src),
      image,
      gallery: uniquePhotos.map((p) => ({
        kind: 'photo',
        src: p.src,
        caption: p.label,
        alt: title + ' — ' + p.label + ' in ' + nhood + ', ' + city.name
      })).concat([{
        kind: 'video',
        src: videoPick.src,
        poster: image,
        caption: 'Video tour',
        alt: 'Video tour of ' + title + ' in ' + nhood
      }]),
      video: {
        src: videoPick.src,
        poster: image,
        caption: videoPick.caption
      },
      location: city.name + ' · ' + nhood,
      categories,
      description,
      neighborhoodScores: {
        walk: city.walk - (seed % 8),
        transit: city.transit - (seed % 10),
        grocery: 60 + (seed % 35),
        nightlife: 40 + (seed % 50),
        quiet: vibe === 'quiet-professional' ? 78 : 45 + (seed % 30)
      },
      commuteNote: city.transit >= 70
        ? 'Strong transit. Most downtown commutes are under 35 minutes.'
        : city.walk >= 60
          ? 'Walkable pocket — groceries and coffee without a car on most days.'
          : 'Plan for a car or bike. We show All-in Rent so parking is not a surprise.',
      postedAt,
      featured: city.featured && index === 0,
      slug: slugify(title) + '-' + city.id + '-' + type + '-' + (index + 1),
      path: 'listings/' + slugify(title) + '-' + city.id + '-' + type + '-' + (index + 1) + '.html',
      cityPath: 'cities/' + (city.slug || slugify(city.name)) + '.html',
      typePath: TYPE_FILES[type] || 'rent.html',
      imageAlt: title + ' — ' + typeLabel(type) + ' for rent in ' + nhood + ', ' + city.name + ', ' + city.state + '. All-in from ' + fmt(allIn, currencyForCountry(city.country || 'US')) + '/mo.',
      building,
      operatorId: operator ? operator.id : null,
      operatorName: operator ? operator.name : null,
      operatorKind: operator ? operator.kind : null,
      operatorMeta: operator ? { tagline: operator.tagline, since: operator.since, scope: operator.scope } : null,
      host: {
        name: operator ? operator.name : pick(FIRST, seed + 19) + ' ' + pick(['Lee', 'Nguyen', 'Patel', 'Garcia', 'Kim', 'Ross'], seed),
        type: hostType,
        responseHours: 1 + (seed % 8)
      },
      vibe
    };
  }

  const FEATURED_TYPES = ['room', 'coliving', 'furnished', 'short-term', 'aparthotel', 'lease-break'];
  const listings = [];

  CITIES.forEach((city) => {
    const extra = city.id === 'nyc' ? 3 : city.featured ? 1 : 0;
    FEATURED_TYPES.forEach((type) => {
      const count = city.id === 'nyc' ? 3 + (type === 'room' || type === 'lease-break' ? 1 : 0) : city.featured ? 1 + extra : 1;
      for (let i = 0; i < count; i++) listings.push(buildListing(city, type, i));
    });
  });


  /* Build the operator registry from the listings that reference them. */
  const operators = (function () {
    const byId = {};
    listings.forEach(function (l) {
      if (!l.operatorId) return;
      var o = byId[l.operatorId];
      if (!o) {
        var meta = l.operatorMeta || {};
        o = byId[l.operatorId] = {
          id: l.operatorId,
          slug: l.operatorId.replace(/^op-/, ''),
          name: l.operatorName,
          kind: l.operatorKind,
          tagline: meta.tagline || '',
          since: meta.since || null,
          scope: meta.scope || '',
          listingIds: [],
          cityIds: [],
          countries: [],
          types: []
        };
      }
      o.listingIds.push(l.id);
      if (o.cityIds.indexOf(l.cityId) === -1) o.cityIds.push(l.cityId);
      if (o.countries.indexOf(l.countryName) === -1) o.countries.push(l.countryName);
      if (o.types.indexOf(l.housingType) === -1) o.types.push(l.housingType);
    });
    return Object.keys(byId).map(function (k) {
      var o = byId[k];
      var homes = listings.filter(function (l) { return l.operatorId === o.id; });
      o.count = homes.length;
      o.verified = homes.filter(function (l) { return l.verified; }).length === homes.length;
      o.noFeeAll = homes.every(function (l) { return l.noFee; });
      o.responseHours = Math.max(1, Math.round(
        homes.reduce(function (a, l) { return a + ((l.host && l.host.responseHours) || 4); }, 0) / homes.length));
      // A portfolio can span currencies, so "from" must be picked on the
      // normalised figure and carried with the currency it was priced in.
      var cheapest = homes.slice().sort(function (a, b) { return a.allInUsd - b.allInUsd; })[0];
      o.currency = cheapest.currency;
      o.fromAllIn = cheapest.allIn;
      o.fromAllInUsd = cheapest.allInUsd;
      o.fromCityId = cheapest.cityId;
      o.multiCurrency = homes.some(function (l) { return l.currency !== cheapest.currency; });
      o.path = 'operators/' + o.slug + '.html';
      return o;
    }).sort(function (a, b) { return b.count - a.count; });
  })();

  const userListings = [];
  try {
    const raw = localStorage.getItem('rl_my_listings');
    if (raw) userListings.push(...JSON.parse(raw));
  } catch (e) { /* ignore */ }

  const categories = HOUSING_TYPES.map((t) => ({ id: t.id, label: t.label })).concat([
    { id: 'no-fee', label: 'No fee' },
    { id: 'pet-friendly', label: 'Pet friendly' },
    { id: 'month-to-month', label: 'Month-to-month' },
    { id: 'furnished', label: 'Furnished' }
  ]);

  window.RENTLEAKS_DATA = {
    product: {
      name: 'RentLeaks',
      tagline: 'Flexible housing, priced honestly.',
      pitch: 'Rooms, co-living buildings, furnished apartments, 1-month+ stays, and lease-breaks — in the U.S. and Canada plus major cities across the UK, Ireland, France, Spain, the Netherlands, Switzerland, Germany, and Italy.',
      minStayRule: 'Short-term here means 30 days or more. We do not list hotel nights.'
    },
    housingTypes: HOUSING_TYPES,
    categories,
    currencyForCountry,
    fmt,
    convert,
    toUsd,
    fxPerUsd: FX_PER_USD,
    fxUpdated: FX_UPDATED,
    cities: CITIES,
    operators,
    getOperator(id) {
      const q = String(id || '').toLowerCase().replace(/^op-/, '');
      return operators.find((o) => o.slug === q || o.id === id) || null;
    },
    listings: userListings.concat(listings),
    typeLabel,
    typeFiles: TYPE_FILES,
    slugify,
    getCity(id) {
      const q = String(id || '').toLowerCase();
      return CITIES.find((c) => c.id === q || c.slug === q || c.name.toLowerCase() === q);
    },
    allIn(listing) {
      if (!listing) return 0;
      if (listing.allIn) return listing.allIn;
      const f = listing.fees || {};
      return listing.price + (f.utilities || 0) + (f.wifi || 0) + (f.cleaning || 0);
    }
  };
})();
