# @pondlog/mcp-npn

A place-aware [USA National Phenology Network](https://www.usanpn.org/)
MCP server. Gives any MCP-aware AI client (Claude Desktop, Cursor,
Continue, custom agents) **eight tools** for plant and animal phenology
data: species catalog, stations, observations, site-level phenometrics,
and a place-aware "what's active near me" shortcut.

**No API key required.** NPN is a public scientific dataset.

Part of [pondlog](https://github.com/andrewschristison/pondlog), a
toolkit for stitching together public nature APIs (iNaturalist, eBird,
USGS, NPN, NOAA, SunCalc).

## What is phenology?

Phenology is the seasonal timing of biological events: first leaf, first
bloom, first call, first migration. NPN volunteers and scientists
record these events at thousands of stations across the US, building a
multi-decade dataset used for tracking climate change, planning
restoration, and understanding regional ecology.

## Install / run

The server is published to npm and runs via `npx` (no install step):

```sh
npx -y @pondlog/mcp-npn
```

It speaks MCP over stdio. The server is internally rate-limited (1
req/sec sustained, bursts to 5). Be polite; NPN doesn't publish a
formal limit.

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pondlog-npn": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-npn"]
    }
  }
}
```

Restart Claude Desktop. The eight tools will appear in the slash menu.

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pondlog-npn": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-npn"]
    }
  }
}
```

### MCP Inspector (debug)

```sh
npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-npn
```

## Tools

All tools are read-only. Coordinates use WGS84 decimal degrees. State
codes are 2-letter US postal codes (`WA`, `CA`, `NY`).

| Tool | What it does |
|------|--------------|
| `search_species` | Filter the ~1,900-species NPN catalog by name, genus, or kingdom. Returns NPN species_ids you can pass to other tools. |
| `get_stations_in_state` | List NPN stations in a US state. Returns station_ids, names, coordinates. |
| `get_station_count_by_state` | Quick map of NPN coverage: how many stations per state. |
| `get_stations_with_species` | Find stations that have observed specific species. |
| `get_stations_by_location` | Stations inside a WKT polygon. Use `get_active_phenology_nearby` for the lat/lng/radius shortcut. |
| `get_observations` | Raw status/intensity records (was phenophase 'yes'/'no' on date). Requires year + ≥1 narrowing filter. Bandwidth-heavy. |
| `get_site_level_data` | Per-site phenometric aggregates: mean first/last 'yes' date for each (site, species, phenophase). Best granularity for "when does X bloom here?" |
| `get_active_phenology_nearby` | Place-aware shortcut: WKT bbox, stations, haversine, site-level data, sorted by most-recent activity. The headline tool. |

## Key gotchas

- **Coverage is patchy.** Eastern US and Arizona are dense; the Pacific Northwest is sparser. Use `get_station_count_by_state` first if you're not sure.
- **NPN stations are species-specific.** A station near you might track only invasive plants or only bird arrivals. Cross-reference with `get_stations_with_species`.
- **Data lags by a year.** Phenometric records for the most recent year are still being ingested. Default `years_back: 2` to surface complete data.
- **`-9999` is NPN's null sentinel.** Tools translate this to `undefined` so you never see it in responses.
- **Species_id=3 (red maple) returns empty.** Known upstream NPN bug. The tool handles it gracefully (empty arrays, not errors).

## Example prompts

After configuring, try:

- *What phenology has been recorded near Port Angeles, WA over the last five years?*
- *Find all NPN stations in Arizona that observe saguaro cactus.*
- *Look up the NPN species ID for "mayapple".*
- *When do magnolias typically bloom in Washington state?*
- *Which states have the most NPN stations?*
- *Get all 2024 phenometric records for Acer rubrum (red maple) in WA.*

## Notes for AI agents

- For "what's blooming near me?" call `get_active_phenology_nearby` first. It composes the multi-step lookup (WKT, stations, site-level data) so you don't have to.
- For "when does X bloom in region Y?" use `get_site_level_data` with state filter. Returns mean first/last yes dates per phenophase.
- Avoid calling `get_observations` without species filtering. Single station-year results can be 80+ MB.
- All tools return the same `Result<T>`-style envelope. Success returns `{ ok: true, data }`; error returns `isError: true` with structured `{ ok: false, error: { source, message, statusCode? } }`.

## License

MIT. See the root [LICENSE](https://github.com/andrewschristison/pondlog).
