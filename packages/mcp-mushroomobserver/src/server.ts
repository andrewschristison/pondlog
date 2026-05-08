import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools.js";

export const SERVER_NAME = "pondlog-mcp-mushroomobserver";
export const SERVER_VERSION = "0.1.0";

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );
  registerAllTools(server);
  return server;
}
