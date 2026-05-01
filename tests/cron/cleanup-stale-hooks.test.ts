import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, disconnect } from "../helpers/test-db";
import { findStaleHookIds, deleteHookSafely } from "@/cron/cleanup-stale-hooks";
import { putObject, deletePrefix, getObjectStream } from "@/lib/s3";
import { randomUUID } from "node:crypto";

const SIXTEEN_DAYS_MS = 16 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnect();
});

async function makeHook(opts: { createdAt: Date; lastRequestAt?: Date }) {
  const hook = await prisma.hook.create({
    data: { name: "h", createdAt: opts.createdAt },
  });
  if (opts.lastRequestAt) {
    await prisma.request.create({
      data: {
        hookId: hook.id,
        method: "GET",
        path: "/",
        createdAt: opts.lastRequestAt,
      },
    });
  }
  return hook;
}

describe("findStaleHookIds", () => {
  it("returns hooks with no requests older than threshold", async () => {
    const stale = await makeHook({
      createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
    });
    await makeHook({ createdAt: new Date() }); // fresh, never used
    const ids = await findStaleHookIds({ retentionDays: 15, limit: 100 });
    expect(ids).toEqual([stale.id]);
  });

  it("ignores hooks with a recent request even if created long ago", async () => {
    await makeHook({
      createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
      lastRequestAt: new Date(Date.now() - FIVE_DAYS_MS),
    });
    const ids = await findStaleHookIds({ retentionDays: 15, limit: 100 });
    expect(ids).toEqual([]);
  });

  it("returns hooks whose only request is older than threshold", async () => {
    const stale = await makeHook({
      createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
      lastRequestAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
    });
    const ids = await findStaleHookIds({ retentionDays: 15, limit: 100 });
    expect(ids).toEqual([stale.id]);
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 3; i++) {
      await makeHook({ createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS) });
    }
    const ids = await findStaleHookIds({ retentionDays: 15, limit: 2 });
    expect(ids.length).toBe(2);
  });
});

describe("deleteHookSafely", () => {
  it("deletes the hook row, cascading requests and attachments", async () => {
    const hook = await makeHook({
      createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
    });
    const req = await prisma.request.create({
      data: {
        hookId: hook.id,
        method: "POST",
        path: "/",
        createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
      },
    });
    await prisma.attachment.create({
      data: {
        requestId: req.id,
        s3Key: `hooks/${hook.id}/${req.id}/x-test.txt`,
        size: 5n,
      },
    });

    const result = await deleteHookSafely({
      hookId: hook.id,
      retentionDays: 15,
    });
    expect(result.deleted).toBe(true);
    expect(await prisma.hook.findUnique({ where: { id: hook.id } })).toBeNull();
    expect(await prisma.request.count()).toBe(0);
    expect(await prisma.attachment.count()).toBe(0);
  });

  it("deletes S3 prefix for the hook", async () => {
    const hook = await makeHook({
      createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
    });
    const key = `hooks/${hook.id}/${randomUUID()}/sentinel.txt`;
    await putObject({ key, body: Buffer.from("bye") });

    await deleteHookSafely({ hookId: hook.id, retentionDays: 15 });

    await expect(getObjectStream(key)).rejects.toThrow();
  });

  it("refuses to delete if a fresh request appeared after candidate selection", async () => {
    const hook = await makeHook({
      createdAt: new Date(Date.now() - SIXTEEN_DAYS_MS),
    });
    // Race: a brand-new request lands between findStaleHookIds and deleteHookSafely.
    await prisma.request.create({
      data: { hookId: hook.id, method: "GET", path: "/", createdAt: new Date() },
    });

    const result = await deleteHookSafely({
      hookId: hook.id,
      retentionDays: 15,
    });
    expect(result.deleted).toBe(false);
    expect(await prisma.hook.findUnique({ where: { id: hook.id } })).not.toBeNull();
  });

  it("returns deleted=false for a hookId that no longer exists", async () => {
    const result = await deleteHookSafely({
      hookId: randomUUID(),
      retentionDays: 15,
    });
    expect(result.deleted).toBe(false);
  });
});
