import busboy from "busboy";
import { Readable } from "node:stream";
import { logger } from "@/lib/log";
import {
  PayloadTooLargeError,
  type ParsedRequest,
  type ParseOptions,
  type ParsedFilePart,
  type ParsedRawBody,
} from "./types";

const TEXTUAL_CT = /^(application\/(json|x-www-form-urlencoded|xml|.*\+json|.*\+xml)|text\/.*)/i;

function parseMultipart(
  buf: Buffer,
  contentType: string,
  maxFileBytes: number,
): Promise<{ textParts: Record<string, string | string[]>; files: ParsedFilePart[] }> {
  return new Promise((resolve, reject) => {
    const textParts: Record<string, string | string[]> = {};
    const files: ParsedFilePart[] = [];
    let bb: ReturnType<typeof busboy>;
    try {
      bb = busboy({ headers: { "content-type": contentType } });
    } catch (err) {
      reject(err);
      return;
    }

    bb.on("field", (name, value) => {
      const existing = textParts[name];
      if (existing === undefined) textParts[name] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else textParts[name] = [existing, value];
    });

    bb.on("file", (name, stream, info) => {
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on("data", (chunk: Buffer) => {
        if (total >= maxFileBytes) return;
        const room = maxFileBytes - total;
        if (chunk.length > room) {
          chunks.push(chunk.subarray(0, room));
          total += room;
        } else {
          chunks.push(chunk);
          total += chunk.length;
        }
      });
      stream.on("end", () => {
        files.push({
          fieldName: name,
          fileName: info.filename || null,
          contentType: info.mimeType || null,
          bytes: Buffer.concat(chunks),
        });
      });
      stream.on("error", reject);
    });

    bb.on("close", () => resolve({ textParts, files }));
    bb.on("error", reject);

    Readable.from(buf).pipe(bb);
  });
}

function pickIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? null;
}

function collectQuery(url: URL): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(Array.from(url.searchParams.keys()))) {
    const all = url.searchParams.getAll(key);
    out[key] = all.length === 1 ? all[0] : all;
  }
  return out;
}

function collectHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/**
 * Read the body up to `maxBytes`. Throws PayloadTooLargeError if the stream
 * exceeds that limit (so callers can return 413 without OOMing).
 */
async function readBodyBounded(req: Request, maxBytes: number): Promise<Buffer> {
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function parseRequest(
  req: Request,
  pathSuffix: string,
  opts: ParseOptions,
): Promise<ParsedRequest> {
  const url = new URL(req.url);
  const headersMap = collectHeaders(req.headers);
  const contentType = req.headers.get("content-type");

  let body: string | null = null;
  let bodyTruncated = false;
  let bodySize = 0;
  const files: ParsedFilePart[] = [];
  let rawBody: ParsedRawBody | null = null;

  const hasBody = !["GET", "HEAD"].includes(req.method.toUpperCase());

  if (hasBody) {
    const rawBuf = await readBodyBounded(req, opts.maxRequestBytes);
    bodySize = rawBuf.byteLength;
    const isMultipart = contentType?.toLowerCase().startsWith("multipart/form-data");
    let multipartParsed = false;

    if (isMultipart && rawBuf.byteLength > 0) {
      try {
        const result = await parseMultipart(rawBuf, contentType!, opts.maxFileBytes);
        files.push(...result.files);
        const serialized = JSON.stringify(result.textParts);
        bodySize = Buffer.byteLength(serialized);
        body = serialized.length > 0 ? serialized : null;
        multipartParsed = true;
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? { name: err.name, message: err.message } : err, contentType },
          "multipart parse failed, falling back to raw",
        );
      }
    }

    if (!multipartParsed) {
      const overflow = rawBuf.byteLength > opts.maxBodyPreviewBytes;
      const slice = overflow ? rawBuf.subarray(0, opts.maxBodyPreviewBytes) : rawBuf;
      bodyTruncated = overflow;
      if (contentType && TEXTUAL_CT.test(contentType)) {
        body = slice.toString("utf8");
      } else if (slice.length === 0) {
        body = null;
      } else {
        body = slice.toString("base64");
      }
      if (overflow) {
        // The persister will upload these full bytes to S3. Cap at maxFileBytes
        // since S3 attachments share that ceiling — anything beyond that is
        // already discarded by the maxRequestBytes check above in practice.
        const truncatedAtFileCap = rawBuf.byteLength > opts.maxFileBytes;
        const uploadBuf = truncatedAtFileCap ? rawBuf.subarray(0, opts.maxFileBytes) : rawBuf;
        rawBody = {
          bytes: new Uint8Array(uploadBuf.buffer, uploadBuf.byteOffset, uploadBuf.byteLength),
          contentType,
          truncatedAtFileCap,
        };
      }
    }
  }

  return {
    method: req.method.toUpperCase(),
    path: pathSuffix,
    query: collectQuery(url),
    headers: headersMap,
    contentType,
    body,
    bodyTruncated,
    bodySize,
    files,
    rawBody,
    ip: pickIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  };
}
