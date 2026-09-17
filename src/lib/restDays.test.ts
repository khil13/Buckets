import { describe, expect, it } from "vitest";
import { getRestContext } from "./restDays";

describe("getRestContext", () => {
  it("returns null rest with no prior games", () => {
    expect(getRestContext([], "2025-01-10")).toEqual({ restDays: null, isBackToBack: false });
  });

  it("flags a true back-to-back (played yesterday)", () => {
    expect(getRestContext(["2025-01-09"], "2025-01-10")).toEqual({ restDays: 0, isBackToBack: true });
  });

  it("counts one day of rest (played two days ago)", () => {
    expect(getRestContext(["2025-01-08"], "2025-01-10")).toEqual({ restDays: 1, isBackToBack: false });
  });

  it("counts multiple days of rest", () => {
    expect(getRestContext(["2025-01-05"], "2025-01-10")).toEqual({ restDays: 4, isBackToBack: false });
  });

  it("only considers games strictly before the target date", () => {
    const result = getRestContext(["2025-01-09", "2025-01-12"], "2025-01-10");
    expect(result).toEqual({ restDays: 0, isBackToBack: true });
  });

  it("uses the most recent prior game when several exist", () => {
    const result = getRestContext(["2025-01-01", "2025-01-08"], "2025-01-10");
    expect(result).toEqual({ restDays: 1, isBackToBack: false });
  });
});
