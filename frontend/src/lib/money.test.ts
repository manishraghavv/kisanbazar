import { describe, expect, it } from "vitest";
import { formatRupees, isZero } from "./money";
import { INDIAN_STATES, stateCodeFromName, stateNameFromCode } from "./indianStates";

describe("money helpers", () => {
  it("formats rupee strings from the API (Decimal values arrive as strings)", () => {
    expect(formatRupees("1180")).toBe("₹1,180.00");
    expect(formatRupees(48.6)).toBe("₹48.60");
    expect(formatRupees(null)).toBe("₹0.00");
  });
  it("detects zero amounts", () => {
    expect(isZero("0")).toBe(true);
    expect(isZero(0)).toBe(true);
    expect(isZero("0.01")).toBe(false);
    expect(isZero(undefined)).toBe(true);
  });
});

describe("Indian states", () => {
  it("maps names and codes both ways", () => {
    expect(stateCodeFromName("  maharashtra ")).toBe("27");
    expect(stateNameFromCode("29")).toBe("Karnataka");
    expect(stateCodeFromName("Atlantis")).toBe("");
  });
  it("has unique codes", () => {
    expect(new Set(INDIAN_STATES.map((s) => s.code)).size).toBe(INDIAN_STATES.length);
  });
});
