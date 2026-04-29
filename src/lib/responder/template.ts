import { logger } from "@/lib/log";
import type { ParsedRequest } from "@/lib/ingest/types";
import type { RenderContext } from "./types";

const JSON_CT = /^(application\/(json|.*\+json))/i;

export function buildContext(parsed: ParsedRequest): RenderContext {
  let json: unknown = undefined;
  if (parsed.body && parsed.contentType && JSON_CT.test(parsed.contentType)) {
    try {
      json = JSON.parse(parsed.body);
    } catch {
      json = undefined;
    }
  }
  return {
    request: {
      method: parsed.method,
      path: parsed.path,
      query: parsed.query,
      headers: parsed.headers,
      body: parsed.body ?? "",
      json,
    },
  };
}

interface Helper {
  name: string;
  arg?: string;
}

function parseExpression(raw: string): { path?: string[]; helper?: Helper } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return {};
  // helper "arg" or helper 'arg'
  const helperMatch = trimmed.match(/^([A-Za-z_][\w.]*)\s+(["'])(.*?)\2$/);
  if (helperMatch) {
    return { helper: { name: helperMatch[1], arg: helperMatch[3] } };
  }
  // bare path: identifier(.identifier)*
  if (/^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)*$/.test(trimmed)) {
    return { path: trimmed.split(".") };
  }
  return {};
}

function dotWalk(root: unknown, segments: string[]): unknown {
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function leafToString(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function resolveHelper(h: Helper, ctx: RenderContext): string | undefined {
  if (h.name === "request.header") {
    if (!h.arg) return "";
    const lower = h.arg.toLowerCase();
    return ctx.request.headers[lower] ?? "";
  }
  return undefined;
}

function resolvePath(path: string[], ctx: RenderContext): string | undefined {
  if (path.length === 0) return undefined;
  const head = path[0];
  if (head === "now") {
    if (path.length === 1) return new Date().toISOString();
    if (path.length === 2 && path[1] === "unix") {
      return Math.floor(Date.now() / 1000).toString();
    }
    return undefined;
  }
  if (head === "uuid" && path.length === 1) {
    return crypto.randomUUID();
  }
  if (head === "request") {
    const sub = path[1];
    if (sub === "method" && path.length === 2) return ctx.request.method;
    if (sub === "path" && path.length === 2) return ctx.request.path;
    if (sub === "body" && path.length === 2) return ctx.request.body;
    if (sub === "query" && path.length >= 3) {
      const key = path.slice(2).join(".");
      const v = ctx.request.query[key];
      if (Array.isArray(v)) return v[0] ?? "";
      return v ?? "";
    }
    if (sub === "json" && path.length >= 2) {
      if (path.length === 2) return leafToString(ctx.request.json);
      return leafToString(dotWalk(ctx.request.json, path.slice(2)));
    }
    return undefined;
  }
  return undefined;
}

export function render(template: string, ctx: RenderContext): string {
  let out = "";
  let i = 0;
  let loggedThisRender = false;
  const noteFailure = (reason: string, snippet: string) => {
    if (loggedThisRender) return;
    loggedThisRender = true;
    logger.debug({ reason, snippet }, "responder template render issue");
  };

  while (i < template.length) {
    const open = template.indexOf("{{", i);
    if (open === -1) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const close = template.indexOf("}}", open + 2);
    if (close === -1) {
      // unclosed expression — emit literal and stop scanning further tokens
      noteFailure("unclosed_expression", template.slice(open, open + 32));
      out += template.slice(open);
      break;
    }
    const inner = template.slice(open + 2, close);
    const parsed = parseExpression(inner);
    let value: string | undefined;
    try {
      if (parsed.helper) value = resolveHelper(parsed.helper, ctx);
      else if (parsed.path) value = resolvePath(parsed.path, ctx);
    } catch {
      value = undefined;
    }
    if (value === undefined) {
      noteFailure("unresolved_expression", inner);
      value = "";
    }
    out += value;
    i = close + 2;
  }
  return out;
}
