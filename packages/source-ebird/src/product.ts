import { err, type Result } from "@pondlog/core";
import { ebirdFetch } from "./client.js";
import {
  EbirdChecklistDetailSchema,
  EbirdChecklistSummaryListSchema,
  EbirdTop100ListSchema,
  type EbirdChecklistDetail,
  type EbirdChecklistSummary,
  type EbirdTop100Entry,
} from "./schemas.js";

export interface RecentChecklistsParams {
  /** Max results (1–200). Default 10. */
  maxResults?: number;
}

// 1. GET /product/lists/{regionCode}
export async function getRecentChecklists(
  regionCode: string,
  params: RecentChecklistsParams = {},
): Promise<Result<EbirdChecklistSummary[]>> {
  if (params.maxResults !== undefined && (params.maxResults < 1 || params.maxResults > 200)) {
    return err({ source: "ebird", message: `maxResults must be between 1 and 200, got ${params.maxResults}` });
  }
  return ebirdFetch(
    `/product/lists/${encodeURIComponent(regionCode)}`,
    EbirdChecklistSummaryListSchema,
    { searchParams: { maxResults: params.maxResults } },
  );
}

export interface Top100Params {
  /** "spp" (most species) or "cl" (most checklists). Default spp. */
  rankedBy?: "spp" | "cl";
  /** Max results (1–100). Default 100. */
  maxResults?: number;
}

// 2. GET /product/top100/{regionCode}/{y}/{m}/{d}
export async function getTop100(
  regionCode: string,
  year: number,
  month: number,
  day: number,
  params: Top100Params = {},
): Promise<Result<EbirdTop100Entry[]>> {
  if (!Number.isInteger(year) || year < 1800) {
    return err({ source: "ebird", message: `year must be an integer >= 1800, got ${year}` });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return err({ source: "ebird", message: `month must be 1–12, got ${month}` });
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return err({ source: "ebird", message: `day must be 1–31, got ${day}` });
  }
  if (params.maxResults !== undefined && (params.maxResults < 1 || params.maxResults > 100)) {
    return err({ source: "ebird", message: `maxResults must be between 1 and 100, got ${params.maxResults}` });
  }

  return ebirdFetch(
    `/product/top100/${encodeURIComponent(regionCode)}/${year}/${month}/${day}`,
    EbirdTop100ListSchema,
    { searchParams: { rankedBy: params.rankedBy, maxResults: params.maxResults } },
  );
}

// 3. GET /product/checklist/view/{subId}
export async function getChecklist(subId: string): Promise<Result<EbirdChecklistDetail>> {
  if (!subId.trim()) {
    return err({ source: "ebird", message: "getChecklist: subId is empty" });
  }
  return ebirdFetch(
    `/product/checklist/view/${encodeURIComponent(subId)}`,
    EbirdChecklistDetailSchema,
  );
}
