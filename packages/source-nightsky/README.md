# @pondlog/source-nightsky

Place-aware night-sky briefing for any latitude/longitude on Earth. Sun
times, moon phase, planet positions, twilight windows, meteor showers,
and constellation visibility — curated, not raw catalogs.

Pure local computation. No API calls, no rate limits, no API key. Built
on top of [`astronomy-engine`](https://github.com/cosinekitty/astronomy)
(±1 arcminute accuracy) plus curated meteor-shower and constellation
fixtures.

Part of [pondlog](https://github.com/andrewschristison/pondlog).

## Install

```sh
npm install @pondlog/source-nightsky
```

Requires Node 18+.

## Quick example

```ts
import { getTonightsBriefing } from "@pondlog/source-nightsky";

const result = getTonightsBriefing({
  coords: { lat: 48.118, lng: -123.4307 }, // Port Angeles, WA
});

if (!result.ok) {
  console.error(result.error.message);
  process.exit(1);
}

const b = result.data;
console.log(b.highlight);
// → "🌒 Waxing Crescent, sky excellent · planets: Saturn ESE, Uranus ENE
//    · Perseids peaking tonight · Cygnus overhead"
```

## API

Every function returns `Result<T>` (never throws).

| Function | Inputs | Returns |
|---|---|---|
| `getTonightsBriefing` | `{ coords, date? }` | Curated full briefing — sun, moon, dark-sky window, visible planets, active showers, top constellations, one-line highlight |
| `getSunTimes` | `{ coords, date? }` | sunrise/sunset/solar noon, civil/nautical/astronomical dawn & dusk, golden hour |
| `getMoonPhase` | `{ coords?, date? }` | phase name, emoji, illumination %, age in days, rise/set (when coords provided) |
| `getPlanetPositions` | `{ coords, date? }` | 7 planets with magnitude, alt/az, compass direction, rise/set, `isVisible` flag |
| `getActiveMeteorShowers` | `{ date?, upcomingDays? }` | active showers (with days-to-peak, ZHR, moon interference) and upcoming peaks |
| `getDarkSkyWindow` | `{ coords, date? }` | astronomical dark window (sun ≤ -18°), 1–5 quality score, moon altitude/illumination at midpoint |
| `getVisibleConstellations` | `{ coords, date? }` | constellations currently above 15°, ranked in-season first then by altitude |

### Helpers

- `azimuthToCompass(azimuthDeg)` — 16-point compass label.
- `phaseNameFromAngle(angleDeg)` / `emojiFromPhase(phaseName)` — moon phase utilities.
- `scoreDarkSky({ hasAstronomicalDark, moonIlluminationFraction, moonAltitudeDeg })` — the 1–5 quality function used by `getDarkSkyWindow`.
- `moonInterferenceLevel(illuminationFraction)` — `"none" | "low" | "moderate" | "high"`.

### Visibility filter

A planet is `isVisible` when:
- Sun altitude ≤ -6° (at least civil twilight), AND
- Planet altitude > 5° (above atmospheric haze), AND
- Apparent magnitude ≤ 6.0 (naked-eye limit at a dark site).

Mercury frequently fails the 5° altitude gate — that's the geometry, not a bug.

### Dark-sky quality (1–5)

The score weights moon illumination by altitude: a full moon on the horizon contributes less light than a half-moon overhead. Astronomical dark (sun ≤ -18°) is the baseline ceiling.

| Score | Label | Typical conditions |
|---|---|---|
| 5 ★ | Excellent | Astronomical dark, moon below horizon or new |
| 4 ★ | Good | Astronomical dark, moon up but quarter-or-less |
| 3 ★ | Fair | Nautical-only twilight (high latitude / midsummer) OR gibbous moon during dark |
| 2 ★ | Poor | Bright moon high overhead during dark window |
| 1 ★ | Bright | Full moon overhead, or no dark of any kind with moonlight |

### Date semantics

The `date` parameter is the *reference moment* for the calculation. The
briefing's planet/constellation snapshot uses the **midpoint of
astronomical dark** following the reference time — that's when stargazers
are actually out — falling back to the midpoint between sunset and
sunrise if there's no astronomical dark, or to the input itself at the
extreme high latitudes where neither happens.

All times in the response are UTC ISO 8601. Consumers handle local
display.

## Data fixtures

- **Meteor showers** (`src/data/meteor-showers.json`) — 12 IMO-recognized annual showers (Quadrantids, Lyrids, Eta Aquariids, Perseids, Orionids, Taurids north & south, Leonids, Geminids, Ursids, Southern Delta Aquariids, Draconids).
- **Constellations** (`src/data/constellations.json`) — 25 high-recognition constellations with hemisphere, best months, notable named stars, and one-line descriptions.

Both fixtures are bundled into the published JS — no runtime file IO.

## What's NOT here

- ISS / satellite passes — needs N2YO or similar; deferred.
- Cloud cover — that's NOAA territory; pondlog wires it in at the aggregate layer.
- Star catalogs / deep-sky objects — out of scope; this library curates "what to look at tonight," not raw ephemeris.

## License

MIT.
