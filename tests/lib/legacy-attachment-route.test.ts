import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

describe("legacy unscoped attachment endpoint", () => {
  it("must not exist (cross-hook info disclosure)", () => {
    const file = path.resolve(
      __dirname,
      "../../src/app/api/files/_legacy_attachment_id/route.ts",
    );
    expect(existsSync(file)).toBe(false);
  });
});
