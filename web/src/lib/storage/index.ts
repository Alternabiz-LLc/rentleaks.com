/**
 * Where uploaded photos and videos go.
 *
 * - With S3_BUCKET etc. set (Cloudflare R2 recommended), files are PUT to the
 *   bucket and the public URL is https://…, which isPublicMediaSrc accepts.
 * - Without it, files go to public/uploads on local disk. That only works on
 *   a machine with a persistent disk (your Mac, a VPS). Cloudflare Workers
 *   and Vercel have no writable disk, so there the store refuses with a
 *   clear error instead of losing files.
 *
 * Env:
 *   S3_ENDPOINT          https://<account>.r2.cloudflarestorage.com  (or https://s3.<region>.amazonaws.com)
 *   S3_REGION            auto for R2, e.g. us-east-1 for AWS
 *   S3_BUCKET            rentleaks-media
 *   S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
 *   S3_PUBLIC_URL        public base URL of the bucket, e.g. https://media.rentleaks.com
 */
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { onWorkers } from "../runtime";
import { amzDateNow, sha256Hex, signV4 } from "./sigv4";

export class StorageNotConfigured extends Error {}

type S3Config = {
  endpoint: URL;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
};

export function s3Config(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_PUBLIC_URL) return null;
  return {
    endpoint: new URL(S3_ENDPOINT),
    region: env.S3_REGION || "auto",
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    publicUrl: S3_PUBLIC_URL.replace(/\/+$/, ""),
  };
}

/** True where the local disk can't be trusted to keep files. */
function ephemeralDisk(env: NodeJS.ProcessEnv = process.env) {
  return onWorkers() || Boolean(env.VERCEL || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME || env.RENTLEAKS_EPHEMERAL_DISK);
}

export function storageReady(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(s3Config(env)) || !ephemeralDisk(env);
}

function objectName(userId: string, ext: string) {
  const safeUser = userId.replace(/[^a-z0-9_-]/gi, "");
  return { safeUser, name: `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}` };
}

async function putS3(cfg: S3Config, key: string, body: Buffer, contentType: string) {
  const basePath = cfg.endpoint.pathname.replace(/\/+$/, "");
  const objectPath = `${basePath}/${cfg.bucket}/${key}`;
  const payloadHash = sha256Hex(body);
  const amzDate = amzDateNow();
  const headers = {
    "content-type": contentType,
    "cache-control": "public, max-age=31536000, immutable",
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const { authorization } = signV4({
    method: "PUT",
    host: cfg.endpoint.host,
    path: objectPath,
    headers,
    payloadHash,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    amzDate,
  });
  const url = `${cfg.endpoint.protocol}//${cfg.endpoint.host}${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, authorization },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Media upload failed (${res.status}). ${detail}`);
  }
  return `${cfg.publicUrl}/${key}`;
}

/** Saves the bytes and returns the public URL (https://… or /uploads/…). */
export async function storeUpload(userId: string, body: Buffer, contentType: string, ext: string) {
  const { safeUser, name } = objectName(userId, ext);
  const cfg = s3Config();
  if (cfg) return putS3(cfg, `uploads/${safeUser}/${name}`, body, contentType);
  if (ephemeralDisk()) {
    throw new StorageNotConfigured(
      "Uploads aren't set up on this server yet. Add the S3_* settings (see DEPLOY.md).",
    );
  }
  const dir = path.join(process.cwd(), "public", "uploads", safeUser);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), body);
  return `/uploads/${safeUser}/${name}`;
}
