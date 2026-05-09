# @pondlog/source-trefle

Typed, Zod-validated, rate-limited TypeScript client for the
[Trefle.io](https://trefle.io) plant database API. All functions return
`Result<T>`, never throw.

Part of [pondlog](https://github.com/andrewschristison/pondlog).

## Scope

Trefle is the **taxonomy** layer of pondlog's garden surface. It supplies:

- common name ↔ scientific name resolution
- genus / family / synonyms
- light, soil pH, atmospheric humidity, image URLs (when populated)

It does **not** supply planting timing — Trefle's `growth.days_to_harvest`,
`growth.sowing`, and `growth.minimum_temperature` fields are universally
null for cultivated vegetables (verified live in May 2026). The 500-crop
planting calendar in `@pondlog/core` covers planning logic.

## Install

```sh
pnpm add @pondlog/source-trefle
```

## Usage

```typescript
import { searchPlants, getGrowingGuide, hasTrefleToken } from "@pondlog/source-trefle";

// Required: TREFLE_API_TOKEN env var.
// Free token at https://trefle.io/users/sign_up

const r = await searchPlants({ commonNameExact: "tomato" });
if (r.ok) {
  console.log(r.data.plants.map((p) => p.scientific_name));
}

const guide = await getGrowingGuide("solanum-lycopersicum");
if (guide.ok) {
  console.log(guide.data.light, guide.data.phMin, guide.data.phMax);
}

if (!hasTrefleToken()) {
  // Aggregate paths can silently skip Trefle when no token is set.
}
```

## Functions

| Function | Purpose |
|----------|---------|
| `searchPlants(params)` | Search by common name, family, genus, or free-text |
| `getPlant(slugOrId)` | Full detail for a single plant |
| `searchSpecies(params)` | Like `searchPlants` but at the species level |
| `getGrowingGuide(slugOrId)` | Flat gardener-friendly summary of available growth fields |
| `hasTrefleToken()` | Boolean: is `TREFLE_API_TOKEN` set? |

## Reliability notes

Trefle is in beta. The `q=` full-text search matches noisily across author
and bibliography fields — prefer `commonNameExact` for precision. Trefle
search endpoints have returned 5xx errors on its public issue tracker
(2025); this client retries transient 5xx with backoff.

## License

MIT.
