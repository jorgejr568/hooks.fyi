import type { ParsedRequest, ParseOptions, ParsedFilePart } from "./types";

const TEXTUAL_CT = /^(application\/(json|x-www-form-urlencoded|xml|.*\+json|.*\+xml)|text\/.*)/i;

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

  const hasBody = !["GET", "HEAD"].includes(req.method.toUpperCase());

  if (hasBody) {
    const rawBuf = Buffer.from(await req.arrayBuffer());
    bodySize = rawBuf.byteLength;
    const isMultipart = contentType?.toLowerCase().startsWith("multipart/form-data");
    let multipartParsed = false;

    if (isMultipart && rawBuf.byteLength > 0) {
      try {
        const fd = await new Response(rawBuf, {
          headers: { "content-type": contentType! },
        }).formData();
        const textParts: Record<string, string | string[]> = {};
        for (const [name, value] of fd.entries()) {
          if (typeof value === "string") {
            const existing = textParts[name];
            if (existing === undefined) {
              textParts[name] = value;
            } else if (Array.isArray(existing)) {
              existing.push(value);
            } else {
              textParts[name] = [existing, value];
            }
          } else {
            const buf = new Uint8Array(await value.arrayBuffer());
            const truncated = buf.byteLength > opts.maxFileBytes;
            files.push({
              fieldName: name,
              fileName: value.name || null,
              contentType: value.type || null,
              bytes: truncated ? buf.slice(0, opts.maxFileBytes) : buf,
            });
          }
        }
        const serialized = JSON.stringify(textParts);
        bodySize = Buffer.byteLength(serialized);
        body = serialized.length > 0 ? serialized : null;
        multipartParsed = true;
      } catch {
        // Malformed multipart — fall through to raw bytes.
      }
    }

    if (!multipartParsed) {
      const slice = rawBuf.byteLength > opts.maxBodyBytes ? rawBuf.subarray(0, opts.maxBodyBytes) : rawBuf;
      bodyTruncated = rawBuf.byteLength > opts.maxBodyBytes;
      if (contentType && TEXTUAL_CT.test(contentType)) {
        body = slice.toString("utf8");
      } else if (slice.length === 0) {
        body = null;
      } else {
        body = slice.toString("base64");
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
    ip: pickIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  };
}
