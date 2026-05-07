# Changelog

All notable changes to this monorepo are recorded here. Each publishable
package may also keep its own CHANGELOG once it ships.

## [0.4.0] - 2026-05-07

### Added — Sticky 5: eBird source client (100% API coverage)
- `@pondlog/source-ebird` ships all 21 documented eBird API v2 endpoints
  across five categories: Observations (7), Product (3), Hotspots (3),
  Taxonomy (5), Regions (3).
- Every function returns `Result<T>`, validates responses with Zod, and
  shares a single 100 req/min `RateLimiter` instance. 429 → exponential
  backoff via `withRetry` (1s, 2s, 4s, max 3 attempts), same pattern as
  `@pondlog/source-inaturalist`.
- API key handling: `EBIRD_API_KEY` is read on every fetch and surfaced
  as a `Result` error if missing. `assertEbirdApiKey()` is exported for
  callers who want fail-loud-at-startup semantics.
- Normalized convenience variants for endpoints with shared `@pondlog/core`
  analogues: `getNearbyRecentNormalized`, `getNearbyNotableNormalized`,
  `getHotspotsInRegionNormalized`, `getNearbyHotspotsNormalized`,
  `getHotspotInfoNormalized`, `getTaxonomyNormalized`. All eBird
  observations normalize to `iconicTaxon: "Aves"` (eBird is birds-only).
- Param validation at the boundary: `back` clamped 1–30, `dist` clamped
  0–50 km, year/month/day integer-checked, `maxResults` range-checked
  per endpoint. Invalid params return `Result` error without a network
  call.
- Source layout split by category (`observations.ts`, `product.ts`,
  `hotspots.ts`, `taxonomy.ts`, `regions.ts`) plus shared `client.ts`,
  `schemas.ts`, `normalize.ts`. `index.ts` is a barrel.

### Verified
- `pnpm --filter @pondlog/source-ebird typecheck` clean.
- `pnpm --filter @pondlog/source-ebird build` clean (tsup esm + dts;
  ~23 KB JS, ~43 KB d.ts).
- 15/15 Zod schema + normalization unit tests pass.
- 5/5 live smoke tests against the real eBird API (Port Angeles area,
  ran in 3.58s):
  - `getNearbyRecent` (lat=48.118, lng=-123.4307): 166 observations
  - `getNearbyNotable` (lat=48.118, lng=-123.4307): 212 notable
  - `getHotspotsInRegion("US-WA-009")`: 216 hotspots
  - `getHistoricOnDate("US-WA-009", 2025, 5, 1)`: 50 observations
  - `getRegionInfo("US-WA-009")`: "Clallam, Washington, United States"

### Notes
- The `.claude/API_AUDIT.md` listed the species-grouping endpoint as
  `/ref/taxonomy/groups/{speciesGrouping}`, but the actual eBird path
  is `/ref/sppgroup/{speciesGrouping}` — implementation uses the
  correct path.
- Smoke test for `getHistoricOnDate` was originally specified at the
  state level (`US-WA`) but consistently exceeded a 30s timeout in
  practice. Narrowed to county scope (`US-WA-009`) with a 60s timeout
  — the historic endpoint is response-heavy at state granularity.

## [0.3.0] - 2026-05-07

### Added — Sticky 3: iNaturalist MCP server
- `@pondlog/mcp-inaturalist` ships nine tools over `@modelcontextprotocol/sdk`
  v1.29 (stdio transport), each a thin wrapper around a source-inaturalist
  function: `search_observations`, `get_observation`, `get_species_counts`,
  `search_taxa`, `get_taxon`, `get_nearby_observations`,
  `get_iconic_taxa_summary`, `search_places`, `get_observers`.
- Tool input schemas authored as Zod raw shapes with LLM-targeted
  `.describe()` strings (iconic-taxa glossary, example coordinates,
  guidance on when to pick a sibling tool).
- Each tool annotated `readOnlyHint: true, openWorldHint: true`.
- Successful responses emit both `structuredContent` (typed JSON) and a
  pretty `text` block for backwards compatibility. Failures set
  `isError: true` and serialize the source/message/statusCode.
