import { describe, expect, it } from "vitest";
import { azimuthToCompass } from "../src/compass.js";
import { getVisibleConstellations } from "../src/constellations.js";
import { getDarkSkyWindow, scoreDarkSky } from "../src/darksky.js";
import {
  getActiveMeteorShowers,
  moonInterferenceLevel,
} from "../src/meteors.js";
import { getMoonPhase, phaseNameFromAngle } from "../src/moon.js";
import { getPlanetPositions } from "../src/planets.js";
import { getSunTimes } from "../src/sun.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };

describe("azimuthToCompass", () => {
  it("maps cardinal points exactly", () => {
    expect(azimuthToCompass(0)).toBe("N");
    expect(azimuthToCompass(90)).toBe("E");
    expect(azimuthToCompass(180)).toBe("S");
    expect(azimuthToCompass(270)).toBe("W");
  });

  it("maps inter-cardinals with the 11.25° half-band", () => {
    expect(azimuthToCompass(22)).toBe("NNE");
    expect(azimuthToCompass(45)).toBe("NE");
    expect(azimuthToCompass(225)).toBe("SW");
    expect(azimuthToCompass(337.5)).toBe("NNW");
    // The 348.75° boundary rounds back to N.
    expect(azimuthToCompass(349)).toBe("N");
  });

  it("normalizes negative and >360 azimuths", () => {
    expect(azimuthToCompass(-90)).toBe("W");
    expect(azimuthToCompass(720)).toBe("N");
  });
});

describe("phaseNameFromAngle", () => {
  it("names the cardinal phases", () => {
    expect(phaseNameFromAngle(0)).toBe("New Moon");
    expect(phaseNameFromAngle(90)).toBe("First Quarter");
    expect(phaseNameFromAngle(180)).toBe("Full Moon");
    expect(phaseNameFromAngle(270)).toBe("Last Quarter");
  });

  it("names the in-between arcs", () => {
    expect(phaseNameFromAngle(45)).toBe("Waxing Crescent");
    expect(phaseNameFromAngle(135)).toBe("Waxing Gibbous");
    expect(phaseNameFromAngle(225)).toBe("Waning Gibbous");
    expect(phaseNameFromAngle(315)).toBe("Waning Crescent");
  });

  it("normalizes negative and >360 inputs", () => {
    expect(phaseNameFromAngle(360)).toBe("New Moon");
    expect(phaseNameFromAngle(-90)).toBe("Last Quarter");
  });
});

describe("scoreDarkSky", () => {
  it("returns 5 for new moon during astronomical dark", () => {
    expect(
      scoreDarkSky({
        hasAstronomicalDark: true,
        moonIlluminationFraction: 0,
        moonAltitudeDeg: 30,
      }),
    ).toBe(5);
  });

  it("returns 5 when moon is below horizon, regardless of illumination", () => {
    expect(
      scoreDarkSky({
        hasAstronomicalDark: true,
        moonIlluminationFraction: 1,
        moonAltitudeDeg: -10,
      }),
    ).toBe(5);
  });

  it("returns 1 for full moon overhead during dark", () => {
    expect(
      scoreDarkSky({
        hasAstronomicalDark: true,
        moonIlluminationFraction: 1,
        moonAltitudeDeg: 60,
      }),
    ).toBe(1);
  });

  it("caps at 3 when there is no astronomical dark, even with no moon", () => {
    expect(
      scoreDarkSky({
        hasAstronomicalDark: false,
        moonIlluminationFraction: 0,
        moonAltitudeDeg: -20,
      }),
    ).toBe(3);
  });

  it("drops to 1 when there is no astronomical dark AND a bright moon", () => {
    expect(
      scoreDarkSky({
        hasAstronomicalDark: false,
        moonIlluminationFraction: 1,
        moonAltitudeDeg: 60,
      }),
    ).toBe(1);
  });
});

describe("moonInterferenceLevel", () => {
  it("classifies illumination thresholds", () => {
    expect(moonInterferenceLevel(0.05)).toBe("none");
    expect(moonInterferenceLevel(0.2)).toBe("low");
    expect(moonInterferenceLevel(0.5)).toBe("moderate");
    expect(moonInterferenceLevel(0.95)).toBe("high");
  });
});

