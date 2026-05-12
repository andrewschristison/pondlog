import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "@pondlog/core";

/** Per-source TTL in seconds. Source ids match the keys callers pass to
 *  cacheGet/cacheSet. Sources not listed here fall back to DEFAULT_TTL. */
const TTL_SECONDS: Record<string, number> = {
  noaa: 3600, // tides, predictable, 1h
  inaturalist: 900, // observations, 15m
  ebird: 900, // observations, 15m
  usgs: 900, // streamflow, 15m
  npn: 3600, // phenology, slow-moving, 1h
};

const DEFAULT_TTL = 900;

export const CONFIG_DIR_ENV = "PONDLOG_CONFIG_DIR";
const CACHE_VERSION = 1;

interface CacheEnvelope<T> {
  version: number;
  source: string;
  expiresAt: number;
  storedAt: number;
  value: T;
}

function configDir(): string {
  const fromEnv = process.env[CONFIG_DIR_ENV];
  if (fromEnv && fromEnv.trim() !== "") return fromEnv;
  return join(homedir(), ".pondlog");
}

export function cacheRoot(): string {
  return join(configDir(), "cache");
}

export function cachePath(source: string, key: string): string {
  return join(cacheRoot(), sanitizeSource(source), `${key}.json`);
}

function sanitizeSource(source: string): string {
  return source.replace(/[^a-z0-9_-]/gi, "_");
}

/** Build a stable cache key from source id + arbitrary param object. */
export function buildKey(source: string, params: unknown): string {
  const json = JSON.stringify(canonicalize(params));
  return createHash("sha256").update(`${source}:${json}`).digest("hex").slice(0, 32);
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const k of keys) {
    out[k] = canonicalize((value as Record<string, unknown>)[k]);
  }
  return out;
}

function ttlFor(source: string): number {
  return TTL_SECONDS[source] ?? DEFAULT_TTL;
}

/** Read a cached value if it exists and hasn't expired. */
export async function cacheGet<T>(
  source: string,
  key: string,
): Promise<T | null> {
  const path = cachePath(source, key);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    if (isENOENT(e)) return null;
    return null; // unreadable cache is non-fatal
  }
  let env: CacheEnvelope<T>;
  try {
    env = JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
  if (env.version !== CACHE_VERSION) return null;
  if (typeof env.expiresAt !== "number" || env.expiresAt < Date.now()) {
    // expired, best-effort delete
    void unlink(path).catch(() => {});
    return null;
  }
  return env.value;
}

/** Atomically write a cached value with the per-source TTL. */
export async function cacheSet<T>(
  source: string,
  key: string,
  value: T,
): Promise<Result<void>> {
  const path = cachePath(source, key);
  const ttlMs = ttlFor(source) * 1000;
  const env: CacheEnvelope<T> = {
    version: CACHE_VERSION,
    source,
    storedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    value,
  };
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(tmp, JSON.stringify(env), { encoding: "utf8", mode: 0o600 });
    await rename(tmp, path);
    return ok(undefined);
  } catch (cause) {
    return err({
      source: "cli/cache",
      message: `failed to write ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    });
  }
}

/** Wrap a fetcher with read-through caching. Bypassed when bypass=true. */
export async function withCache<T>(opts: {
  source: string;
  params: unknown;
  bypass?: boolean;
  fetcher: () => Promise<Result<T>>;
}): Promise<{ result: Result<T>; cacheHit: boolean }> {
  if (opts.bypass) {
    const r = await opts.fetcher();
    return { result: r, cacheHit: false };
  }
  const key = buildKey(opts.source, opts.params);
  const cached = await cacheGet<T>(opts.source, key);
  if (cached !== null) {
    return { result: ok(cached), cacheHit: true };
  }
  const result = await opts.fetcher();
  if (result.ok) {
    await cacheSet(opts.source, key, result.data);
  }
  return { result, cacheHit: false };
}

function isENOENT(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

/** For tests/diagnostics. */
export async function cacheStat(source: string, key: string): Promise<{ exists: boolean; mtimeMs?: number }> {
  try {
    const s = await stat(cachePath(source, key));
    return { exists: true, mtimeMs: s.mtimeMs };
  } catch {
    return { exists: false };
  }
}
