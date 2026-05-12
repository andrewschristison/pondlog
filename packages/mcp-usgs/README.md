# @pondlog/mcp-usgs

MCP server for [USGS Water Services](https://waterservices.usgs.gov/) (NWIS).
Four tools for real-time and historic streamflow data, plus site search and
metadata. No API key required.

Part of [pondlog](https://github.com/andrewschristison/pondlog).

## Install / run

```sh
npx -y @pondlog/mcp-usgs
```

## Configure

### Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pondlog-usgs": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-usgs"]
    }
  }
}
```

### Cursor
Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pondlog-usgs": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-usgs"]
    }
  }
}
```

### MCP Inspector (debug)

```sh
npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-usgs
```

## Tools

| Tool | What it does |
|------|--------------|
| `get_instantaneous_values` | Real-time discharge / gage height (default) over a relative period (PT2H, P1D, etc.) for one or more USGS sites. |
| `get_daily_values` | Daily statistics, either a relative window or explicit start/end dates. Use this for any historic query. |
| `get_site_info` | Single-site metadata: name, coordinates, HUC, state, county, altitude. |
| `search_sites` | Find active stream-gauge sites by lat/lng/radius_km or by US state. |

## Parameter codes

Common USGS codes: `00060` = streamflow / discharge (ft³/s); `00065` = gage
height (ft); `00010` = water temperature (°C). Full list:
<https://help.waterdata.usgs.gov/codes-and-parameters/parameters>.

## Example prompts

- *"What's the Elwha River doing right now? (USGS site 12045500)"*
- *"Find USGS gauges within 25 km of Port Angeles, WA, and show today's flow."*
- *"Pull daily mean streamflow for the Dungeness River from January 2024."*

## License

MIT.
