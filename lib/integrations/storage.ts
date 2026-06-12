import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import type { Storage, UploadedFile } from "./types";

// Stub → writes to /public/uploads. Real impl: Cloudflare R2 via S3 client.
export class StubStorage implements Storage {
  private dir = path.join(process.cwd(), "public", "uploads");

  async upload(file: UploadedFile): Promise<{ url: string }> {
    await mkdir(this.dir, { recursive: true });
    const ext = path.extname(file.name) || ".bin";
    const filename = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
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

export const storage: Storage = new StubStorage();
