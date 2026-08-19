import { describe, it, expect } from "vitest";
import { maskPhone } from "../selfCheckin";

describe("maskPhone", () => {
  it("keeps just enough for someone to recognise their own number", () => {
    expect(maskPhone("0553766929")).toBe("0•• ••• 6929");
    expect(maskPhone("0201140165")).toBe("0•• ••• 0165");
  });

  it("never reveals the middle digits", () => {
    const masked = maskPhone("0553766929");
    expect(masked).not.toContain("5537");
    expect(masked).not.toContain("376");
  });

  it("tolerates formatting in the stored value", () => {
    expect(maskPhone("020 114 0165")).toBe("0•• ••• 0165");
  });

  // ~50 member records have no phone at all; the row still has to render.
  it("returns empty rather than a broken mask when there is no number", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("12")).toBe("");
  });
});
