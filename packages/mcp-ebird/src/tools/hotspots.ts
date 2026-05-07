import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getHotspotInfo,
  getHotspotsInRegion,
  getNearbyHotspots,
} from "@pondlog/source-ebird";
import { failure, success } from "../respond.js";
import {
  backField,
  distField,
  latField,
  lngField,
  locIdField,
  REGION_CODE_HELP,
  regionCodeField,
} from "../schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerHotspotTools(server: McpServer): void {
  server.registerTool(
    "get_hotspots_in_region",
    {
      title: "Birding Hotspots in a Region",
      description:
        `Returns all eBird hotspots in a region, with locId, name, coordinates, all-time species count, and last observation date. ${REGION_CODE_HELP} ` +
        "Use to enumerate every hotspot in a county/state. For coords-scoped (within a radius of a point), use `get_nearby_hotspots`. For full hierarchical info on one hotspot, use `get_hotspot_info`.",
      inputSchema: {
        region_code: regionCodeField,
        back: backField
          .optional()
          .describe("Filter to hotspots with activity in the last N days, 1-30."),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getHotspotsInRegion(args.region_code, {
        ...(args.back !== undefined ? { back: args.back } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_nearby_hotspots",
    {
      title: "Birding Hotspots Near Coordinates",
      description:
        "Returns birding hotspots within `dist` km of a lat/lng, ranked by all-time species count. Each row: locId, name, coordinates, species count, last activity date. " +
        "Use to find places to go birding near a point. For region-scoped, use `get_hotspots_in_region`.",
      inputSchema: {
        lat: latField,
        lng: lngField,
        dist: distField.optional(),
        back: backField
          .optional()
          .describe("Filter to hotspots with activity in the last N days, 1-30."),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getNearbyHotspots(args.lat, args.lng, {
        ...(args.dist !== undefined ? { dist: args.dist } : {}),
        ...(args.back !== undefined ? { back: args.back } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_hotspot_info",
    {
      title: "Hotspot Detail by locId",
      description:
        "Fetches detailed info for a single hotspot: full hierarchical name (e.g. \"Ediz Hook, Clallam County, Washington, US\"), country/state/county codes, coordinates, isHotspot flag. " +
        "Use after `get_hotspots_in_region` or `get_nearby_hotspots` returns a locId the caller wants more context on.",
      inputSchema: {
        loc_id: locIdField,
      },
      annotations: READ_ONLY,
    },
    async ({ loc_id }) => {
      const result = await getHotspotInfo(loc_id);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
