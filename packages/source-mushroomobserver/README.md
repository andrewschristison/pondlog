# @pondlog/source-mushroomobserver

Mushroom Observer API2 client for the [pondlog](https://github.com/andrewschristison/pondlog) ecosystem. Typed, Zod-validated, and rate-limited (20 req/min). Returns `Result<T>` rather than throwing.

Mushroom Observer is the largest dedicated mycology platform, hosting 500,000+ fungal observations with vote-weighted ID confidence scores. This package is the data-fetch layer; CLI and MCP wrappers live in `pondlog` (the CLI) and `@pondlog/mcp-mushroomobserver`.

## Install

```sh
pnpm add @pondlog/source-mushroomobserver
```

## Functions

| Function | Returns |
|---|---|
| `searchObservations({ coords, radiusKm, region, name, dateFrom, dateTo, hasImages, confidenceMin, page })` | Observations matching at least one of: bbox, region suffix, taxon name, date window |
| `getObservation(id)` | Single observation with high-detail nested fields |
| `searchNames({ query, rank, includeSubtaxa, page })` | Fungal taxonomy via `text_name_has` substring match |
| `searchRegions({ query, maxPages })` | Discovers MO location-name strings ending in `query` (e.g. "Washington, USA") with observation counts |
| `getRecentNearLocation({ coords, radiusKm } \| { region }, days?, limit?, confidenceMin?)` | "What's fruiting near here in the last N days" |
| `getSpeciesCountByLocation({ coords, radiusKm } \| { region }, daysBack?, maxPages?)` | Species diversity at a location, ranked by observation count |
| `getLocationsInBbox(bbox)` | Direct `/locations` hit. Bbox is the ONLY MO-supported filter |

## Notes

- MO defaults to XML; the client appends `.json` to every path automatically.
- `/locations` exposes only bbox + ID filters. There is no name search. Use `searchRegions` to enumerate location-name strings instead.
- Spatial queries on `/observations` accept `north/south/east/west` lat/lng. Pondlog converts coords + radius to a bbox via `bboxAround`.
- Rate limit is 20 req/min (1 every 3 s). The client enforces this with a token bucket; bursts up to 3 are allowed.

## License

MIT.
