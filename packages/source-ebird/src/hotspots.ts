import { err, ok, type Place, type Result } from "@pondlog/core";
import { ebirdFetch } from "./client.js";
import { normalizeHotspot, normalizeHotspotInfo } from "./normalize.js";
import {
  EbirdHotspotInfoSchema,
  EbirdHotspotListSchema,
  type EbirdHotspot,
  type EbirdHotspotInfo,
} from "./schemas.js";

export interface HotspotsInRegionParams {
  /** Days back filter on latest activity (1–30). */
  back?: number;
}

// 1. GET /ref/hotspot/{regionCode}
export async function getHotspotsInRegion(
  regionCode: string,
  params: HotspotsInRegionParams = {},
): Promise<Result<EbirdHotspot[]>> {
  if (params.back !== undefined && (params.back < 1 || params.back > 30)) {
    return err({ source: "ebird", message: `back must be between 1 and 30, got ${params.back}` });
  }
  return ebirdFetch(
    `/ref/hotspot/${encodeURIComponent(regionCode)}`,
    EbirdHotspotListSchema,
    { searchParams: { back: params.back, fmt: "json" } },
  );
}

export interface NearbyHotspotsParams {
  /** Search radius in km (0–50). Default 25. */
  dist?: number;
  /** Days back filter on latest activity (1–30). */
  back?: number;
}

// 2. GET /ref/hotspot/geo
export async function getNearbyHotspots(
  lat: number,
  lng: number,
  params: NearbyHotspotsParams = {},
): Promise<Result<EbirdHotspot[]>> {
  if (params.dist !== undefined && (params.dist < 0 || params.dist > 50)) {
    return err({ source: "ebird", message: `dist must be between 0 and 50 km, got ${params.dist}` });
  }
  if (params.back !== undefined && (params.back < 1 || params.back > 30)) {
    return err({ source: "ebird", message: `back must be between 1 and 30, got ${params.back}` });
  }
  return ebirdFetch("/ref/hotspot/geo", EbirdHotspotListSchema, {
    searchParams: { lat, lng, dist: params.dist, back: params.back, fmt: "json" },
  });
}

// 3. GET /ref/hotspot/info/{locId}
export async function getHotspotInfo(locId: string): Promise<Result<EbirdHotspotInfo>> {
  if (!locId.trim()) {
    return err({ source: "ebird", message: "getHotspotInfo: locId is empty" });
  }
  return ebirdFetch(
    `/ref/hotspot/info/${encodeURIComponent(locId)}`,
    EbirdHotspotInfoSchema,
  );
}

// Convenience: normalized variants
export async function getHotspotsInRegionNormalized(
  regionCode: string,
  params: HotspotsInRegionParams = {},
): Promise<Result<Place[]>> {
  const result = await getHotspotsInRegion(regionCode, params);
  if (!result.ok) return result;
  return ok(result.data.map(normalizeHotspot));
}

export async function getNearbyHotspotsNormalized(
  lat: number,
  lng: number,
  params: NearbyHotspotsParams = {},
): Promise<Result<Place[]>> {
  const result = await getNearbyHotspots(lat, lng, params);
  if (!result.ok) return result;
  return ok(result.data.map(normalizeHotspot));
}

export async function getHotspotInfoNormalized(locId: string): Promise<Result<Place>> {
  const result = await getHotspotInfo(locId);
  if (!result.ok) return result;
  return ok(normalizeHotspotInfo(result.data));
}
