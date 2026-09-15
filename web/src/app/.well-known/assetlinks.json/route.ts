/**
 * Android App Links for the app domain.
 *
 * Env: ANDROID_CERT_SHA256 — the signing certificate fingerprint(s), comma
 *      separated (EAS: `eas credentials -p android`; Play: App integrity page).
 *      ANDROID_PACKAGE defaults to com.alternabiz.rentleaks.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!prints.length) return new Response("ANDROID_CERT_SHA256 is not set", { status: 404 });
  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
        target: {
          namespace: "android_app",
          package_name: process.env.ANDROID_PACKAGE || "com.alternabiz.rentleaks",
          sha256_cert_fingerprints: prints,
        },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
