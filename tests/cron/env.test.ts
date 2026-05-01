import { describe, it, expect } from "vitest";
import { parseCronEnv } from "@/cron/env";

describe("parseCronEnv", () => {
  it("applies defaults", () => {
    const e = parseCronEnv({
      DATABASE_URL: "postgresql://u:p@h/db",
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "b",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    });
    expect(e.STALE_HOOK_RETENTION_DAYS).toBe(15);
    expect(e.CLEANUP_CRON).toBe("0 3 * * *");
    expect(e.CLEANUP_BATCH_SIZE).toBe(500);
    expect(e.RUN_ON_START).toBe(true);
  });

  it("rejects retention < 1", () => {
    expect(() =>
      parseCronEnv({
        DATABASE_URL: "postgresql://u:p@h/db",
        S3_ENDPOINT: "http://localhost:9000",
        S3_REGION: "us-east-1",
        S3_BUCKET: "b",
        S3_ACCESS_KEY_ID: "k",
        S3_SECRET_ACCESS_KEY: "s",
        STALE_HOOK_RETENTION_DAYS: "0",
      }),
    ).toThrow();
  });

  it("coerces string booleans for RUN_ON_START", () => {
    const e = parseCronEnv({
      DATABASE_URL: "postgresql://u:p@h/db",
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "b",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
      RUN_ON_START: "false",
    });
    expect(e.RUN_ON_START).toBe(false);
  });
});
