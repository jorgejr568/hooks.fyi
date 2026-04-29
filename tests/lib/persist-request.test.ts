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
  rawBody: null,
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

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

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

  it("saves multipart files to s3 with kind=MULTIPART_FILE", async () => {
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
    expect(attachments[0].kind).toBe("MULTIPART_FILE");
    expect(attachments[0].fileName).toBe("report.txt");
    expect(Number(attachments[0].size)).toBe(13);

    const obj = await getObjectStream(attachments[0].s3Key);
    expect((await readStream(obj.body!)).toString("utf8")).toBe("file contents");
  });

  it("uploads overflow body to s3 as a RAW_BODY attachment", async () => {
    const fullBytes = new Uint8Array(Buffer.alloc(2_000, 0x42)); // 2 KB
    const parsed: ParsedRequest = {
      ...baseParsed,
      contentType: "application/octet-stream",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from(fullBytes.subarray(0, 100)).toString("base64"),
      bodyTruncated: true,
      bodySize: 2_000,
      rawBody: {
        bytes: fullBytes,
        contentType: "application/octet-stream",
        truncatedAtFileCap: false,
      },
    };
    const result = await persistRequest({ hookId, parsed });
    const attachments = await prisma.attachment.findMany({
      where: { requestId: result.id },
      orderBy: { createdAt: "asc" },
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0].kind).toBe("RAW_BODY");
    expect(attachments[0].fieldName).toBeNull();
    expect(attachments[0].fileName).toBe("body.bin");
    expect(attachments[0].contentType).toBe("application/octet-stream");
    expect(Number(attachments[0].size)).toBe(2_000);

    const obj = await getObjectStream(attachments[0].s3Key);
    expect((await readStream(obj.body!)).byteLength).toBe(2_000);

    const row = await prisma.request.findUnique({ where: { id: result.id } });
    expect(row!.bodyTruncated).toBe(true);
    expect(row!.bodySize).toBe(2_000);
  });

  it("can persist multipart files AND a raw_body in the same request", async () => {
    const fullBytes = new Uint8Array(Buffer.alloc(800, 0x43));
    const parsed: ParsedRequest = {
      ...baseParsed,
      contentType: "multipart/form-data; boundary=x",
      files: [
        {
          fieldName: "upload",
          fileName: "a.txt",
          contentType: "text/plain",
          bytes: new TextEncoder().encode("hello"),
        },
      ],
      rawBody: {
        bytes: fullBytes,
        contentType: "application/octet-stream",
        truncatedAtFileCap: false,
      },
    };
    const result = await persistRequest({ hookId, parsed });
    const attachments = await prisma.attachment.findMany({
      where: { requestId: result.id },
    });
    expect(attachments.map((a) => a.kind).sort()).toEqual(["MULTIPART_FILE", "RAW_BODY"]);
  });

  it("returns request id usable for downstream events", async () => {
    const r1 = await persistRequest({ hookId, parsed: baseParsed });
    const r2 = await persistRequest({ hookId, parsed: baseParsed });
    expect(r1.id).not.toBe(r2.id);
  });
});
