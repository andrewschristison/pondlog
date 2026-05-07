# Architecture — Pondlog

## Design principle

One data layer, two interfaces. Every data source is a **core library** that fetches, validates (Zod), and normalizes API responses into shared types. The **CLI** and **MCP server** are thin consumers — they format output and handle I/O but contain zero business logic.

```
┌─────────────────────────────────────────────┐
│                  Consumer                    │
│                                             │
│   ┌─────────┐         ┌──────────────┐      │
│   │   CLI   │         │  MCP Server  │      │
│   │pondlog  │         │  (per-source │      │
│   │         │         │   + aggregate)│      │
│   └────┬────┘         └──────┬───────┘      │
│        │                     │              │
│        └──────────┬──────────┘              │
│                   │                         │
│          ┌────────▼────────┐                │
│          │   Core Library  │                │
│          │   (per-source)  │                │
│          └────────┬────────┘                │
│                   │                         │
│          ┌────────▼────────┐                │
│          │  Shared Types   │                │
│          │  packages/core  │                │
│          └────────┬────────┘                │
│                   │                         │
└───────────────────┼─────────────────────────┘
                    │
           ┌────────▼────────┐
           │  Public APIs    │
           │  (iNat, eBird,  │
           │   NPN, USGS,    │
           │   NOAA)         │
           └─────────────────┘
```

## Package map

### `packages/core`
Shared foundation. No API calls — only types, utilities, and schemas.

- **Types:** `Coordinates`, `DateRange`, `Observation`, `SpeciesCount`, `NatureBriefing`
- **Utilities:** rate limiter, retry with backoff, coordinate validation, date helpers
- **Schemas:** Zod schemas for shared response types
- **SunCalc:** celestial calculations (sunrise, sunset, moon phase) — lives here since it's pure math

Published as: `@pondlog/core`

### `packages/source-inaturalist`
iNaturalist API client. Depends on `@pondlog/core`.

- Fetches from `api.inaturalist.org/v1`
- Validates responses with Zod
- Normalizes into shared types
- Handles rate limiting (100 req/min)
- Exports typed functions: `searchObservations()`, `getSpeciesCounts()`, `searchTaxa()`, etc.

Published as: `@pondlog/source-inaturalist`

### `packages/source-ebird`
eBird API client. Same pattern as iNaturalist.

- Requires `EBIRD_API_KEY` env var
- Full 21-endpoint coverage
- Published as: `@pondlog/source-ebird`

### `packages/source-npn`
NPN API client. Same pattern.
Published as: `@pondlog/source-npn`

### `packages/source-usgs`
USGS Water Services client. Same pattern.
Published as: `@pondlog/source-usgs`

### `packages/cli`
Unified CLI. Depends on all source packages.

```
pondlog inat nearby          # iNaturalist nearby observations
pondlog inat species         # species counts
pondlog inat search <query>  # search by name
pondlog inat taxon <name>    # taxon lookup

pondlog ebird recent         # recent observations
pondlog ebird notable        # notable/rare sightings
pondlog ebird hotspots       # nearby hotspots
pondlog ebird historic       # observations on a specific date

pondlog npn blooming         # what's in phenological activity
pondlog usgs flow            # streamflow data

pondlog today                # THE AGGREGATE BRIEFING
pondlog today --save         # save location for future calls
```

Published as: `pondlog` (global CLI install: `npm install -g pondlog`)

### `packages/mcp-inaturalist`
Standalone iNaturalist MCP server. Depends on `source-inaturalist`.

- 9 tools (see API_AUDIT.md)
- NPX-ready: `npx @pondlog/mcp-inaturalist`
- Includes `server.json` for MCP Registry
- Published as: `@pondlog/mcp-inaturalist`

### `packages/mcp-ebird`
Standalone eBird MCP server. 21+ tools, 100% API coverage.
Published as: `@pondlog/mcp-ebird`

### `packages/mcp-npn`, `packages/mcp-usgs`
Same pattern. Published independently.

### `packages/mcp-pondlog`
Aggregate MCP server. Exposes a unified `get_nature_briefing` tool that combines all sources.
Published as: `@pondlog/mcp-pondlog`

## Shared response types (in `packages/core`)

```typescript
interface Coordinates {
  lat: number;
  lng: number;
}

interface Observation {
  id: string;
  source: 'inaturalist' | 'ebird' | 'npn';
  taxonName: string;
  commonName: string;
  iconicTaxon: string; // Aves, Amphibia, Plantae, etc.
  observedAt: string;  // ISO 8601
  coordinates: Coordinates;
  placeGuess: string;
  qualityGrade?: string;
  observerName: string;
  url: string;
}

interface SpeciesCount {
  taxonName: string;
  commonName: string;
  iconicTaxon: string;
  count: number;
  source: 'inaturalist' | 'ebird';
}

interface NatureBriefing {
  coordinates: Coordinates;
  generatedAt: string;
  celestial: {
    sunrise: string;
    sunset: string;
    daylightHours: number;
    moonPhase: string;
    moonIllumination: number;
  };
  tides?: { high: TideEvent[]; low: TideEvent[] };
  recentObservations: Observation[];
  speciesCounts: SpeciesCount[];
  streamflow?: { siteName: string; flowCfs: number; gageHeightFt: number };
  phenology?: { species: string; phenophase: string }[];
  errors: { source: string; message: string }[];
}
```

## Error handling pattern

Every source client returns `Result<T>`:

```typescript
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { source: string; message: string; statusCode?: number } };
```

The aggregate briefing collects all results, includes whatever succeeded, and reports failures in the `errors` array. The CLI prints partial results with a warning line. The MCP server returns partial data with error context in the response.
