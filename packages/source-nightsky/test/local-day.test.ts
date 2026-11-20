import { describe, expect, it } from "vitest";
import { getDarkSkyWindow, getSunTimes, getTonightsBriefing } from "../src/index.js";

/** Calendar day of an instant in local mean solar time at `lng`. */
function localDay(iso: string | null, lng: number): string | undefined {
  if (!iso) return undefined;
  return new Date(Date.parse(iso) + (lng / 15) * 3_600_000).toISOString().slice(0, 10);
}

const PLACES = [
  { name: "Deception Pass, WA (US Pacific)", coords: { lat: 48.406, lng: -122.643 }, date: "2026-11-21" },
  { name: "New York, NY (US Eastern)", coords: { lat: 40.7128, lng: -74.006 }, date: "2026-06-21" },
  { name: "Tokyo (positive longitude)", coords: { lat: 35.6762, lng: 139.6503 }, date: "2026-06-21" },
];

describe("date-only input means the local calendar day", () => {
  for (const p of PLACES) {
    it(`sun times fall on ${p.date} locally at ${p.name}`, () => {
      const r = getSunTimes({ coords: p.coords, date: p.date });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const s = r.data;
      for (const t of [s.sunrise, s.sunset, s.solarNoon, s.goldenHourMorningEnd, s.goldenHourEveningStart]) {
        expect(localDay(t, p.coords.lng)).toBe(p.date);
      }
      expect(Date.parse(s.sunrise!)).toBeLessThan(Date.parse(s.sunset!));
      expect(Date.parse(s.goldenHourEveningStart!)).toBeLessThan(Date.parse(s.sunset!));
    });

    it(`tonight's dark window starts on the evening of ${p.date} at ${p.name}`, () => {
      const r = getDarkSkyWindow({ coords: p.coords, date: p.date });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.start).not.toBeNull();
      expect(localDay(r.data.start, p.coords.lng)).toBe(p.date);
    });
  }

  it("the briefing's sunset and dark window are the same evening", () => {
    const p = PLACES[0]!;
    const r = getTonightsBriefing({ coords: p.coords, date: p.date });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(localDay(r.data.sun.sunset, p.coords.lng)).toBe(p.date);
    expect(Date.parse(r.data.referenceTime)).toBeGreaterThan(Date.parse(r.data.sun.sunset!));
  });

  it("rejects impossible calendar dates", () => {
    expect(getSunTimes({ coords: PLACES[0]!.coords, date: "2026-02-30" }).ok).toBe(false);
  });

  it("keeps instant semantics for full timestamps", () => {
    // UTC midnight on the 21st is 4 PM on the 20th in Pacific time, so the
    // next sunset after that instant is the evening of the 20th.
    const r = getSunTimes({ coords: PLACES[0]!.coords, date: "2026-11-21T00:00:00Z" });
    expect(r.ok && localDay(r.data.sunset, PLACES[0]!.coords.lng)).toBe("2026-11-20");
  });
});

describe("meteor showers follow the requested night", () => {
  it("evaluates showers on the local night of a date-only input", () => {
    // 2026-08-11 in US Pacific is the night of Aug 11-12, the Perseid peak night.
    const r = getTonightsBriefing({ coords: { lat: 48.406, lng: -122.643 }, date: "2026-08-11" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const perseids = r.data.activeMeteorShowers.find((s) => s.id === "perseids");
    expect(perseids?.daysToPeak).toBe(0);
  });
});
