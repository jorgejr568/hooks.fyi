import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { persistRequest } from "@/lib/ingest/persist-request";
import { prisma } from "@/lib/prisma";
import { resetDb, disconnect } from "../helpers/test-db";
import { getObjectStream, deletePrefix } from "@/lib/s3";
import type { ParsedRequest } from "@/lib/ingest/types";

const baseParsed: ParsedRequest = {
  method: "POST",
  path: "/",
  query: { a: "1" },
  headers: { "content-type": "application/json", "x-test": "yes" },
  contentType: "application/json",
  body: '{"k":"v"}',
  bodyTruncated: false,
  bodySize: 9,
  files: [],
  ip: "10.0.0.1",
  userAgent: "curl/8",
};

let hookId: string;

beforeAll(async () => {
  await resetDb();
  const hook = await prisma.hook.create({ data: { name: "test" } });
  hookId = hook.id;
});

afterAll(async () => {
  await deletePrefix(`hooks/${hookId}/`);
  await disconnect();
});

beforeEach(async () => {
  await prisma.attachment.deleteMany();
  await prisma.request.deleteMany();
});

describe("persistRequest", () => {
  it("saves a JSON request with no attachments", async () => {
    const result = await persistRequest({ hookId, parsed: baseParsed });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    const row = await prisma.request.findUnique({ where: { id: result.id } });
    expect(row).not.toBeNull();
    expect(row!.method).toBe("POST");
    expect(row!.body).toBe('{"k":"v"}');
    expect(row!.headers).toEqual(baseParsed.headers);
    expect(row!.bodySize).toBe(9);
    expect(row!.bodyTruncated).toBe(false);
  });

  it("saves multipart files to s3 and creates Attachment rows", async () => {
    const parsed: ParsedRequest = {
      ...baseParsed,
      contentType: "multipart/form-data; boundary=x",
      headers: { ...baseParsed.headers, "content-type": "multipart/form-data; boundary=x" },
      body: '{"subject":"hi"}',
      bodySize: 16,
      files: [
        {
          fieldName: "upload",
          fileName: "report.txt",
          contentType: "text/plain",
          bytes: new TextEncoder().encode("file contents"),
        },
      ],
    };
    const result = await persistRequest({ hookId, parsed });
    const attachments = await prisma.attachment.findMany({
      where: { requestId: result.id },
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0].fileName).toBe("report.txt");
    expect(attachments[0].contentType).toBe("text/plain");
    expect(Number(attachments[0].size)).toBe(13);
    expect(attachments[0].s3Key).toContain(`hooks/${hookId}/${result.id}/`);

    const obj = await getObjectStream(attachments[0].s3Key);
    const reader = (obj.body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    expect(Buffer.concat(chunks).toString("utf8")).toBe("file contents");
  });

  it("returns request id usable for downstream events", async () => {
    const r1 = await persistRequest({ hookId, parsed: baseParsed });
    const r2 = await persistRequest({ hookId, parsed: baseParsed });
    expect(r1.id).not.toBe(r2.id);
  });
});
