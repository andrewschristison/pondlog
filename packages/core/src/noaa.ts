import { z } from "zod";
import { err, ok, type Result } from "./result.js";
import type { TideEvent } from "./types.js";
import { RateLimiter } from "./rate-limiter.js";
import { withRetry } from "./retry.js";
import { PONDLOG_USER_AGENT } from "./user-agent.js";

const NOAA_BASE_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const STATION_ID_RE = /^[0-9]{6,8}$/;
const ISO_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** Documented NOAA limit: 5 req/sec sustained, no burst guidance. */
const limiter = new RateLimiter({
  maxTokens: 5,
  refillRate: 5,
  refillIntervalMs: 1000,
});

const NoaaPredictionSchema = z
  .object({
    t: z.string(),
    v: z.string(),
    type: z.enum(["H", "L"]),
  })
  .passthrough();

const NoaaPredictionsResponseSchema = z
  .object({ predictions: z.array(NoaaPredictionSchema) })
  .passthrough();

const NoaaErrorResponseSchema = z
  .object({ error: z.object({ message: z.string() }).passthrough() })
  .passthrough();

export interface GetTidePredictionsParams {
  /** NOAA station id (6–8 digits). Port Angeles = "9444090". */
  stationId: string;
  /** YYYY-MM-DD. Defaults to today. */
  date?: string;
  /** Override default 30s timeout. */
  timeoutMs?: number;
}

/** Fetch high/low tide predictions for one NOAA CO-OPS station. */
export async function getTidePredictions(
  params: GetTidePredictionsParams,
): Promise<Result<TideEvent[]>> {
  if (!STATION_ID_RE.test(params.stationId)) {
    return err({
      source: "noaa",
      message: `invalid stationId "${params.stationId}", expected 6–8 digits (e.g. "9444090")`,
    });
  }
  if (params.date !== undefined && !ISO_DATE_RE.test(params.date)) {
    return err({
      source: "noaa",
      message: `invalid date "${params.date}", expected YYYY-MM-DD`,
    });
  }

  const beginDate = (params.date ?? todayIso()).replace(/-/g, "");
  const url = new URL(NOAA_BASE_URL);
  url.searchParams.set("product", "predictions");
  url.searchParams.set("station", params.stationId);
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("units", "english");
  url.searchParams.set("time_zone", "lst_ldt");
  url.searchParams.set("format", "json");
  url.searchParams.set("interval", "hilo");
  url.searchParams.set("begin_date", beginDate);
  url.searchParams.set("range", "24");

  await limiter.acquire();

  let response: Response;
  try {
    response = await withRetry(
      async () => {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), params.timeoutMs ?? 30_000);
        try {
          const r = await fetch(url, {
            headers: {
              accept: "application/json",
              "user-agent": PONDLOG_USER_AGENT,
            },
            signal: ac.signal,
          });
          if (r.status === 429 || r.status >= 500) {
            throw new Error(`noaa: HTTP ${r.status}`);
          }
          return r;
        } finally {
          clearTimeout(timer);
        }
      },
      { maxAttempts: 3, baseDelayMs: 1000 },
    );
  } catch (cause) {
    return err({
      source: "noaa",
      message: `request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    return err({
      source: "noaa",
      message: `response was not JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      statusCode: response.status,
      cause,
    });
  }

  if (!response.ok) {
    const errParsed = NoaaErrorResponseSchema.safeParse(json);
    const message = errParsed.success
      ? errParsed.data.error.message
      : `HTTP ${response.status}`;
    return err({ source: "noaa", message, statusCode: response.status });
  }

  // NOAA returns 200 with `{error: {...}}` body for invalid stations / dates.
  const errParsed = NoaaErrorResponseSchema.safeParse(json);
  if (errParsed.success) {
    return err({ source: "noaa", message: errParsed.data.error.message });
  }

  const parsed = NoaaPredictionsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return err({
      source: "noaa",
      message: `unexpected response shape: ${parsed.error.message}`,
    });
  }

  const events: TideEvent[] = [];
  for (const p of parsed.data.predictions) {
    const heightFt = Number.parseFloat(p.v);
    if (!Number.isFinite(heightFt)) continue;
    events.push({
      time: noaaTimeToIso(p.t),
      heightFt,
      type: p.type === "H" ? "high" : "low",
    });
  }
  return ok(events);
}

/** Convenience: split a flat tide-event list into {high, low} arrays. */
export function splitHighLow(
  events: TideEvent[],
): { high: TideEvent[]; low: TideEvent[] } {
  const high: TideEvent[] = [];
  const low: TideEvent[] = [];
  for (const e of events) {
    if (e.type === "high") high.push(e);
    else if (e.type === "low") low.push(e);
  }
  return { high, low };
}

function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** NOAA returns "YYYY-MM-DD HH:mm" in station local time. We pass it through
 *  as "YYYY-MM-DDTHH:mm:00" without a timezone suffix, the caller knows the
 *  station's TZ, and inventing a UTC offset would lie. */
function noaaTimeToIso(t: string): string {
  const trimmed = t.trim();
  return trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
}
