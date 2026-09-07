import { PrismaClient } from "@prisma/client";
import { loadCatalog, toDbCity, toDbListing } from "../src/lib/catalog-source";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = hashPassword("rentleaks");

  const host = await prisma.user.upsert({
    where: { email: "host@rentleaks.com" },
    update: { passwordHash },
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
    update: { passwordHash },
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

  // Root data.js is the single source of truth for both front ends.
  const catalog = loadCatalog();

  for (const city of catalog.cities) {
    const data = toDbCity(city);
    const { id, ...rest } = data;
    await prisma.city.upsert({
      where: { id },
      update: rest,
      create: data,
    });
  }

  let count = 0;
  for (const listing of catalog.listings) {
    // The static catalog carries a few non-rental rows; the marketplace only
    // serves rentals.
    if (listing.type && listing.type !== "rent") continue;
    const data = toDbListing(listing, host.id);
    const { id, ...rest } = data;
    await prisma.listing.upsert({
      where: { id },
      update: rest,
      create: data,
    });
    count += 1;
  }

  console.log(`Seeded ${catalog.cities.length} cities, ${count} listings, host ${host.email}`);
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
