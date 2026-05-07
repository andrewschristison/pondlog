# pondlog

Place-aware nature data aggregation. **What's happening in nature at
these coordinates right now?** Pondlog stitches together free public
APIs — iNaturalist, eBird, USA-NPN, USGS — plus local astronomy
computation (`astronomy-engine`) and NOAA tides/cloud cover into a
unified data layer with two interfaces:

- A **CLI** for humans (`pondlog inat nearby --lat 48.118 --lng -123.43`)
- An **MCP server** per source for AI agents (Claude Desktop, Cursor)

By [Andrew Christison](https://github.com/andrewschristison).

## Packages

| Package | npm | What it does |
|---|---|---|
| [`pondlog`](./packages/cli) | [![npm](https://img.shields.io/npm/v/pondlog.svg)](https://www.npmjs.com/package/pondlog) | Unified CLI |
| [`@pondlog/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@pondlog/core.svg)](https://www.npmjs.com/package/@pondlog/core) | Shared types, `Result<T>`, rate limiter, utils |
| [`@pondlog/source-inaturalist`](./packages/source-inaturalist) | [![npm](https://img.shields.io/npm/v/@pondlog/source-inaturalist.svg)](https://www.npmjs.com/package/@pondlog/source-inaturalist) | iNaturalist API client |
| [`@pondlog/source-ebird`](./packages/source-ebird) | [![npm](https://img.shields.io/npm/v/@pondlog/source-ebird.svg)](https://www.npmjs.com/package/@pondlog/source-ebird) | eBird API client (21 endpoints) |
| [`@pondlog/source-npn`](./packages/source-npn) | [![npm](https://img.shields.io/npm/v/@pondlog/source-npn.svg)](https://www.npmjs.com/package/@pondlog/source-npn) | USA-NPN phenology client |
| [`@pondlog/source-usgs`](./packages/source-usgs) | [![npm](https://img.shields.io/npm/v/@pondlog/source-usgs.svg)](https://www.npmjs.com/package/@pondlog/source-usgs) | USGS Water Services client |
| [`@pondlog/source-nightsky`](./packages/source-nightsky) | [![npm](https://img.shields.io/npm/v/@pondlog/source-nightsky.svg)](https://www.npmjs.com/package/@pondlog/source-nightsky) | Local night-sky briefing (astronomy-engine) |
| [`@pondlog/mcp-inaturalist`](./packages/mcp-inaturalist) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-inaturalist.svg)](https://www.npmjs.com/package/@pondlog/mcp-inaturalist) | iNaturalist MCP server (9 tools) |
| [`@pondlog/mcp-ebird`](./packages/mcp-ebird) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-ebird.svg)](https://www.npmjs.com/package/@pondlog/mcp-ebird) | eBird MCP server (21 tools) |
| [`@pondlog/mcp-npn`](./packages/mcp-npn) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-npn.svg)](https://www.npmjs.com/package/@pondlog/mcp-npn) | NPN MCP server (8 tools) |
| [`@pondlog/mcp-usgs`](./packages/mcp-usgs) | [![npm](https://img.shields.io/npm/v/@pondlog/mcp-usgs.svg)](https://www.npmjs.com/package/@pondlog/mcp-usgs) | USGS MCP server (4 tools) |

## Status

| Source | Library | CLI | MCP |
|---|---|---|---|
| iNaturalist | ✅ | ✅ | ✅ |
| eBird | ✅ | ✅ | ✅ |
| NPN (phenology) | ✅ | ✅ | ✅ |
| USGS (water) | ✅ | ✅ | ✅ |
| Night sky (`astronomy-engine`) | ✅ | ✅ | — (in `mcp-pondlog`) |
| Aggregate (`pondlog today`) | — | 🔜 | 🔜 |

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

The same JSON works in `~/.cursor/mcp.json` for Cursor.

### As a human (CLI)

```sh
npm install -g pondlog
pondlog config set-location --lat 48.118 --lng -123.4307 --name "Port Angeles"
pondlog inat nearby
pondlog ebird notable
pondlog npn active
pondlog usgs flow --site 12045500
pondlog nightsky                       # tonight's curated briefing
```

`--json` works on every command for machine output.

## Design principles

- **One data layer, two interfaces.** Each source is a typed library
  (Zod-validated, rate-limited, returns `Result<T>`). The CLI and MCP
  servers are thin wrappers — no business logic.
- **Degrade gracefully.** When a source is down, the aggregate still
  returns whatever else worked, with errors reported in-band.
- **Rate limits respected.** Each client throttles itself; never trust
  the caller.
- **No keys for what doesn't need them.** iNaturalist, NPN, USGS, and
  the night-sky source all run keyless. Only eBird requires a key
  (`EBIRD_API_KEY`).
- **Local computation when the data isn't external.** Astronomy is
  pure math — `@pondlog/source-nightsky` ships zero network calls,
  zero rate limits, zero failure modes.

## Repository

```
pondlog/
├── packages/
│   ├── core/                    Shared types and utilities
│   ├── source-inaturalist/      iNaturalist client library
│   ├── cli/                     `pondlog` CLI
│   └── mcp-inaturalist/         MCP server for AI agents
├── docs/
│   ├── ARCHITECTURE.md
│   ├── METHODOLOGY.md
│   ├── API_AUDIT.md
│   ├── STICKIES.md
│   └── SESSION_HANDOFF.md
├── CHANGELOG.md
└── README.md
```

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

Each package follows a strict pattern documented in
[`docs/METHODOLOGY.md`](./docs/METHODOLOGY.md). Source clients always
ship before the CLI commands or MCP tools that consume them.

## License

MIT — see [LICENSE](./LICENSE).
