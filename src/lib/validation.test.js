import { describe, expect, it } from "vitest";
import { NOTE_MAX_LENGTH, validateNote } from "./notes";
import { checkPasswordPolicy, getPasswordPolicyError } from "./password";

describe("validateNote", () => {
  it("trims and accepts valid notes", () => {
    expect(validateNote("  hello  ")).toEqual({ note: "hello", error: "" });
  });

  it("rejects empty and too long notes", () => {
    expect(validateNote("   ").error).toMatch(/Write a note/);
    expect(validateNote("x".repeat(NOTE_MAX_LENGTH + 1)).error).toMatch(/500/);
    expect(validateNote("x".repeat(NOTE_MAX_LENGTH)).error).toBe("");
  });
});

describe("password policy", () => {
  it("reports the first failing rule", () => {
    expect(getPasswordPolicyError(checkPasswordPolicy("short!", "short!"))).toMatch(/12/);
    expect(getPasswordPolicyError(checkPasswordPolicy("longpassword1", "longpassword1"))).toMatch(
      /special/,
    );
    expect(getPasswordPolicyError(checkPasswordPolicy("longpassword!", "other"))).toMatch(
      /match/,
    );
    expect(getPasswordPolicyError(checkPasswordPolicy("longpassword!", "longpassword!"))).toBe("");
  });
});
