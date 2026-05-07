# Changelog

All notable changes to this monorepo are recorded here. Each publishable
package may also keep its own CHANGELOG once it ships.

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
