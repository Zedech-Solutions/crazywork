import { describe, expect, test } from "vitest";
import { DEFAULT_HOME_CONTENT, deepMerge } from "@/lib/content";

describe("deepMerge (content fallback)", () => {
  test("returns defaults when override is null/undefined", () => {
    expect(deepMerge(DEFAULT_HOME_CONTENT, null)).toEqual(DEFAULT_HOME_CONTENT);
    expect(deepMerge(DEFAULT_HOME_CONTENT, undefined)).toEqual(
      DEFAULT_HOME_CONTENT,
    );
  });

  test("overrides only the provided top-level fields", () => {
    const merged = deepMerge(DEFAULT_HOME_CONTENT, {
      heroHeadline: "New Headline",
    });
    expect(merged.heroHeadline).toBe("New Headline");
    expect(merged.heroSub).toBe(DEFAULT_HOME_CONTENT.heroSub);
  });

  test("merges nested objects key-by-key (missing keys fall back)", () => {
    const merged = deepMerge(DEFAULT_HOME_CONTENT, {
      heroCtaPrimary: { label: "Buy Now" },
    });
    expect(merged.heroCtaPrimary.label).toBe("Buy Now");
    expect(merged.heroCtaPrimary.href).toBe(
      DEFAULT_HOME_CONTENT.heroCtaPrimary.href,
    );
  });

  test("arrays are replaced wholesale, not merged", () => {
    const merged = deepMerge(DEFAULT_HOME_CONTENT, { marquee: ["one", "two"] });
    expect(merged.marquee).toEqual(["one", "two"]);
  });

  test("ignores unknown keys in the override", () => {
    const merged = deepMerge(DEFAULT_HOME_CONTENT, { bogus: "x" } as never);
    expect("bogus" in merged).toBe(false);
  });
});
