# Changelog

All notable changes to this monorepo are recorded here. Each publishable
package may also keep its own CHANGELOG once it ships.

## [0.8.0] - 2026-05-07

### Added — Stickies 11 & 12: USGS source client + CLI + MCP (one ship)

USGS Water Services is the smallest API in the stack — keyless, two
data endpoints (`/iv`, `/dv`) plus a site service. All three
deliverables ship together. Live-probed before writing schemas; the
audit doc was correct on shape but missed two practical gotchas
captured below.

#### `@pondlog/source-usgs` (new package)

- 4 source functions, all returning `Result<T>`, Zod-validated,
  polite-rate-limited (1 req/sec sustained, bursts to 5).
- `getInstantaneousValues({ sites, parameterCodes?, period? })` —
  real-time gauge readings (typically 15-min cadence). Defaults to
  discharge (00060) + gage height (00065) over the last 2 hours.
- `getDailyValues({ sites, parameterCodes?, period?, startDt?, endDt?,
  statisticCodes? })` — daily statistics. Use `period` for
  relative-to-now or `startDt`/`endDt` for historic windows. The two
  modes are mutually exclusive at the source boundary.
- `getSiteInfo({ siteNumber })` — single-site metadata via the RDB-only
  `/site/` endpoint. Client parses the tab-delimited RDB format
  internally and returns a normalized record (name, coords, HUC, state,
  county, altitude).
- `searchSites({ bbox?, stateCode?, hucCode?, siteType?,
  hasDataTypeCode? })` — find active stream gauges. Defaults
  `siteType=ST` (streams) and `hasDataTypeCd=iv` (real-time enabled).
