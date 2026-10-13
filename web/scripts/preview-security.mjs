import { Client } from "pg";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";

const name = process.argv[2];
const url = new URL(process.env.DATABASE_URL ?? "");
if (!/^rentleaks_security_test_[a-f0-9]+$/.test(name ?? "") || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Only isolated local verification databases may be previewed.");
url.pathname = `/${name}`;
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query('DROP TRIGGER IF EXISTS reject_notification_test ON "NotificationDelivery"');
  // Synthetic fixture login only; the strict database-name guard excludes real accounts.
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync("RentLeaks-isolated-preview-only", salt, 64).toString("hex")}`;
  await client.query('UPDATE "User" SET "passwordHash"=$1 WHERE "email"=$2', [passwordHash, "bank-host@example.test"]);
}
finally { await client.end(); }
// No credentials or cron authorization: the preview can queue but cannot dispatch mail.
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100", "-H", "127.0.0.1"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), APP_URL: "https://app.rentleaks.com", API_ALLOWED_ORIGINS: "http://127.0.0.1:8079,http://localhost:8079", AUTH_SECRET: "isolated-security-verification-secret-32chars", CRON_SECRET: "", RESEND_API_KEY: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
