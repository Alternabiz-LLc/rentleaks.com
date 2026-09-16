import { PrismaClient } from "@prisma/client";
import { loadCatalog, toDbCity, toDbListing, toDbOperator } from "../src/lib/catalog-source";
import { pickDiverseFeatured } from "../src/lib/listings";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

/* `npm run db:up` returns before Postgres accepts connections, so wait for it
   rather than failing on the first query. */
async function waitForDatabase(tries = 30) {
  for (let i = 1; ; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (i >= tries) throw error;
      if (i === 1) console.log("Waiting for the database…");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function main() {
  await waitForDatabase();

  /* The catalogue is owned by the founder account. No shared demo logins:
     credentials come from the environment and are never written to the repo.
       FOUNDER_EMAIL=you@example.com FOUNDER_PASSWORD='…' npx prisma db seed
     Without FOUNDER_EMAIL the seed uses the founder already created with
     `npm run founder` (the oldest admin account).
     An existing founder keeps their password unless FOUNDER_PASSWORD is set. */
  let email = (process.env.FOUNDER_EMAIL || "").trim().toLowerCase();
  if (!email) {
    const founder = await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
    if (!founder) {
      throw new Error("No founder account yet. Run `npm run founder` first, then `npm run db:seed` again.");
    }
    email = founder.email;
  }
  const name = process.env.FOUNDER_NAME || "Yves Dikoume";
  const password = process.env.FOUNDER_PASSWORD || "";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing && password.length < 12) {
    throw new Error("FOUNDER_PASSWORD must be at least 12 characters to create the founder account.");
  }

  const host = await prisma.user.upsert({
    where: { email },
    update: { role: "admin", ...(password ? { passwordHash: hashPassword(password) } : {}) },
    create: {
      email,
      name,
      passwordHash: hashPassword(password),
      role: "admin",
      identity: { create: { status: "unverified", provider: "demo" } },
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

  for (const op of catalog.operators || []) {
    const data = toDbOperator(op);
    const { id, ...rest } = data;
    await prisma.operator.upsert({ where: { id }, update: rest, create: data });
  }

  let count = 0;
  for (const listing of catalog.listings) {
    // The static catalog carries a few non-rental rows; the marketplace only
    // serves rentals.
    if (listing.type && listing.type !== "rent") continue;
    /* The catalogue is ours, so it is approved on load. The moderation
       migration backfills 'approved' only for rows that already existed; on a
       fresh database the seed runs after it and rows would sit in 'pending'. */
    const data = { ...toDbListing(listing, host.id), moderation: "approved", moderatedAt: new Date() };
    const { id, ...rest } = data;
    await prisma.listing.upsert({
      where: { id },
      update: rest,
      create: data,
    });
    count += 1;
  }

  const candidates = await prisma.listing.findMany({
    select: { id: true, cityId: true, housingType: true },
    orderBy: [{ verified: "desc" }, { postedAt: "desc" }],
  });
  const featuredIds = pickDiverseFeatured(candidates, 16).map((row) => row.id);
  const catalogIds = catalog.listings.map((listing) => listing.id);
  await prisma.listing.updateMany({
    where: {
      id: {
        in: catalogIds,
        ...(featuredIds.length ? { notIn: featuredIds } : {}),
      },
    },
    data: { featured: false },
  });
  if (featuredIds.length) {
    await prisma.listing.updateMany({
      where: { id: { in: featuredIds } },
      data: { featured: true },
    });
  }

  console.log(`Seeded ${catalog.cities.length} cities, ${(catalog.operators || []).length} operators, ${count} listings, ${featuredIds.length} sponsored, host ${host.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error && !process.env.DEBUG ? `Seed failed: ${error.message}` : error);
    await prisma.$disconnect();
    process.exit(1);
  });