- `bboxAround(coords, radiusKm)` helper builds a square bbox tuple
  ready for `searchSites({ bbox })`. Coordinates are rounded to 7
  decimals because USGS rejects `bBox` arguments with more precision
  than that (HTTP 400 with a "requires a decimal number with at most
  7 digits to the right of the decimal point" message).
- `PARAMETER_CODES` constant exports the three most-asked codes
  (`DISCHARGE`, `GAGE_HEIGHT`, `WATER_TEMP_C`).
- WaterML JSON envelope handled: each request returns one timeSeries
  per (site × parameter × statistic). Normalizer collapses them by
  site so consumers get one reading-per-site with multiple series.
- HTML-entity decode in variable names (`&#179;` → `³`) so terminal
  output is readable.
- `-999999.0` is the noDataValue sentinel — `denull()` translates to
  `undefined` so consumers never see the magic number. Per-value
  parser also catches stray `-999999` payloads in the wire string.
- `.passthrough()` on every Zod object — schemas accept what USGS
  sends even when shapes drift.

#### `pondlog usgs …` CLI subcommands

- `pondlog usgs flow --site <number> [--period] [--json]` — current
  real-time discharge + gage height. Picocolors output with parameter
  code, description, value, unit, and timestamp.
- `pondlog usgs daily --site <number> [--period | --start-date
  --end-date] [--json]` — daily statistics, current or historic. CLI
  enforces the period/range mutual exclusion before any network call.
- `pondlog usgs sites [--lat] [--lng] [--radius] [--state] [--json]` —
  find gauges. `--state` and `--lat/--lng` are mutually exclusive.
  Falls back to saved location when `--lat/--lng` are absent.
- Validation at the CLI boundary: site number regex, ISO-8601 period
  regex, radius clamp, state-code regex — all fail loud with
  descriptive errors before touching the network.
- Help text on every command with worked examples and a note that
  `/iv/` rejects historic dates so you must use `daily` for past data.

#### `@pondlog/mcp-usgs` (new package, 4 MCP tools)

- Tools: `get_instantaneous_values`, `get_daily_values`,
  `get_site_info`, `search_sites`. Stdio transport, NPX-ready
  (`pondlog-mcp-usgs` bin with shebang).
- All tools `readOnlyHint: true, openWorldHint: true`. No env vars
  required (USGS is keyless).
- LLM-targeted descriptions inline the USGS parameter-code glossary
  (`00060` = discharge, `00065` = gage height, `00010` = water temp,
  `00400` = pH, `00095` = specific conductance) and statistic codes
  (`00003` = mean, `00001` = max, `00002` = min, `00008` = median).
- Cross-references between siblings: `get_instantaneous_values`'s
  description tells the LLM to use `get_daily_values` for historic
  ranges; `search_sites` tells it to feed results into the value
  endpoints; `get_site_info` is positioned as a follow-up step after
  search.
- Per-field Zod `.describe()` strings on every input
  (`siteNumberField`, `periodField`, `parameterCodeField`, etc.,
  shared via `schemas.ts`).
- README with Claude Desktop + Cursor config blocks (no env block —
  no key needed), 4-tool table, parameter-code reference, example
  prompts.
- `server.json` for MCP Registry submission.

### Verified

- `pnpm typecheck` + `pnpm build` clean across all 10 workspace
  packages.
- `@pondlog/source-usgs` unit tests: 16 passing (Zod schemas + boundary
  validation + RDB parsing + denull + groupBySite + bboxAround).
- `@pondlog/source-usgs` live smoke: 8/8 passing against the real USGS
  API. `getInstantaneousValues({Elwha 12045500, PT2H})` returned 2
  series (00060=1310 ft³/s, 00065=10.6 ft); `Dungeness 12048000` IV
  returned 418 ft³/s; unknown site `99999999` correctly returned
  `ok: true` with `data: []`; `getDailyValues({Elwha, P7D})` returned
  7 daily means with statistic="Mean"; `getDailyValues({Elwha,
  startDt: 2024-01-01, endDt: 2024-01-05})` returned 5 historic means
  with quality `[A]`; `getSiteInfo({Elwha})` returned correct lat/lng
  and full station name; `searchSites({bbox: PA 25 km})` returned
  8 stream gauges including both Elwha and Dungeness; `searchSites
  ({stateCode: 'WA'})` returned 557 stream gauges.
- CLI manual smoke: `usgs flow --site 12045500` shows live readings
  with timestamps; `usgs daily --site 12045500 --period P10D` renders
  a 10-row table; `usgs daily --site 12045500 --start-date 2024-01-01
  --end-date 2024-01-05` shows historic data with `[A]` qualifiers;
  `usgs sites --lat 48.118 --lng -123.4307 --radius 25` returns
  8 sites; `--json` on every command returns the full structured
  result; bad inputs (`--site abc`, period+date combo,
  `--state WA --lat 48`) all rejected at the CLI boundary with
  descriptive errors.
- MCP JSON-RPC handshake (per `mcp-server` SKILL.md §6) — all 4
  required checks: `initialize` returns `pondlog-mcp-usgs` v0.1.0;
  `tools/list` returns all 4 tools; live `get_instantaneous_values
  ({sites: ['12045500'], period: 'PT1H'})` returns last reading
  1310 ft³/s; live `get_daily_values({sites: ['12045500'], period:
  'P5D'})` returns 5 values; live `search_sites({lat: 48.118, lng:
  -123.4307, radius_km: 25})` returns 8 sites; bad-input
  `get_instantaneous_values({sites: ['abc']})` rejected by SDK Zod
  (`isError: true`). Verification script deleted before commit per
  SKILL.md.

### Gotchas discovered live (worth carrying into mcp-pondlog)

- **`/iv/` rejects historic `startDT`/`endDT`** with HTTP 301 — only
  `period` (relative-to-now) is accepted. For past data the caller
  must use `/dv/` (daily values), which DOES accept date ranges. The
  source client guards both modes correctly; the CLI wires
  mutually-exclusive flags so the user can't trip it.
- **`/site/` returns RDB only.** `format=json` returns an HTML 400
  error page. The client uses an internal RDB parser and returns
  normalized objects regardless of which endpoint was hit.
- **`bBox` argument validation rejects > 7 decimal places.** Naive
  floating-point math (e.g. `48.05 - 25/111.32`) produces 14+ decimals
  and HTTP 400. `bboxAround` rounds to 7 places before constructing
  the tuple.
- **Unknown site numbers don't error.** USGS returns HTTP 200 with
  `timeSeries: []`. Source client surfaces this as `ok: true` with an
  empty array — handled gracefully in the CLI ("No data for site X").
- **Each parameter is a separate timeSeries.** Asking for both 00060
  and 00065 at one site yields 2 timeSeries with the same sourceInfo
  and 1 group of values each. Normalizer collapses these into one
  reading-per-site with N series.

### Notes for future stickies (mcp-pondlog aggregate)

- USGS is the cheapest source in the stack. Real-time discharge belongs
  in any "what's happening at this place right now?" briefing — it's
  context-rich (one number tells you flood / drought / spring melt),
  cheap to fetch, and updates every 15 minutes.
- The RDB parser is generic enough to be promoted to `@pondlog/core`
  if any other USGS subendpoint needs it later. Right now it lives in
  `source-usgs/normalize.ts`.

---

## [0.7.0] - 2026-05-07

### Added — Stickies 9 & 10: NPN source client + CLI + MCP (one ship)

NPN is a small, sparsely documented API; the audit doc had two
pre-existing errors (wrong host + missing WKT spatial model). All three
deliverables shipped together since the surface is small and
co-evolved. NPN's data model required real research to get right —
notes captured below for future reference.

#### `@pondlog/source-npn` (new package)

- 7 source functions + 1 composed helper, all returning `Result<T>`,
  Zod-validated, polite-rate-limited (1 req/sec sustained, bursts to
  5). Real base URL is `https://services.usanpn.org/npn_portal/`
  (audit doc said `data.usanpn.org` — it's wrong).
- Functions: `getSpecies`, `getStations({stateCode?})`,
  `getStationCountByState`, `getStationsWithSpecies`,
  `getStationsByLocation` (WKT polygon), `getObservations`,
  `getSiteLevelData`. Plus the composed `getActivePhenologyNearby` —
  builds a WKT bbox from coords+radius, pulls stations, haversine-
  filters, and returns site-level phenometric rows sorted by
  most-recent activity.
- WKT helpers: `bboxWkt(coords, radiusKm)` builds a closed flat-earth
  polygon (good to a few percent under ~100 km outside the poles);
  `haversineKm(a, b)` for true-radius post-filter.
- `-9999` is NPN's null sentinel — `denull()` translates to
  `undefined` so consumers never see it.
- Hard guards at the source boundary on `getObservations` and
  `getSiteLevelData`: must pass `years[]` AND ≥1 narrowing filter
  (species/station/state/etc). Unfiltered queries can be 95+ MB.
- Generous default fetch timeout (60s) with a `timeoutMs` override on
  the heavy endpoints (state-year `getSiteLevelData` runs ~50s).
- `.passthrough()` on every Zod object — schemas accept what NPN sends
  even when shapes drift; normalizers handle the translation.
- Defensive parsing for known wire quirks:
    - `station_name` can be a number (some integer-named stations).
    - `state` field can be `null` in some `stationCountByState` rows.
    - `state` field can be a number in some `getSiteLevelData` rows.
    - `network_id` can be string, number, null, or empty.
- Empty-body bug handling: NPN returns HTTP 200 with 0-byte body for
  some queries (notably `getStationsWithSpecies({speciesIds:[3]})`,
  rnpn issue #38). The client treats empty body as `[]` so callers
  don't crash on `JSON.parse`.
- Inconsistency NPN didn't document: `station_id` (singular) is the
  filter parameter on `getSiteLevelData`, while `station_ids` (plural)
  is the parameter on `getObservations`. Took live probing to find.

#### `pondlog npn …` CLI subcommands

- `pondlog npn active [--lat] [--lng] [--radius] [--years]
  [--max-stations] [--json]` — recently observed phenology near a
  location. Picocolors output with distance + sample size columns;
  `--json` returns full structured result.
- `pondlog npn species [--query] [--genus] [--kingdom] [--json]` —
  search the ~1,900-species NPN catalog. Cap of 30 alphabetical rows
  with no filter; up to 200 with filters.
- Validation at the CLI boundary (`--radius`, `--years`,
  `--max-stations` all clamped with descriptive errors).
- Help text on every command with worked examples and a coverage
  caveat ("Eastern US and AZ are dense; PNW is sparser").

#### `@pondlog/mcp-npn` (new package, 8 MCP tools)

- Tools: `search_species`, `get_stations_in_state`,
  `get_station_count_by_state`, `get_stations_with_species`,
  `get_stations_by_location`, `get_observations`,
  `get_site_level_data`, `get_active_phenology_nearby`. Stdio
  transport, NPX-ready (`pondlog-mcp-npn` bin with shebang).
- All tools `readOnlyHint: true, openWorldHint: true`. No env vars
  required (NPN is keyless — `server.json` reflects that).
- LLM-targeted tool descriptions inline the NPN glossary: phenophase
  definition, what "first yes" / "last yes" mean, why `-9999` doesn't
  appear in responses, when to pick `get_active_phenology_nearby` vs
  the lower-level tools.
- Per-field `.describe()` calls on every input (`speciesIdField`,
  `stateCodeField`, `phenophaseIdField`, etc., shared via
  `schemas.ts`). Tool descriptions cross-reference siblings so the LLM
  doesn't pick `get_observations` when `get_site_level_data` is
  cheaper.
- README with Claude Desktop + Cursor config blocks (no env block —
  no key needed), 8-tool table, key gotchas (coverage patchiness, data
  lag, sentinel value, species_id=3 bug), example prompts.
- `server.json` for MCP Registry submission.

### Verified

- `pnpm typecheck` + `pnpm build` clean across all 8 workspace
  packages.
- `@pondlog/source-npn` unit tests: 12 passing
  (Zod schemas, denull/normalize, WKT bbox + haversine).
- `@pondlog/source-npn` live smoke: 9/9 passing against the real NPN
  API at Port Angeles + WA. `getSpecies` (1,940 species),
  `getStationCountByState` (202 state buckets, includes territories +
  null bucket), `getStations({stateCode:'WA'})` (1,374 stations),
  `getStationsByLocation` (16 stations in PA bbox 25 km),
  `getStationsWithSpecies({speciesIds:[210]})` (188 stations) and the
  graceful-empty case for the buggy species_id=3,
  `getObservations({states:['WA'], speciesIds:[3], years:[2024]})`
  (803 obs), `getActivePhenologyNearby({Port Angeles, 50 km, 2y})`
  (75 phenometric rows across 40 stations).
- CLI manual smoke: `npn species --query mayapple` (1 result with
  binomial + species_id), `npn species --genus Acer` (14 maples
  alphabetically), `npn active --lat 47.6062 --lng -122.3321
  --radius 50 --years 5` (21 rows incl. dwarf witchalder, herring
  gull, kinnikinnick), `--json` returns the full result envelope, bad
  `--radius 9999` rejected at the CLI boundary.
- MCP JSON-RPC handshake (per `mcp-server` SKILL.md §6) — all 4
  required checks: `initialize` returns `pondlog-mcp-npn` v0.1.0;
  `tools/list` returns all 8 tools; live `search_species(query=saguaro)`
  returns id=210; live `get_active_phenology_nearby(Seattle, 50km, 5y,
  30 stations)` returns the entries; live
  `get_station_count_by_state` returns 202 states; bad-input
  `get_active_phenology_nearby({lat:999})` rejected by SDK Zod
  before the handler runs (`isError: true`). Verification script
  deleted before commit per SKILL.md.

### Notes for future stickies (USGS, mcp-pondlog aggregate)

- NPN's session — three pre-existing errors had to be discovered live
  by probing the real API: wrong host in audit doc, undocumented
  `station_id` vs `station_ids` parameter inconsistency between
  related endpoints, and the `-9999` sentinel + `null`/`number`
  type-drift in fields the docs claimed were strings. Lesson: always
  hit the live API before writing schemas. Don't trust audit notes.
- `getObservations` is bandwidth-bound (80+ MB per station-year). For
  any "is this happening now?" query, prefer site-level summaries.
  Carrying that lens into mcp-pondlog: aggregate "what's recent" is
  best built on site-level data + recent eBird/inat observations,
  not raw NPN status records.
- `bboxWkt` + `haversineKm` are reusable — promote to `@pondlog/core`
  if mcp-pondlog or USGS integration needs them. Right now they live
  in `@pondlog/source-npn` and are re-exported.
- 7 endpoints + 8 MCP tools (the eighth being the composed helper) is
  the right ratio for a bandwidth-constrained API. Don't expose 1:1
  bare wrappers when one composed tool answers the actual question
  better.

---

## [0.6.0] - 2026-05-07

### Added — Sticky 7: eBird MCP server (21 tools, 100% API coverage)
- `@pondlog/mcp-ebird` ships **21 MCP tools** — direct snake_case
  mappings of all 21 `@pondlog/source-ebird` functions. Stdio
  transport, `@modelcontextprotocol/sdk` v1.x, NPX-ready
  (`pondlog-mcp-ebird` bin with shebang).
- Tools split by category to keep files focused (mirrors source-ebird):
  `tools/observations.ts` (7), `tools/product.ts` (3),
  `tools/hotspots.ts` (3), `tools/taxonomy.ts` (5),
  `tools/regions.ts` (3). `tools.ts` is a thin barrel.
- Tool descriptions inline the eBird domain glossary: region-code
  hierarchy (US / US-WA / US-WA-009), species-code format, subId/locId
  formats. Cross-references between siblings (region-scoped vs
  coords-scoped, recent vs notable, etc.) so the LLM picks the right
  tool.
- Per-field Zod `.describe()` strings on every input. Shared field
  fragments live in `schemas.ts` (`latField`, `lngField`, `distField`,
  `backField`, `regionCodeField`, `speciesCodeField`, etc.) — same
  pattern as `mcp-inaturalist`.
- All tools annotated `readOnlyHint: true, openWorldHint: true`.
  Successful responses emit both `structuredContent` and a `text`
  block; failures set `isError: true` with `source/message/statusCode`.
- `EBIRD_API_KEY` enforcement at server startup: `assertEbirdApiKey()`
  runs at the top of `index.ts main()` before `buildServer()`. Missing
  key prints a clear error to stderr (link to keygen + export
  instructions) and exits 1 before binding stdio. `buildServer()` stays
  pure for testability.
- `server.json` for MCP Registry submission, with
  `environment_variables` declaring `EBIRD_API_KEY` as required +
  secret. README with Claude Desktop + Cursor config blocks (both with
  `env` block for the key), full 21-tool table grouped by category,
  region-code glossary, example prompts.

### Verified
- `pnpm --filter @pondlog/mcp-ebird typecheck` + `build` clean
  (~31 KB ESM bundle).
- Missing-key error path: `node dist/index.js` (without
  `EBIRD_API_KEY`) prints the actionable error and exits 1 before
  any other work.
- JSON-RPC handshake: `initialize` returns expected `serverInfo`
  (`pondlog-mcp-ebird` v0.1.0); `tools/list` returns all 21 tools;
  bad-input `tools/call` (`get_nearby_recent` with `lat=999`) is
  rejected by SDK Zod with `isError: true` before the handler runs.
- Live `tools/call` against `get_nearby_recent` (Port Angeles,
  dist=25, back=3) returned `ok: true` with 138 species.

## [0.5.0] - 2026-05-07

### Added — Sticky 6: eBird CLI subcommands
- `pondlog ebird recent [--lat] [--lng] [--radius] [--days] [--json]` —
  recent bird sightings near a location, sorted newest first. eBird's
  `obs/recent` already returns one row per species (the most recent
  sighting), so output is naturally one row per species with `howMany`,
  bold common name, dim scientific name, dim location, relative date.
- `pondlog ebird notable [--lat] [--lng] [--radius] [--days] [--json]` —
  notable / unusual sightings with a yellow ★ marker per row.
- `pondlog ebird species <speciesCode> [--lat] [--lng] [--radius] [--json]`
  — recent sightings of one species (eBird 4–10 char code, e.g.
  `barowl`). Validated lower-case alphanumeric.
- `pondlog ebird historic <date> --region <code> [--json]` — observations
  on a specific date in a region (date as YYYY-MM-DD; region required,
  e.g. `US-WA-009`). Output is grouped by location, with each group
  sorted by sighting count desc.
- `pondlog ebird hotspots [--lat] [--lng] [--radius] [--json]` —
  birding hotspots near a location, sorted by all-time species count
  desc, showing species count and last activity (relative).
- `pondlog ebird checklist <subId> [--json]` — view a single eBird
  checklist (e.g. `S987654321`) with metadata header (observer, date,
  duration, distance, species count) and species list.
- All location-aware commands resolve from `--lat/--lng` flags →
  `~/.pondlog/config.json` saved default → friendly error.
- Every eBird subcommand requires `EBIRD_API_KEY`. Missing key prints
  a clear actionable error to stderr (link to keygen + the export
  command) and exits 1, before any network call.
- eBird radius is clamped to 50 km (eBird's API max), days to 30
  (eBird's API max). Both validated at the CLI boundary with descriptive
  error messages.
- New validators in `validate.ts`: `parseHistoricDate`,
  `parseSpeciesCode`, `parseRegionCode`.
- New `format-ebird.ts` with `formatEbirdObs` (with optional notable
  marker), `formatHotspot`, `formatChecklistHeader`,
  `groupObsByLocation`. Truncation with `…` for long location names.

### Verified
- `pnpm --filter pondlog typecheck` + `build` clean (~35 KB ESM bundle).
- `pondlog ebird --help` lists all 6 subcommands; per-command `--help`
  prints usage examples.
- Manual smoke against the real eBird API (Port Angeles area):
  - `recent`: 166 species rendered cleanly, sorted newest first
  - `notable`: 1 sighting (Mountain Bluebird) with ★ marker
  - `hotspots`: 100 hotspots ranked by all-time species (Rocky Point
    Bird Observatory at 299 spp leading)
  - `historic 2025-05-01 --region US-WA-009`: 125 observations across
    27 locations, grouped neatly
  - `recent --json | jq '.[0]'`: valid JSON observation object
- Missing-key error: `node … ebird recent` (without `EBIRD_API_KEY`)
  prints the actionable error and exits 1 before any fetch.

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
