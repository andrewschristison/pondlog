// DEPRECATED. @pondlog/mcp-garden has been replaced by @cropgraph/mcp.
// Garden planning lives at https://cropgraph.com.
//
// This entrypoint prints a one-line notice to stderr and exits cleanly so
// existing Claude Desktop / Cursor / agent configs surface a clear migration
// hint instead of silently doing nothing.

const message = [
  "@pondlog/mcp-garden has moved.",
  "Install @cropgraph/mcp instead:",
  "  npx @cropgraph/mcp",
  "Docs: https://cropgraph.com",
].join("\n");

process.stderr.write(`${message}\n`);
process.exit(0);
