# @pondlog/core

Shared types, schemas, and utilities for the [pondlog](https://github.com/andrewschristison/pondlog)
monorepo. Used by every source client (`@pondlog/source-*`), the
`pondlog` CLI, and every MCP server.

This package makes no API calls. It's all types and pure utilities.

## Install

```sh
npm install @pondlog/core
```

## What's inside

- **Types**: `Coordinates`, `DateRange`, `Observation`, `SpeciesCount`,
  `IconicTaxaSummary`, `Place`, `Observer`, `Taxon`, `TaxonDetail`,
  `ObservationDetail`, `NatureBriefing`.
- **`Result<T>`**: discriminated union for "ok or error" without throwing.
  Helpers: `ok(data)`, `err(error)`.
- **`RateLimiter`**: token-bucket limiter. Configure with `maxTokens`,
  `refillRate`, `refillIntervalMs`. `await limiter.acquire()` blocks
  until a token is available; never throws.
- **`withRetry(fn, opts?)`**: exponential backoff with custom retry
  predicate (`shouldRetry`). Defaults: 3 attempts, 1s base delay.
- **Coordinate utilities**: `validateCoordinates`,
  `parseLatLngString` (handles iNat's `"lat,lng"` format).
- **`PONDLOG_USER_AGENT`**: canonical user-agent string for every HTTP
  request from a pondlog source client.
- **Garden data**: USDA hardiness zones (PRISM 2023, 40,283 ZIP centroids),
  the ~1000-crop frost-anchored planting calendar (climate-aware),
  and the companion-planting graph. All offline, loaded from bundled
  JSON with Zod validation at module load.

## Example

```ts
import { ok, err, RateLimiter, type Result } from "@pondlog/core";

const limiter = new RateLimiter({
  maxTokens: 100,
  refillRate: 100,
  refillIntervalMs: 60_000,
});

async function fetchSomething(url: string): Promise<Result<unknown>> {
  await limiter.acquire();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "myapp/1.0" },
    });
    return ok(await res.json());
  } catch (cause) {
    return err({ source: "myapp", message: String(cause), cause });
  }
}
```

## License

MIT.