- `server.json` for MCP Registry submission; `bin: pondlog-mcp-inaturalist`
  with shebang for npx; README with Claude Desktop + Cursor config blocks
  and example prompts.

### Verified
- `pnpm typecheck` + `pnpm build` clean across all 4 packages.
- JSON-RPC handshake test: `initialize` (protocol 2025-06-18) succeeds,
  `tools/list` returns all 9 tools with the expected schemas, live
  `tools/call get_nearby_observations` against Port Angeles returns 50
  real observations with the expected normalized shape, and invalid input
  (lat=999) is rejected with `isError: true` before reaching the handler.

## [0.2.0] - 2026-05-07

### Added — Sticky 2: iNaturalist CLI commands
- `pondlog config set-location --lat <lat> --lng <lng> [--name <name>]` —
  saves default coordinates to `~/.pondlog/config.json` (overridable via
  `PONDLOG_CONFIG_DIR`); atomic write, mode 0600 file in mode 0700 dir,
  versioned schema validated by Zod.
- `pondlog config show [--json]`.
- `pondlog inat nearby [--lat] [--lng] [--radius] [--days] [--taxon] [--json]` —
  recent observations grouped by iconic taxa; uses saved config when
  flags absent.
- `pondlog inat species [--lat] [--lng] [--radius] [--days] [--json]` —
  species counts grouped by iconic taxa, count-sorted.
- `pondlog inat search <query> [--lat] [--lng] [--radius] [--json]` —
  observations matching a taxon name.
- `pondlog inat taxon <name> [--json]` — taxon lookup with rank/group.
- Validation layer: lat/lng/radius/days are bounds-checked at the CLI
  boundary (radius capped at 500 km per iNat).
- Output: picocolors for bold/dim, relative-date helper ("today", "N days
  ago", falls back to ISO past 30 days), padded columns with ANSI-aware
  width math.

### Changed
- `@pondlog/source-inaturalist` `pickObserverName`: empty-string user
  fields now fall through to "unknown" alongside null/undefined.

### Verified
- `pnpm typecheck` + `pnpm build` clean across all 4 packages.
- 16 unit tests + 9 live smoke tests still passing.
- Manual CLI: all sticky-listed commands run live against iNat at Port
  Angeles. `pondlog inat nearby --json` produces valid JSON; negative
  cases (bad lat, bad radius, --lat without --lng, no config + no flags)
  all surface friendly errors and exit 1.

## [0.1.0] - 2026-05-07

### Added
- pnpm workspace scaffold (`pnpm-workspace.yaml`, `tsconfig.base.json` with
  strict / ES2022 / NodeNext, `.npmrc`, `.gitignore`).
- `@pondlog/core`: shared types (`Coordinates`, `Result<T>`, `Observation`,
  `SpeciesCount`, `IconicTaxaSummary`, `Place`, `Observer`, `Taxon`,
  `TaxonDetail`, `ObservationDetail`, `NatureBriefing`), token-bucket
  `RateLimiter`, exponential `withRetry`, coordinate parsing/validation,
  `PONDLOG_USER_AGENT` constant.
- `@pondlog/source-inaturalist`: Zod schemas for iNat responses,
  normalizers, rate-limited fetch client (100 req/min, exponential backoff
  on 429), and 9 functions returning `Result<T>`:
  `searchObservations`, `getObservation`, `getSpeciesCounts`,
  `getNearbyObservations`, `searchTaxa`, `getTaxon`,
  `getIconicTaxaSummary`, `searchPlaces`, `getObservers`.
- `pondlog` CLI shell (commander, no commands yet — Sticky 2).
- `@pondlog/mcp-inaturalist` MCP shell (MCP SDK stdio, no tools yet —
  Sticky 3).

### Verified
- `pnpm typecheck` clean across all 4 packages.
- `pnpm build` (tsup) clean across all 4 packages.
- Unit tests: 16 passing (rate limiter, coordinate parsing, Zod schemas,
  normalizers).
- Live smoke tests against iNaturalist API at Port Angeles, WA
  (48.118, -123.4307): 9/9 passing. All Zod schemas parsed real responses
  without warnings.
