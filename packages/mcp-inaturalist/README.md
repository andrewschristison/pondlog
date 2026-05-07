# @pondlog/mcp-inaturalist

A place-aware [iNaturalist](https://www.inaturalist.org) MCP server. Gives any
MCP-aware AI client (Claude Desktop, Cursor, Continue, custom agents) nine
tools for searching observations, species counts, taxa, places, and top
observers anywhere in the world. No API key required — iNaturalist reads
are open. Rate-limited internally to stay within iNat's 100 req/min budget.

Part of [pondlog](https://github.com/andrewchristison/pondlog) — a
toolkit for stitching together public nature APIs (iNaturalist, eBird,
USGS, NPN, NOAA, SunCalc).

## Install / run

The server is published to npm and runs via `npx` — no install step.

```sh
npx -y @pondlog/mcp-inaturalist
```

It speaks MCP over stdio.

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. The nine tools will appear in the slash menu.

### Cursor

Edit `~/.cursor/mcp.json`:

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

### MCP Inspector (debug)

```sh
npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-inaturalist
```

## Tools

All tools are read-only. None require auth. Coordinates use WGS84 decimal
degrees.

| Tool | What it does |
|------|-------------|
| `search_observations` | Search observations with filters (geo radius, taxon, iconic group, date range, quality grade). |
| `get_observation` | Fetch a single observation by ID with photos and full detail. |
| `get_species_counts` | Per-species observation counts for a geo + temporal query. |
| `search_taxa` | Search the iNat taxonomy by common or scientific name. |
| `get_taxon` | Fetch one taxon by ID with ancestry, Wikipedia URL, observation count. |
| `get_nearby_observations` | Convenience: recent observations near coords (default 25 km / 7 days). |
| `get_iconic_taxa_summary` | Group counts and top species by iconic taxa group at a location. |
| `search_places` | Look up an iNat place (park, county, country) by name to get its `place_id`. |
| `get_observers` | Top observers for a geo + temporal query. |

### Iconic taxa glossary

`Aves` = birds · `Amphibia` = frogs/salamanders · `Mammalia` = mammals ·
`Reptilia` = reptiles · `Insecta` = insects · `Arachnida` = spiders ·
`Mollusca` = snails/octopuses · `Plantae` = plants · `Fungi` = fungi/lichens ·
`Actinopterygii` = ray-finned fish.

## Example prompts

After configuring, try:

- *What amphibians have been seen near Port Angeles, WA in the last week?*
- *Show me the top 10 birds reported around Olympic National Park this month.*
- *What's the most-observed plant in Clallam County right now?*
- *Find the iNaturalist taxon ID for Pacific chorus frog.*
- *Who are the most active observers in Sequim, WA over the last 30 days?*

## License

MIT — see the root [LICENSE](https://github.com/andrewchristison/pondlog).
