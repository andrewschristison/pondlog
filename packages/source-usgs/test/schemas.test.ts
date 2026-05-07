import { describe, expect, it } from "vitest";
import {
  bboxAround,
  getDailyValues,
  getInstantaneousValues,
  getSiteInfo,
  searchSites,
} from "../src/index.js";
import {
  denull,
  groupBySite,
  normalizeRdbSite,
  parseRdb,
} from "../src/normalize.js";
import {
  UsgsResponseSchema,
  UsgsTimeSeriesSchema,
} from "../src/schemas.js";

describe("USGS Zod schemas", () => {
  it("parses an /iv/ response with discharge + gage height", () => {
    const sample = {
      name: "ns1:timeSeriesResponseType",
      value: {
        queryInfo: { criteria: { locationParam: "[ALL:12045500]" } },
        timeSeries: [
          {
            sourceInfo: {
              siteName: "ELWHA RIVER AT MCDONALD BR NEAR PORT ANGELES, WA",
              siteCode: [
                { value: "12045500", network: "NWIS", agencyCode: "USGS" },
              ],
              timeZoneInfo: {
                defaultTimeZone: { zoneOffset: "-08:00", zoneAbbreviation: "PST" },
              },
              geoLocation: {
                geogLocation: {
                  srs: "EPSG:4326",
                  latitude: 48.05478018,
                  longitude: -123.5832136,
                },
              },
            },
            variable: {
              variableCode: [
                {
                  value: "00060",
                  network: "NWIS",
                  variableID: 45807197,
                  default: true,
                },
              ],
              variableName: "Streamflow, ft&#179;/s",
              variableDescription: "Discharge, cubic feet per second",
              valueType: "Derived Value",
              unit: { unitCode: "ft3/s" },
              options: {
                option: [{ name: "Statistic", optionCode: "00000" }],
              },
              noDataValue: -999999.0,
            },
            values: [
              {
                value: [
                  {
                    value: "1320",
                    qualifiers: ["P"],
                    dateTime: "2026-05-07T13:15:00.000-07:00",
                  },
                ],
                qualifier: [
                  {
                    qualifierCode: "P",
                    qualifierDescription: "Provisional data subject to revision.",
                  },
                ],
                method: [{ methodDescription: "", methodID: 150691 }],
              },
            ],
            name: "USGS:12045500:00060:00000",
          },
        ],
      },
    };
    expect(UsgsResponseSchema.safeParse(sample).success).toBe(true);
  });

  it("parses an empty /iv/ response (unknown site)", () => {
    const sample = {
      name: "ns1:timeSeriesResponseType",
      value: { timeSeries: [] },
    };
    expect(UsgsResponseSchema.safeParse(sample).success).toBe(true);
  });

  it("parses a /dv/ entry with statistic option", () => {
    const sample = {
      sourceInfo: {
        siteName: "ELWHA RIVER",
        siteCode: [{ value: "12045500" }],
        geoLocation: {
          geogLocation: { latitude: 48, longitude: -123 },
        },
      },
      variable: {
        variableCode: [{ value: "00060" }],
        variableName: "Streamflow",
        unit: { unitCode: "ft3/s" },
        options: {
          option: [{ value: "Mean", name: "Statistic", optionCode: "00003" }],
        },
        noDataValue: -999999,
      },
      values: [
        {
          value: [
            {
              value: "1040",
              qualifiers: ["P"],
              dateTime: "2026-04-30T00:00:00.000",
            },
          ],
        },
      ],
      name: "USGS:12045500:00060:00003",
    };
    expect(UsgsTimeSeriesSchema.safeParse(sample).success).toBe(true);
  });
});

