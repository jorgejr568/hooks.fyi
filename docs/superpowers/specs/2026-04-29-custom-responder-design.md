# Custom Responder — Design

**Status:** approved (in-conversation, 2026-04-29)
**Branch:** `feat/custom-responder`

## Goal

Let a hook owner configure what `/h/{hookId}/*` returns to the caller, instead of the current fixed `200 OK`. Configuration is hidden behind a cogs icon on the hook dashboard. The home page is unchanged.

## Scope (MVP)

- Per-hook responder config: a **default** response plus an **ordered list of rules**. First match wins.
- Each response carries: `status`, `headers`, `body`, `delayMs`.
- **Method + path-glob** matching (`*` = one segment, `**` = many; method literal or `*`).
- **Mustache-style templating** in `status`, header values, and `body` with a small fixed helper set.
- Capture is unchanged: every request is still parsed, persisted, and emitted to the SSE stream.
- Edited via a structured form in a shadcn `Dialog`. No raw-JSON power-user editor in MVP.

Out of scope: per-rule capture toggle, scripted (JS) responses, conditionals/loops in templates, regex paths, multi-region delays.

## Data Model

Single additive nullable column on `Hook`:

```prisma
model Hook {
  id              String   @id @default(uuid()) @db.Uuid
  name            String?  @db.VarChar(120)
  responderConfig Json?    // null ⇒ legacy 200 OK behavior
  createdAt       DateTime @default(now())
  // ... unchanged
}
```

`responderConfig` (validated by Zod on every write *and* every read):

```ts
ResponderConfig = {
  default: ResponseSpec
  rules: RuleSpec[]              // ordered; may be empty
}

ResponseSpec = {
  status: string                 // template; renders to int 100–599 (else 500)
  headers: Array<{ name: string, value: string }>  // value templated; name literal
  body: string                   // template
  delayMs: number                // integer 0..30000
}

RuleSpec = ResponseSpec & {
  method: "*" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
  pathGlob: string               // 1..256 chars; non-empty
}
```

**Why headers as an array:** preserves order and allows duplicate names (`Set-Cookie`). The form UI maps cleanly to a list.

**Why status as a string:** so it can be a template (`{{request.json.code}}`). Resolution casts to int and falls back to `500` if invalid.

Migration: `ALTER TABLE "Hook" ADD COLUMN "responderConfig" JSONB`. Reversible. No backfill.

## Module Layout

```
src/lib/responder/
├── types.ts          # ResponderConfig, ResponseSpec, RuleSpec, ResolvedResponse, RenderContext
├── schema.ts         # Zod schema + parseResponderConfig(unknown) → ResponderConfig
├── glob.ts           # globToRegex("/users/**") → RegExp; pathMatches(glob, path)
├── match.ts          # matchRule(rules, method, path) → RuleSpec | null
├── template.ts       # render(template, ctx) → string ; buildContext(parsed) → RenderContext
└── resolve.ts        # resolveResponse(config, parsed) → ResolvedResponse
```

Pure functions everywhere except `resolve.ts` (which composes them). All unit-tested with Vitest.

## Request Flow

In `src/app/h/[hookId]/_handle.ts`, after the existing capture path:

1. `parseRequest` → `persistRequest` → `hookEvents.publish` — unchanged.
2. Refetch hook with `responderConfig` selected (the existing `findUnique` only selects `id`).
   - To avoid a second DB round-trip, change the existing lookup to also `select: { responderConfig: true }`.
3. If `responderConfig == null` → return current `{received, requestId, at}` JSON 200. Existing behavior preserved.
4. Else:
   - `cfg = parseResponderConfig(hook.responderConfig)` (defense-in-depth; logs and falls back to legacy 200 if it fails).
   - `rule = matchRule(cfg.rules, parsed.method, parsed.path) ?? cfg.default`.
   - `ctx = buildContext(parsed)`.
   - `body = render(rule.body, ctx)`.
   - `headers = rule.headers.map(h => [h.name, render(h.value, ctx)])`.
   - `statusStr = render(rule.status, ctx)`; `status = clampStatus(parseInt(statusStr))`. Invalid → 500.
   - `delayMs = clamp(rule.delayMs, 0, 30000)`.
   - `await sleep(delayMs)`.
   - Return `new Response(body, { status, headers })`. If body non-empty and no `content-type` header set, default to `text/plain; charset=utf-8`.

## Template Engine

Minimal hand-rolled engine — no dependency.

**Grammar:**
- `{{ <path> }}` — variable, dot-path
- `{{ <helper> [ "<arg>" ] }}` — helper with optional one quoted-string arg (single or double quote)
- `{{{` and `}}}` are not supported. Whitespace inside `{{ }}` is trimmed.
- Literal `{` / `}` outside `{{...}}` pass through.
- Malformed expression (unclosed `{{`, unknown helper called with arg, etc.) → render as empty string and log a single debug line.

