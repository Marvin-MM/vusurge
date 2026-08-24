import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/lib/safeReturnTo";

describe("safeReturnTo", () => {
  it("preserves local application paths", () => {
    expect(safeReturnTo("/app/challenges?tab=mine#active")).toBe("/app/challenges?tab=mine#active");
  });

  it("rejects external, protocol-relative, and backslash targets", () => {
    expect(safeReturnTo("https://attacker.example/phish")).toBe("/app");
    expect(safeReturnTo("//attacker.example/phish")).toBe("/app");
    expect(safeReturnTo("/\\attacker.example/phish")).toBe("/app");
  });

  it("uses the caller fallback when no safe target exists", () => {
    expect(safeReturnTo(null, "/dashboard")).toBe("/dashboard");
  });
});
