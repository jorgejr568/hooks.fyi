export function buildRequest(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
}): Request {
  const url =
    opts.url ?? "http://localhost:3000/h/00000000-0000-0000-0000-000000000000";
  return new Request(url, {
    method: opts.method ?? "POST",
    headers: opts.headers ?? {},
    body: opts.body ?? null,
  });
}
