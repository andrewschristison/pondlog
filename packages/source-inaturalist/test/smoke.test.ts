import { describe, expect, it } from "vitest";
import {
  getIconicTaxaSummary,
  getNearbyObservations,
  getObservation,
  getObservers,
  getSpeciesCounts,
  getTaxon,
  searchObservations,
  searchPlaces,
  searchTaxa,
} from "../src/index.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };

const TIMEOUT = 30_000;

describe.sequential("iNaturalist live smoke (Port Angeles, WA)", () => {
  it(
    "searchObservations near Port Angeles",
    async () => {
      const result = await searchObservations({
        lat: PORT_ANGELES.lat,
        lng: PORT_ANGELES.lng,
        radiusKm: 25,
        perPage: 5,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  searchObservations: ${result.data.length} results`);
        if (result.data[0]) console.log("  sample:", result.data[0].commonName);
      }
    },
    TIMEOUT,
  );

  it(
    "getNearbyObservations 7-day window",
    async () => {
      const result = await getNearbyObservations(PORT_ANGELES, 25, 7);
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getNearbyObservations: ${result.data.length} results`);
      }
    },
    TIMEOUT,
  );

  it(
    "getSpeciesCounts near Port Angeles",
    async () => {
      const result = await getSpeciesCounts({
        lat: PORT_ANGELES.lat,
        lng: PORT_ANGELES.lng,
        radiusKm: 25,
        perPage: 10,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getSpeciesCounts: ${result.data.length} species`);
        if (result.data[0]) console.log("  top:", result.data[0].commonName, result.data[0].count);
      }
    },
    TIMEOUT,
  );

  it(
    "getIconicTaxaSummary near Port Angeles",
    async () => {
      const result = await getIconicTaxaSummary(PORT_ANGELES, 25, 14);
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log("  iconic totals:", JSON.stringify(result.data.totals));
      }
    },
    TIMEOUT,
  );

  it(
    "searchTaxa for 'Pacific chorus frog'",
    async () => {
      const result = await searchTaxa("Pacific chorus frog");
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  searchTaxa: ${result.data.length} results`);
        if (result.data[0]) console.log("  top:", result.data[0].name);
      }
    },
    TIMEOUT,
  );

  it(
    "getTaxon for first searchTaxa result (Pseudacris regilla)",
    async () => {
      const search = await searchTaxa("Pseudacris regilla");
      expect(search.ok).toBe(true);
      if (!search.ok) return;
      const first = search.data[0];
      expect(first).toBeDefined();
      if (!first) return;
      const result = await getTaxon(first.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log("  getTaxon:", result.data.name, "/", result.data.commonName);
      }
    },
    TIMEOUT,
  );

  it(
    "searchPlaces for 'Port Angeles'",
    async () => {
      const result = await searchPlaces("Port Angeles");
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  searchPlaces: ${result.data.length} results`);
        if (result.data[0]) console.log("  top:", result.data[0].displayName);
      }
    },
    TIMEOUT,
  );

  it(
    "getObservers near Port Angeles",
    async () => {
      const result = await getObservers(PORT_ANGELES, 25, 30);
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log(`  getObservers: ${result.data.length} observers`);
        if (result.data[0]) console.log("  top:", result.data[0].displayName);
      }
    },
    TIMEOUT,
  );

  it(
    "getObservation for a known observation id",
    async () => {
      const search = await searchObservations({
        lat: PORT_ANGELES.lat,
        lng: PORT_ANGELES.lng,
        radiusKm: 25,
        perPage: 1,
      });
      expect(search.ok).toBe(true);
      if (!search.ok) return;
      const first = search.data[0];
      if (!first) {
        console.log("  no observations found, skipping detail call");
        return;
      }
      const result = await getObservation(first.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log("  getObservation:", result.data.id, "/", result.data.commonName);
      }
    },
    TIMEOUT,
  );
});
