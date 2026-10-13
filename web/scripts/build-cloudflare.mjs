import { copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Keep the public campaign registry and bundled app registry identical.
copyFileSync(new URL("../../provider-sponsorships.json", import.meta.url), new URL("../src/lib/provider-sponsorships.json", import.meta.url));

// Production URLs must be fixed at build time as well as in Worker bindings.
// Explicit process values take precedence over a developer's local .env file.
const result = spawnSync(process.execPath, ["node_modules/@opennextjs/cloudflare/dist/cli/index.js", "build"], {
  stdio: "inherit",
  env: { ...process.env, APP_URL: "https://app.rentleaks.com", NEXT_PUBLIC_APP_URL: "https://app.rentleaks.com", CATALOG_ORIGIN: "https://rentleaks.com", NEXT_PUBLIC_CATALOG_ORIGIN: "https://rentleaks.com" },
});
process.exitCode = result.status ?? 1;
