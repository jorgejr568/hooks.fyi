# Custom Responder — Implementation Plan

> Spec: `docs/superpowers/specs/2026-04-29-custom-responder-design.md`
> Branch: `feat/custom-responder`

Tasks are bite-sized and ordered. Each ends with a verification step. Mark with `[x]` as completed.

---

## Task 1 — Prisma schema + migration

**Files:** `prisma/schema.prisma`, new migration under `prisma/migrations/`

- [ ] 1.1 Add `responderConfig Json?` to `Hook` model in `prisma/schema.prisma`.
- [ ] 1.2 Generate migration: `pnpm db:migrate --name add_hook_responder_config`. (Requires local db up — `pnpm db:up` if not running.)
- [ ] 1.3 Run `pnpm db:generate` to refresh Prisma client.
- [ ] 1.4 Verify: `pnpm tsc --noEmit` passes.

## Task 2 — Responder types + Zod schema

**Files:** `src/lib/responder/types.ts` (new), `src/lib/responder/schema.ts` (new), `tests/lib/responder/schema.test.ts` (new)

- [ ] 2.1 Define `ResponseSpec`, `RuleSpec`, `ResponderConfig`, `ResolvedResponse`, `RenderContext` in `types.ts` per the spec.
- [ ] 2.2 In `schema.ts`, build Zod schemas for `ResponseSpec`, `RuleSpec`, `ResponderConfig`. Export `parseResponderConfig(unknown): ResponderConfig` (throws `ZodError`) and `safeParseResponderConfig(unknown)` returning the SafeParseResult.
- [ ] 2.3 Tests: accept full valid config; reject negative `delayMs`, `delayMs > 30000`, status string > 32 chars, body > 64 KiB, header name/value length caps, bad method, empty pathGlob.
- [ ] 2.4 Verify: `pnpm test tests/lib/responder/schema.test.ts` green.

## Task 3 — Path glob engine

**Files:** `src/lib/responder/glob.ts` (new), `tests/lib/responder/glob.test.ts` (new)

- [ ] 3.1 Implement `globToRegex(glob: string): RegExp` and `pathMatches(glob: string, path: string): boolean`. Strip trailing slash from both sides before matching.
- [ ] 3.2 Tests cover: `/users/*` matches `/users/42` and `/users/42/`, NOT `/users/42/posts`; `/api/**` matches `/api`, `/api/`, `/api/x/y/z`; metachars (`.+?()$^[]`) escaped; empty glob throws.
- [ ] 3.3 Verify: `pnpm test tests/lib/responder/glob.test.ts` green.

## Task 4 — Rule matcher

**Files:** `src/lib/responder/match.ts` (new), `tests/lib/responder/match.test.ts` (new)

- [ ] 4.1 Implement `matchRule(rules, method, path) → RuleSpec | null`. Walk in order. Method matches if literal-equal OR rule method is `"*"`. Path uses `pathMatches`.
- [ ] 4.2 Tests cover: first match wins; `"*"` method; no match returns null; case-insensitive method comparison.
- [ ] 4.3 Verify: `pnpm test tests/lib/responder/match.test.ts` green.

## Task 5 — Template engine

**Files:** `src/lib/responder/template.ts` (new), `tests/lib/responder/template.test.ts` (new)

- [ ] 5.1 Implement `buildContext(parsed: ParsedRequest): RenderContext`. `request.json` is `JSON.parse(parsed.body)` only if `parsed.body` is non-null AND `parsed.contentType` matches a JSON content-type regex; otherwise `undefined`. Wrap parse in try/catch.
- [ ] 5.2 Implement `render(template: string, ctx: RenderContext): string`:
  - Tokenize: literal text vs `{{ ... }}` expressions.
  - Inside an expression: trim whitespace, then either parse `helper "arg"` (one helper, optional one quoted-string arg) or treat as a dot-path.
  - Resolution table per spec section "Recognized expressions". Anything else → empty string.
  - Wrap each expression resolution in try/catch — on throw, emit empty string and a single `logger.debug` line per render call (use a dedup flag).
- [ ] 5.3 Tests cover all helpers, missing JSON paths, missing query keys, case-insensitive `request.header`, malformed `{{` expressions, dot-walk into non-object, non-string JSON leaf serialization, empty template.
- [ ] 5.4 Verify: `pnpm test tests/lib/responder/template.test.ts` green.

## Task 6 — Resolver

**Files:** `src/lib/responder/resolve.ts` (new), `src/lib/responder/index.ts` (new), `tests/lib/responder/resolve.test.ts` (new)

- [ ] 6.1 `resolveResponse(config: ResponderConfig, parsed: ParsedRequest): ResolvedResponse` where `ResolvedResponse = { status: number, headers: Array<[string, string]>, body: string, delayMs: number }`.
  - Pick rule via `matchRule`, fall back to `config.default`.
  - Render `status` → parseInt → if NaN or outside [100, 599], log warn and use `500`.
  - Render headers: skip pairs with empty rendered name. Lowercase header names not required (HTTP fetch normalizes).
  - Render body.
  - Clamp `delayMs` to `[0, 30000]`.
