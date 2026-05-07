# Changelog

All notable changes to this monorepo are recorded here. Each publishable
package may also keep its own CHANGELOG once it ships.

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
