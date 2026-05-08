// Trefle.io HTTP client — token-authenticated, rate-limited, retry-on-5xx.
//
// Trefle is a beta API and has documented stability issues (search endpoints
// returned 500s during 2025 per its public issue tracker). We're more
// retry-tolerant than other pondlog sources to compensate. Rate limit is
// the published 120 req/min — we run a polite 100/min internally.

import {
  PONDLOG_USER_AGENT,
  RateLimiter,
  err,
  ok,
  withRetry,
  type Result,
} from "@pondlog/core";
import type { z } from "zod";

const BASE_URL = "https://trefle.io/api/v1";

// 100 requests per minute (well under the 120/min posted ceiling). A burst
// of 5 lets a user fan out a single multi-call command without stalling on
// the first request.
const limiter = new RateLimiter({
  maxTokens: 5,
  refillRate: 1,
  refillIntervalMs: 600,
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

class TransientHttpError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "TransientHttpError";
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

class MissingTokenError extends Error {
  constructor() {
    super(
      "TREFLE_API_TOKEN env var is required. Register a free account at https://trefle.io/users/sign_up to get a token, then export TREFLE_API_TOKEN=<your-token>.",
    );
    this.name = "MissingTokenError";
  }
}

function getToken(): string {
  const t = process.env.TREFLE_API_TOKEN;
  if (typeof t !== "string" || t.trim().length === 0) {
    throw new MissingTokenError();
  }
  return t.trim();
}

export type TrefleSearchParamValue = string | number | boolean | undefined;

export interface TrefleFetchOptions {
  searchParams?: Record<string, TrefleSearchParamValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(
  path: string,
  opts: TrefleFetchOptions | undefined,
  token: string,
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${BASE_URL}${cleanPath}`);
  url.searchParams.set("token", token);
  if (opts?.searchParams) {
    for (const [key, value] of Object.entries(opts.searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function trefleFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  opts?: TrefleFetchOptions,
): Promise<Result<T>> {
  let token: string;
  try {
    token = getToken();
  } catch (cause) {
    return err({
      source: "trefle",
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }

  const url = buildUrl(path, opts, token);
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
            throw new RateLimitedError(429, `Trefle rate limit hit at ${path}`);
          }
          if (res.status >= 500 && res.status < 600) {
            // Trefle's reported stability issues — retry transient 5xx.
            const text = await safeReadText(res);
            throw new TransientHttpError(
              res.status,
              `Trefle ${res.status} on ${path}: ${truncate(text, 200)}`,
            );
          }
          if (!res.ok) {
            const text = await safeReadText(res);
            throw new HttpError(
              res.status,
              `Trefle ${res.status} on ${path}: ${truncate(text, 200)}`,
            );
          }
          return (await res.json()) as unknown;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        maxAttempts: 3,
        baseDelayMs: 1_000,
        shouldRetry: (e: unknown) =>
          e instanceof RateLimitedError || e instanceof TransientHttpError,
      },
    );

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err({
        source: "trefle",
        message: `Zod schema mismatch on ${path}: ${parsed.error.message}`,
      });
    }
    return ok(parsed.data);
  } catch (cause) {
    if (cause instanceof RateLimitedError) {
      return err({
        source: "trefle",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof TransientHttpError) {
      return err({
        source: "trefle",
        message: `${cause.message} (retried 3 times)`,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof HttpError) {
      return err({
        source: "trefle",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof Error && cause.name === "AbortError") {
      return err({
        source: "trefle",
        message: `Trefle request aborted (timeout ${timeoutMs}ms) on ${path}`,
      });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ source: "trefle", message, cause });
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

/** True if a usable TREFLE_API_TOKEN is set. Helpful for the aggregate
 *  briefing path so it can silently skip Trefle when no token is present. */
export function hasTrefleToken(): boolean {
  const t = process.env.TREFLE_API_TOKEN;
  return typeof t === "string" && t.trim().length > 0;
}
