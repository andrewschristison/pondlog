import {
  PONDLOG_USER_AGENT,
  RateLimiter,
  err,
  ok,
  withRetry,
  type Result,
} from "@pondlog/core";
import type { z } from "zod";

const BASE_URL = "https://services.usanpn.org/npn_portal";

// NPN does not publish a rate limit. We're polite: ~1 req/sec, allowing brief
// bursts of up to 5 (e.g. composing a "nearby" call that fans out across
// stations and observations).
const limiter = new RateLimiter({
  maxTokens: 5,
  refillRate: 1,
  refillIntervalMs: 1_000,
});

// Default fetch timeout — getObservations payloads can run into tens of MB
// even with filters. Generous timeout here is the harden-lens default.
const DEFAULT_TIMEOUT_MS = 60_000;

class RateLimitedError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "RateLimitedError";
    this.statusCode = statusCode;
  }
}

class HttpError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export type SearchParamValue = string | number | undefined;

export interface NpnFetchOptions {
  /** Plain key/value pairs. Repeated indexed keys (`species_id[0]`, `species_id[1]`) should be expanded by the caller. */
  searchParams?: Record<string, SearchParamValue>;
  /** Raw query-string suffix appended after `searchParams`, used for repeated array params NPN expects in indexed form. */
  rawQuery?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(path: string, opts: NpnFetchOptions | undefined): string {
  const url = new URL(`${BASE_URL}${path}`);
  // request_src is required by NPN on every call. Set it once here so individual
  // function callers don't have to thread it through.
  url.searchParams.set("request_src", "pondlog");
  if (opts?.searchParams) {
    for (const [key, value] of Object.entries(opts.searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  let final = url.toString();
  if (opts?.rawQuery && opts.rawQuery.length > 0) {
    final += (final.includes("?") ? "&" : "?") + opts.rawQuery;
  }
  return final;
}

/** Build the indexed-array query NPN expects for repeated params:
 *  expandIndexed("species_id", [3, 7]) -> "species_id%5B0%5D=3&species_id%5B1%5D=7" */
export function expandIndexed(name: string, values: ReadonlyArray<string | number>): string {
  return values
    .map((v, i) => `${encodeURIComponent(name)}%5B${i}%5D=${encodeURIComponent(String(v))}`)
    .join("&");
}

export function joinRawQuery(parts: ReadonlyArray<string | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("&");
}

export async function npnFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  opts?: NpnFetchOptions,
): Promise<Result<T>> {
  const url = buildUrl(path, opts);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const json = await withRetry(
      async () => {
        await limiter.acquire();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const signal = opts?.signal
          ? composeSignals(opts.signal, ctrl.signal)
          : ctrl.signal;
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: {
              "User-Agent": PONDLOG_USER_AGENT,
              Accept: "application/json",
            },
            signal,
          });
          if (res.status === 429) {
            throw new RateLimitedError(429, `NPN rate limit hit at ${path}`);
          }
          if (!res.ok) {
            const text = await safeReadText(res);
            throw new HttpError(
              res.status,
              `NPN ${res.status} on ${path}: ${truncate(text, 200)}`,
            );
          }
          // NPN occasionally returns HTTP 200 with an empty body for queries
          // that have no matching records (and for at least one known
          // upstream bug — see rnpn issue #38 re: stations/getStationsWithSpecies
          // with species_id=3). Treat empty body as an empty array so the
          // schema can validate.
          const text = await res.text();
          if (text.trim() === "") return [];
          return JSON.parse(text) as unknown;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        maxAttempts: 3,
        baseDelayMs: 1_000,
        shouldRetry: (e: unknown) => e instanceof RateLimitedError,
      },
    );

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err({
        source: "npn",
        message: `Zod schema mismatch on ${path}: ${parsed.error.message}`,
      });
    }
    return ok(parsed.data);
  } catch (cause) {
    if (cause instanceof RateLimitedError) {
      return err({
        source: "npn",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof HttpError) {
      return err({
        source: "npn",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof Error && cause.name === "AbortError") {
      return err({
        source: "npn",
        message: `NPN request aborted (timeout ${timeoutMs}ms) on ${path}`,
      });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ source: "npn", message, cause });
  }
}

function composeSignals(...signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1 && signals[0]) return signals[0];
  const ctrl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort(s.reason);
      return ctrl.signal;
    }
    s.addEventListener("abort", () => ctrl.abort(s.reason), { once: true });
  }
  return ctrl.signal;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}
