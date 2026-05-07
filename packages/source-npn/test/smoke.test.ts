import { describe, expect, it } from "vitest";
import {
  bboxWkt,
  getActivePhenologyNearby,
  getObservations,
  getSpecies,
  getStationCountByState,
  getStations,
  getStationsByLocation,
  getStationsWithSpecies,
} from "../src/index.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };
const TIMEOUT = 90_000;

describe.sequential("NPN live smoke (Port Angeles, WA)", () => {
  it(
    "getSpecies returns the full catalog (~1900 records)",
    async () => {
      const result = await getSpecies();
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getSpecies: ${result.data.length} species`);
        expect(result.data.length).toBeGreaterThan(1000);
      }
    },
    TIMEOUT,
  );

  it(
    "getStationCountByState lists all 50+ states",
    async () => {
      const result = await getStationCountByState();
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getStationCountByState: ${result.data.length} states`);
        expect(result.data.length).toBeGreaterThan(40);
      }
    },
    TIMEOUT,
  );

  it(
    "getStations({ stateCode: 'WA' }) returns Washington stations",
    async () => {
      const result = await getStations({ stateCode: "WA" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getStations(WA): ${result.data.length} stations`);
        expect(result.data.length).toBeGreaterThan(100);
      }
    },
    TIMEOUT,
  );

  it(
    "getStationsByLocation with a Port Angeles bounding box",
    async () => {
      const wkt = bboxWkt(PORT_ANGELES, 25);
      const result = await getStationsByLocation({ wkt });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getStationsByLocation(PA bbox 25km): ${result.data.length} stations`);
      }
    },
    TIMEOUT,
  );

  it(
    "getStationsWithSpecies for species_id=210 (saguaro)",
    async () => {
      // species_id=3 has a known upstream NPN bug (rnpn issue #38) that
      // returns an empty body. We use saguaro (210) which is reliable.
      const result = await getStationsWithSpecies({ speciesIds: [210] });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getStationsWithSpecies(210): ${result.data.length} stations`);
        expect(result.data.length).toBeGreaterThan(0);
      }
    },
    TIMEOUT,
  );

  it(
    "getStationsWithSpecies handles upstream empty-body bug for species_id=3",
    async () => {
      const result = await getStationsWithSpecies({ speciesIds: [3] });
      // The upstream NPN bug returns HTTP 200 with empty body. We translate
      // that to an empty array so callers don't crash on JSON.parse.
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getStationsWithSpecies(3) [bugged species]: ${result.data.length} stations`);
        expect(result.data.length).toBe(0);
      }
    },
    TIMEOUT,
  );

  it(
    "getObservations refuses unbounded calls",
    async () => {
      // No narrowing filter — must fail at the source boundary, no network call.
      const result = await getObservations({ years: [2024] });
      expect(result.ok).toBe(false);
    },
    TIMEOUT,
  );

  it(
    "getObservations with state=WA + species=3 + year=2024",
    async () => {
      const result = await getObservations({
        years: [2024],
        speciesIds: [3],
        states: ["WA"],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getObservations(WA, sp=3, 2024): ${result.data.length} obs`);
      }
    },
    TIMEOUT,
  );

  it(
    "getActivePhenologyNearby Port Angeles 50km, 2 years",
    async () => {
      const result = await getActivePhenologyNearby({
        coords: PORT_ANGELES,
        radiusKm: 50,
        yearsBack: 2,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(
          `  getActivePhenologyNearby: ${result.data.entries.length} phenometric rows across ${result.data.stationsSearched} stations`,
        );
        if (result.data.entries[0]) {
          const top = result.data.entries[0];
          console.log(
            `    most recent: ${top.commonName} - ${top.phenophaseDescription} - last yes ${top.meanLastYesDate ?? "n/a"}`,
          );
        }
      }
    },
    150_000,
  );
});
