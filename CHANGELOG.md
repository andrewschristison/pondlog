# Changelog

All notable changes to this monorepo are recorded here. Each publishable
package may also keep its own CHANGELOG once it ships.

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
