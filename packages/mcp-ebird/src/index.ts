import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { assertEbirdApiKey } from "@pondlog/source-ebird";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  try {
    assertEbirdApiKey();
  } catch {
    process.stderr.write(
      "pondlog-mcp-ebird: EBIRD_API_KEY is not set. Get a free key at https://ebird.org/api/keygen, then export EBIRD_API_KEY=<your-key> (or set it in your MCP client's env block).\n",
    );
    process.exit(1);
  }

  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `pondlog-mcp-ebird: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
