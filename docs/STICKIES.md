# Stickies — Pondlog

## Active

### Sticky 1 — Monorepo scaffold + iNaturalist core ✅ COMPLETE (2026-05-07)

```
This is pondlog — a place-aware nature data aggregation tool
by Andrew Christison. NOT Retencity. NOT DojoFlow. NOT Frame.

Context loading (in order):
1. Read CLAUDE.md
2. Read docs/ARCHITECTURE.md
3. Read docs/API_AUDIT.md (iNaturalist section)
4. Read docs/METHODOLOGY.md

Task: Scaffold the monorepo and build the iNaturalist source
client library.

Step 1 — Scaffold
- pnpm workspace with pnpm-workspace.yaml
- tsconfig.base.json (strict, ES2022, NodeNext)
- packages/core/ with shared types (Coordinates, Result<T>,
  Observation, SpeciesCount) and rate limiter utility
- packages/source-inaturalist/ depending on core
- packages/cli/ shell (commander, no commands yet)
- packages/mcp-inaturalist/ shell (MCP SDK, no tools yet)

Step 2 — iNaturalist client (packages/source-inaturalist)
Build and test these functions:
- searchObservations(params) → Result<Observation[]>
- getObservation(id) → Result<ObservationDetail>
- getSpeciesCounts(params) → Result<SpeciesCount[]>
- getNearbyObservations(coords, radius?, days?) → Result<Observation[]>
- searchTaxa(query) → Result<Taxon[]>
- getTaxon(id) → Result<TaxonDetail>
- getIconicTaxaSummary(coords, radius?, days?) → Result<IconicTaxaSummary>
- searchPlaces(query) → Result<Place[]>
- getObservers(coords, radius?, days?) → Result<Observer[]>

Each function:
- Uses fetch with User-Agent header
- Passes response through Zod schema
- Returns Result<T> (never throws)
- Respects rate limiter (100 req/min)

Step 3 — Smoke test
- Run each function with Port Angeles coords (48.1180, -123.4307)
- Verify Zod schemas parse real API responses
- Log any unexpected fields or shapes

Skills to apply: system-design, harden
```

### Sticky 2 — iNaturalist CLI commands ✅ COMPLETE (2026-05-07)

```
Prereq: Sticky 1 complete and tested.

Build CLI commands in packages/cli using commander:
- pondlog inat nearby [--lat] [--lng] [--radius] [--days]
- pondlog inat species [--lat] [--lng] [--radius] [--days]
- pondlog inat search <query>
- pondlog inat taxon <name>

Each command:
- Calls source-inaturalist functions
- Formats output as human-readable terminal text
- Supports --json flag for machine output
- Has --help with example usage
- Defaults lat/lng to Port Angeles if not provided and
  no saved location exists

Also: implement `pondlog config set-location <lat> <lng>`
to save default coordinates to ~/.pondlog/config.json
```

### Sticky 3 — iNaturalist MCP server ✅ COMPLETE (2026-05-07)

```
Prereq: Sticky 1 complete and tested.

Build MCP server in packages/mcp-inaturalist using
@modelcontextprotocol/sdk (TypeScript).

9 tools (see API_AUDIT.md):
1. search_observations
2. get_observation
3. get_species_counts
4. search_taxa
5. get_taxon
6. get_nearby_observations
7. get_iconic_taxa_summary
8. search_places
9. get_observers

Each tool:
- Zod input schema with descriptions written for LLMs
- Calls source-inaturalist functions (thin wrapper)
- Returns structured JSON response

Also:
- NPX-ready packaging (bin field in package.json)
- server.json for MCP Registry submission
- README with Claude Desktop config example
- Test with MCP Inspector (npx @modelcontextprotocol/inspector)
```

### Sticky 4 — iNaturalist publish + list

```
Prereq: Stickies 2-3 complete.

- Publish @pondlog/core to npm
- Publish @pondlog/source-inaturalist to npm
- Publish @pondlog/mcp-inaturalist to npm
- Publish pondlog CLI to npm (with inat commands only)
- Submit server.json to MCP Registry
- List on PulseMCP, Glama, Smithery
- Write root README linking to all packages
- Tag v0.1.0
```

## Backlog

### Sticky 5 — eBird source client (100% API coverage)
### Sticky 6 — eBird CLI commands
### Sticky 7 — eBird MCP server (21+ tools)
### Sticky 8 — eBird publish + list
### Sticky 9 — NPN source client
### Sticky 10 — NPN CLI + MCP
### Sticky 11 — USGS source client
### Sticky 12 — USGS CLI + MCP
### Sticky 13 — SunCalc + NOAA integration in core
### Sticky 14 — `pondlog today` aggregate command
### Sticky 15 — mcp-pondlog aggregate MCP server
### Sticky 16 — Pond Log kiosk data layer integration

## Completed

- **Sticky 1** (2026-05-07) — Monorepo scaffold + iNaturalist core. 4
  packages built, 16 unit tests + 9 live smoke tests all passing against
  real iNat API.
- **Sticky 2** (2026-05-07) — iNaturalist CLI: config (set-location +
  show), inat nearby/species/search/taxon. Validation, picocolors output,
  --json on every command. Live-tested against real iNat API at Port
  Angeles.
- **Sticky 3** (2026-05-07) — iNaturalist MCP server: 9 tools over
  @modelcontextprotocol/sdk v1.29 (stdio). LLM-targeted Zod schemas,
  server.json, README with Claude Desktop + Cursor configs. JSON-RPC
  handshake live-verified: 9 tools listed, real iNat call returns 50
  observations near Port Angeles.
