import { describe, it, expect } from "vitest";
import { methodColor } from "@/lib/format/method-color";

describe("methodColor", () => {
  it.each([
    ["GET", "sky"],
    ["POST", "emerald"],
    ["PUT", "amber"],
    ["PATCH", "violet"],
    ["DELETE", "rose"],
    ["HEAD", "zinc"],
    ["OPTIONS", "zinc"],
    ["TRACE", "zinc"],
    ["BREW", "zinc"],
  ])("returns the right tone for %s", (method, color) => {
    expect(methodColor(method)).toBe(color);
  });
});
