import path from "path";
import { randomBytes } from "crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Storage, UploadedFile } from "./types";

function randomKey(name: string): string {
  const ext = path.extname(name) || ".bin";
  return `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
}

interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

// Cloudflare R2 via the S3-compatible API. Public reads are served from
// R2_PUBLIC_BASE_URL (the bucket's public r2.dev URL or a bound custom domain).
// Objects live under an "uploads/" prefix.
export class R2Storage implements Storage {
  private client: S3Client;
  private bucket: string;
  private publicBase: string;
  private prefix = "uploads/";

  constructor(env: R2Env, client?: S3Client) {
    this.bucket = env.bucket;
    this.publicBase = env.publicUrl.replace(/\/$/, "");
    this.client =
      client ??
      new S3Client({
        region: "auto",
        endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.accessKeyId,
          secretAccessKey: env.secretAccessKey,
        },
      });
  }

  async upload(file: UploadedFile): Promise<{ url: string }> {
    const key = this.prefix + randomKey(file.name);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.bytes,
        ContentType: file.contentType,
      }),
    );
    return { url: `${this.publicBase}/${key}` };
  }

  async presignUpload(file: {
    name: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; publicUrl: string }> {
    const key = this.prefix + randomKey(file.name);
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: file.contentType,
      }),
      { expiresIn: 300 },
    );
    return { uploadUrl, publicUrl: `${this.publicBase}/${key}` };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(this.publicBase)) return;
    const key = url.slice(this.publicBase.length + 1);
    if (!key) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

type EnvLike = Record<string, string | undefined>;

const R2_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

// Reads the five R2 vars, throwing if any are missing — storage is R2-only, so
// the app must be configured to boot (no silent local fallback).
export function readR2Env(env: EnvLike = process.env): R2Env {
  const missing = R2_VARS.filter((v) => !env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required R2 env vars: ${missing.join(", ")}`);
  }
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET!,
    publicUrl: env.R2_PUBLIC_BASE_URL!,
  };
}

export function storageFromEnv(env: EnvLike = process.env): Storage {
  return new R2Storage(readR2Env(env));
}

export const storage: Storage = storageFromEnv();

// Best-effort deletion of many object URLs. Falsy and externally-hosted URLs
// are ignored by the storage guard; failures never bubble up because callers
// run this after the DB row is already gone.
export async function deleteObjects(
  urls: (string | null | undefined)[],
): Promise<void> {
  await Promise.allSettled(
    urls
      .filter((u): u is string => Boolean(u))
      .map((u) => storage.delete(u)),
  );
}
