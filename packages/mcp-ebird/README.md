# @pondlog/mcp-ebird

A place-aware [eBird](https://ebird.org) MCP server. Gives any MCP-aware AI
client (Claude Desktop, Cursor, Continue, custom agents) **21 tools covering
100% of the eBird API v2**: bird observations (recent, notable, historic),
checklists, hotspots, taxonomy, and regions.

Part of [pondlog](https://github.com/andrewschristison/pondlog), a
toolkit for stitching together public nature APIs (iNaturalist, eBird,
USGS, NPN, NOAA, SunCalc).

## Setup

eBird requires a free API key:

1. Sign up at [eBird](https://ebird.org) (free).
2. Generate a key at [ebird.org/api/keygen](https://ebird.org/api/keygen).
3. Set `EBIRD_API_KEY` in your shell or pass it via your MCP client's `env` block (see below).

If `EBIRD_API_KEY` is missing at startup, the server prints a clear error
and exits before binding stdio. Rate-limited internally (100 req/min) with
exponential backoff on 429.

## Install / run

The server is published to npm and runs via `npx` (no install step):

```sh
EBIRD_API_KEY=<your-key> npx -y @pondlog/mcp-ebird
```

It speaks MCP over stdio.

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pondlog-ebird": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-ebird"],
      "env": { "EBIRD_API_KEY": "<your-key>" }
    }
  }
}
```

Restart Claude Desktop. The 21 tools will appear in the slash menu.

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pondlog-ebird": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-ebird"],
      "env": { "EBIRD_API_KEY": "<your-key>" }
    }
  }
}
```

### MCP Inspector (debug)

```sh
EBIRD_API_KEY=<your-key> npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-ebird
```

## Tools

All tools are read-only. Coordinates use WGS84 decimal degrees. Region codes
are hierarchical: `US` (country), `US-WA` (state/subnational1), `US-WA-009`
(county/subnational2, Clallam County in this example).

### Observations (7)

| Tool | What it does |
|------|--------------|
| `get_recent_observations` | Most-recent sighting per species in a region (last `back` days). |
| `get_recent_notable` | Rare/unusual sightings in a region. |
| `get_recent_of_species` | Recent sightings of one species in a region. |
| `get_nearby_recent` | Most-recent sighting per species near coords. |
| `get_nearby_notable` | Rare/unusual sightings near coords. |
| `get_nearby_of_species` | Recent sightings of one species near coords. |
| `get_historic_on_date` | Observations in a region on a specific calendar date. |

### Product (3)

| Tool | What it does |
|------|--------------|
| `get_recent_checklists` | Recently submitted birding checklists for a region. |
| `get_top_100` | Top 100 eBirders for a region on a date (by species or checklists). |
| `get_checklist` | Full detail on one checklist by submission ID. |

### Hotspots (3)

| Tool | What it does |
|------|--------------|
| `get_hotspots_in_region` | All eBird hotspots in a region. |
| `get_nearby_hotspots` | Hotspots within radius of coordinates, ranked by species count. |
| `get_hotspot_info` | Detail (full hierarchical name, country/state/county) for one hotspot. |

### Taxonomy (5)

| Tool | What it does |
|------|--------------|
| `get_taxonomy` | Full or filtered eBird taxonomy (sci/common name, code, family, taxon order). |
| `get_taxonomic_forms` | Subspecies and identifiable forms of a species. |
| `get_taxa_locales` | Available locale codes for common names (en, es, fr, ...). |
| `get_taxonomy_versions` | List of eBird taxonomy versions with the latest flagged. |
| `get_taxonomic_groups` | Taxonomic groups for browsing (eBird-style or Merlin-style). |

### Regions (3)

| Tool | What it does |
|------|--------------|
| `get_region_info` | Display name and bounding box for a region code. |
| `get_sub_regions` | Immediate child regions of a parent (countries to states to counties). |
| `get_adjacent_regions` | Bordering regions (subnational2 only). |

## Region code glossary

- **Country**: 2-letter ISO codes: `US`, `CA`, `MX`, `GB`, `AU`...
- **Subnational1** (state/province): `<country>-<region>`: `US-WA`, `US-CA`, `CA-ON`...
- **Subnational2** (county/equivalent): `<country>-<region>-<county>`: `US-WA-009` (Clallam, WA), `US-CA-037` (Los Angeles, CA)...

Use `get_sub_regions` to discover codes when you only know names.

## Example prompts

After configuring, try:

- *What birds have been seen near Port Angeles, WA in the last week?*
- *Show me notable / rare sightings in Clallam County right now.*
- *Where are the best birding hotspots within 25 km of 48.118, -123.4307?*
- *What was seen at eBird checklist S987654321?*
- *Look up the eBird species code for "Pacific Wren".*
- *Find all subspecies of the Yellow-rumped Warbler.*
- *What counties border Clallam County (US-WA-009)?*

## License

MIT. See the root [LICENSE](https://github.com/andrewschristison/pondlog).
