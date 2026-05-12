# @pondlog/source-usgs

USGS Water Services (NWIS) API client. Typed, Zod-validated, politely
rate-limited. Returns `Result<T>` instead of throwing.

Base URL: `https://waterservices.usgs.gov/nwis/`. No API key required.

Part of [pondlog](https://github.com/andrewschristison/pondlog).

## Install

```sh
npm install @pondlog/source-usgs
```

## Functions

| Function | Description |
|---|---|
| `getInstantaneousValues({ sites, parameterCodes?, period? })` | Real-time gauge readings (typically 15-min cadence). Defaults to discharge + gage height for the last 2 hours. |
| `getDailyValues({ sites, parameterCodes?, period?, startDt?, endDt?, statisticCodes? })` | Daily statistics. Use `period` for relative-to-now or `startDt`/`endDt` for historic. Defaults to discharge mean for the last 7 days. |
| `getSiteInfo({ siteNumber })` | Site metadata (name, coordinates, HUC, state, altitude). |
| `searchSites({ bbox?, stateCode?, hucCode?, siteType?, hasDataTypeCode? })` | Find sites by bounding box, US state, or hydrologic unit. Default `siteType: "ST"` (streams) and `hasDataTypeCode: "iv"` (live data). |

All functions return `Result<T>` from `@pondlog/core`.

## Helpers

- `bboxAround(coords, radiusKm)`: square bbox tuple around a point, ready for `searchSites({ bbox })`.
- `PARAMETER_CODES`: common USGS parameter constants (`DISCHARGE`, `GAGE_HEIGHT`, `WATER_TEMP_C`).

## Parameter codes (the ones you almost always want)

| Code  | Meaning                              | Unit    |
|-------|--------------------------------------|---------|
| 00060 | Discharge / streamflow               | ft³/s   |
| 00065 | Gage height                          | ft      |
| 00010 | Water temperature                    | °C      |

## Notes

- `/iv/` (instantaneous) does **not** accept historic `startDT`/`endDT`. It
  returns HTTP 301. Use `period` (relative-to-now) for /iv/, or `getDailyValues`
  for historic data.
- Unknown sites return HTTP 200 with `timeSeries: []` rather than an error. The
  client surfaces this as `ok: true` with an empty array.
- USGS encodes "no value" as `-999999.0`. The client translates this to
  `undefined` so consumers never see the sentinel.
- `/site/` only returns RDB (tab-delimited); JSON is unsupported. The client
  parses RDB internally and returns normalized objects.
- Rate limiter: 1 req/sec sustained, bursts up to 5. USGS doesn't publish a
  documented limit; we're polite by default.

## License

MIT.
