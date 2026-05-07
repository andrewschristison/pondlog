import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHotspotTools } from "./tools/hotspots.js";
import { registerObservationTools } from "./tools/observations.js";
import { registerProductTools } from "./tools/product.js";
import { registerRegionTools } from "./tools/regions.js";
import { registerTaxonomyTools } from "./tools/taxonomy.js";

export function registerAllTools(server: McpServer): void {
  registerObservationTools(server);
  registerProductTools(server);
  registerHotspotTools(server);
  registerTaxonomyTools(server);
  registerRegionTools(server);
}
