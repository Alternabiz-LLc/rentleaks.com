import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { db } from "../src/lib/prisma";
import { GET as meta } from "../src/app/api/meta/route";
import { GET as cities } from "../src/app/api/cities/route";
import { liveListingWhere } from "../src/lib/billing";

test("public statistics and city counts use the same visibility gate as search", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-13T00:00:00Z") });
  const client = db();
  const first = client.listing.findFirst, count = client.listing.count, aggregate = client.listing.aggregate;
  const cityCount = client.city.count, cityFind = client.city.findMany;
  const live = await liveListingWhere();
  client.listing.findFirst = (async () => null) as typeof first;
  const queries: unknown[] = [];
  client.listing.count = (async (args: unknown) => { queries.push(args); return 3; }) as typeof count;
  client.listing.aggregate = (async (args: unknown) => { queries.push(args); return { _avg: { allInUsd: 1000, remainingMonths: 6 }, _count: 1 }; }) as unknown as typeof aggregate;
  client.city.count = (async () => 2) as typeof cityCount;
  client.city.findMany = (async (args: unknown) => { assert.deepEqual((args as { include: unknown }).include, { _count: { select: { listings: { where: live } } } }); return []; }) as typeof cityFind;
  try {
    const response = await meta(new NextRequest("https://app.rentleaks.com/api/meta"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).listings, 3);
    assert.deepEqual(queries[0], { where: live });
    for (const query of queries.slice(1)) assert.deepEqual((query as { where: { AND: unknown[] } }).where.AND[0], live);
    assert.equal((await cities(new NextRequest("https://app.rentleaks.com/api/cities"))).status, 200);
  } finally {
    client.listing.findFirst = first; client.listing.count = count; client.listing.aggregate = aggregate;
    client.city.count = cityCount; client.city.findMany = cityFind;
    await client.$disconnect();
  }
});
