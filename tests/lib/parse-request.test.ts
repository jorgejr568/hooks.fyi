import { describe, it, expect } from "vitest";
import { parseRequest } from "@/lib/ingest/parse-request";
import { buildRequest } from "../helpers/build-request";

const opts = { maxBodyBytes: 1024, maxFileBytes: 4096 };

describe("parseRequest", () => {
  it("parses a GET with query string and headers", async () => {
    const req = buildRequest({
      method: "GET",
      url: "http://localhost:3000/h/abc?x=1&y=2&y=3",
      headers: { "User-Agent": "curl/8", "X-Forwarded-For": "10.0.0.1, 1.2.3.4" },
    });
    const parsed = await parseRequest(req, "/extra/path", opts);
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/extra/path");
    expect(parsed.query).toEqual({ x: "1", y: ["2", "3"] });
    expect(parsed.headers["user-agent"]).toBe("curl/8");
    expect(parsed.userAgent).toBe("curl/8");
    expect(parsed.ip).toBe("10.0.0.1");
    expect(parsed.body).toBeNull();
    expect(parsed.files).toEqual([]);
  });

  it("parses a JSON POST", async () => {
    const req = buildRequest({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    const parsed = await parseRequest(req, "/", opts);
    expect(parsed.method).toBe("POST");
    expect(parsed.contentType).toBe("application/json");
    expect(parsed.body).toBe('{"hello":"world"}');
    expect(parsed.bodyTruncated).toBe(false);
    expect(parsed.bodySize).toBe(17);
    expect(parsed.files).toEqual([]);
  });

  it("parses multipart with text fields and files", async () => {
    const fd = new FormData();
    fd.append("subject", "hi");
    fd.append("subject", "again");
    fd.append("file", new File([new Uint8Array([1, 2, 3, 4])], "blob.bin", { type: "application/octet-stream" }));
    const req = new Request("http://localhost:3000/h/abc", { method: "POST", body: fd });
    const parsed = await parseRequest(req, "/", opts);
    expect(parsed.contentType).toMatch(/^multipart\/form-data/);
    expect(JSON.parse(parsed.body!)).toEqual({ subject: ["hi", "again"] });
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].fieldName).toBe("file");
    expect(parsed.files[0].fileName).toBe("blob.bin");
    expect(parsed.files[0].contentType).toBe("application/octet-stream");
    expect(Array.from(parsed.files[0].bytes)).toEqual([1, 2, 3, 4]);
  });

  it("truncates oversized text bodies and reports size", async () => {
    const big = "x".repeat(2000);
    const req = buildRequest({
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: big,
    });
    const parsed = await parseRequest(req, "/", { maxBodyBytes: 100, maxFileBytes: 4096 });
    expect(parsed.bodySize).toBe(2000);
    expect(parsed.bodyTruncated).toBe(true);
    expect(parsed.body!.length).toBe(100);
  });

  it("encodes non-textual bodies as base64", async () => {
    const buf = new Uint8Array([0xff, 0x00, 0xfa]);
    const req = new Request("http://localhost:3000/h/abc", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: buf,
    });
    const parsed = await parseRequest(req, "/", opts);
    expect(parsed.body).toBe(Buffer.from(buf).toString("base64"));
  });
});
