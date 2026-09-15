/**
 * iOS universal links for the app domain (the host in APP_URL), so password
 * reset emails and shared listing links open the app when it is installed.
 * Served as application/json, which Apple requires.
 *
 * Env: APPLE_TEAM_ID (10 characters, from developer.apple.com → Membership),
 *      IOS_BUNDLE_ID (defaults to com.alternabiz.rentleaks).
 */
export const dynamic = "force-dynamic";

export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return new Response("APPLE_TEAM_ID is not set", { status: 404 });
  const appID = `${team}.${process.env.IOS_BUNDLE_ID || "com.alternabiz.rentleaks"}`;
  return Response.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appID],
            components: [
              { "/": "/listings/*", comment: "Listing pages" },
              { "/": "/reset", "?": { token: "?*" }, comment: "Password reset links" },
            ],
          },
        ],
      },
      webcredentials: { apps: [appID] },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