describe("normalize", () => {
  it("denull strips -999999 sentinel and non-finite numbers", () => {
    expect(denull(-999999)).toBe(undefined);
    expect(denull(Number.NaN)).toBe(undefined);
    expect(denull(undefined)).toBe(undefined);
    expect(denull(0)).toBe(0);
    expect(denull(42.5)).toBe(42.5);
  });

  it("groupBySite collapses two parameters for a single site into one reading", () => {
    const ts = UsgsResponseSchema.parse({
      value: {
        timeSeries: [
          {
            sourceInfo: {
              siteName: "ELWHA",
              siteCode: [{ value: "12045500", agencyCode: "USGS" }],
              geoLocation: {
                geogLocation: { latitude: 48.05, longitude: -123.58 },
              },
            },
            variable: {
              variableCode: [{ value: "00060" }],
              variableName: "Streamflow, ft&#179;/s",
              unit: { unitCode: "ft3/s" },
              noDataValue: -999999.0,
            },
            values: [
              {
                value: [
                  { value: "1320", qualifiers: ["P"], dateTime: "2026-05-07T13:15:00-07:00" },
                ],
              },
            ],
            name: "USGS:12045500:00060:00000",
          },
          {
            sourceInfo: {
              siteName: "ELWHA",
              siteCode: [{ value: "12045500", agencyCode: "USGS" }],
              geoLocation: {
                geogLocation: { latitude: 48.05, longitude: -123.58 },
              },
            },
            variable: {
              variableCode: [{ value: "00065" }],
              variableName: "Gage height, ft",
              unit: { unitCode: "ft" },
              noDataValue: -999999.0,
            },
            values: [
              {
                value: [
                  { value: "10.58", qualifiers: ["P"], dateTime: "2026-05-07T13:15:00-07:00" },
                ],
              },
            ],
            name: "USGS:12045500:00065:00000",
          },
        ],
      },
    }).value.timeSeries;

    const readings = groupBySite(ts);
    expect(readings).toHaveLength(1);
    const reading = readings[0]!;
    expect(reading.site.siteNumber).toBe("12045500");
    expect(reading.series).toHaveLength(2);
    const codes = reading.series.map((s) => s.parameterCode).sort();
    expect(codes).toEqual(["00060", "00065"]);
    // HTML entity decoded:
    expect(reading.series[0]!.variableName).toContain("ft³/s");
    expect(reading.series[0]!.values[0]!.value).toBeCloseTo(1320, 2);
  });

  it("normalize translates noDataValue sentinel to undefined", () => {
    const ts = UsgsResponseSchema.parse({
      value: {
        timeSeries: [
          {
            sourceInfo: {
              siteName: "X",
              siteCode: [{ value: "12345678" }],
              geoLocation: { geogLocation: { latitude: 48, longitude: -123 } },
            },
            variable: {
              variableCode: [{ value: "00060" }],
              variableName: "Streamflow",
              unit: { unitCode: "ft3/s" },
              noDataValue: -999999.0,
            },
            values: [
              {
                value: [
                  { value: "-999999", qualifiers: [], dateTime: "2026-05-07T00:00:00Z" },
                  { value: "100", qualifiers: ["A"], dateTime: "2026-05-07T01:00:00Z" },
                ],
              },
            ],
            name: "USGS:12345678:00060",
          },
        ],
      },
    }).value.timeSeries;
    const reading = groupBySite(ts)[0]!;
    expect(reading.series[0]!.values[0]!.value).toBe(undefined);
    expect(reading.series[0]!.values[1]!.value).toBe(100);
  });

  it("parseRdb skips comments and the type/width row", () => {
    const body = [
      "# header comment",
      "# another comment",
      "agency_cd\tsite_no\tstation_nm\tdec_lat_va\tdec_long_va",
      "5s\t15s\t50s\t16s\t16s",
      "USGS\t12045500\tELWHA RIVER\t48.054\t-123.583",
      "USGS\t12048000\tDUNGENESS RIVER\t48.014\t-123.132",
    ].join("\n");
    const rows = parseRdb(body);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.site_no).toBe("12045500");
    expect(rows[1]?.station_nm).toBe("DUNGENESS RIVER");
  });

  it("normalizeRdbSite parses lat/lng + identifiers", () => {
    const row = {
      agency_cd: "USGS",
      site_no: "12045500",
      station_nm: "ELWHA RIVER AT MCDONALD BR NEAR PORT ANGELES, WA",
      site_tp_cd: "ST",
      dec_lat_va: "48.05478018",
      dec_long_va: "-123.5832136",
      huc_cd: "17110020",
      state_cd: "53",
      county_cd: "53009",
      alt_va: "204.11",
    };
    const site = normalizeRdbSite(row);
    expect(site.siteNumber).toBe("12045500");
    expect(site.coordinates?.lat).toBeCloseTo(48.05, 2);
    expect(site.hucCode).toBe("17110020");
    expect(site.altitudeFt).toBeCloseTo(204.11, 2);
  });

  it("bboxAround produces a sensible square around Port Angeles", () => {
    const bbox = bboxAround({ lat: 48.118, lng: -123.4307 }, 25);
    const [w, s, e, n] = bbox;
    expect(e).toBeGreaterThan(w);
    expect(n).toBeGreaterThan(s);
    expect(n - s).toBeGreaterThan(0);
    expect(n - s).toBeLessThan(1);
  });
});

describe("boundary validation", () => {
  it("getInstantaneousValues rejects malformed site numbers", async () => {
    const r = await getInstantaneousValues({ sites: ["ABC123"] });
    expect(r.ok).toBe(false);
  });

  it("getInstantaneousValues rejects bad parameter codes", async () => {
    const r = await getInstantaneousValues({
      sites: ["12045500"],
      parameterCodes: ["6"],
    });
    expect(r.ok).toBe(false);
  });

  it("getDailyValues rejects period + startDt combination", async () => {
    const r = await getDailyValues({
      sites: ["12045500"],
      period: "P7D",
      startDt: "2024-01-01",
    });
    expect(r.ok).toBe(false);
  });

  it("getDailyValues rejects malformed dates", async () => {
    const r = await getDailyValues({
      sites: ["12045500"],
      startDt: "2024/01/01",
    });
    expect(r.ok).toBe(false);
  });

  it("searchSites requires at least one filter", async () => {
    const r = await searchSites({});
    expect(r.ok).toBe(false);
  });

  it("searchSites rejects degenerate bbox", async () => {
    const r = await searchSites({ bbox: [-123, 47, -123, 47] });
    expect(r.ok).toBe(false);
  });

  it("getSiteInfo rejects malformed site numbers", async () => {
    const r = await getSiteInfo({ siteNumber: "abc" });
    expect(r.ok).toBe(false);
  });
});
