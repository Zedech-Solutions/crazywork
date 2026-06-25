import { describe, expect, test } from "vitest";
import { validateUpload } from "@/lib/integrations/media";

describe("validateUpload", () => {
  test("accepts an allowed image type as mediaType 'image'", () => {
    expect(
      validateUpload({ contentType: "image/png", size: 1_000 }),
    ).toEqual({ ok: true, mediaType: "image" });
  });

  test("accepts an allowed video type as mediaType 'video'", () => {
    expect(
      validateUpload({ contentType: "video/mp4", size: 1_000 }),
    ).toEqual({ ok: true, mediaType: "video" });
  });

  test("rejects a disallowed MIME type", () => {
    const result = validateUpload({
      contentType: "application/pdf",
      size: 1_000,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects an image over the 10 MB cap", () => {
    const result = validateUpload({
      contentType: "image/png",
      size: 11 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects a video over the 50 MB cap", () => {
    const result = validateUpload({
      contentType: "video/mp4",
      size: 51 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
  });

  test("accepts a video larger than the image cap but under the video cap", () => {
    expect(
      validateUpload({ contentType: "video/mp4", size: 30 * 1024 * 1024 }),
    ).toEqual({ ok: true, mediaType: "video" });
  });
});
