import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Storage, UploadedFile } from "./types";

function randomKey(name: string): string {
  const ext = path.extname(name) || ".bin";
  return `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
}

// Stub → writes to /public/uploads. Used in dev / when R2 env is absent.
export class StubStorage implements Storage {
  private dir = path.join(process.cwd(), "public", "uploads");

  async upload(file: UploadedFile): Promise<{ url: string }> {
    await mkdir(this.dir, { recursive: true });
    const filename = randomKey(file.name);
    await writeFile(path.join(this.dir, filename), file.bytes);
    return { url: `/uploads/${filename}` };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith("/uploads/")) return;
    const filename = path.basename(url);
    try {
      await unlink(path.join(this.dir, filename));
    } catch {
      // already gone — fine
    }
  }
}

interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

// Cloudflare R2 via the S3-compatible API. Public reads are served from
// R2_PUBLIC_URL (the bucket's public r2.dev URL or a bound custom domain).
// Objects live under an "uploads/" prefix.
export class R2Storage implements Storage {
  private client: S3Client;
  private bucket: string;
  private publicBase: string;
  private prefix = "uploads/";

  constructor(env: R2Env) {
    this.bucket = env.bucket;
    this.publicBase = env.publicUrl.replace(/\/$/, "");
    this.client = new S3Client({
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

  async delete(url: string): Promise<void> {
    if (!url.startsWith(this.publicBase)) return;
    const key = url.slice(this.publicBase.length + 1);
    if (!key) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

function readR2Env(): R2Env | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_BASE_URL;
  if (accountId && accessKeyId && secretAccessKey && bucket && publicUrl) {
    return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
  }
  return null;
}

// Pick R2 when fully configured, otherwise fall back to the local stub. Go-live
// is a config flip: set the five R2_* env vars and redeploy.
const r2Env = readR2Env();
export const storage: Storage = r2Env
  ? new R2Storage(r2Env)
  : new StubStorage();
