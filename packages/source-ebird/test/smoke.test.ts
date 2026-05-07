import { describe, expect, it } from "vitest";
import {
  getHistoricOnDate,
  getHotspotsInRegion,
  getNearbyNotable,
  getNearbyRecent,
  getRegionInfo,
} from "../src/index.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };
const CLALLAM = "US-WA-009";

const TIMEOUT = 30_000;
// Historic-on-date returns thousands of rows for whole states; scope to county
// and give it more headroom even then.
const HISTORIC_TIMEOUT = 60_000;

const HAS_KEY = typeof process.env.EBIRD_API_KEY === "string" && process.env.EBIRD_API_KEY.trim() !== "";

const suite = HAS_KEY ? describe.sequential : describe.skip;

suite("eBird live smoke (Port Angeles, WA)", () => {
  it(
    "getNearbyRecent",
    async () => {
      const result = await getNearbyRecent(PORT_ANGELES.lat, PORT_ANGELES.lng, { dist: 25, back: 7 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getNearbyRecent: ${result.data.length} observations`);
        if (result.data[0]) console.log("  sample:", result.data[0].comName, "@", result.data[0].locName);
      }
    },
    TIMEOUT,
  );

  it(
    "getNearbyNotable",
    async () => {
      const result = await getNearbyNotable(PORT_ANGELES.lat, PORT_ANGELES.lng, { dist: 50, back: 14 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getNearbyNotable: ${result.data.length} notable`);
        if (result.data[0]) console.log("  sample:", result.data[0].comName);
      }
    },
    TIMEOUT,
  );

  it(
    "getHotspotsInRegion (Clallam County)",
    async () => {
      const result = await getHotspotsInRegion(CLALLAM);
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getHotspotsInRegion: ${result.data.length} hotspots`);
        if (result.data[0]) console.log("  sample:", result.data[0].locName);
      }
    },
    TIMEOUT,
  );

  it(
    "getHistoricOnDate (Clallam, 2025-05-01)",
    async () => {
      const result = await getHistoricOnDate(CLALLAM, 2025, 5, 1, { maxResults: 50 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getHistoricOnDate: ${result.data.length} observations`);
        if (result.data[0]) console.log("  sample:", result.data[0].comName);
      }
    },
    HISTORIC_TIMEOUT,
  );

  it(
    "getRegionInfo (Clallam County)",
    async () => {
      const result = await getRegionInfo(CLALLAM);
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log("  getRegionInfo:", result.data.result);
      }
    },
    TIMEOUT,
  );
});

if (!HAS_KEY) {
  describe("eBird live smoke", () => {
    it("skipped — EBIRD_API_KEY not set", () => {
      console.log("  Set EBIRD_API_KEY in your environment to run live smoke tests.");
      expect(true).toBe(true);
    });
  });
}
