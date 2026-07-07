/* NPN contract test: the drift guard.
 *
 * getSiteLevelData silently 400ed in production for ~6 weeks (from ~2026-05-26)
 * when NPN made `start_date`/`end_date` required and stopped honoring `years[]`.
 * These live assertions fail LOUDLY, by name, the next time the request or
 * response contract moves, instead of degrading to a dark tier in a consumer.
 *
 * Run standalone:  pnpm --filter @pondlog/source-npn run test:contract
 * The plain `test` script excludes live tests (smoke + contract); a CI job that
 * should gate on upstream health runs `test:contract` explicitly.
 */

import { describe, expect, it } from "vitest";
import { getActivePhenologyNearby, getSiteLevelData } from "../src/index.js";

const BASE_URL = "https://services.usanpn.org/npn_portal";
const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };
const TIMEOUT = 120_000;

// The exact wire fields normalize.ts reads off each getSiteLevelData row. If
// NPN renames or drops any of these, the parser silently loses data. Assert
// them by name so a response-shape drift is caught here, not downstream.
const REQUIRED_ROW_FIELDS = [
  "site_id",
  "species_id",
  "phenophase_id",
  "phenophase_description",
  "common_name",
  "genus",
  "species",
  "kingdom",
  "latitude",
  "longitude",
  "mean_first_yes_julian_date",
  "mean_last_yes_julian_date",
] as const;

describe.sequential("NPN getSiteLevelData contract", () => {
  it(
    "the endpoint still REQUIRES start_date/end_date (pins the 2026-05 change)",
    async () => {
      // A raw call in the old shape (years[], no dates) must still 400 with the
      // known message. If this ever returns 200, NPN relaxed the requirement and
      // the derived-window fallback logic can be revisited.
      const url = `${BASE_URL}/observations/getSiteLevelData.json?request_src=pondlog&years%5B0%5D=2025&state%5B0%5D=WA`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string };
      console.log(`  no-dates call -> HTTP ${res.status}: ${body.error}`);
      expect(String(body.error ?? "")).toMatch(/start_date and end_date are required/i);
    },
    TIMEOUT,
  );

  it(
    "returns HTTP 200 and the response shape the parser depends on",
    async () => {
      // species_id=17 (Virginia strawberry) reliably has US-wide data in any
      // recent 2-month window; keeps this assertion independent of one station.
      const now = new Date();
      const endDate = now.toISOString().slice(0, 10);
      const startDate = new Date(now.getTime() - 60 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const raw = `species_id%5B0%5D=17`;
      const url = `${BASE_URL}/observations/getSiteLevelData.json?request_src=pondlog&start_date=${startDate}&end_date=${endDate}&${raw}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      expect(res.status).toBe(200);
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      const first = rows[0];
      const missing = REQUIRED_ROW_FIELDS.filter((f) => !(f in first));
      console.log(
        `  dated call -> HTTP 200, ${rows.length} rows, missing fields: [${missing.join(", ") || "none"}]`,
      );
      expect(missing).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "getSiteLevelData (the fixed client) returns ok with the new date window",
    async () => {
      const now = new Date();
      const endDate = now.toISOString().slice(0, 10);
      const startDate = new Date(now.getTime() - 60 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const result = await getSiteLevelData({
        startDate,
        endDate,
        speciesIds: [17],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getSiteLevelData(dates, sp=17): ${result.data.length} rows`);
        expect(result.data.length).toBeGreaterThan(0);
      }
    },
    TIMEOUT,
  );

  it(
    "getSiteLevelData rejects a call with no date window and no years",
    async () => {
      // The client must fail at the boundary rather than 400 at the wire.
      const result = await getSiteLevelData({ speciesIds: [17] });
      expect(result.ok).toBe(false);
    },
    TIMEOUT,
  );

  it(
    "getActivePhenologyNearby (kiosk path) completes and returns a well-formed result",
    async () => {
      // Asserts the CONTRACT and composed round-trip, not data richness at a
      // specific place: how many phenometric rows a location yields depends on
      // NPN citizen-science density + the window, which is the consumer's
      // freshness concern (see the kiosk's verify-freshness), not the SDK's.
      const result = await getActivePhenologyNearby({
        coords: PORT_ANGELES,
        radiusKm: 50,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(
          `  getActivePhenologyNearby(PA, 50km, default ${result.data.windowDays}d): ${result.data.entries.length} rows across ${result.data.stationsSearched} stations`,
        );
        expect(result.data.windowDays).toBe(365);
        expect(result.data.stationsInRadius).toBeGreaterThan(0);
        const top = result.data.entries[0];
        if (top) {
          console.log(
            `    most recent: ${top.commonName} - ${top.phenophaseDescription} - last yes ${top.meanLastYesDate ?? "n/a"}`,
          );
        }
      }
    },
    150_000,
  );
});
