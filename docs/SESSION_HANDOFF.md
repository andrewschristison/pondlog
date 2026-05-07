# Session Handoff — Pondlog

## Current state

**Phase:** Build — Sticky 1 complete
**Last session:** Session 1 (2026-05-07) — monorepo scaffold + iNat core
**Branch:** main
**Next sticky:** Sticky 2 — iNaturalist CLI commands

## Session log

### Session 1 — 2026-05-07 — Sticky 1 complete

**Shipped:**
- pnpm workspace + tsconfig.base.json + .npmrc + .gitignore
- `@pondlog/core` v0.1.0 (types, Result, RateLimiter, retry, coords, UA)
- `@pondlog/source-inaturalist` v0.1.0 (Zod schemas, normalizers, client,
  9 functions returning `Result<T>`)
- `pondlog` CLI shell (commander, version + inat placeholder)
- `@pondlog/mcp-inaturalist` MCP shell (stdio server, zero tools)

**Verified:**
- `pnpm typecheck` clean, `pnpm build` clean across all 4 packages.
- 16 unit tests passing (rate limiter, coords, Zod schemas).
- 9 live smoke tests against iNat at Port Angeles (48.118, -123.4307) —
  all `Result.ok === true` against real API responses.

**API observations (no schema changes needed):**
- iNat `/taxa/{id}` returns the standard paginated wrapper, not a single
  object — handled by re-using `InatPaginatedSchema(InatTaxonSchema)`.
- `/observations/{id}` returns a paginated wrapper too — same handling.
- `/places/autocomplete` omits `page`/`per_page` in some responses; made
  those fields optional.
- iNat `location` is `"lat,lng"` strings (sometimes null) — parsed in
  `@pondlog/core/coords.parseLatLngString`.

**Notes for Sticky 2 / 3:**
- `pondlog inat ...` subcommands should call into source-inaturalist,
  format human-readable text, and gate machine output behind `--json`.
- MCP tool input schemas live alongside the source functions — the MCP
  package is a thin adapter that imports schemas + handlers.
- Default smoke coords: `{ lat: 48.118, lng: -123.4307 }` (Port Angeles).
- Live smoke is gated behind `pnpm smoke`; default `pnpm test` is offline.
