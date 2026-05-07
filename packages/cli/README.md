# pondlog (CLI)

Place-aware nature data aggregation CLI. Part of
[pondlog](https://github.com/andrewschristison/pondlog).

## Install

```sh
npm install -g pondlog
```

## Quick start

Save your default location once:

```sh
pondlog config set-location --lat 48.118 --lng -123.4307 --name "Port Angeles"
```

Then ask what's around:

```sh
pondlog inat nearby                # last 7 days, 10 km
pondlog inat nearby --radius 25 --days 14
pondlog inat species               # ranked species counts grouped by iconic taxa
pondlog inat search "pacific chorus frog"
pondlog inat taxon "bald eagle"
```

## Commands

### Config

| Command | Purpose |
|---|---|
| `pondlog config set-location --lat <lat> --lng <lng> [--name <name>]` | Save default coordinates to `~/.pondlog/config.json`. |
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
