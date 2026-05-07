# Methodology — Pondlog

## API integration patterns

### 1. Rate limiting

Every source client wraps a shared rate limiter from `packages/core`.

```typescript
// packages/core/src/rate-limiter.ts
// Token bucket pattern. Each source gets its own bucket.
// Config: { maxTokens: 100, refillRate: 100, refillIntervalMs: 60_000 }
// On exhaust: wait until next refill, do NOT throw.
```

Never trust the caller to rate-limit. The source client handles it internally. If a 429 comes back despite our limiting, back off exponentially (1s, 2s, 4s) up to 3 retries, then fail.

### 2. Response validation

Every API response passes through a Zod schema before returning.

```typescript
// CORRECT — parse, don't assume
const parsed = ObservationSchema.safeParse(response);
if (!parsed.success) {
  return { ok: false, error: { source: 'inaturalist', message: parsed.error.message } };
}

// WRONG — never do this
const data = response as Observation;
```

If an API changes its response shape, we want a clear Zod error, not a silent undefined propagating downstream.

### 3. Result type

All source client functions return `Result<T>`, never throw.

```typescript
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { source: string; message: string; statusCode?: number } };
```

The CLI and MCP layers handle presentation of errors. The source library just reports what happened.

### 4. Coordinate normalization

All coordinates are `{ lat: number; lng: number }` — never strings, never "location" fields that need parsing. Source clients parse provider-specific formats internally (e.g., iNaturalist's "lat,lng" string).

### 5. User-Agent

Every HTTP request includes a descriptive User-Agent header:

```
pondlog/1.0.0 (https://github.com/andrewchristison/pondlog)
```

This is required by iNaturalist and good practice for all public APIs.

### 6. Caching strategy

For the CLI `pondlog today` command:
- **SunCalc data:** computed locally, no cache needed
- **Tide predictions:** cache 1 hour (tides are predictable)
- **Observations (iNat, eBird):** cache 15 minutes (fresh enough, avoids hammering)
- **Streamflow (USGS):** cache 15 minutes
- **Phenology (NPN):** cache 1 hour (changes slowly)

Cache location: `~/.pondlog/cache/` as JSON files with TTL metadata.

For MCP servers: no caching. Each tool call is fresh. The MCP client (Claude, etc.) handles its own context.

## Development standards

### Testing

- Every source client gets integration tests that hit the real API with Port Angeles coordinates
- Rate limit the test suite (don't run all sources in parallel)
- Vitest with `--run` for CI, `--watch` for dev
- Mock tests for Zod schema validation (unit tests don't need network)

### Package publishing

- Scope: `@pondlog/` for all packages
- Version: start at 0.1.0, semver from there
- Each MCP server includes a `server.json` per MCP Registry spec
- README per package with: description, install, config example, tool list, example prompts

### MCP server standards

- Use `@modelcontextprotocol/sdk` TypeScript SDK
- Every tool has: name, description, Zod input schema
- Tool descriptions are written for LLMs — clear, specific, include example values
- Bad tool description: "Search observations"
- Good tool description: "Search iNaturalist observations near a location. Returns recent wildlife sightings including species name, observer, date, and coordinates. Use iconic_taxa to filter by group (e.g., 'Aves' for birds, 'Amphibia' for frogs)."

### CLI standards

- Use `commander` for argument parsing
- Default output is human-readable terminal text with light formatting
- `--json` flag on every command for machine-readable output
- `--help` on every command with examples
- Exit code 0 on success, 1 on error
- Partial results (some APIs succeeded, some failed) still exit 0 with warnings
