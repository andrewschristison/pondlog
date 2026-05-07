# @pondlog/source-inaturalist

[iNaturalist](https://www.inaturalist.org) API client. Typed,
Zod-validated, rate-limited, returns `Result<T>` instead of throwing.
Part of [pondlog](https://github.com/andrewschristison/pondlog).

No API key required — iNaturalist reads are open. The library handles
the 100 req/min rate limit internally and backs off on 429.

## Install

```sh
npm install @pondlog/source-inaturalist @pondlog/core
```

## Functions

| Function | Endpoint | Returns |
|---|---|---|
| `searchObservations(params)` | `GET /observations` | `Result<Observation[]>` |
| `getObservation(id)` | `GET /observations/{id}` | `Result<ObservationDetail>` |
| `getSpeciesCounts(params)` | `GET /observations/species_counts` | `Result<SpeciesCount[]>` |
| `getNearbyObservations(coords, radius?, days?)` | `GET /observations` (geo) | `Result<Observation[]>` |
| `searchTaxa(query)` | `GET /taxa` | `Result<Taxon[]>` |
| `getTaxon(id)` | `GET /taxa/{id}` | `Result<TaxonDetail>` |
| `getIconicTaxaSummary(coords, radius?, days?)` | `GET /observations/species_counts` (grouped) | `Result<IconicTaxaSummary>` |
| `searchPlaces(query)` | `GET /places/autocomplete` | `Result<Place[]>` |
| `getObservers(coords, radius?, days?)` | `GET /observations/observers` | `Result<Observer[]>` |

Defaults: `radius = 25 km`, `days = 7`.

## Example

```ts
import { getNearbyObservations } from "@pondlog/source-inaturalist";

const result = await getNearbyObservations(
  { lat: 48.118, lng: -123.4307 }, // Port Angeles, WA
  25,                               // km
  7,                                // days
);

if (!result.ok) {
  console.error(result.error.message);
  process.exit(1);
}

for (const obs of result.data) {
  console.log(obs.commonName, obs.taxonName, obs.observedAt);
}
```

## Companion packages

- **CLI**: [`pondlog`](https://www.npmjs.com/package/pondlog) wraps
  these functions in a terminal interface.
- **MCP**: [`@pondlog/mcp-inaturalist`](https://www.npmjs.com/package/@pondlog/mcp-inaturalist)
  exposes them as MCP tools for AI agents.

## License

MIT.
