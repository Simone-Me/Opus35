import { describe, expect, it } from "vitest";
import { firstRelation, localDayKey, toOrIlikePattern, uniqueSorted } from "./utils";

describe("firstRelation", () => {
  it("unwraps one-element arrays and passes objects through", () => {
    expect(firstRelation([{ id: 1 }])).toEqual({ id: 1 });
    expect(firstRelation({ id: 2 })).toEqual({ id: 2 });
    expect(firstRelation([])).toBeNull();
    expect(firstRelation(undefined)).toBeNull();
  });
});

describe("uniqueSorted", () => {
  it("dedupes, drops empty values and sorts", () => {
    const items = [{ g: "Vocal" }, { g: "" }, { g: "Chamber" }, { g: "Vocal" }, {}];
    expect(uniqueSorted(items, (item) => item.g)).toEqual(["Chamber", "Vocal"]);
  });
});

describe("localDayKey", () => {
  it("uses the local calendar day, not UTC", () => {
    // 23:30 local time is still the same local day whatever the timezone.
    expect(localDayKey(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
    expect(localDayKey(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });
});

describe("toOrIlikePattern", () => {
  it("quotes the value so PostgREST separators stay literal", () => {
    expect(toOrIlikePattern("No. 5, Op. 67 (Fate)")).toBe('"%No. 5, Op. 67 (Fate)%"');
  });

  it("escapes LIKE wildcards and quotes typed by the user", () => {
    expect(toOrIlikePattern("100%")).toBe('"%100\\\\%%"');
    expect(toOrIlikePattern("a_b")).toBe('"%a\\\\_b%"');
    expect(toOrIlikePattern('say "hi"')).toBe('"%say \\"hi\\"%"');
    expect(toOrIlikePattern("a*b")).toBe('"%a b%"');
  });
});
