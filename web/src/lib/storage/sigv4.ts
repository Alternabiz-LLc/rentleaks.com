/**
 * AWS Signature Version 4 for single S3 requests. Works with any S3-compatible
 * store (Cloudflare R2, AWS S3, Supabase Storage's S3 endpoint, MinIO), so the
 * app needs no SDK. Verified against AWS's published PUT example in
 * tests/storage.test.ts.
 */
import { createHash, createHmac } from "crypto";

export function sha256Hex(data: string | Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string) {
  return createHmac("sha256", key).update(data).digest();
}

/** RFC 3986 encoding of each path segment, as SigV4 requires ("/" kept). */
export function encodePath(path: string) {
  return path
    .split("/")
    .map((seg) =>
      encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join("/");
}

export type SignInput = {
  method: string;
  host: string;
  /** Unencoded path, starting with "/". */
  path: string;
  /** Header names in any case; `host` is added automatically. */
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** e.g. 20130524T000000Z */
  amzDate: string;
  service?: string;
};

export function signV4(input: SignInput) {
  const service = input.service ?? "s3";
  const date = input.amzDate.slice(0, 8);
  const all: Record<string, string> = { host: input.host };
  for (const [k, v] of Object.entries(input.headers)) all[k.toLowerCase()] = String(v).trim().replace(/\s+/g, " ");
  const names = Object.keys(all).sort();
  const canonicalHeaders = names.map((n) => `${n}:${all[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    input.method.toUpperCase(),
    encodePath(input.path),
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const scope = `${date}/${input.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", input.amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${input.secretAccessKey}`, date);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return {
    signature,
    signedHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export function amzDateNow(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
