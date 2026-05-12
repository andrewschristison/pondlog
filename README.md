# pondlog

Place-aware nature data for developers. **What's happening in nature at
these coordinates right now?**

Pondlog stitches together free public APIs (iNaturalist, eBird, USA-NPN,
USGS, Mushroom Observer) plus local astronomy computation
(`astronomy-engine`) and NOAA tides/cloud cover into one data layer
with two interfaces:

- A **CLI** for humans (`pondlog inat nearby --lat 48.118 --lng -123.43`)
- An **MCP server** per source for AI agents (Claude Desktop, Cursor)

By [Andrew Christison](https://github.com/andrewschristison).

## What's in the box

8 data sources. 7 MCP servers. 1 unified CLI. A ~1000-crop garden
planner with USDA hardiness zones and companion-planting graph.

| Package | npm | What it does |
|---|---|---|
| [`pondlog`](./packages/cli) | [![npm](https://img.shields.io/npm/v/pondlog.svg)](https://www.npmjs.com/package/pondlog) | Unified CLI |
| [`@pondlog/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@pondlog/core.svg)](https://www.npmjs.com/package/@pondlog/core) | Shared types, `Result<T>`, rate limiter, USDA zones, crop calendar, companions |
| [`@pondlog/source-inaturalist`](./packages/source-inaturalist) | [![npm](https://img.shields.io/npm/v/@pondlog/source-inaturalist.svg)](https://www.npmjs.com/package/@pondlog/source-inaturalist) | iNaturalist API client |
| [`@pondlog/source-ebird`](./packages/source-ebird) | [![npm](https://img.shields.io/npm/v/@pondlog/source-ebird.svg)](https://www.npmjs.com/package/@pondlog/source-ebird) | eBird API client (21 endpoints) |
| [`@pondlog/source-npn`](./packages/source-npn) | [![npm](https://img.shields.io/npm/v/@pondlog/source-npn.svg)](https://www.npmjs.com/package/@pondlog/source-npn) | USA-NPN phenology client |
| [`@pondlog/source-usgs`](./packages/source-usgs) | [![npm](https://img.shields.io/npm/v/@pondlog/source-usgs.svg)](https://www.npmjs.com/package/@pondlog/source-usgs) | USGS Water Services client |
| [`@pondlog/source-nightsky`](./packages/source-nightsky) | [![npm](https://img.shields.io/npm/v/@pondlog/source-nightsky.svg)](https://www.npmjs.com/package/@pondlog/source-nightsky) | Local night-sky briefing (astronomy-engine) |
| [`@pondlog/source-mushroomobserver`](./packages/source-mushroomobserver) | [![npm](https://img.shields.io/npm/v/@pondlog/source-mushroomobserver.svg)](https://www.npmjs.com/package/@pondlog/source-mushroomobserver) | Mushroom Observer (mycology) client |
| [`@pondlog/source-trefle`](./packages/source-trefle) | [![npm](https://img.shields.io/npm/v/@pondlog/source-trefle.svg)](https://www.npmjs.com/package/@pondlog/source-trefle) | Trefle.io plant taxonomy client |
| [`@pondlog/mcp-inaturalist`](./packages/mcp-inaturalist) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-inaturalist.svg)](https://www.npmjs.com/package/@pondlog/mcp-inaturalist) | iNaturalist MCP server (9 tools) |
| [`@pondlog/mcp-ebird`](./packages/mcp-ebird) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-ebird.svg)](https://www.npmjs.com/package/@pondlog/mcp-ebird) | eBird MCP server (21 tools) |
| [`@pondlog/mcp-npn`](./packages/mcp-npn) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-npn.svg)](https://www.npmjs.com/package/@pondlog/mcp-npn) | NPN MCP server (8 tools) |
| [`@pondlog/mcp-usgs`](./packages/mcp-usgs) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-usgs.svg)](https://www.npmjs.com/package/@pondlog/mcp-usgs) | USGS MCP server (4 tools) |
| [`@pondlog/mcp-mushroomobserver`](./packages/mcp-mushroomobserver) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-mushroomobserver.svg)](https://www.npmjs.com/package/@pondlog/mcp-mushroomobserver) | Mushroom Observer MCP server (5 tools, mycology-first) |
| [`@pondlog/mcp-garden`](./packages/mcp-garden) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-garden.svg)](https://www.npmjs.com/package/@pondlog/mcp-garden) | Garden-planning MCP server (8 tools, calendar + zones + companions + Trefle) |
| [`@pondlog/mcp-pondlog`](./packages/mcp-pondlog) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-pondlog.svg)](https://www.npmjs.com/package/@pondlog/mcp-pondlog) | Aggregate MCP server (5 tools, all eight sources) |

## Status

| Source | Library | CLI | MCP |
|---|---|---|---|
| iNaturalist | ✅ | ✅ | ✅ |
| eBird | ✅ | ✅ | ✅ |
| NPN (phenology) | ✅ | ✅ | ✅ |
| USGS (water) | ✅ | ✅ | ✅ |
| Mushroom Observer (mycology) | ✅ | ✅ | ✅ |
| Garden (USDA zones + ~1000-crop calendar + companions + Trefle) | ✅ | ✅ | ✅ |
| Night sky (`astronomy-engine`) | ✅ | ✅ | ✅ (via `mcp-pondlog`) |
| Aggregate (`pondlog today` / `mcp-pondlog`) | n/a | ✅ | ✅ |

## Quick start

### As an AI agent (MCP)

Add to your Claude Desktop config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on
macOS):

```json
{
  "mcpServers": {
    "pondlog-inaturalist": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-inaturalist"]
    }
  }
}
```

Then ask Claude:

> What amphibians have been seen near Port Angeles, WA in the last week?

The same JSON works in `~/.cursor/mcp.json` for Cursor. Run any MCP
server in one command:

```sh
npx -y @pondlog/mcp-inaturalist          # no key
npx -y @pondlog/mcp-garden               # offline garden tools
EBIRD_API_KEY=... npx -y @pondlog/mcp-ebird
npx -y @pondlog/mcp-pondlog              # aggregate of all eight sources
```

### As a human (CLI)

```sh
npm install -g pondlog
pondlog config set-location --lat 48.118 --lng -123.4307 --name "Port Angeles"
pondlog today                          # unified briefing
pondlog inat nearby
pondlog ebird notable
pondlog npn active
pondlog usgs flow --site 12045500
pondlog nightsky                       # tonight's curated briefing
pondlog garden now                     # what to plant this week
```

`--json` works on every command for machine output.

## Architecture

```
                          ┌─────────────────────────┐
                          │      @pondlog/core      │
                          │  types, Result<T>,      │
                          │  RateLimiter, withRetry,│
                          │  USDA zones, crops,     │
                          │  companion graph        │
                          └────────────┬────────────┘
                                       │
        ┌──────────┬──────────┬────────┼─────────┬──────────┬──────────┐
        ▼          ▼          ▼        ▼         ▼          ▼          ▼
 source-inat  source-ebird  source-npn  source-usgs  source-mo  source-trefle  source-nightsky
        │          │          │        │         │          │          │
        └──────────┴──────────┴────────┼─────────┴──────────┴──────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
            pondlog (CLI)                       7 × @pondlog/mcp-* servers
            ├─ pondlog today (aggregate)         ├─ mcp-inaturalist
            ├─ pondlog inat/ebird/...             ├─ mcp-ebird
            └─ pondlog garden/nightsky            ├─ mcp-npn / mcp-usgs
                                                  ├─ mcp-mushroomobserver
                                                  ├─ mcp-garden
                                                  └─ mcp-pondlog  ◀── aggregate
```

Source clients do all the work (Zod validation, rate limiting, retry,
normalization). The CLI and MCP servers are thin wrappers around them.

## Design principles

- **One data layer, two interfaces.** Each source is a typed library
  (Zod-validated, rate-limited, returns `Result<T>`). The CLI and MCP
  servers are thin wrappers. No business logic in them.
- **Degrade gracefully.** When a source is down, the aggregate still
  returns whatever else worked, with errors reported in-band.
- **Rate limits respected.** Each client throttles itself. Never trust
  the caller.
- **No keys for what doesn't need them.** iNaturalist, NPN, USGS,
  Mushroom Observer, and the night-sky source all run keyless. Only
  eBird and Trefle require free keys.
- **Local computation when the data isn't external.** Astronomy is
  pure math; `@pondlog/source-nightsky` ships zero network calls,
  zero rate limits, zero failure modes. The garden calendar, zones,
  and companion graph are bundled JSON, all offline.

## Related: CropGraph

[CropGraph](https://api.cropgraph.com) is a sibling HTTP API exposing
the same ~1000-crop planting calendar, USDA hardiness zones, and
companion-planting graph used by `@pondlog/core` and `@pondlog/mcp-garden`.
Use CropGraph when you want the data over HTTP from any language. The
schemas are kept in lockstep with this repo.

## Contributing

PRs welcome. The build is pnpm-based:

```sh
git clone https://github.com/andrewschristison/pondlog.git
cd pondlog
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm smoke   # live tests against iNaturalist
```

### Crop calendar / companion-planting data

The crop calendar (`packages/core/src/data/crop-calendar.json`) and
companion graph (`packages/core/src/data/companions.json`) accept
community PRs. Both have JSON Schemas alongside the data:

- `packages/core/src/data/crop-calendar.schema.json`
- `packages/core/src/data/companions.schema.json`

When adding a crop entry, include a per-entry `source` citing a real
extension service (USDA, Cornell, WSU, Oregon State, UMass, UF/IFAS,
etc.). When adding a companion edge, include `evidence` (`strong` or
`moderate`) and a `citation` URL. Zod validation runs at module load,
so a malformed PR breaks `import "@pondlog/core"` immediately.

### Code

Each package follows a strict pattern documented in
[`docs/METHODOLOGY.md`](./docs/METHODOLOGY.md). Source clients always
ship before the CLI commands or MCP tools that consume them.

## License

MIT. See [LICENSE](./LICENSE).
