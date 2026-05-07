# Pondlog

**Owner:** Andrew Christison
**Brand candidate:** Banyan Stand
**Status:** Pre-build — scaffolding phase
**This is NOT:** Retencity, DojoFlow, Frame, Ask K, or any agency project

---

## What this is

Pondlog is a place-aware nature data aggregation tool. It stitches together free public APIs — iNaturalist, eBird, NOAA, USA-NPN, USGS, and SunCalc — into a unified layer that answers one question: **"What's happening in nature at these coordinates right now?"**

Every data source gets two interfaces consuming a shared core library:
- A **CLI** for humans (`pondlog inat nearby --lat 48.12 --lng -123.43`)
- An **MCP server** for AI agents (published independently to npm and MCP registries)

The aggregate command `pondlog today` combines all sources into a single briefing.

The eventual consumer of this data layer is **Pond Log** — a wall-mounted family kiosk for the Christison household in Port Angeles, WA. But the libraries, CLIs, and MCP servers are general-purpose tools for anyone.

## Stack

- **Language:** TypeScript (strict mode)
- **Monorepo:** pnpm workspaces
- **Build:** tsup (fast, zero-config)
- **Validation:** Zod for all API response parsing and MCP tool input schemas
- **MCP SDK:** @modelcontextprotocol/sdk (TypeScript)
- **CLI framework:** commander
- **HTTP client:** undici or native fetch (Node 18+)
- **Testing:** vitest
- **Node minimum:** 18+

## Project structure

```
pondlog/
├── CLAUDE.md                    ← you are here
├── package.json                 ← pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docs/
│   ├── ARCHITECTURE.md          ← package relationships and data flow
│   ├── METHODOLOGY.md           ← API integration patterns
│   ├── API_AUDIT.md             ← per-source API due diligence
│   ├── STICKIES.md              ← session work queue
│   └── SESSION_HANDOFF.md       ← continuity between sessions
├── packages/
│   ├── core/                    ← shared types, utils, response schemas
│   ├── source-inaturalist/      ← iNaturalist API client library
│   ├── source-ebird/            ← eBird API client library
│   ├── source-npn/              ← NPN API client library
│   ├── source-usgs/             ← USGS API client library
│   ├── cli/                     ← unified CLI (pondlog)
│   ├── mcp-inaturalist/         ← iNaturalist MCP server (standalone npm)
│   ├── mcp-ebird/               ← eBird MCP server (standalone npm)
│   ├── mcp-npn/                 ← NPN MCP server (standalone npm)
│   ├── mcp-usgs/                ← USGS MCP server (standalone npm)
│   └── mcp-pondlog/             ← aggregate MCP server
└── .agents/
    └── skills/                  ← symlinks to gundry-agents skills
```

## Build order

1. **iNaturalist** — `source-inaturalist` → `cli` (inat subcommands) → `mcp-inaturalist`
2. **eBird** — `source-ebird` → `cli` (ebird subcommands) → `mcp-ebird`
3. **NPN** — `source-npn` → `cli` (npn subcommands) → `mcp-npn`
4. **USGS** — `source-usgs` → `cli` (usgs subcommands) → `mcp-usgs`
5. **Aggregate** — `pondlog today` CLI command + `mcp-pondlog` aggregate server

Each source ships independently. Do not build source N+1 until source N has a working CLI and MCP.

## Rules

1. **Plan before code.** Every session starts by reading CLAUDE.md, STICKIES.md, and the relevant section of API_AUDIT.md. Propose a plan. Wait for approval before writing code.

2. **Core library first.** The source client library is always built and tested before the CLI or MCP that consumes it. The CLI and MCP are thin wrappers — no business logic in them.

3. **Zod everywhere.** Every API response gets a Zod schema. Every MCP tool input gets a Zod schema. No `any` types. If the API returns unexpected shapes, fail loudly with a descriptive error, don't swallow it.

4. **Rate limits are sacred.** Each source client must implement rate limiting internally. iNaturalist: 100 req/min. eBird: 100 req/min (estimated). NOAA: 5 req/sec. NPN/USGS: be polite. Never rely on the caller to rate-limit.

5. **Degrade gracefully.** If one API is down, return what you have from the others. The aggregate `pondlog today` must never crash because one source is unreachable. Return partial data with a clear indication of what's missing.

6. **No secrets in code.** API keys (where required) come from environment variables. iNaturalist reads need no key — just a User-Agent header. eBird requires EBIRD_API_KEY env var.

7. **Test with Port Angeles.** Default test coordinates are 48.1180, -123.4307 (Port Angeles, WA). Every new source client gets a smoke test at these coordinates before shipping.

8. **NPX-ready MCP servers.** Each MCP server must be publishable and runnable via `npx @pondlog/mcp-inaturalist` (or whatever the package name). Include a `server.json` for MCP Registry submission.

9. **One README per package.** Each publishable package gets its own README with setup instructions, tool list, and example usage. The root README is an overview that links to each package.

10. **Commits are atomic.** One feature per commit. Descriptive messages. No "WIP" commits on main.
