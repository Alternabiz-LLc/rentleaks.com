import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare build output
    ".open-next/**",
    ".wrangler/**",
  ]),
  {
    rules: {
      /**
       * `<img>` over next/image, deliberately.
       *
       * This app runs on Cloudflare Workers through OpenNext, where Next's
       * built-in image optimizer does not run: it needs the Node/sharp
       * pipeline, so a `next/image` here either needs a custom loader
       * (Cloudflare Images — a paid product, as the rule's own text warns) or
       * `unoptimized`, which buys nothing over a plain tag. Photos are
       * already resized before they are stored — 1920px on the long edge, in
       * lib/image-resize.ts and again in the mobile composer — so the
       * bandwidth this rule is about has been spent at upload time instead.
       *
       * Revisit if an image loader is ever configured.
       */
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
