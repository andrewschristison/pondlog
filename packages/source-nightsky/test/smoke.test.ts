import { describe, expect, it } from "vitest";
import { getTonightsBriefing } from "../src/index.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };

describe.sequential("Night sky smoke (Port Angeles, WA)", () => {
  it("getTonightsBriefing returns a complete briefing on a fixed evening", () => {
    const result = getTonightsBriefing({
      coords: PORT_ANGELES,
      date: "2026-08-12T07:00:00Z", // Perseids peak — should surface in active showers
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const b = result.data;
    console.log("  highlight:", b.highlight);
    console.log(
      "  sun:",
      `rise ${b.sun.sunrise?.slice(11, 16)} set ${b.sun.sunset?.slice(11, 16)} astro-dusk ${b.sun.astronomicalDusk?.slice(11, 16) ?? "—"}`,
    );
    console.log(
      "  moon:",
      `${b.moon.emoji} ${b.moon.phase} (${(b.moon.illuminationFraction * 100).toFixed(0)}%)`,
    );
    console.log(
      "  dark sky:",
      `${b.darkSky.qualityLabel} (${b.darkSky.quality}/5), ${b.darkSky.hours.toFixed(1)} h`,
    );
    if (b.visiblePlanets.length > 0) {
      console.log(
        "  planets:",
        b.visiblePlanets
          .map((p) => `${p.name} ${p.direction} mag ${p.magnitude.toFixed(1)}`)
          .join(", "),
      );
    } else {
      console.log("  planets: none above 5° during dark");
    }
    if (b.activeMeteorShowers[0]) {
      const s = b.activeMeteorShowers[0];
      console.log(
        "  top shower:",
        `${s.name} (peak ${s.daysToPeak === 0 ? "tonight" : `${s.daysToPeak}d`}, ZHR ${s.zhr}, moon ${s.moonInterference})`,
      );
    }
    if (b.visibleConstellations[0]) {
      const c = b.visibleConstellations[0];
      console.log(
        "  top constellation:",
        `${c.name} ${c.direction} alt ${c.altitudeDeg.toFixed(0)}°`,
      );
    }

    // Plausibility checks.
    expect(b.sun.sunrise).not.toBeNull();
    expect(b.sun.sunset).not.toBeNull();
    expect(b.moon.illuminationFraction).toBeGreaterThanOrEqual(0);
    expect(b.moon.illuminationFraction).toBeLessThanOrEqual(1);
    expect(b.darkSky.quality).toBeGreaterThanOrEqual(1);
    expect(b.darkSky.quality).toBeLessThanOrEqual(5);
    // Perseids should be active mid-August.
    expect(b.activeMeteorShowers.some((s) => s.id === "perseids")).toBe(true);
    expect(b.visibleConstellations.length).toBeGreaterThan(0);
    expect(b.highlight.length).toBeGreaterThan(10);
  });

  it("getTonightsBriefing handles arctic polar day", () => {
    const result = getTonightsBriefing({
      coords: { lat: 70, lng: 0 },
      date: "2026-06-21T08:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.darkSky.hours).toBe(0);
    expect(result.data.darkSky.quality).toBeLessThanOrEqual(3);
  });
});
