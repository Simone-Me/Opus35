import { describe, expect, it } from "vitest";
import { getHeardYear, toEpochBucket } from "./epochs";

describe("toEpochBucket", () => {
  it.each([
    ["Baroque", "Baroque"],
    ["Early Romantic", "Early Romantic"],
    ["Late Romantic", "Late Romantic"],
    ["Romantic", "Romantic"],
    ["20th Century", "20th Century"],
    ["Post‐War", "Post-War"],
    ["21st Century", "21st Century"],
    ["Modern", "20th Century"],
    [null, "Other"],
    ["Unknown thing", "Other"],
  ])("%s -> %s", (epoch, bucket) => {
    expect(toEpochBucket(epoch)).toBe(bucket);
  });
});

describe("getHeardYear", () => {
  it("reads the typed year without timezone shifts", () => {
    expect(getHeardYear({ details: { heard: { date: "2026-01-01" } } })).toBe("2026");
  });

  it("falls back to created_at and handles invalid values", () => {
    expect(getHeardYear({ created_at: "2025-06-15T10:00:00Z" })).toBe("2025");
    expect(getHeardYear({ details: { heard: { date: "not a date" } } })).toBe("Unknown");
    expect(getHeardYear({})).toBe("Unknown");
  });
});
