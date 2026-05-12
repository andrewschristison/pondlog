# @pondlog/mcp-mushroomobserver

The first dedicated [Mushroom Observer](https://mushroomobserver.org/) MCP server. Gives any MCP-aware AI client (Claude Desktop, Cursor, Continue, custom agents) **five tools** for fungal observations, mycology taxonomy, and region discovery from the largest dedicated mycology platform (500,000+ observations with vote-weighted ID confidence scores).

**No API key required.** Mushroom Observer is a public scientific community platform.

Part of [pondlog](https://github.com/andrewschristison/pondlog), a toolkit for stitching together public nature APIs (iNaturalist, eBird, USGS, NPN, NOAA, SunCalc, Mushroom Observer).

## What is Mushroom Observer?

Mushroom Observer is a community of mycologists, mushroom hunters, and scientists who document fungal observations with photos and vote-weighted identification confidence. Unlike a generic biodiversity platform, MO is mycology-first: its taxonomy, voting system, and geography are designed around fungi.

## Install / run

The server is published to npm and runs via `npx` (no install step):

```sh
npx -y @pondlog/mcp-mushroomobserver
```

It speaks MCP over stdio. The server is internally rate-limited to 20 req/min (1 every 3 s) to respect Mushroom Observer's posted limits.

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pondlog-mushroomobserver": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-mushroomobserver"]
    }
  }
}
```

Restart Claude Desktop. The five tools will appear in the slash menu.

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pondlog-mushroomobserver": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-mushroomobserver"]
    }
  }
}
```

### MCP Inspector (debug)

```sh
npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-mushroomobserver
```

## Tools

All tools are read-only. Coordinates use WGS84 decimal degrees. Region strings use Mushroom Observer's "City, County, State, Country" suffix model.

| Tool | What it does |
|------|--------------|
| `get_recent_fungi` | The headline tool. "What's fruiting near here in the last N days?" Accepts coords+radius OR region suffix. |
| `search_observations` | Rich filters: bbox, region, taxon name, date range, has-images, confidence threshold. |
| `get_observation` | Single observation, high detail: namings, votes, full image set, comments. |
| `search_fungal_names` | Substring search over MO's 100,000+ fungal name index, with rank filter. |
| `search_regions` | Discover MO's location-name suffixes (e.g. "Olympic National Park, Clallam Co., Washington, USA"). |

## Key gotchas

- **Mushroom Observer's `/locations` endpoint has no name filter.** Use `search_regions` (which scans observations and harvests unique location names) to discover well-formed suffixes.
- **Geography is suffix-based.** Region strings match "ends with X"; pass the most-specific tail you want. "Washington, USA" matches all of Washington; "Clallam Co., Washington, USA" matches just Clallam County.
- **Coverage is uneven.** Pacific Northwest, Northern California, the Northeast US, and Western Europe are dense. South America, Africa, and most of Asia are sparse.
- **Confidence is in [-3..3].** Vote-weighted across observers. 1.0+ is a reasonable filter for "agreed-upon ID"; 2.0+ is strong consensus; negative numbers mean the consensus name is disputed.
- **Some observations have hidden GPS** (`gps_hidden=true`). The tool still returns the location-name centroid in that case so the LLM has a reference point.

## Example prompts

After configuring, try:

- *What fungi have been observed near Port Angeles, Washington in the last 60 days?*
- *Find all chanterelle observations in Marin County, California with photos.*
- *Show me observation #187521 in detail.*
- *What's the difference between Cantharellus formosus and Cantharellus cibarius? Find recent examples of each.*
- *Where in Olympic National Park have mycologists observed Mycena haematopus?*

## Notes for AI agents

- For "what's fruiting near me?" call `get_recent_fungi` first. It pages through MO results internally and accepts either coords+radius or a region suffix.
- For "look up a name" use `search_fungal_names`. It returns the scientific name, author, classification, and a link to the MO name page.
- For broader region discovery use `search_regions` to enumerate location-name suffixes. This is the only path to discovering MO's geography programmatically.
- All tools return the same `Result<T>` envelope. Success returns `{ ok: true, data }`; error returns `isError: true` with `{ ok: false, error: { source, message, statusCode? } }`.

## License

MIT. See the root [LICENSE](https://github.com/andrewschristison/pondlog).