describe("getActiveMeteorShowers", () => {
  it("flags Perseids active on August 12 (peak day)", () => {
    const result = getActiveMeteorShowers({ date: "2026-08-12T08:00:00Z" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const perseids = result.data.active.find((s) => s.id === "perseids");
    expect(perseids).toBeDefined();
    expect(perseids?.daysToPeak).toBe(0);
  });

  it("flags Quadrantids active across the year boundary (Jan 1)", () => {
    const result = getActiveMeteorShowers({ date: "2026-01-01T08:00:00Z" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const quad = result.data.active.find((s) => s.id === "quadrantids");
    expect(quad).toBeDefined();
  });

  it("returns an empty active list outside any window (Feb 15)", () => {
    const result = getActiveMeteorShowers({ date: "2026-02-15T08:00:00Z" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.active.length).toBe(0);
  });

  it("surfaces Geminids as upcoming in early December", () => {
    const result = getActiveMeteorShowers({ date: "2026-12-02T08:00:00Z" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const gem = result.data.upcoming.find((s) => s.id === "geminids");
    expect(gem).toBeDefined();
  });
});

describe("getSunTimes (boundary checks)", () => {
  it("rejects out-of-range latitude", () => {
    const result = getSunTimes({ coords: { lat: 91, lng: 0 } });
    expect(result.ok).toBe(false);
  });

  it("rejects NaN coordinates", () => {
    const result = getSunTimes({ coords: { lat: Number.NaN, lng: 0 } });
    expect(result.ok).toBe(false);
  });

  it("rejects unparseable date strings", () => {
    const result = getSunTimes({ coords: PORT_ANGELES, date: "not-a-date" });
    expect(result.ok).toBe(false);
  });

  it("returns sunrise/sunset for Port Angeles on a typical date", () => {
    const result = getSunTimes({
      coords: PORT_ANGELES,
      date: "2026-05-07T12:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sunrise).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.data.sunset).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.data.astronomicalDusk).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("getMoonPhase", () => {
  it("works without coordinates and reports phase", () => {
    const result = getMoonPhase({ date: "2026-05-07T12:00:00Z" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.illuminationFraction).toBeGreaterThanOrEqual(0);
    expect(result.data.illuminationFraction).toBeLessThanOrEqual(1);
    expect(result.data.rise).toBe(null);
    expect(result.data.set).toBe(null);
  });

  it("returns rise/set when coords are provided", () => {
    const result = getMoonPhase({
      coords: PORT_ANGELES,
      date: "2026-05-07T12:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // At least one of rise/set should be non-null on a typical mid-latitude day.
    expect(result.data.rise || result.data.set).toBeTruthy();
  });
});

describe("getPlanetPositions", () => {
  it("returns 7 planets with magnitudes and compass directions", () => {
    const result = getPlanetPositions({
      coords: PORT_ANGELES,
      date: "2026-05-07T08:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.planets).toHaveLength(7);
    for (const p of result.data.planets) {
      expect(typeof p.magnitude).toBe("number");
      expect(p.altitudeDeg).toBeGreaterThanOrEqual(-90);
      expect(p.altitudeDeg).toBeLessThanOrEqual(90);
      expect(p.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(p.azimuthDeg).toBeLessThan(360);
    }
  });

  it("filters out daytime planets via isVisible (sun above horizon)", () => {
    const result = getPlanetPositions({
      coords: PORT_ANGELES,
      // Local noon at Port Angeles in May — sun is well up.
      date: "2026-05-07T20:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isDark).toBe(false);
    expect(result.data.planets.every((p) => !p.isVisible)).toBe(true);
  });
});

describe("getDarkSkyWindow", () => {
  it("returns a positive dark window in a typical mid-latitude winter night", () => {
    const result = getDarkSkyWindow({
      coords: PORT_ANGELES,
      date: "2026-12-21T08:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.start).not.toBeNull();
    expect(result.data.end).not.toBeNull();
    expect(result.data.hours).toBeGreaterThan(8);
  });

  it("reports no astronomical dark for an arctic summer night", () => {
    const result = getDarkSkyWindow({
      // ~70°N (north of the Arctic Circle).
      coords: { lat: 70, lng: 0 },
      date: "2026-06-21T08:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.start).toBeNull();
    expect(result.data.end).toBeNull();
    expect(result.data.hours).toBe(0);
    // No dark + however much moon = quality ≤ 3.
    expect(result.data.quality).toBeLessThanOrEqual(3);
  });
});

describe("getVisibleConstellations", () => {
  it("returns at least a few constellations above 15° from a mid-latitude site", () => {
    const result = getVisibleConstellations({
      coords: PORT_ANGELES,
      date: "2026-05-07T08:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.visible.length).toBeGreaterThan(0);
    for (const c of result.data.visible) {
      expect(c.altitudeDeg).toBeGreaterThanOrEqual(15);
    }
  });

  it("ranks in-season constellations above out-of-season ones", () => {
    const result = getVisibleConstellations({
      coords: PORT_ANGELES,
      date: "2026-08-15T08:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const list = result.data.visible;
    if (list.length < 2) return; // not enough data to compare
    // First out-of-season entry can't appear before the last in-season entry.
    const firstOut = list.findIndex((c) => !c.isInSeason);
    const lastIn = [...list].reverse().findIndex((c) => c.isInSeason);
    if (firstOut === -1 || lastIn === -1) return;
    const lastInIdx = list.length - 1 - lastIn;
    expect(firstOut).toBeGreaterThan(lastInIdx - 1);
  });
});
