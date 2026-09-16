/**
 * The database client used across the app.
 *
 * On Node (your Mac, Vercel, a VPS) this is one long-lived PrismaClient.
 *
 * On Cloudflare Workers a connection opened in one request can't be reused in
 * another, so each request gets its own client, connected through Hyperdrive
 * (env.HYPERDRIVE) with @prisma/adapter-pg. `prisma` stays a single import:
 * it is a proxy that hands every call to the current request's client.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { onWorkers } from "./runtime";

const log: Array<"error" | "warn"> = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function nodeClient() {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient({ log });
  return globalForPrisma.prisma;
}

const perRequest = new WeakMap<object, PrismaClient>();

function workersClient() {
  const { env, ctx } = getCloudflareContext();
  const existing = perRequest.get(ctx);
  if (existing) return existing;
  const connectionString = env.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("No database: bind Hyperdrive as HYPERDRIVE or set DATABASE_URL (see DEPLOY.md).");
  }
  const client = new PrismaClient({ log, adapter: new PrismaPg({ connectionString, maxUses: 1 }) });
  perRequest.set(ctx, client);
  return client;
}

export function db(): PrismaClient {
  return onWorkers() ? workersClient() : nodeClient();
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = db();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
