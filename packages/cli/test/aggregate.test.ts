import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_DIR_ENV } from "../src/cache.js";

vi.mock("@pondlog/source-inaturalist", () => ({
  getNearbyObservations: vi.fn(),
}));
vi.mock("@pondlog/source-ebird", () => ({
  getNearbyRecentNormalized: vi.fn(),
}));
vi.mock("@pondlog/source-npn", () => ({
  getActivePhenologyNearby: vi.fn(),
}));
vi.mock("@pondlog/source-mushroomobserver", () => ({
  getRecentNearLocation: vi.fn(),
}));
vi.mock("@pondlog/source-usgs", () => ({
  getInstantaneousValues: vi.fn(),
}));
vi.mock("@pondlog/source-nightsky", () => ({
  getTonightsBriefing: vi.fn(),
}));

vi.mock("@pondlog/core", async () => {
  const actual = await vi.importActual<typeof import("@pondlog/core")>("@pondlog/core");
  return {
    ...actual,
    getTidePredictions: vi.fn(),
  };
});

const { getNearbyObservations } = await import("@pondlog/source-inaturalist");
const { getNearbyRecentNormalized } = await import("@pondlog/source-ebird");
const { getActivePhenologyNearby } = await import("@pondlog/source-npn");
const { getRecentNearLocation } = await import("@pondlog/source-mushroomobserver");
const { getInstantaneousValues } = await import("@pondlog/source-usgs");
const { getTonightsBriefing } = await import("@pondlog/source-nightsky");
const core = await import("@pondlog/core");
const { buildTodayBriefing } = await import("../src/aggregate.js");

let sandbox: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "pondlog-aggregate-test-"));
  originalEnv = process.env[CONFIG_DIR_ENV];
  process.env[CONFIG_DIR_ENV] = sandbox;
  vi.mocked(getNearbyObservations).mockReset();
  vi.mocked(getNearbyRecentNormalized).mockReset();
  vi.mocked(getActivePhenologyNearby).mockReset();
  vi.mocked(getRecentNearLocation).mockReset();
  vi.mocked(getInstantaneousValues).mockReset();
  vi.mocked(getTonightsBriefing).mockReset();
  vi.mocked(core.getTidePredictions).mockReset();
  // Tripwire: any source left unmocked reaches the network through fetch.
  // Fail fast and by name instead of hanging until the test timeout.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(`unmocked network call: ${String((input as { url?: string })?.url ?? input)}`);
    }),
  );
});

afterEach(() => {
  const calls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String((c[0] as { url?: string })?.url ?? c[0]));
  vi.unstubAllGlobals();
  expect(calls, "a source in the fan-out reached the network; mock it").toEqual([]);
  if (originalEnv === undefined) delete process.env[CONFIG_DIR_ENV];
  else process.env[CONFIG_DIR_ENV] = originalEnv;
});

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };

const EMPTY_MO = { ok: true as const, data: { observations: [], totalRecords: 0, windowDays: 30 } };

const FAKE_NIGHT_SKY = {
  date: "2026-05-07",
  referenceTime: "2026-05-07T08:00:00Z",
  coordinates: PORT_ANGELES,
  sun: {
    date: "2026-05-07",
    coordinates: PORT_ANGELES,
    sunrise: "2026-05-07T12:32:00Z",
    sunset: "2026-05-08T03:47:00Z",
    solarNoon: null,
    civilDawn: null,
    civilDusk: null,
    nauticalDawn: null,
    nauticalDusk: null,
    astronomicalDawn: null,
    astronomicalDusk: null,
    goldenHourMorningEnd: null,
    goldenHourEveningStart: null,
  },
  moon: {
    date: "2026-05-07",
    phase: "Waning Gibbous" as const,
    emoji: "🌖",
    phaseAngleDeg: 200,
    illuminationFraction: 0.78,
    ageDays: 18,
    rise: null,
    set: null,
  },
  darkSky: {
    date: "2026-05-07",
    coordinates: PORT_ANGELES,
    start: null,
    end: null,
    hours: 0,
    quality: 2 as const,
    qualityLabel: "Poor",
    moonIlluminationAtMid: 0.78,
    moonAltAtMid: 30,
  },
  visiblePlanets: [],
  activeMeteorShowers: [],
  upcomingMeteorShowers: [],
  visibleConstellations: [],
  highlight: "🌖 Waning Gibbous, sky poor",
};

