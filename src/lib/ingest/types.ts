export interface ParsedFilePart {
  fieldName: string | null;
  fileName: string | null;
  contentType: string | null;
  bytes: Uint8Array;
}

/**
 * Full bytes of a non-multipart request body, used by the persister when the
 * body overflows MAX_BODY_PREVIEW_BYTES and needs to be uploaded to S3 as a
 * RAW_BODY attachment. Null for multipart requests (their bytes are split into
 * `files`) or when the body fits inline.
 */
export interface ParsedRawBody {
  bytes: Uint8Array;
  contentType: string | null;
  truncatedAtFileCap: boolean;
}

export interface ParsedRequest {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  contentType: string | null;
  /** Inline preview of the body (or full body when small enough). */
  body: string | null;
  /** True when `body` is a prefix of a larger payload that is also in `rawBody`. */
  bodyTruncated: boolean;
  /** Original byte length of the request body. */
  bodySize: number;
  /** Multipart files (always uploaded to S3 by the persister). */
  files: ParsedFilePart[];
  /**
   * Full bytes of the body when it overflowed the preview cap (non-multipart
   * only). The persister uploads these to S3 as a RAW_BODY attachment.
   */
  rawBody: ParsedRawBody | null;
  ip: string | null;
  userAgent: string | null;
}

export interface ParseOptions {
  /** Bytes kept inline in `body`. Larger bodies surface in `rawBody`. */
  maxBodyPreviewBytes: number;
  /** Hard cap on the entire request body. Above this, parsing throws PayloadTooLargeError. */
  maxRequestBytes: number;
  /** Per-file cap inside multipart and for the raw-body upload. */
  maxFileBytes: number;
}

export class PayloadTooLargeError extends Error {
  readonly code = "PAYLOAD_TOO_LARGE";
  constructor(public readonly limit: number) {
    super(`request body exceeds ${limit} bytes`);
    this.name = "PayloadTooLargeError";
  }
}
