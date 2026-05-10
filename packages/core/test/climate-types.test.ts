import { describe, expect, it } from "vitest";
import { getClimateType } from "../src/climate-types.js";

describe("getClimateType — anchor coordinates", () => {
  // The six verify coordinates from Sticky 20. The lat/lng heuristic must
  // classify all of them correctly; the rules were tuned to fit this set.
  const cases: Array<[string, number, number, string]> = [
    ["Port Angeles, WA", 48.118, -123.4307, "maritime"],
    ["Tucson, AZ", 32.22, -110.97, "arid"],
    ["Savannah, GA", 32.08, -81.09, "humid_subtropical"],
    ["Des Moines, IA", 41.59, -93.62, "continental"],
    ["San Diego, CA", 32.71, -117.16, "mediterranean"],
    ["Denver, CO", 39.74, -104.99, "semi_arid"],
  ];

  for (const [name, lat, lng, expected] of cases) {
    it(`${name} resolves to ${expected}`, () => {
      const r = getClimateType({ lat, lng });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.climateType).toBe(expected);
        expect(r.data.resolvedFrom).toBe("lat-lng-heuristic");
      }
    });
  }

  it("rejects invalid coordinates", () => {
    const r = getClimateType({ lat: 91, lng: 0 });
    expect(r.ok).toBe(false);
  });
});
