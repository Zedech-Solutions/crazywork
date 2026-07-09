import "dotenv/config";
import { CopyObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const env = process.env;
const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
});
const Bucket = env.R2_BUCKET!;
const listed = await client.send(new ListObjectsV2Command({ Bucket, Prefix: "uploads/" }));
const videos = (listed.Contents ?? []).filter((o) => /\.(mp4|mov|webm)$/i.test(o.Key ?? ""));
for (const v of videos) {
  await client.send(new CopyObjectCommand({ Bucket, CopySource: `${Bucket}/${encodeURIComponent(v.Key!)}`, Key: `originals-backup/${v.Key}` }));
  console.log(`backed up ${v.Key} (${Math.round((v.Size ?? 0) / 1048576)} MB)`);
}
