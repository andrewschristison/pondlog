import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildKey,
  cacheGet,
  cachePath,
  cacheRoot,
  cacheSet,
  withCache,
  CONFIG_DIR_ENV,
} from "../src/cache.js";
import { ok, err, type Result } from "@pondlog/core";

let sandbox: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "pondlog-cache-test-"));
  originalEnv = process.env[CONFIG_DIR_ENV];
  process.env[CONFIG_DIR_ENV] = sandbox;
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env[CONFIG_DIR_ENV];
  else process.env[CONFIG_DIR_ENV] = originalEnv;
});

describe("buildKey", () => {
  it("is order-independent for object params", () => {
    const a = buildKey("noaa", { station: "9444090", date: "2026-05-07" });
    const b = buildKey("noaa", { date: "2026-05-07", station: "9444090" });
    expect(a).toBe(b);
  });

  it("differs across sources", () => {
    const a = buildKey("noaa", { station: "9444090" });
    const b = buildKey("ebird", { station: "9444090" });
    expect(a).not.toBe(b);
  });

  it("differs across param values", () => {
    const a = buildKey("noaa", { station: "9444090" });
    const b = buildKey("noaa", { station: "8418150" });
    expect(a).not.toBe(b);
  });
});

describe("cacheGet / cacheSet", () => {
  it("roundtrips and respects PONDLOG_CONFIG_DIR sandbox", async () => {
    const key = buildKey("noaa", { station: "9444090" });
    const set = await cacheSet("noaa", key, { hello: "world" });
    expect(set.ok).toBe(true);
    expect(cacheRoot()).toBe(join(sandbox, "cache"));
    expect(cachePath("noaa", key)).toBe(
      join(sandbox, "cache", "noaa", `${key}.json`),
    );
    const got = await cacheGet<{ hello: string }>("noaa", key);
    expect(got).toEqual({ hello: "world" });
  });

  it("returns null for expired entries", async () => {
    const key = buildKey("noaa", { station: "9444090" });
    const path = cachePath("noaa", key);
    await cacheSet("noaa", key, { v: 1 });
    // Hand-edit the envelope to force expiration
    const raw = await readFile(path, "utf8");
    const env = JSON.parse(raw);
    env.expiresAt = Date.now() - 1000;
    await writeFile(path, JSON.stringify(env), "utf8");
    const got = await cacheGet("noaa", key);
    expect(got).toBeNull();
  });

  it("returns null when the file doesn't exist", async () => {
    const got = await cacheGet("noaa", "nonexistent");
    expect(got).toBeNull();
  });
});

describe("withCache", () => {
  it("calls the fetcher on first request, returns cached on second", async () => {
    let calls = 0;
    const fetcher = async (): Promise<Result<{ n: number }>> => {
      calls += 1;
      return ok({ n: 42 });
    };
    const first = await withCache({
      source: "noaa",
      params: { station: "9444090" },
      fetcher,
    });
    expect(first.cacheHit).toBe(false);
    expect(first.result.ok).toBe(true);
    expect(calls).toBe(1);

    const second = await withCache({
      source: "noaa",
      params: { station: "9444090" },
      fetcher,
    });
    expect(second.cacheHit).toBe(true);
    expect(calls).toBe(1);
  });

  it("bypasses cache when bypass=true", async () => {
    let calls = 0;
    const fetcher = async (): Promise<Result<{ n: number }>> => {
      calls += 1;
      return ok({ n: calls });
    };
    await withCache({
      source: "noaa",
      params: { station: "9444090" },
      fetcher,
    });
    const second = await withCache({
      source: "noaa",
      params: { station: "9444090" },
      bypass: true,
      fetcher,
    });
    expect(second.cacheHit).toBe(false);
    expect(calls).toBe(2);
  });

  it("does not cache failures", async () => {
    let calls = 0;
    const fetcher = async (): Promise<Result<{ n: number }>> => {
      calls += 1;
      return err({ source: "noaa", message: "boom" });
    };
    await withCache({
      source: "noaa",
      params: { station: "9444090" },
      fetcher,
    });
    const second = await withCache({
      source: "noaa",
      params: { station: "9444090" },
      fetcher,
    });
    expect(second.cacheHit).toBe(false);
    expect(calls).toBe(2);
  });
});
