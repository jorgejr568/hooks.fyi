import { describe, it, expect, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { attachment: { findFirst } },
}));
vi.mock("@/lib/s3", () => ({
  getObjectStream: vi.fn().mockResolvedValue({
    body: new ReadableStream({ start(c) { c.close(); } }),
  }),
}));

const ID = "550e8400-e29b-41d4-a716-446655440000";
const FID = "660e8400-e29b-41d4-a716-446655440001";

const { GET } = await import("@/app/api/files/[hookId]/[fileName]/route");

async function call(fileName: string, inline = false) {
  const url = `https://hooks.fyi/api/files/${ID}/${fileName}${inline ? "?inline=1" : ""}`;
  return GET(new Request(url), {
    params: Promise.resolve({ hookId: ID, fileName }),
  });
}

describe("file download MIME hardening", () => {
  beforeEach(() => findFirst.mockReset());

  it("forces attachment + octet-stream for text/html (XSS bait)", async () => {
    findFirst.mockResolvedValueOnce({
      s3Key: "k", fileName: "evil.html", contentType: "text/html", size: 10,
    });
    const res = await call(`${FID}.html`, true);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")!.startsWith("attachment;"))
      .toBe(true);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows inline image/png (safelist)", async () => {
    findFirst.mockResolvedValueOnce({
      s3Key: "k", fileName: "x.png", contentType: "image/png", size: 10,
    });
    const res = await call(`${FID}.png`, true);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")!.startsWith("inline;"))
      .toBe(true);
  });

  it("forces application/octet-stream when a download is requested even for safe MIMEs", async () => {
    findFirst.mockResolvedValueOnce({
      s3Key: "k", fileName: "x.png", contentType: "image/png", size: 10,
    });
    const res = await call(`${FID}.png`, false);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")!.startsWith("attachment;"))
      .toBe(true);
  });
});
