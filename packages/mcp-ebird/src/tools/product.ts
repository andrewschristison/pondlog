import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getChecklist,
  getRecentChecklists,
  getTop100,
} from "@pondlog/source-ebird";
import { z } from "zod";
import { failure, success } from "../respond.js";
import {
  dayField,
  monthField,
  REGION_CODE_HELP,
  regionCodeField,
  subIdField,
  yearField,
} from "../schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerProductTools(server: McpServer): void {
  server.registerTool(
    "get_recent_checklists",
    {
      title: "Recent Checklists Submitted in a Region",
      description:
        `Returns recent eBird checklists (birding submissions) for a region, with submission ID, location, observer, observation date/time, and species count per checklist. ${REGION_CODE_HELP} ` +
        "Use this to see who has been birding where, recently. Drill into a specific checklist with `get_checklist`.",
      inputSchema: {
        region_code: regionCodeField,
        max_results: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Max checklists to return, 1-200. Default 10."),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getRecentChecklists(args.region_code, {
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_top_100",
    {
      title: "Top 100 eBirders in a Region on a Date",
      description:
        `Returns the top 100 eBirders for a region on a specific date, ranked by most species seen or most checklists submitted. ${REGION_CODE_HELP} Returns user display name, profile handle, species count, and checklist count.`,
      inputSchema: {
        region_code: regionCodeField,
        year: yearField,
        month: monthField,
        day: dayField,
        ranked_by: z
          .enum(["spp", "cl"])
          .optional()
          .describe(
            "Ranking criterion. \"spp\" (default) = most species seen; \"cl\" = most checklists submitted.",
          ),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results, 1-100. Default 100."),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getTop100(args.region_code, args.year, args.month, args.day, {
        ...(args.ranked_by ? { rankedBy: args.ranked_by } : {}),
        ...(args.max_results !== undefined ? { maxResults: args.max_results } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_checklist",
    {
      title: "View a Single eBird Checklist",
      description:
        "Fetches a single eBird checklist by submission ID with full detail: location, observer, date/time, duration, distance, number of observers, and the full list of species seen with counts. " +
        "Use after `get_recent_checklists` returns a subId the caller wants to drill into, or when the caller pastes a checklist URL.",
      inputSchema: {
        sub_id: subIdField,
      },
      annotations: READ_ONLY,
    },
    async ({ sub_id }) => {
      const result = await getChecklist(sub_id);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
