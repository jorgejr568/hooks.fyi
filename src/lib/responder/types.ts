export type Method =
  | "*"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface ResponseSpec {
  status: string;
  headers: HeaderEntry[];
  body: string;
  delayMs: number;
}

export interface RuleSpec extends ResponseSpec {
  method: Method;
  pathGlob: string;
}

export interface ResponderConfig {
  default: ResponseSpec;
  rules: RuleSpec[];
}

export interface ResolvedResponse {
  status: number;
  headers: Array<[string, string]>;
  body: string;
  delayMs: number;
}

export interface RenderContext {
  request: {
    method: string;
    path: string;
    query: Record<string, string | string[]>;
    headers: Record<string, string>;
    body: string;
    json: unknown;
  };
}
