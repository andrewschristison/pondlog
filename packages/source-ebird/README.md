# @pondlog/source-ebird

[eBird API v2](https://documenter.getpostman.com/view/664302/S1ENwy59) client.
Typed, Zod-validated, rate-limited, returns `Result<T>` instead of throwing.
**100% endpoint coverage — all 21 documented endpoints.**
Part of [pondlog](https://github.com/andrewschristison/pondlog).

## Setup

eBird requires a free API key. Request one at
[ebird.org/api/keygen](https://ebird.org/api/keygen) and export it:

```sh
export EBIRD_API_KEY=your-key-here
```

If the key is missing, every fetch returns a `Result` error with a clear
message. Call `assertEbirdApiKey()` at app startup to fail loudly before
issuing any requests.

The library handles the ~100 req/min rate limit internally and backs off
on 429 with exponential retry.

## Install

```sh
npm install @pondlog/source-ebird @pondlog/core
```

## Endpoints

### Observations (7)

| Function | Endpoint |
|---|---|
| `getRecentObservations(regionCode, params?)` | `GET /data/obs/{regionCode}/recent` |
| `getRecentNotable(regionCode, params?)` | `GET /data/obs/{regionCode}/recent/notable` |
| `getRecentOfSpecies(regionCode, speciesCode, params?)` | `GET /data/obs/{regionCode}/recent/{speciesCode}` |
| `getNearbyRecent(lat, lng, params?)` | `GET /data/obs/geo/recent` |
| `getNearbyNotable(lat, lng, params?)` | `GET /data/obs/geo/recent/notable` |
| `getNearbyOfSpecies(lat, lng, speciesCode, params?)` | `GET /data/obs/geo/recent/{speciesCode}` |
| `getHistoricOnDate(regionCode, year, month, day, params?)` | `GET /data/obs/{regionCode}/historic/{y}/{m}/{d}` |

### Product (3)

| Function | Endpoint |
|---|---|
| `getRecentChecklists(regionCode, params?)` | `GET /product/lists/{regionCode}` |
| `getTop100(regionCode, year, month, day, params?)` | `GET /product/top100/{regionCode}/{y}/{m}/{d}` |
| `getChecklist(subId)` | `GET /product/checklist/view/{subId}` |

### Hotspots (3)

| Function | Endpoint |
|---|---|
| `getHotspotsInRegion(regionCode, params?)` | `GET /ref/hotspot/{regionCode}` |
| `getNearbyHotspots(lat, lng, params?)` | `GET /ref/hotspot/geo` |
| `getHotspotInfo(locId)` | `GET /ref/hotspot/info/{locId}` |

### Taxonomy (5)

| Function | Endpoint |
|---|---|
| `getTaxonomy(params?)` | `GET /ref/taxonomy/ebird` (always `fmt=json`) |
| `getTaxonomicForms(speciesCode)` | `GET /ref/taxonomy/forms/{speciesCode}` |
| `getTaxaLocales()` | `GET /ref/taxonomy/locales` |
| `getTaxonomyVersions()` | `GET /ref/taxonomy/versions` |
| `getTaxonomicGroups(grouping, params?)` | `GET /ref/sppgroup/{grouping}` |

### Regions (3)

| Function | Endpoint |
|---|---|
| `getRegionInfo(regionCode, params?)` | `GET /ref/region/info/{regionCode}` |
| `getSubRegions(regionType, parentRegionCode)` | `GET /ref/region/list/{regionType}/{parentRegionCode}` |
| `getAdjacentRegions(regionCode)` | `GET /ref/adjacent/{regionCode}` (subnational2 only) |

### Normalized convenience

For endpoints that return shapes mappable to `@pondlog/core` shared types,
`*Normalized` variants return `Observation[]` / `Place[]` / `Taxon[]`:

- `getNearbyRecentNormalized`, `getNearbyNotableNormalized`
- `getHotspotsInRegionNormalized`, `getNearbyHotspotsNormalized`, `getHotspotInfoNormalized`
- `getTaxonomyNormalized`

All normalized observations get `iconicTaxon: "Aves"` (eBird is birds-only).

## Example

```ts
import { getNearbyRecent, getHotspotsInRegion } from "@pondlog/source-ebird";

const obs = await getNearbyRecent(48.118, -123.4307, { dist: 25, back: 7 });
if (obs.ok) {
  for (const o of obs.data) {
    console.log(o.comName, o.howMany ?? "?", "@", o.locName);
  }
}

const hotspots = await getHotspotsInRegion("US-WA-009"); // Clallam County
if (hotspots.ok) {
  console.log(`${hotspots.data.length} hotspots`);
}
```

## Region codes

eBird uses hierarchical region codes:
- Country: `US`
- Subnational1 (state/province): `US-WA`
- Subnational2 (county): `US-WA-009` (Clallam County)

## Rate limits

The eBird API rate limit is undocumented; this client throttles at 100
req/min and retries on 429 with exponential backoff (1s, 2s, 4s, max 3
attempts).

## License

MIT — Andrew Christison