**Context:**
```ts
RenderContext = {
  request: {
    method: string                          // uppercase
    path: string                            // begins with "/"
    query: Record<string, string | string[]>
    headers: Record<string, string>         // lowercase keys
    body: string                            // raw inline preview (possibly truncated/base64)
    json: unknown                           // JSON.parse(parsed.body) if textual & valid JSON, else undefined
  }
}
```

**Recognized expressions:**
| Expression | Resolves to |
| --- | --- |
| `{{request.method}}` | request method |
| `{{request.path}}` | request path |
| `{{request.body}}` | raw inline body string |
| `{{request.query.<key>}}` | first value (or empty if missing/array first) |
| `{{request.json.<a>.<b>...}}` | dot-walk into parsed JSON; missing → empty string. Non-string leaf is `JSON.stringify`'d. |
| `{{request.header "X-Foo"}}` | case-insensitive header lookup |
| `{{now}}` | `new Date().toISOString()` |
| `{{now.unix}}` | seconds since epoch as integer string |
| `{{uuid}}` | `crypto.randomUUID()` |

Anything not matching the table above → empty string. **No** conditionals, loops, defaults, or chained helpers.

## Glob Engine

`globToRegex(glob)`:
- Anchor with `^...$`.
- Escape every regex metachar except `*`.
- `**` → `.*` (zero or more characters, including `/`).
- Single `*` → `[^/]+` (one segment, non-empty).
- Trailing slashes on both glob and path are stripped before matching (so `/users/*` matches both `/users/42` and `/users/42/`).
- Empty glob is rejected by Zod.

Compiled lazily per call; rule list is short (typical < 20), so no caching needed for MVP.

## API Surface

New endpoint: `src/app/api/hooks/[hookId]/responder/route.ts`

- `GET` → `{ responderConfig: ResponderConfig | null }`. 404 if hook missing.
- `PUT` body `{ responderConfig: ResponderConfig | null }` → validates with Zod. On success returns the saved config. On Zod failure returns 400 with `{ error: string, issues: ZodIssue[] }`. On hook missing returns 404.

Auth posture: open by hookId — same as every other route in this app today.

## UI

New component: `src/app/[hookId]/_components/responder-dialog.tsx`. Cogs icon (`Settings2` from lucide) added to the right side of `hook-header.tsx`, between the title block and the trash button.

Dialog content:

- Top toggle: **Custom responder enabled** (off = `responderConfig: null`).
- When on, two sections:
  - **Default response** — collapsed accordion-style block with status / headers list / body textarea / delayMs.
  - **Rules** — list of rule cards, each with method dropdown, pathGlob input, status, headers, body, delayMs, plus reorder (up/down) and delete buttons. Footer: "Add rule".
- Save button calls `PUT /api/hooks/{id}/responder`. Validates client-side first, surfacing field-level errors. Cancel discards local edits.

Form state managed with `useState` + a dirty flag; not using a form library to keep deps minimal.

## Failure Handling

- Invalid stored config (data corruption / hand-edit) → log error, fall back to legacy 200 OK so the bin keeps capturing. Never crash the ingest path.
- Template render exception → empty string at that token, single debug log.
- Status renders to non-integer or out of `[100, 599]` → `500`, single warn log.
- Delay above 30 s → clamped to 30 s.
- Headers with empty rendered name skipped silently. Empty value is allowed (some tools rely on this).

## Performance

- Adds one `await sleep()` inside the response path (configurable; capped at 30 s).
- Rule matching is O(rules × path-length); rules are user-set and small.
- One extra column read on each ingest. No new queries.
- Schema validation on every read is cheap (Zod parse on a small object). If profiling ever shows it, cache per-hook-version.

## Testing

Vitest unit tests, no DB:
- `tests/lib/responder/glob.test.ts` — `*`, `**`, escaping, trailing slash, anchoring, empty.
- `tests/lib/responder/match.test.ts` — first match wins, method `*`, no match → null.
- `tests/lib/responder/template.test.ts` — every helper; missing paths; malformed input; JSON path walk; case-insensitive header.
- `tests/lib/responder/schema.test.ts` — accept valid; reject negative `delayMs`, oversized strings, bad method, empty pathGlob.
- `tests/lib/responder/resolve.test.ts` — end-to-end (config + parsed → ResolvedResponse), default fallback, status clamp, delay clamp.

Manual smoke (recorded in PR):
- `curl` a hook with no responderConfig → 200 (regression check).
- Configure default `{status: "201", body: "{{request.json.id}}", delayMs: 0}` and POST `{"id":"abc"}` → 201 body `abc`.
- Add rule `{method:"GET", pathGlob:"/health"}` returning 503 → `GET /h/{id}/health` is 503; everything else hits default.
- Set delayMs 1000, observe latency.

## Open follow-ups (not this PR)

- B4 scripted responses (small JS sandbox) once the static + template approach reveals real limits.
- Per-rule `capture: bool` for silencing health checks.
- Raw-JSON editor mode for power users.
- Inspector additions (signature decode, JWT, search) — separate spec.
