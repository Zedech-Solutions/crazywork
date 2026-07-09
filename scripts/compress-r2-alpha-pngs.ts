import "dotenv/config";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Follow-up to compress-r2-images.ts: transparent PNGs can't be JPEG'd, so use
// pngquant (lossy palette quantisation, alpha preserved). Same-key overwrite,
// backup-first — but NEVER overwrite an existing backup (it may hold the true
// original from an earlier pass). Dry-run by default; --live to write.

const LIVE = process.argv.includes("--live");
const SIZE_THRESHOLD = 800 * 1024;
const MAX_DIMENSION = 1600;

const env = process.env;
const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  },
});
const Bucket = env.R2_BUCKET!;
const workDir = mkdtempSync(path.join(tmpdir(), "r2-alpha-"));

async function backupExists(key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket, Key: `originals-backup/${key}` }));
    return true;
  } catch {
    return false;
  }
}

const listed = await client.send(new ListObjectsV2Command({ Bucket, Prefix: "uploads/" }));
const targets = (listed.Contents ?? []).filter(
  (o) => (o.Size ?? 0) > SIZE_THRESHOLD && /\.png$/i.test(o.Key ?? ""),
);
console.log(`${LIVE ? "LIVE" : "DRY RUN"} — ${targets.length} PNGs over ${SIZE_THRESHOLD / 1024} KB\n`);

for (const obj of targets) {
  const key = obj.Key!;
  const orig = path.join(workDir, path.basename(key));
  const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
  writeFileSync(orig, Buffer.from(await res.Body!.transformToByteArray()));
  const beforeKB = Math.round(statSync(orig).size / 1024);

  // Resize down first (keeps PNG + alpha), then quantise.
  const resized = orig + ".resized.png";
  execFileSync("sips", ["-Z", String(MAX_DIMENSION), "-s", "format", "png", orig, "--out", resized]);
  const quantised = orig + ".quant.png";
  execFileSync("pngquant", ["--quality=60-90", "--speed", "1", "--force", "--output", quantised, resized]);

  const out = readFileSync(quantised);
  const afterKB = Math.round(out.length / 1024);
  const worthIt = out.length < statSync(orig).size * 0.9;
  console.log(`${key}: ${beforeKB} KB -> ${afterKB} KB${worthIt ? "" : "  [skipped: <10% saving]"}`);
  if (!LIVE || !worthIt) continue;

  if (await backupExists(key)) {
    console.log(`  backup already exists (kept — holds the earlier original)`);
  } else {
    await client.send(
      new CopyObjectCommand({ Bucket, CopySource: `${Bucket}/${key}`, Key: `originals-backup/${key}` }),
    );
    console.log(`  -> backed up to originals-backup/${key}`);
  }
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: out,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  console.log(`  -> overwritten (alpha preserved)`);
}
if (!LIVE) console.log("\nDry run only — rerun with --live to apply.");
