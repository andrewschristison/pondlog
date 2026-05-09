import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  err,
  findCrop,
  getCropsForZone,
  getFrostDates,
  getHardinessZone,
  getHardinessZoneByZip,
  getPlantingPlan,
  searchCrops,
  type CropCategory,
  type CropEntry,
  type GardenBriefing,
  type ZoneInfo,
} from "@pondlog/core";
import {
  getGrowingGuide,
  hasTrefleToken,
  searchPlants,
  type GrowingGuide,
  type TreflePlantSummary,
} from "@pondlog/source-trefle";
import { z } from "zod";
import { failure, success } from "./respond.js";
import {
  categoryField,
  dateField,
  latField,
  limitField,
  lngField,
  padDaysField,
  queryField,
  slugOrNameField,
  zipField,
  zoneField,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerAllTools(server: McpServer): void {
  registerGetHardinessZone(server);
  registerGetPlantingPlan(server);
  registerGetCropDetails(server);
  registerSearchPlants(server);
  registerGetCropsForZone(server);
}

// ---------------------------------------------------------------------------
// 1. get_hardiness_zone
// ---------------------------------------------------------------------------

function registerGetHardinessZone(server: McpServer): void {
  server.registerTool(
    "get_hardiness_zone",
    {
      title: "Look up USDA Plant Hardiness Zone",
      description:
        "Returns the USDA hardiness zone (1a..13b) and typical first/last frost dates for a US location. " +
        "Provide either lat+lng (resolves to nearest ZIP centroid in the bundled 40,283-ZIP PRISM 2023 dataset) or a 5-digit zip (exact match when present). " +
        "The zone object includes the 5°F temperature band (min/max winter °F), and frostDates includes lastSpring (MM-DD), firstFall (MM-DD), and seasonDays. " +
        "Coastal, mountain, and desert microclimates can shift frost dates 2-3 weeks from the table — surface this caveat to gardeners. " +
        "No API key required; works fully offline.",
      inputSchema: {
        lat: latField.optional(),
        lng: lngField.optional(),
        zip: zipField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      let zoneRes: ReturnType<typeof getHardinessZone>;
      if (args.zip) {
        zoneRes = getHardinessZoneByZip(args.zip);
      } else if (args.lat !== undefined && args.lng !== undefined) {
        zoneRes = getHardinessZone({ lat: args.lat, lng: args.lng });
      } else {
        return failure({
          source: "mcp-garden",
          message:
            "get_hardiness_zone: provide either {lat, lng} or {zip}",
        });
      }
      if (!zoneRes.ok) return failure(zoneRes.error);
      const frost = getFrostDates(zoneRes.data.zone);
      return success({
        zone: zoneRes.data,
        frostDates: frost.ok ? frost.data : null,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 2. get_planting_plan
// ---------------------------------------------------------------------------

function registerGetPlantingPlan(server: McpServer): void {
  server.registerTool(
    "get_planting_plan",
    {
      title: "What to Plant Now (USDA Zone + Frost-Anchored Calendar)",
      description:
        "Returns a list of crops to plant in the supplied date window, drawn from the bundled 500-crop calendar (USDA Cooperative Extension publications). " +
        "Provide a USDA zone string ('5b', '8b') OR a coordinate pair / zip — coordinates resolve to a zone via the same lookup as `get_hardiness_zone`. " +
        "Each suggestion has: action (start_indoors / direct_sow / transplant / plant_now), windowStart..windowEnd (ISO dates anchored to the zone's typical frost dates), daysToHarvest range, and expectedHarvestEarliest. " +
        "If expectedHarvestEarliest lands past the typical first fall frost the crop is unlikely to finish — surface that to the user. " +
        "For a strict view pass padDays:0 (default). For 'almost in window' pass padDays:7 or 14. " +
        "No API key required; works offline.",
      inputSchema: {
        zone: zoneField.optional(),
        lat: latField.optional(),
        lng: lngField.optional(),
        zip: zipField.optional(),
        date: dateField.optional(),
        category: categoryField.optional(),
        limit: limitField.optional(),
        pad_days: padDaysField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const zoneRes = await resolveZoneFromArgs(args);
      if (!zoneRes.ok) return failure(zoneRes.error);
      const planRes = getPlantingPlan({
        zone: zoneRes.data,
        ...(args.date ? { date: args.date } : {}),
        ...(args.category
          ? { category: args.category as CropCategory }
          : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
        ...(args.pad_days !== undefined ? { padDays: args.pad_days } : {}),
      });
      if (!planRes.ok) return failure(planRes.error);
      const briefing: GardenBriefing = {
        zone: planRes.data.zone,
        frostDates: planRes.data.frostDates,
        plantNow: planRes.data.plantNow,
        asOf: planRes.data.asOf,
      };
      return success(briefing);
    },
  );
}

// ---------------------------------------------------------------------------
// 3. get_crop_details
// ---------------------------------------------------------------------------

function registerGetCropDetails(server: McpServer): void {
  server.registerTool(
    "get_crop_details",
    {
      title: "Detailed Crop Profile (Calendar + Trefle Botanical)",
      description:
        "Returns a unified crop profile combining the bundled crop calendar entry (planting windows, days to harvest, zone range, sowing/transplant guidance) with Trefle.io botanical detail (family, genus, light requirement, soil pH, image) when TREFLE_API_TOKEN is set. " +
        "Look up by slug, common name, or scientific name. Match is case-insensitive. " +
        "If the calendar has no entry for the query, the tool still attempts a Trefle lookup. If neither has a match, returns an error. " +
        "Trefle's horticulture coverage is sparse (many growth fields are null) — the calendar is the authoritative source for planting timing.",
      inputSchema: {
        slug_or_name: slugOrNameField,
      },
      annotations: READ_ONLY,
    },
    async ({ slug_or_name }) => {
      const calendar = findCrop(slug_or_name);
      let trefle: GrowingGuide | undefined;
      let trefleError: string | undefined;
      if (hasTrefleToken()) {
        const trefleKey = calendar
          ? calendar.scientificName.toLowerCase().replace(/\s+/g, "-")
          : slug_or_name;
        const r = await getGrowingGuide(trefleKey);
        if (r.ok) trefle = r.data;
        else trefleError = r.error.message;
      }
      if (!calendar && !trefle) {
        return failure({
          source: "mcp-garden",
          message: trefleError
            ? `No calendar entry for "${slug_or_name}", and Trefle lookup failed: ${trefleError}`
            : `No calendar entry for "${slug_or_name}". Set TREFLE_API_TOKEN to also search Trefle.`,
        });
      }
      return success({
        calendar: calendar ?? null,
        trefle: trefle ?? null,
        ...(trefleError ? { trefleError } : {}),
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 4. search_plants
// ---------------------------------------------------------------------------

function registerSearchPlants(server: McpServer): void {
  server.registerTool(
    "search_plants",
    {
      title: "Search the Crop Calendar and Trefle",
      description:
        "Combined search: the bundled 500-crop calendar (precise, gardener-curated) + Trefle.io's 1M+ plant database (broad, beta data quality). " +
        "Calendar matches come first and have full planting-window data; Trefle matches are taxonomic only. " +
        "For a focused 'find me the calendar entry for X' use `get_crop_details` instead. " +
        "Trefle results require TREFLE_API_TOKEN; without it only calendar matches are returned. " +
        "Trefle's free-text search (q=) is noisy — it matches across author, bibliography, and sources fields. " +
        "Filter by zone or category to narrow calendar matches.",
      inputSchema: {
        query: queryField,
        zone: zoneField.optional(),
        category: categoryField.optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Cap on calendar matches (1-50, default 20)."),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = args.limit ?? 20;
      let calendarMatches: CropEntry[] = searchCrops(args.query, limit);
      if (args.category) {
        calendarMatches = calendarMatches.filter(
          (c) => c.category === args.category,
        );
      }
      if (args.zone) {
        const zoneNum = parseInt(args.zone.replace(/[^0-9]/g, ""), 10);
        calendarMatches = calendarMatches.filter(
          (c) => zoneNum >= c.zoneRange.min && zoneNum <= c.zoneRange.max,
        );
      }

      let trefleMatches: TreflePlantSummary[] = [];
      let trefleError: string | undefined;
      if (hasTrefleToken()) {
        const r = await searchPlants({ query: args.query });
        if (r.ok) trefleMatches = r.data.plants;
        else trefleError = r.error.message;
      }

      return success({
        query: args.query,
        calendar: calendarMatches,
        trefle: trefleMatches,
        ...(trefleError ? { trefleError } : {}),
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 5. get_crops_for_zone
// ---------------------------------------------------------------------------

function registerGetCropsForZone(server: McpServer): void {
  server.registerTool(
    "get_crops_for_zone",
    {
      title: "Crops Suited to a USDA Zone",
      description:
        "Returns all crop calendar entries whose zone range includes the supplied USDA zone, optionally filtered by category. " +
        "Pure metadata — does NOT consider the current date. For 'what to plant now' use `get_planting_plan` instead. " +
        "Useful for browsing what's possible in a zone, planning beds, or generating seed lists.",
      inputSchema: {
        zone: zoneField,
        category: categoryField.optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ zone, category }) => {
      const r = getCropsForZone(zone, category as CropCategory | undefined);
      return r.ok ? success(r.data) : failure(r.error);
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ZoneArgs {
  zone?: string;
  lat?: number;
  lng?: number;
  zip?: string;
}

async function resolveZoneFromArgs(
  args: ZoneArgs,
): Promise<
  | { ok: true; data: ZoneInfo }
  | { ok: false; error: { source: string; message: string } }
> {
  if (args.zone) {
    const m = /^(\d{1,2})([ab])$/i.exec(args.zone.trim().toLowerCase());
    if (!m || !m[1] || !m[2]) {
      return err({
        source: "mcp-garden",
        message: `zone must look like "5a" or "8b", got "${args.zone}"`,
      });
    }
    const num = Number(m[1]);
    const sub = m[2].toLowerCase() as "a" | "b";
    const minTempF = -60 + 10 * (num - 1) + (sub === "b" ? 5 : 0);
    return {
      ok: true,
      data: {
        zone: `${num}${sub}`,
        zoneNumber: num,
        subzone: sub,
        minTempF,
        maxTempF: minTempF + 5,
        source: "prism-2023",
        resolvedFrom: "zip-exact",
        zip: "00000",
      },
    };
  }
  if (args.zip) return getHardinessZoneByZip(args.zip);
  if (args.lat !== undefined && args.lng !== undefined) {
    return getHardinessZone({ lat: args.lat, lng: args.lng });
  }
  return err({
    source: "mcp-garden",
    message: "provide one of {zone}, {zip}, or {lat, lng}",
  });
}
