# pondlog (CLI)

Place-aware nature data aggregation CLI. Part of
[pondlog](https://github.com/andrewschristison/pondlog).

## Install

```sh
npm install -g pondlog
```

## Quick start

Save your default location and station/site once:

```sh
pondlog config set-location --lat 48.118 --lng -123.4307 --name "Port Angeles"
pondlog config set-station 9444090       # NOAA tide station
pondlog config set-usgs-site 12045500    # USGS streamflow gauge (Elwha River)
pondlog config set-ebird-region US-WA-009
```

Then run the unified briefing:

```sh
pondlog today                   # one place, six sources, parallel fan-out
pondlog today --no-cache        # skip on-disk cache (default TTL 15m–1h)
pondlog today --json | jq       # machine-readable NatureBriefing
```

Or query individual sources:

```sh
pondlog inat nearby                # last 7 days, 25 km
pondlog ebird recent
pondlog usgs flow
pondlog nightsky
```

## Commands

### `pondlog today` — the aggregate

Combines iNaturalist + eBird + NPN + USGS streamflow + Night Sky + NOAA
tides into a single briefing. Sources fan out in parallel; partial
failures (e.g. eBird key missing, USGS site down) collect into a ⚠
warning block but never crash the briefing. Results are file-cached at
`~/.pondlog/cache/` with per-source TTLs (tides/phenology 1h,
observations/streamflow 15m).

| Flag | Purpose |
|---|---|
| `--lat <lat>` `--lng <lng>` | Override the saved default location. |
| `--date <iso>` | Reference date/time for sun/moon calculations. |
| `--json` | Print the full `NatureBriefing` plus a `cacheHits` map. |
| `--no-cache` | Bypass the on-disk cache and re-fetch every source. |

### Config

| Command | Purpose |
|---|---|
| `pondlog config set-location --lat <lat> --lng <lng> [--name <name>]` | Save default coordinates to `~/.pondlog/config.json`. |
| `pondlog config set-station <stationId>` | Save NOAA CO-OPS station for tides (e.g. `9444090`). |
| `pondlog config set-usgs-site <siteNumber>` | Save USGS NWIS site for streamflow (e.g. `12045500`). |
| `pondlog config set-ebird-region <regionCode>` | Save eBird region for region-scoped queries (e.g. `US-WA-009`). |
| `pondlog config show [--json]` | Print the current config. |

The config path can be overridden with `PONDLOG_CONFIG_DIR`.

### iNaturalist

| Command | Purpose |
|---|---|
| `pondlog inat nearby [--lat] [--lng] [--radius] [--days] [--taxon]` | Recent observations grouped by iconic taxa. |
| `pondlog inat species [--lat] [--lng] [--radius] [--days]` | Per-species counts grouped by iconic taxa. |
| `pondlog inat search <query> [--lat] [--lng] [--radius]` | Observations matching a taxon name. |
| `pondlog inat taxon <name>` | Look up a taxon by name. |

Every command supports `--json` for machine-readable output and `--help`
with examples. When `--lat`/`--lng` are omitted, the saved config is
used; if no config is saved, the command exits 1 with a friendly error.

## Defaults

- Radius: 10 km (max 500)
- Days: 7

## Companion packages

- [`@pondlog/source-inaturalist`](https://www.npmjs.com/package/@pondlog/source-inaturalist)
  is the underlying client library.
- [`@pondlog/mcp-inaturalist`](https://www.npmjs.com/package/@pondlog/mcp-inaturalist)
  is an MCP server exposing the same data to AI agents (Claude Desktop,
  Cursor).

## License

MIT.
