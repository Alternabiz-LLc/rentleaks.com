import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const source = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) throw new Error("Verification requires a local database; refusing remote access.");
const name = `rentleaks_security_test_${randomBytes(6).toString("hex")}`;
const admin = new Client({ connectionString: source.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${name}"`);
await admin.end();
source.pathname = `/${name}`;
const client = new Client({ connectionString: source.toString() });
await client.connect();
try {
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await client.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
  }
  console.log("All migrations applied to a new isolated local database.");
} finally { await client.end(); }
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "tests/integration/security.test.ts", "tests/integration/bank-billing.test.ts"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: source.toString(), DIRECT_URL: source.toString(), NODE_ENV: "test", AUTH_SECRET: "isolated-security-verification-secret-32chars", APP_URL: "http://localhost:3100" },
});
console.log(`Isolated verification database retained: ${name}`);
process.exitCode = result.status ?? 1;
