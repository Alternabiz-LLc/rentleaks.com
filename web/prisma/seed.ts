import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CITIES, buildSeedListings } from "../src/lib/catalog";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("rentleaks", 10);

  const host = await prisma.user.upsert({
    where: { email: "host@rentleaks.com" },
    update: {},
    create: {
      email: "host@rentleaks.com",
      name: "Kai Kim",
      passwordHash,
      role: "host",
      identity: {
        create: {
          status: "verified",
          provider: "demo",
          legalName: "Kai Kim",
          livenessPassed: true,
          addressConfirmed: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "renter@rentleaks.com" },
    update: {},
    create: {
      email: "renter@rentleaks.com",
      name: "Ava Lee",
      passwordHash,
      role: "renter",
      identity: {
        create: {
          status: "verified",
          provider: "demo",
          legalName: "Ava Lee",
          livenessPassed: true,
          addressConfirmed: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  for (const city of CITIES) {
    await prisma.city.upsert({
      where: { id: city.id },
      update: {
        name: city.name,
        state: city.state,
        rank: city.rank,
        lat: city.lat,
        lng: city.lng,
        walk: city.walk,
        transit: city.transit,
        featured: city.featured,
      },
      create: {
        id: city.id,
        name: city.name,
        state: city.state,
        rank: city.rank,
        lat: city.lat,
        lng: city.lng,
        walk: city.walk,
        transit: city.transit,
        featured: city.featured,
      },
    });
  }

  const listings = buildSeedListings();
  for (const listing of listings) {
    await prisma.listing.upsert({
      where: { id: listing.id },
      update: {
        title: listing.title,
        address: listing.address,
        neighborhood: listing.neighborhood,
        price: listing.price,
        allIn: listing.allIn,
        deposit: listing.deposit,
        beds: listing.beds,
        baths: listing.baths,
        sqft: listing.sqft,
        lat: listing.lat,
        lng: listing.lng,
        image: listing.image,
        description: listing.description,
        minStayMonths: listing.minStayMonths,
        availableFrom: listing.availableFrom,
        furnishedLevel: listing.furnishedLevel,
        amenitiesJson: listing.amenitiesJson,
      },
      create: {
        ...listing,
        hostId: host.id,
        verified: true,
        noFee: true,
      },
    });
  }

  console.log(`Seeded ${CITIES.length} cities, ${listings.length} listings, host ${host.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
