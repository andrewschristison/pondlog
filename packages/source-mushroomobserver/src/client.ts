import {
  PONDLOG_USER_AGENT,
  RateLimiter,
  err,
  ok,
  withRetry,
  type Result,
} from "@pondlog/core";
import type { z } from "zod";

const BASE_URL = "https://mushroomobserver.org/api2";

// Mushroom Observer publishes a 20 req/min limit. We refill 1 token every
// 3 000 ms with a small burst allowance so a fan-out (e.g. region search +
// observation count aggregation) doesn't stall on the first call.
const limiter = new RateLimiter({
  maxTokens: 3,
  refillRate: 1,
  refillIntervalMs: 3_000,
});

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

export type MoSearchParamValue = string | number | boolean | undefined;

export interface MoFetchOptions {
  searchParams?: Record<string, MoSearchParamValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Build the URL. The `.json` suffix is mandatory, without it MO defaults to
 *  XML, which our schemas don't speak. */
function buildUrl(path: string, opts: MoFetchOptions | undefined): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Append `.json` if the caller didn't already (allow `.json` already on path).
  const jsonPath = /\.json($|\?)/.test(cleanPath)
    ? cleanPath
    : cleanPath.replace(/(\?|$)/, ".json$1");
  const url = new URL(`${BASE_URL}${jsonPath}`);
  if (opts?.searchParams) {
    for (const [key, value] of Object.entries(opts.searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function moFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  opts?: MoFetchOptions,
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
            throw new RateLimitedError(429, `MO rate limit hit at ${path}`);
          }
          if (!res.ok) {
            const text = await safeReadText(res);
            throw new HttpError(
              res.status,
              `MO ${res.status} on ${path}: ${truncate(text, 200)}`,
            );
          }
          const text = await res.text();
          if (text.trim() === "") {
            // MO never returns an empty body on success, treat as a soft error.
            throw new HttpError(502, `MO returned empty body on ${path}`);
          }
          return JSON.parse(text) as unknown;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        maxAttempts: 3,
        baseDelayMs: 3_000,
        shouldRetry: (e: unknown) => e instanceof RateLimitedError,
      },
    );

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err({
        source: "mushroomobserver",
        message: `Zod schema mismatch on ${path}: ${parsed.error.message}`,
      });
    }
    return ok(parsed.data);
  } catch (cause) {
    if (cause instanceof RateLimitedError) {
      return err({
        source: "mushroomobserver",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof HttpError) {
      return err({
        source: "mushroomobserver",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof Error && cause.name === "AbortError") {
      return err({
        source: "mushroomobserver",
        message: `MO request aborted (timeout ${timeoutMs}ms) on ${path}`,
      });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ source: "mushroomobserver", message, cause });
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
