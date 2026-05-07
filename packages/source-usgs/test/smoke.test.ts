import { describe, expect, it } from "vitest";
import {
  bboxAround,
  getDailyValues,
  getInstantaneousValues,
  getSiteInfo,
  searchSites,
} from "../src/index.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };
const ELWHA_SITE = "12045500";
const DUNGENESS_SITE = "12048000";
const TIMEOUT = 60_000;

describe.sequential("USGS live smoke (Elwha + Dungeness near Port Angeles)", () => {
  it(
    "getInstantaneousValues returns discharge + gage height for Elwha",
    async () => {
      const r = await getInstantaneousValues({
        sites: [ELWHA_SITE],
        period: "PT2H",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.length).toBe(1);
        const reading = r.data[0]!;
        console.log(
          `  Elwha IV: ${reading.site.siteName} — ${reading.series.length} series`,
        );
        for (const s of reading.series) {
          const last = s.values[s.values.length - 1];
          console.log(
            `    ${s.parameterCode} ${s.variableName}: ${last?.value ?? "n/a"} ${s.unitCode} @ ${last?.dateTime ?? "n/a"}`,
          );
        }
        const codes = reading.series.map((s) => s.parameterCode).sort();
        expect(codes).toEqual(["00060", "00065"]);
      }
    },
    TIMEOUT,
  );

  it(
    "getInstantaneousValues works for Dungeness",
    async () => {
      const r = await getInstantaneousValues({
        sites: [DUNGENESS_SITE],
        period: "PT1H",
        parameterCodes: ["00060"],
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data[0]?.site.siteNumber).toBe(DUNGENESS_SITE);
        const last = r.data[0]?.series[0]?.values.at(-1);
        console.log(
          `  Dungeness IV: ${last?.value ?? "n/a"} ft3/s @ ${last?.dateTime ?? "n/a"}`,
        );
      }
    },
    TIMEOUT,
  );

  it(
    "getInstantaneousValues for an unknown site returns an empty array",
    async () => {
      const r = await getInstantaneousValues({
        sites: ["99999999"],
        period: "PT1H",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data).toEqual([]);
      }
    },
    TIMEOUT,
  );

  it(
    "getDailyValues returns 7 daily means for Elwha",
    async () => {
      const r = await getDailyValues({
        sites: [ELWHA_SITE],
        period: "P7D",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const reading = r.data[0]!;
        const series = reading.series[0]!;
        console.log(
          `  Elwha DV (P7D): ${series.values.length} daily values, statistic=${series.statistic ?? "n/a"}`,
        );
        expect(series.values.length).toBeGreaterThanOrEqual(5);
      }
    },
    TIMEOUT,
  );

  it(
    "getDailyValues with explicit startDt/endDt for January 2024",
    async () => {
      const r = await getDailyValues({
        sites: [ELWHA_SITE],
        startDt: "2024-01-01",
        endDt: "2024-01-05",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const series = r.data[0]?.series[0];
        expect(series?.values.length).toBe(5);
      }
    },
    TIMEOUT,
  );

  it(
    "getSiteInfo returns metadata for Elwha",
    async () => {
      const r = await getSiteInfo({ siteNumber: ELWHA_SITE });
      expect(r.ok).toBe(true);
      if (r.ok) {
        console.log(
          `  Elwha site info: ${r.data.siteName} (${r.data.coordinates?.lat.toFixed(3)}, ${r.data.coordinates?.lng.toFixed(3)})`,
        );
        expect(r.data.siteName).toContain("ELWHA");
        expect(r.data.coordinates?.lat).toBeCloseTo(48.05, 1);
      }
    },
    TIMEOUT,
  );

  it(
    "searchSites finds streams near Port Angeles",
    async () => {
      const bbox = bboxAround(PORT_ANGELES, 25);
      const r = await searchSites({ bbox });
      expect(r.ok).toBe(true);
      if (r.ok) {
        console.log(`  Sites near PA bbox: ${r.data.length} stream sites`);
        expect(r.data.length).toBeGreaterThan(0);
        const sites = r.data.map((s) => s.siteNumber);
        // Elwha at McDonald Br should be in the bbox.
        expect(sites).toContain(ELWHA_SITE);
      }
    },
    TIMEOUT,
  );

  it(
    "searchSites by stateCode returns Washington stream sites",
    async () => {
      const r = await searchSites({ stateCode: "WA" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        console.log(`  WA stream sites: ${r.data.length}`);
        expect(r.data.length).toBeGreaterThan(50);
      }
    },
    TIMEOUT,
  );
});
