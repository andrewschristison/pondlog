import { describe, expect, it } from "vitest";
import {
  bboxAround,
  getObservation,
  getRecentNearLocation,
  getSpeciesCountByLocation,
  searchNames,
  searchObservations,
  searchRegions,
} from "../src/index.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };

describe("source-mushroomobserver live smoke", () => {
  it("bboxAround produces a usable bbox around Port Angeles", () => {
    const box = bboxAround(PORT_ANGELES, 25);
    expect(box.north).toBeGreaterThan(48);
    expect(box.south).toBeLessThan(48.5);
    expect(box.east).toBeGreaterThan(-124);
    expect(box.west).toBeLessThan(-123);
  });

  it("searchObservations(coords + radius) returns Port Angeles area observations", async () => {
    const res = await searchObservations({
      coords: PORT_ANGELES,
      radiusKm: 25,
      detail: "low",
      page: 1,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.numberOfRecords).toBeGreaterThan(0);
    expect(res.data.observations.length).toBeGreaterThan(0);
    const first = res.data.observations[0];
    if (!first) throw new Error("no observations returned");
    expect(typeof first.id).toBe("number");
    expect(typeof first.url).toBe("string");
  }, 30_000);

  it("searchObservations refuses unbounded queries", async () => {
    const res = await searchObservations({});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain("at least one of");
  });

  it("searchNames finds Cantharellus species", async () => {
    const res = await searchNames({ query: "Cantharellus" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.names.length).toBeGreaterThan(0);
    expect(
      res.data.names.some((n) => n.scientificName.includes("Cantharellus")),
    ).toBe(true);
  }, 30_000);

  it("searchRegions discovers location names ending in 'Clallam Co., Washington, USA'", async () => {
    const res = await searchRegions({
      query: "Clallam Co., Washington, USA",
      maxPages: 1,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.regions.length).toBeGreaterThan(0);
    expect(
      res.data.regions.every((r) =>
        r.name.endsWith("Clallam Co., Washington, USA"),
      ),
    ).toBe(true);
  }, 30_000);

  it("getObservation returns a high-detail single record", async () => {
    const res = await getObservation(187521);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.id).toBe(187521);
    expect(res.data.locationName).toContain("Port Angeles");
  }, 30_000);

  it("getRecentNearLocation accepts coords + radius", async () => {
    const res = await getRecentNearLocation({
      coords: PORT_ANGELES,
      radiusKm: 50,
      days: 365,
      limit: 10,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.windowDays).toBe(365);
  }, 60_000);

  it("getSpeciesCountByLocation aggregates by consensus name in a region", async () => {
    const res = await getSpeciesCountByLocation({
      region: "Clallam Co., Washington, USA",
      daysBack: 1825, // 5 years
      maxPages: 1,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.observationsScanned).toBeGreaterThanOrEqual(0);
  }, 60_000);
});
