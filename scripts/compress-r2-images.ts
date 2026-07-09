import "dotenv/config";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  CopyObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// One-off maintenance: compress oversized images in the R2 bucket IN PLACE
// (same keys, so all existing URLs keep working). Originals are copied to the
// "originals-backup/" prefix first. Dry-run by default; pass --live to write.
//
//   bun run scripts/compress-r2-images.ts          # dry run (downloads + measures only)
//   bun run scripts/compress-r2-images.ts --live   # backup + overwrite in R2

const LIVE = process.argv.includes("--live");
const SIZE_THRESHOLD = 800 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = "78"; // sips formatOptions percent

const env = process.env;
for (const v of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
  if (!env[v]) throw new Error(`Missing ${v} in .env`);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  },
});
const Bucket = env.R2_BUCKET!;
const workDir = mkdtempSync(path.join(tmpdir(), "r2-compress-"));

function sips(args: string[]): string {
  return execFileSync("sips", args, { encoding: "utf8" });
}

function hasAlpha(file: string): boolean {
  return /hasAlpha: yes/.test(sips(["-g", "hasAlpha", file]));
}

async function main() {
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket, Prefix: "uploads/" }),
  );
  const targets = (listed.Contents ?? []).filter(
    (o) =>
      (o.Size ?? 0) > SIZE_THRESHOLD &&
      /\.(png|jpe?g|webp)$/i.test(o.Key ?? ""),
  );
  console.log(
    `${LIVE ? "LIVE" : "DRY RUN"} — ${targets.length} objects over ${SIZE_THRESHOLD / 1024} KB\n`,
  );

  let beforeTotal = 0;
  let afterTotal = 0;

  for (const obj of targets) {
    const key = obj.Key!;
    const orig = path.join(workDir, path.basename(key));
    const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
    writeFileSync(orig, Buffer.from(await res.Body!.transformToByteArray()));
    const beforeKB = Math.round(statSync(orig).size / 1024);

    const alpha = hasAlpha(orig);
    const outFormat = alpha ? "png" : "jpeg";
    const out = orig + ".out";
    sips([
      "-Z", String(MAX_DIMENSION),
      "-s", "format", outFormat,
      ...(alpha ? [] : ["-s", "formatOptions", JPEG_QUALITY]),
      orig,
      "--out", out,
    ]);
    const afterBytes = readFileSync(out);
    const afterKB = Math.round(afterBytes.length / 1024);
    const worthIt = afterBytes.length < statSync(orig).size * 0.9;

    beforeTotal += beforeKB;
    afterTotal += worthIt ? afterKB : beforeKB;
    console.log(
      `${key}: ${beforeKB} KB -> ${afterKB} KB (${outFormat}${alpha ? ", alpha kept" : ""})${worthIt ? "" : "  [skipped: <10% saving]"}`,
    );
    if (!LIVE || !worthIt) continue;

    await client.send(
      new CopyObjectCommand({
        Bucket,
        CopySource: `${Bucket}/${key}`,
        Key: `originals-backup/${key}`,
      }),
    );
    await client.send(
      new PutObjectCommand({
        Bucket,
        Key: key,
        Body: afterBytes,
        ContentType: alpha ? "image/png" : "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    console.log(`  -> backed up to originals-backup/${key} and overwritten`);
  }

  console.log(
    `\nTotal: ${Math.round(beforeTotal / 1024)} MB -> ${Math.round(afterTotal / 1024)} MB`,
  );
  if (!LIVE) console.log("Dry run only — rerun with --live to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
