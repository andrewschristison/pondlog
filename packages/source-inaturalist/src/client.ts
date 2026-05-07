import {
  PONDLOG_USER_AGENT,
  RateLimiter,
  err,
  ok,
  withRetry,
  type Result,
} from "@pondlog/core";
import type { z } from "zod";

const BASE_URL = "https://api.inaturalist.org/v1";

const limiter = new RateLimiter({
  maxTokens: 100,
  refillRate: 100,
  refillIntervalMs: 60_000,
});

class RateLimitedError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "RateLimitedError";
    this.statusCode = statusCode;
  }
}

interface FetchOptions {
  searchParams?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, opts: FetchOptions | undefined): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (opts?.searchParams) {
    for (const [key, value] of Object.entries(opts.searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function inatFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  opts?: FetchOptions,
): Promise<Result<T>> {
  const url = buildUrl(path, opts);

  try {
    const json = await withRetry(
      async () => {
        await limiter.acquire();
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": PONDLOG_USER_AGENT,
            Accept: "application/json",
          },
          signal: opts?.signal,
        });
        if (res.status === 429) {
          throw new RateLimitedError(429, `iNaturalist rate limit hit at ${path}`);
        }
        if (!res.ok) {
          const text = await safeReadText(res);
          throw new HttpError(
            res.status,
            `iNaturalist ${res.status} on ${path}: ${truncate(text, 200)}`,
          );
        }
        return (await res.json()) as unknown;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        shouldRetry: (e: unknown) => e instanceof RateLimitedError,
      },
    );

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err({
        source: "inaturalist",
        message: `Zod schema mismatch on ${path}: ${parsed.error.message}`,
      });
    }
    return ok(parsed.data);
  } catch (cause) {
    if (cause instanceof RateLimitedError) {
      return err({
        source: "inaturalist",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    if (cause instanceof HttpError) {
      return err({
        source: "inaturalist",
        message: cause.message,
        statusCode: cause.statusCode,
      });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ source: "inaturalist", message, cause });
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
