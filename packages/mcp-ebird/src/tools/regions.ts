import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAdjacentRegions,
  getRegionInfo,
  getSubRegions,
} from "@pondlog/source-ebird";
import { z } from "zod";
import { failure, success } from "../respond.js";
import {
  REGION_CODE_HELP,
  regionCodeField,
  regionTypeField,
} from "../schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerRegionTools(server: McpServer): void {
  server.registerTool(
    "get_region_info",
    {
      title: "Region Info (name, bounds)",
      description:
        `Returns the human-readable name and geographic bounds for an eBird region code. ${REGION_CODE_HELP} Output: \`result\` (display name like "Clallam, Washington, United States") and \`bounds\` (minX/maxX/minY/maxY = lng/lat extent). ` +
        "Use to convert an opaque region code into a readable name, or to get the bounding box of a region.",
      inputSchema: {
        region_code: regionCodeField,
        region_name_format: z
          .enum([
            "detailed",
            "detailednoqual",
            "full",
            "namequal",
            "nameonly",
            "revdetailed",
          ])
          .optional()
          .describe(
            "Naming format for the `result` field. \"detailed\" (default) gives the full hierarchical name; \"nameonly\" returns just the local name. Other formats add or reorder qualifiers.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getRegionInfo(args.region_code, {
        ...(args.region_name_format ? { regionNameFormat: args.region_name_format } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_sub_regions",
    {
      title: "Sub-regions of a Parent Region",
      description:
        "Enumerates the immediate child regions of a parent. Pair `region_type` with `parent_region_code`: " +
        "for `country`, parent must be \"world\"; for `subnational1`, parent must be a country code (e.g. \"US\"); for `subnational2`, parent must be a subnational1 code (e.g. \"US-WA\"). " +
        "Use to discover region codes when the caller names a place but doesn't know the code.",
      inputSchema: {
        region_type: regionTypeField,
        parent_region_code: z
          .string()
          .min(1)
          .max(12)
          .describe(
            "Parent region. Use \"world\" with `region_type=country`; a country code (e.g. \"US\") with `region_type=subnational1`; a state code (e.g. \"US-WA\") with `region_type=subnational2`.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getSubRegions(args.region_type, args.parent_region_code);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_adjacent_regions",
    {
      title: "Adjacent Regions (subnational2 only)",
      description:
        "Returns regions adjacent to a given region. eBird only supports adjacency for subnational2 codes (counties or equivalents), e.g. \"US-WA-009\" returns its bordering counties. Calling with country or subnational1 codes returns an empty list or error.",
      inputSchema: {
        region_code: regionCodeField.describe(
          `Subnational2 region code (county/equivalent), e.g. "US-WA-009". ${REGION_CODE_HELP}`,
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ region_code }) => {
      const result = await getAdjacentRegions(region_code);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
