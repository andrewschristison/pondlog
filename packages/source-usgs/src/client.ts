import {
  PONDLOG_USER_AGENT,
  RateLimiter,
  err,
  ok,
  withRetry,
  type Result,
} from "@pondlog/core";
import type { z } from "zod";

export const USGS_BASE_URL = "https://waterservices.usgs.gov/nwis";

// USGS does not publish a rate limit. Be polite: 1 req/sec sustained, allow
// brief bursts (e.g. fetching iv + dv for the same site as a pair).
const limiter = new RateLimiter({
  maxTokens: 5,
  refillRate: 1,
  refillIntervalMs: 1_000,
});

const DEFAULT_TIMEOUT_MS = 30_000;

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

export interface UsgsFetchOptions {
  searchParams?: Record<string, SearchParamValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Defaults to 'application/json'. Set to 'text/plain' for /site/ which returns RDB. */
  accept?: string;
}

function buildUrl(path: string, opts: UsgsFetchOptions | undefined): string {
  const url = new URL(`${USGS_BASE_URL}${path}`);
  if (opts?.searchParams) {
    for (const [key, value] of Object.entries(opts.searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Fetch + parse a JSON response against a Zod schema. Returns Result<T>. */
export async function usgsFetchJson<T>(
  path: string,
  schema: z.ZodType<T>,
  opts?: UsgsFetchOptions,
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
            throw new RateLimitedError(429, `USGS rate limit hit at ${path}`);
          }
          if (!res.ok) {
            const text = await safeReadText(res);
            throw new HttpError(
              res.status,
              `USGS ${res.status} on ${path}: ${truncate(text, 200)}`,
            );
          }
          const text = await res.text();
          if (text.trim() === "") return null;
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
        source: "usgs",
        message: `Zod schema mismatch on ${path}: ${parsed.error.message}`,
      });
    }
    return ok(parsed.data);
  } catch (cause) {
    return mapError(path, timeoutMs, cause);
  }
}

/** Fetch + return raw text. Used for /site/ which only emits RDB. */
export async function usgsFetchText(
  path: string,
  opts?: UsgsFetchOptions,
): Promise<Result<string>> {
  const url = buildUrl(path, opts);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const text = await withRetry(
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
              Accept: opts?.accept ?? "text/plain",
            },
            signal,
          });
          if (res.status === 429) {
            throw new RateLimitedError(429, `USGS rate limit hit at ${path}`);
          }
          if (!res.ok) {
            const body = await safeReadText(res);
            throw new HttpError(
              res.status,
              `USGS ${res.status} on ${path}: ${truncate(body, 200)}`,
            );
          }
          return res.text();
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
    return ok(text);
  } catch (cause) {
    return mapError(path, timeoutMs, cause);
  }
}

function mapError<T>(
  path: string,
  timeoutMs: number,
  cause: unknown,
): Result<T> {
  if (cause instanceof RateLimitedError) {
    return err({
      source: "usgs",
      message: cause.message,
      statusCode: cause.statusCode,
    });
  }
  if (cause instanceof HttpError) {
    return err({
      source: "usgs",
      message: cause.message,
      statusCode: cause.statusCode,
    });
  }
  if (cause instanceof Error && cause.name === "AbortError") {
    return err({
      source: "usgs",
      message: `USGS request aborted (timeout ${timeoutMs}ms) on ${path}`,
    });
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return err({ source: "usgs", message, cause });
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
