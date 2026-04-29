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

const headerEntrySchema = z.object({
  name: z.string().trim().min(1).max(MAX_HEADER_NAME_LEN),
  value: z.string().max(MAX_HEADER_VALUE_LEN),
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
