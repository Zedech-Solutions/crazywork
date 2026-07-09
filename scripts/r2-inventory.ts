import "dotenv/config";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const env = process.env;
const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
});

const all: { Key?: string; Size?: number }[] = [];
let token: string | undefined;
do {
  const page = await client.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET!, ContinuationToken: token }));
  all.push(...(page.Contents ?? []));
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

const groups = new Map<string, { count: number; bytes: number; min: number; max: number; over800k: number }>();
for (const o of all) {
  const key = o.Key ?? "";
  const prefix = key.includes("/") ? key.split("/")[0] + "/" : "(root)";
  const ext = (key.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? "none").toLowerCase();
  const g = `${prefix} .${ext}`;
  const cur = groups.get(g) ?? { count: 0, bytes: 0, min: Infinity, max: 0, over800k: 0 };
  const s = o.Size ?? 0;
  cur.count++; cur.bytes += s; cur.min = Math.min(cur.min, s); cur.max = Math.max(cur.max, s);
  if (s > 800 * 1024) cur.over800k++;
  groups.set(g, cur);
}
console.log(`TOTAL objects: ${all.length}, ${(all.reduce((a, o) => a + (o.Size ?? 0), 0) / 1048576).toFixed(1)} MB\n`);
const kb = (n: number) => (n / 1024).toFixed(0) + "KB";
for (const [g, v] of [...groups.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`${g.padEnd(22)} count=${String(v.count).padStart(3)}  total=${(v.bytes / 1048576).toFixed(1).padStart(6)}MB  range=${kb(v.min)}-${kb(v.max)}  over800KB=${v.over800k}`);
}
