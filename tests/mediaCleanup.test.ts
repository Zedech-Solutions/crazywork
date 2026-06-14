import { describe, expect, test } from "vitest";
import { removedUrls, contentMediaUrls } from "@/lib/integrations/media-cleanup";

describe("removedUrls", () => {
  test("returns old URLs that are absent from the new set", () => {
    const old = ["a.png", "b.png", "c.png"];
    const next = ["b.png", "d.png"];
    expect(removedUrls(old, next)).toEqual(["a.png", "c.png"]);
  });

  test("returns nothing when every old URL is kept", () => {
    expect(removedUrls(["a.png", "b.png"], ["a.png", "b.png"])).toEqual([]);
  });

  test("ignores falsy entries on both sides", () => {
    expect(
      removedUrls(["a.png", "", null as never], ["", undefined as never]),
    ).toEqual(["a.png"]);
  });
});

describe("contentMediaUrls", () => {
  test("collects the cover image", () => {
    expect(contentMediaUrls("cover.png", [])).toEqual(["cover.png"]);
  });

  test("collects url from image blocks and urls from image_grid blocks", () => {
    const blocks = [
      { type: "paragraph", data: { text: "hi" } },
      { type: "image", data: { url: "one.png", alt: "x" } },
      {
        type: "image_grid",
        data: { images: [{ url: "two.png" }, { url: "three.png" }], columns: 3 },
      },
    ];
    expect(contentMediaUrls(null, blocks)).toEqual([
      "one.png",
      "two.png",
      "three.png",
    ]);
  });

  test("skips empty/missing urls and non-image blocks", () => {
    const blocks = [
      { type: "image", data: { url: "" } },
      { type: "image_grid", data: { images: [{ url: "" }, { url: "keep.png" }] } },
      { type: "heading", data: { text: "h" } },
    ];
    expect(contentMediaUrls(undefined, blocks)).toEqual(["keep.png"]);
  });
});
