/** Deep links from the public site. Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { redirectSystemPath } from "../app/+native-intent.ts";

const open = (path: string) => redirectSystemPath({ path, initial: false });

test("a listing page from the site opens the listing screen", () => {
  /* The real shape: listings/<title-slug>-<id>.html (the API resolves it). */
  assert.equal(
    open("https://rentleaks.com/listings/sunny-private-room-in-bushwick-share-nyc-room-1.html"),
    "/listing/sunny-private-room-in-bushwick-share-nyc-room-1",
  );
  /* A bare id — what the app itself shares. */
  assert.equal(open("https://app.rentleaks.com/listings/nyc-room-3"), "/listing/nyc-room-3");
});

test("a translated link lands on the same screen", () => {
  for (const loc of ["fr", "de", "it"]) {
    assert.equal(
      open(`https://rentleaks.com/${loc}/listings/chambre-lumineuse-paris-room-2.html`),
      "/listing/chambre-lumineuse-paris-room-2",
      loc,
    );
  }
});

test("password reset carries its token, and a bare /reset asks for a new link", () => {
  const token = "a".repeat(64);
  assert.equal(open(`https://app.rentleaks.com/reset?token=${token}`), `/auth/reset?token=${token}`);
  assert.equal(open("https://app.rentleaks.com/reset"), "/auth/forgot");
});

test("the pre-2026 catalogue URL still works, and anything else is left alone", () => {
  assert.equal(open("https://rentleaks.com/listing.html?id=nyc-room-9"), "/listing/nyc-room-9");
  assert.equal(open("/saved"), "/saved");
});
