export interface ParsedFilePart {
  fieldName: string | null;
  fileName: string | null;
  contentType: string | null;
  bytes: Uint8Array;
}

export interface ParsedRequest {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  contentType: string | null;
  body: string | null;
  bodyTruncated: boolean;
  bodySize: number;
  files: ParsedFilePart[];
  ip: string | null;
  userAgent: string | null;
}

export interface ParseOptions {
  maxBodyBytes: number;
  maxFileBytes: number;
}