- [ ] 6.2 `index.ts` re-exports public surface (`parseResponderConfig`, `safeParseResponderConfig`, `resolveResponse`, types).
- [ ] 6.3 Tests cover: default fallback when no rules match; rule wins over default; status clamp; delay clamp; templated header value; missing JSON path renders empty.
- [ ] 6.4 Verify: `pnpm test tests/lib/responder/resolve.test.ts` green.

## Task 7 — Wire responder into ingest path

**Files:** `src/app/h/[hookId]/_handle.ts` (edit)

- [ ] 7.1 Change the existing `prisma.hook.findUnique` to `select: { id: true, responderConfig: true }`.
- [ ] 7.2 After `hookEvents.publish`, branch on `hook.responderConfig`:
  - `null` → return existing JSON 200 response (unchanged).
  - non-null:
    - Wrap in try/catch: `safeParseResponderConfig(hook.responderConfig)`. On failure log error and fall through to legacy 200.
    - Call `resolveResponse(cfg, parsed)`.
    - `await new Promise(r => setTimeout(r, resolved.delayMs))`.
    - Build a `Headers` object from the array. If body is non-empty and no `content-type` was set, default to `text/plain; charset=utf-8`.
    - Return `new Response(resolved.body, { status: resolved.status, headers })`.
- [ ] 7.3 Verify: `pnpm tsc --noEmit` passes.

## Task 8 — Responder API endpoint

**Files:** `src/app/api/hooks/[hookId]/responder/route.ts` (new)

- [ ] 8.1 `GET` returns `{ responderConfig: ResponderConfig | null }`. 404 if hook missing.
- [ ] 8.2 `PUT` parses body as `{ responderConfig: ResponderConfig | null }`. Run `safeParseResponderConfig` when non-null (allow `null` to clear). On error: 400 `{ error, issues }`. On success: persist via `prisma.hook.update`, return saved value. 404 if hook missing.
- [ ] 8.3 Use the existing UUID validation pattern (see `_handle.ts`) before hitting DB.
- [ ] 8.4 Verify: `pnpm tsc --noEmit` passes.

## Task 9 — Cogs icon + dialog scaffold

**Files:** `src/app/[hookId]/_components/responder-dialog.tsx` (new), `src/app/[hookId]/_components/hook-header.tsx` (edit)

- [ ] 9.1 Create `responder-dialog.tsx` exporting `<ResponderDialog hookId>`. Internally fetches `GET /api/hooks/{hookId}/responder` on open. Renders a Dialog with two sections: Default Response and Rules. Save button hits `PUT`. Skeleton loader while fetching.
- [ ] 9.2 Build form state: `enabled: boolean`, `defaultResponse: ResponseSpec`, `rules: RuleSpec[]`. Each editable field uses controlled inputs/textareas.
- [ ] 9.3 Add subcomponents (in same file for now to keep diffs small): `<ResponseFields>` (status, headers list, body, delayMs), `<RuleCard>` (method dropdown, pathGlob input, ResponseFields, reorder up/down, delete).
- [ ] 9.4 Header reorder: simple Up/Down buttons. Delete via X. "Add header" appends `{name:"", value:""}`. Same model for rules.
- [ ] 9.5 Save logic: client-side `safeParseResponderConfig` validation; on PUT failure surface a toast with first issue.
- [ ] 9.6 In `hook-header.tsx`: import `Settings2` from lucide, mount `<ResponderDialog hookId>` button to the left of the existing trash button.
- [ ] 9.7 Verify: `pnpm tsc --noEmit` passes; `pnpm lint` clean.

## Task 10 — Smoke / regression tests

**Files:** `tests/lib/responder/smoke.test.ts` (new) — optional integration-style test against `_handle.ts` is heavy; instead exercise `resolveResponse` end-to-end with realistic `ParsedRequest` objects.

- [ ] 10.1 Add a smoke test in `resolve.test.ts` (or a new file): build a `ParsedRequest` for a JSON POST `{"order":{"id":"X1"}}`, config returns `201` body `Order {{request.json.order.id}} created` and header `X-Order: {{request.json.order.id}}` → assert exact resolved values.
- [ ] 10.2 Run full suite: `pnpm test`.
- [ ] 10.3 Run `pnpm lint` and `pnpm tsc --noEmit`.

## Task 11 — Manual UI smoke (after `pnpm dev`)

- [ ] 11.1 Start `pnpm dev`; create a hook; verify cogs icon appears.
- [ ] 11.2 Toggle on, set default `{status:"201", body:"hello {{request.method}}"}`, save; `curl -X POST http://localhost:3000/h/<id>` → 201 with body `hello POST`.
- [ ] 11.3 Add rule `{method:"GET", pathGlob:"/health", status:"503", body:"down"}`; `curl http://localhost:3000/h/<id>/health` → 503 `down`; other paths still hit default.
- [ ] 11.4 Confirm dashboard still shows captured requests.

## Task 12 — Commit & finish

- [ ] 12.1 Commit spec + plan first, then implementation, in 2–3 logical commits. Use Conventional Commits.
- [ ] 12.2 Use the `superpowers:finishing-a-development-branch` skill to wrap up.
