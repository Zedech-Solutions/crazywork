import { describe, expect, test } from "vitest";
import {
  DEFAULT_SIZE_GUIDE,
  isValidSizeGuide,
  resolveSizeGuide,
  type SizeGuideTable,
} from "@/lib/size-guide";

const custom: SizeGuideTable = {
  note: "Waist & inseam in inches.",
  columns: ["Size", "Waist", "Inseam"],
  rows: [
    ["28", "28", "7"],
    ["30", "30", "7"],
  ],
};

describe("resolveSizeGuide", () => {
  test("uses the product override when it is a valid table with rows", () => {
    expect(resolveSizeGuide(custom, DEFAULT_SIZE_GUIDE)).toEqual(custom);
  });

  test("falls back to the default when override is null/undefined", () => {
    expect(resolveSizeGuide(null, DEFAULT_SIZE_GUIDE)).toBe(DEFAULT_SIZE_GUIDE);
    expect(resolveSizeGuide(undefined, DEFAULT_SIZE_GUIDE)).toBe(
      DEFAULT_SIZE_GUIDE,
    );
  });

  test("falls back when the override has no rows (blank custom guide)", () => {
    expect(
      resolveSizeGuide(
        { note: "", columns: ["Size"], rows: [] },
        DEFAULT_SIZE_GUIDE,
      ),
    ).toBe(DEFAULT_SIZE_GUIDE);
  });

  test("falls back when the override is malformed JSON shape", () => {
    expect(resolveSizeGuide({ foo: "bar" }, DEFAULT_SIZE_GUIDE)).toBe(
      DEFAULT_SIZE_GUIDE,
    );
    expect(resolveSizeGuide("not-an-object", DEFAULT_SIZE_GUIDE)).toBe(
      DEFAULT_SIZE_GUIDE,
    );
  });
});

describe("isValidSizeGuide", () => {
  test("accepts a well-formed table", () => {
    expect(isValidSizeGuide(custom)).toBe(true);
  });

  test("rejects non-objects and missing fields", () => {
    expect(isValidSizeGuide(null)).toBe(false);
    expect(isValidSizeGuide({ columns: [], rows: [] })).toBe(false); // no note
    expect(isValidSizeGuide({ note: "x", rows: [] })).toBe(false); // no columns
    expect(isValidSizeGuide({ note: "x", columns: [] })).toBe(false); // no rows
  });
});
