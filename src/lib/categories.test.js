import { describe, expect, it } from "vitest";
import {
  collectPlaceOptions,
  getCategoryLabel,
  getDetailsPreview,
  PROFILE_TABS,
} from "./categories";

describe("labels", () => {
  it("uses the same user-facing names everywhere", () => {
    expect(getCategoryLabel("heard")).toBe("Attended");
    expect(getCategoryLabel("bought")).toBe("Record");
    expect(PROFILE_TABS.map((tab) => tab.label)).toEqual([
      "All",
      "Attended",
      "Favorites",
      "Records",
      "Alerts",
      "Notes",
    ]);
  });
});

describe("getDetailsPreview", () => {
  it("never prints objects or empty separators", () => {
    const preview = getDetailsPreview("heard", {
      date: "2026-01-10",
      place: "Philharmonie de Paris",
      orchestra: "",
      vocals: [{ role: "Choir", name: "Accentus" }],
    });

    expect(preview).toBe("2026-01-10 · Philharmonie de Paris · Accentus");
    expect(preview).not.toContain("[object Object]");
  });

  it("ignores empty vocals and handles flags", () => {
    expect(getDetailsPreview("bought", { vocals: [] })).toBe("No details yet");
    expect(getDetailsPreview("favorite", {})).toBe("Flag only");
  });

  it("keeps at most three values", () => {
    expect(
      getDetailsPreview("bought", {
        dateBought: "2025-01-01",
        place: "Shop",
        orchestra: "LSO",
        conductor: "Rattle",
      }),
    ).toBe("2025-01-01 · Shop · LSO");
  });
});

describe("collectPlaceOptions", () => {
  it("merges defaults with places used in heard and record details", () => {
    expect(
      collectPlaceOptions([
        { details: { heard: { place: " Wigmore Hall " } } },
        { details: { bought: { place: "Opera de Paris" } } },
        { details: {} },
      ]),
    ).toEqual(["Opera de Paris", "Philharmonie de Paris", "Wigmore Hall"]);
  });
});
