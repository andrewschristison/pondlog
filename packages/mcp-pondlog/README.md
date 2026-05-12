# @pondlog/mcp-pondlog

The aggregate nature MCP server. **One tool call replaces six API
integrations.**

`get_nature_briefing` returns a unified briefing for any coordinates:
recent wildlife from iNaturalist and eBird, tide predictions from NOAA,
streamflow from USGS, plant phenology from USA-NPN, and a full night-sky
briefing (sun, moon, planets, meteor showers, constellations) from
astronomy-engine, stitched into a single JSON response. All six sources
are fetched in parallel; partial failures are reported in `errors[]`
without crashing the briefing.

Part of [pondlog](https://github.com/andrewschristison/pondlog), a
toolkit for stitching together public nature APIs.

## Install / run

The server is published to npm and runs via `npx` (no install step):

```sh
npx -y @pondlog/mcp-pondlog
```

Speaks MCP over stdio.

## Configure

All env vars are optional. Without them you still get iNaturalist,
night-sky, and (for `get_phenology`) NPN phenology. eBird/NOAA/USGS
sections are skipped gracefully when their key/station is unset.

| Env var | What it enables | Required? | How to get one |
|---------|----------------|-----------|----------------|
| `EBIRD_API_KEY` | eBird observations in the briefing | Optional | Free at [ebird.org/api/keygen](https://ebird.org/api/keygen) |
| `NOAA_STATION` | Tide predictions (6 to 8 digit station id) | Optional | Look up at [tidesandcurrents.noaa.gov](https://tidesandcurrents.noaa.gov) |
| `USGS_SITE` | Streamflow (8 to 15 digit site number) | Optional | Look up at [waterdata.usgs.gov](https://waterdata.usgs.gov) |

`noaa_station`, `usgs_site`, and `ebird_api_key` can also be passed per
call as tool inputs. That takes precedence over the env vars.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pondlog": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-pondlog"],
      "env": {
        "EBIRD_API_KEY": "your-ebird-key",
        "NOAA_STATION": "9444090",
        "USGS_SITE": "12045500"
      }
    }
  }
}
```

Restart Claude Desktop. Five tools will appear in the slash menu.

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pondlog": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-pondlog"],
      "env": {
        "EBIRD_API_KEY": "your-ebird-key",
        "NOAA_STATION": "9444090",
        "USGS_SITE": "12045500"
      }
    }
  }
}
```

### MCP Inspector (debug)

```sh
EBIRD_API_KEY=your-key npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-pondlog
```

## Tools

All tools are read-only. Coordinates use WGS84 decimal degrees.

| Tool | What it does | Sources |
|------|-------------|---------|
| `get_nature_briefing` | Full unified briefing (the headline tool). | iNaturalist + eBird + NOAA + USGS + NPN + astronomy-engine |
| `get_nearby_wildlife` | Recent wildlife sightings, merged + chronologically sorted. | iNaturalist + eBird |
| `get_water_conditions` | Streamflow + tide predictions, both keys always present. | USGS + NOAA |
| `get_tonight_sky` | Sun, moon, planets, meteor showers, dark-sky window, constellations. | astronomy-engine (pure local computation) |
| `get_phenology` | What's blooming / leafing out near you. | USA-NPN |

### Per-source tools

For finer-grained queries against a single source, prefer the standalone
servers in the same monorepo:

- [`@pondlog/mcp-inaturalist`](https://github.com/andrewschristison/pondlog/tree/main/packages/mcp-inaturalist): 9 tools, no key required
- [`@pondlog/mcp-ebird`](https://github.com/andrewschristison/pondlog/tree/main/packages/mcp-ebird): 21 tools, free key
- [`@pondlog/mcp-npn`](https://github.com/andrewschristison/pondlog/tree/main/packages/mcp-npn): phenology
- [`@pondlog/mcp-usgs`](https://github.com/andrewschristison/pondlog/tree/main/packages/mcp-usgs): water data
- [`@pondlog/mcp-mushroomobserver`](https://github.com/andrewschristison/pondlog/tree/main/packages/mcp-mushroomobserver): fungi
- [`@pondlog/mcp-garden`](https://github.com/andrewschristison/pondlog/tree/main/packages/mcp-garden): garden planning

## Example prompts

After configuring, try:

- *What's happening in nature near Port Angeles, WA today?*
- *Any notable bird sightings near Olympic National Park this week?*
- *What are the tides and streamflow like today?*
- *What should I look at in the sky tonight at 48.118, -123.4307?*
- *What's blooming near Seattle right now?*

## Output shape

`get_nature_briefing` returns a `NatureBriefing` (defined in
`@pondlog/core`):

```ts
{
  coordinates: { lat, lng },
  generatedAt: string,                  // ISO timestamp
  celestial: { sunrise, sunset, daylightHours, moonPhase, moonIllumination },
  nightSky?: NightSkyBriefing,          // full sky briefing when present
  tides?: { high: TideEvent[], low: TideEvent[] },
  recentObservations: Observation[],    // iNat + eBird, sorted by date desc
  speciesCounts: SpeciesCount[],        // reserved for future use
  streamflow?: StreamflowReading,
  phenology?: PhenologyEntry[],
  errors: { source: string, message: string }[]
}
```

## Caveats

- `ebird_api_key` passed as a tool input is implemented by temporarily
  setting `process.env.EBIRD_API_KEY` for the duration of that call.
  Stdio MCP processes JSON-RPC sequentially in practice, so this is
  fine, but in shared deployments prefer the env-var path.
- No caching at the MCP layer. Each `get_nature_briefing` call fetches
  fresh from all six sources. If you want caching, the host (Claude
  Desktop, Cursor, an agent) is the right place to add it. Cold call at
  Port Angeles takes ~2.5 s.

## License

MIT. See the root [LICENSE](https://github.com/andrewschristison/pondlog).
