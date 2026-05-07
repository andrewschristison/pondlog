import { describe, expect, it } from "vitest";
import { parseLatLngString, validateCoordinates } from "../src/coords.js";

describe("validateCoordinates", () => {
  it("accepts valid coords", () => {
    expect(validateCoordinates({ lat: 48.118, lng: -123.43 })).toBe(true);
  });
  it("rejects out-of-range", () => {
    expect(validateCoordinates({ lat: 91, lng: 0 })).toBe(false);
    expect(validateCoordinates({ lat: 0, lng: -181 })).toBe(false);
  });
  it("rejects non-objects", () => {
    expect(validateCoordinates(null)).toBe(false);
    expect(validateCoordinates("48,−123")).toBe(false);
  });
});

describe("parseLatLngString", () => {
  it("parses iNat-style strings", () => {
    expect(parseLatLngString("48.118,-123.43")).toEqual({ lat: 48.118, lng: -123.43 });
    expect(parseLatLngString(" 48.1 , -123.4 ")).toEqual({ lat: 48.1, lng: -123.4 });
  });
  it("returns null on garbage", () => {
    expect(parseLatLngString(null)).toBeNull();
    expect(parseLatLngString("")).toBeNull();
    expect(parseLatLngString("not,a,point")).toBeNull();
    expect(parseLatLngString("nope,nope")).toBeNull();
    expect(parseLatLngString("999,0")).toBeNull();
  });
});
