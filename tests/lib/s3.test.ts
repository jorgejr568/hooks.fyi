import { describe, it, expect, beforeAll } from "vitest";
import {
  putObject,
  getObjectStream,
  deletePrefix,
  buildAttachmentKey,
} from "@/lib/s3";
import { randomUUID } from "node:crypto";

describe("s3 wrapper (integration)", () => {
  const prefix = `tests/${randomUUID()}/`;

  it("puts and gets an object", async () => {
    const key = `${prefix}hello.txt`;
    await putObject({
      key,
      body: Buffer.from("hello world"),
      contentType: "text/plain",
    });

    const { body, contentType } = await getObjectStream(key);
    expect(contentType).toBe("text/plain");
    const chunks: Uint8Array[] = [];
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    expect(text).toBe("hello world");
  });

  it("buildAttachmentKey sanitizes filename", () => {
    const k = buildAttachmentKey({
      hookId: "h",
      requestId: "r",
      attachmentId: "a",
      fileName: "my report (1).pdf",
    });
    expect(k).toBe("hooks/h/r/a-my_report__1_.pdf");
  });

  beforeAll(() => {
    return () => deletePrefix(prefix);
  });
});