describe("buildTodayBriefing partial-failure handling", () => {
  it("collects per-source failures into errors[] without crashing", async () => {
    vi.mocked(getNearbyObservations).mockResolvedValue({
      ok: false,
      error: { source: "inaturalist", message: "fake inat down" },
    });
    vi.mocked(getNearbyRecentNormalized).mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.mocked(getActivePhenologyNearby).mockResolvedValue({
      ok: true,
      data: {
        coordinates: PORT_ANGELES,
        radiusKm: 50,
        yearsBack: 2,
        stationsInRadius: 0,
        stationsSearched: 0,
        entries: [],
      },
    });
    vi.mocked(getRecentNearLocation).mockResolvedValue(EMPTY_MO);
    vi.mocked(getTonightsBriefing).mockReturnValue({
      ok: true,
      data: FAKE_NIGHT_SKY,
    });

    const { briefing } = await buildTodayBriefing({
      coords: PORT_ANGELES,
      config: null,
      noCache: true,
    });

    expect(briefing.errors).toEqual([
      { source: "inaturalist", message: "fake inat down" },
    ]);
    expect(briefing.recentObservations).toEqual([]);
    expect(briefing.nightSky).toBeDefined();
    expect(briefing.tides).toBeUndefined();
    expect(briefing.streamflow).toBeUndefined();
  });

  it("derives legacy `celestial` field from night-sky data", async () => {
    vi.mocked(getNearbyObservations).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(getNearbyRecentNormalized).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(getActivePhenologyNearby).mockResolvedValue({
      ok: true,
      data: {
        coordinates: PORT_ANGELES,
        radiusKm: 50,
        yearsBack: 2,
        stationsInRadius: 0,
        stationsSearched: 0,
        entries: [],
      },
    });
    vi.mocked(getRecentNearLocation).mockResolvedValue(EMPTY_MO);
    vi.mocked(getTonightsBriefing).mockReturnValue({ ok: true, data: FAKE_NIGHT_SKY });

    const { briefing } = await buildTodayBriefing({
      coords: PORT_ANGELES,
      config: null,
      noCache: true,
    });
    expect(briefing.celestial.sunrise).toBe("2026-05-07T12:32:00Z");
    expect(briefing.celestial.moonPhase).toBe("Waning Gibbous");
    expect(briefing.celestial.moonIllumination).toBe(0.78);
    expect(briefing.celestial.daylightHours).toBeGreaterThan(15);
  });

  it("queries NOAA + USGS when configured and merges tides/streamflow", async () => {
    vi.mocked(getNearbyObservations).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(getNearbyRecentNormalized).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(getActivePhenologyNearby).mockResolvedValue({
      ok: true,
      data: {
        coordinates: PORT_ANGELES,
        radiusKm: 50,
        yearsBack: 2,
        stationsInRadius: 0,
        stationsSearched: 0,
        entries: [],
      },
    });
    vi.mocked(getRecentNearLocation).mockResolvedValue(EMPTY_MO);
    vi.mocked(getTonightsBriefing).mockReturnValue({ ok: true, data: FAKE_NIGHT_SKY });
    vi.mocked(core.getTidePredictions).mockResolvedValue({
      ok: true,
      data: [
        { time: "2026-05-07T06:18", heightFt: 3.2, type: "low" },
        { time: "2026-05-07T12:42", heightFt: 8.1, type: "high" },
      ],
    });
    vi.mocked(getInstantaneousValues).mockResolvedValue({
      ok: true,
      data: [
        {
          site: {
            siteNumber: "12045500",
            siteName: "Elwha River at McDonald Br near Port Angeles, WA",
            agencyCode: "USGS",
            coordinates: PORT_ANGELES,
          },
          series: [
            {
              parameterCode: "00060",
              variableName: "Streamflow, ft³/s",
              unitCode: "ft3/s",
              values: [{ dateTime: "2026-05-07T17:00:00-07:00", value: 1240, qualifiers: ["P"] }],
            },
            {
              parameterCode: "00065",
              variableName: "Gage height, ft",
              unitCode: "ft",
              values: [{ dateTime: "2026-05-07T17:00:00-07:00", value: 4.32, qualifiers: ["P"] }],
            },
          ],
        },
      ],
    });

    const { briefing } = await buildTodayBriefing({
      coords: PORT_ANGELES,
      config: {
        version: 1,
        noaaStation: "9444090",
        usgsSite: "12045500",
      },
      noCache: true,
    });

    expect(briefing.tides?.high).toHaveLength(1);
    expect(briefing.tides?.low).toHaveLength(1);
    expect(briefing.streamflow?.flowCfs).toBe(1240);
    expect(briefing.streamflow?.gageHeightFt).toBe(4.32);
    expect(briefing.streamflow?.siteName).toMatch(/Elwha/);
    expect(briefing.errors).toEqual([]);
  });
});

describe("buildTodayBriefing test isolation", () => {
  it("mocks every function the fan-out imports from a source package", async () => {
    const src = await readFile(new URL("../src/aggregate.ts", import.meta.url), "utf8");
    const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(@pondlog\/source-[^"]+)"/g)];
    const pairs = imports.flatMap(([, names, pkg]) =>
      names
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n && !n.startsWith("type "))
        .map((n) => [pkg, n.split(/\s+as\s+/)[0].trim()] as const),
    );
    // Sentinel: the parse must see the known sources, so an empty or broken
    // match can never read as "everything is mocked".
    expect(new Set(pairs.map(([pkg]) => pkg)).size).toBeGreaterThanOrEqual(6);
    const unmocked: string[] = [];
    for (const [pkg, name] of pairs) {
      const mod = (await import(pkg)) as Record<string, unknown>;
      if (!vi.isMockFunction(mod[name])) unmocked.push(`${pkg} ${name}`);
    }
    expect(unmocked, "add a vi.mock for each listed source function").toEqual([]);
  });
});
