import { describe, expect, test } from "vitest";
import { formatRM, rm, toSen } from "@/lib/money";

describe("formatRM", () => {
  test("formats sen as RM with thousands separator and two decimals", () => {
    expect(formatRM(150000)).toBe("RM 1,500.00");
  });

  test("formats zero", () => {
    expect(formatRM(0)).toBe("RM 0.00");
  });

  test("formats sub-ringgit cents", () => {
    expect(formatRM(12050)).toBe("RM 120.50");
  });

  test("formats large amounts", () => {
    expect(formatRM(123456789)).toBe("RM 1,234,567.89");
  });
});

describe("rm (ringgit → sen)", () => {
  test("converts whole ringgit", () => {
    expect(rm(120)).toBe(12000);
  });

  test("converts fractional ringgit", () => {
    expect(rm(120.5)).toBe(12050);
  });

  test("rounds float artifacts to the nearest sen", () => {
    expect(rm(0.1 + 0.2)).toBe(30);
  });
});

describe("toSen (Prisma Decimal / string / number → sen)", () => {
  test("parses decimal strings", () => {
    expect(toSen("120.00")).toBe(12000);
    expect(toSen("1500.55")).toBe(150055);
  });

  test("passes through numbers", () => {
    expect(toSen(99.9)).toBe(9990);
  });

  test("accepts Decimal-like objects via toString", () => {
    expect(toSen({ toString: () => "45.05" } as unknown as string)).toBe(4505);
  });
});
