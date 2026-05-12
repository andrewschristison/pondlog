# @pondlog/source-npn

USA National Phenology Network (NPN) Portal API client. Typed, Zod-validated,
politely rate-limited. Returns `Result<T>` instead of throwing.

Base URL: `https://services.usanpn.org/npn_portal/`. No API key required.

Part of [pondlog](https://github.com/andrewschristison/pondlog).

## Install

```sh
npm install @pondlog/source-npn
```

## Functions

| Function | Description |
|---|---|
| `getSpecies()` | Full NPN species catalog (~1900 records). |
| `getStations({ stateCode? })` | All NPN stations, optionally filtered by US state postal code. Recommend a state filter; unfiltered is ≈ 50k stations. |
| `getStationCountByState()` | Station count per US state. |
| `getStationsWithSpecies({ speciesIds })` | Stations that have observed any of the given species. |
| `getStationsByLocation({ wkt })` | Stations inside a WKT polygon. Use `bboxWkt(coords, radiusKm)` to construct one from lat/lng. |
| `getObservations({ years, ... })` | Status / intensity records. **Requires** `years[]` and ≥ 1 narrowing filter (species/station/state/etc). |
| `getSiteLevelData({ years, ... })` | Site-level phenometric records. Same narrowing rule as `getObservations`. |
| `getActivePhenologyNearby({ coords, radiusKm, days? })` | Composed helper. Builds a WKT bbox, fetches stations, haversine-filters to true radius, fetches observations, returns ones with `phenophaseStatus === 1` in the last `days` days. |

All functions return `Result<T>` from `@pondlog/core`.

## Helpers

- `bboxWkt(coords, radiusKm)`: WGS84 bounding-box polygon as WKT, ready for `getStationsByLocation`.
- `haversineKm(a, b)`: great-circle distance in km.

## Notes

- NPN encodes "no value" as the integer `-9999` across many fields. Normalizers
  translate this to `undefined` so consumers never see the sentinel.
- Rate limiter: 1 req/sec sustained, bursts up to 5. NPN doesn't publish a
  formal limit; this is the polite default.
- Default request timeout is 60 seconds. Some NPN payloads (e.g. saguaro
  observations across all years) run into tens of MB.
- NPN's spatial model is WKT polygons, not lat/lng/radius. The
  `getActivePhenologyNearby` helper composes the round-trip so callers don't
  have to learn WKT.

## License

MIT.
