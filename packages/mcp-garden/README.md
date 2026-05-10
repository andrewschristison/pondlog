# @pondlog/mcp-garden

Garden-planning MCP server for Claude Desktop, Cursor, and any
[Model Context Protocol](https://modelcontextprotocol.io) client.

Five tools backed by:

1. **A 1000-crop calendar** baked into the package (USDA Cooperative
   Extension sourced — vegetables, herbs, fruits, companion flowers, cover
   crops, with frost-anchored planting windows). Works fully offline.
2. **The PRISM 2023 USDA Plant Hardiness Zone Map** (40,283 ZIP centroids).
   Coordinate or ZIP → zone in milliseconds. Works offline.
3. **Trefle.io plant taxonomy** for botanical detail. Optional — set
   `TREFLE_API_TOKEN` to enable. Trefle is in beta; the calendar is the
   authoritative source for planting timing.

Part of [pondlog](https://github.com/andrewschristison/pondlog) — the
place-aware nature data layer.

## Install / run

```sh
npx -y @pondlog/mcp-garden
```

For Trefle taxonomy, set `TREFLE_API_TOKEN` (free at
[trefle.io](https://trefle.io/users/sign_up)). Without it the four
calendar/zone tools work; `search_plants` and `get_crop_details` fall back
to calendar-only.

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pondlog-garden": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-garden"],
      "env": { "TREFLE_API_TOKEN": "<optional>" }
    }
  }
}
```

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pondlog-garden": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-garden"]
    }
  }
}
```

### MCP Inspector (debug)

```sh
npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-garden
```

## Tools

| Tool | What it does |
|------|--------------|
| `get_hardiness_zone` | USDA zone + frost dates from lat/lng or ZIP. |
| `get_planting_plan` | What to plant in zone X on date Y, from the 1000-crop calendar. |
| `get_crop_details` | Calendar entry + Trefle botanical detail for a single crop. |
| `search_plants` | Search calendar + Trefle by name. Calendar matches first. |
| `get_crops_for_zone` | All crops whose zone range includes the given zone. |

## Example prompts

- *"What zone am I in if I'm at 48.118, -123.4307?"*
- *"What can I plant this week in zone 7b?"*
- *"Give me a planting schedule for zone 5a, May 15."*
- *"What perennial fruits grow in zone 4b?"*
- *"How long does kale take to mature?"*

## Data sources & licenses

- **USDA hardiness zones**: PRISM Climate Group / USDA-ARS 2023 Plant
  Hardiness Zone Map. Free to redistribute with attribution.
- **Crop calendar**: hand-curated from USDA Cooperative Extension
  publications, Washington State University Extension, Cornell Cooperative
  Extension, and The Old Farmer's Almanac. Conservative ranges; coastal
  and mountain microclimates may shift dates 2-3 weeks. Schema:
  `crop-calendar.schema.json` in `@pondlog/core` — community contributions
  welcome via PR.
- **Trefle.io**: third-party API in beta; data quality varies. Many
  growth fields are null for cultivated vegetables — the calendar is the
  authoritative planting source.

## License

MIT.
