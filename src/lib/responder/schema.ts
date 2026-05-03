import { z } from "zod";
import type { ResponderConfig } from "./types";

export const MAX_STATUS_LEN = 32;
export const MAX_HEADER_NAME_LEN = 256;
export const MAX_HEADER_VALUE_LEN = 4096;
export const MAX_HEADERS = 50;
export const MAX_BODY_LEN = 64 * 1024;
export const MAX_PATH_GLOB_LEN = 256;
export const MAX_DELAY_MS = 30_000;
export const MAX_RULES = 50;

const methodSchema = z.enum([
  "*",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

// RFC 7230 token chars for field-name.
const HEADER_NAME_RE = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;

// Forbid CR, LF, and NUL in field-value (header-injection bytes).
const HEADER_VALUE_FORBIDDEN_RE = /[\r\n\0]/;

const headerEntrySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_HEADER_NAME_LEN)
    .regex(HEADER_NAME_RE, "invalid header name"),
  value: z
    .string()
    .max(MAX_HEADER_VALUE_LEN)
    .refine((v) => !HEADER_VALUE_FORBIDDEN_RE.test(v), {
      message: "header value contains forbidden control character",
    }),
});

const baseResponse = {
  status: z.string().min(1).max(MAX_STATUS_LEN),
  headers: z.array(headerEntrySchema).max(MAX_HEADERS),
  body: z.string().max(MAX_BODY_LEN),
  delayMs: z.number().int().min(0).max(MAX_DELAY_MS),
};

export const responseSpecSchema = z.object(baseResponse);

export const ruleSpecSchema = z.object({
  ...baseResponse,
  method: methodSchema,
  pathGlob: z.string().min(1).max(MAX_PATH_GLOB_LEN),
});

export const responderConfigSchema = z.object({
  default: responseSpecSchema,
  rules: z.array(ruleSpecSchema).max(MAX_RULES),
});

export function parseResponderConfig(input: unknown): ResponderConfig {
  return responderConfigSchema.parse(input);
}

export function safeParseResponderConfig(input: unknown) {
  return responderConfigSchema.safeParse(input);
}
