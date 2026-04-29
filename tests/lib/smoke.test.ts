import { describe, it, expect } from "vitest";

describe("vitest harness", () => {
  it("reads .env.test", () => {
    expect(process.env.DATABASE_URL).toContain("hooksfyi_test");
  });
});
