# MCP Server (Pondlog)

A guide for building MCP servers in the pondlog monorepo. Read at the
start of any sticky that ships an MCP server — Sticky 7 (eBird), 10 (NPN),
12 (USGS), 15 (mcp-pondlog aggregate). Encodes patterns extracted from
Sticky 3 (`@pondlog/mcp-inaturalist`).

The whole point of this skill: **don't trust LLM training data on the MCP
SDK API.** It changes faster than knowledge cutoffs. The first few sections
are corrections — read them before writing any tool code.

---

## 1. SDK API — the gotcha

Verified against `@modelcontextprotocol/sdk` v1.29 (Sticky 3, 2026-05-07).

Use `McpServer.registerTool`, **not** the deprecated `tool(name, …)`
overloads. Signature:

```ts
server.registerTool(
  name,                        // snake_case per MCP convention
  {
    title,                     // Human-readable: "Search iNaturalist Observations"
    description,               // LLM-targeted (see §5)
    inputSchema,               // ⚠️ Zod RAW SHAPE, not z.object(...)
    outputSchema,              // optional Zod raw shape
    annotations,               // see §4
  },
  handler                      // (args, extra) => CallToolResult | Promise<CallToolResult>
);
```

**The big trap:** `inputSchema` is a Zod **raw shape** — an object literal
of `{ key: zodSchema }` — not a `z.object(...)` wrapping one. If you wrap
it, TypeScript will fight you and the JSON Schema sent to the client will
be wrong.

```ts
// ✅ Correct
inputSchema: {
  lat: z.number().min(-90).max(90).describe("WGS84 latitude…"),
  lng: z.number().min(-180).max(180).describe("WGS84 longitude…"),
}

// ❌ Wrong — don't wrap
inputSchema: z.object({ lat: …, lng: … })
```

The SDK derives the JSON Schema for the client. You don't write JSON
Schema by hand.

Imports:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
```

---

## 2. Type the handler return as `CallToolResult`

Use the SDK's `CallToolResult` type. Custom interfaces (e.g.
`interface ToolResponse { content: …; isError?: boolean }`) fail with
"index signature for type 'string' is missing" in strict mode because the
SDK accepts arbitrary extra keys.

```ts
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function success<T>(data: T): CallToolResult { … }
```

---

## 3. Drop-in templates

These three files are the same in every pondlog MCP server — copy them
into the new package and adapt the schemas to the source.

### 3a. `src/respond.ts`

```ts
import type { ResultError } from "@pondlog/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function success<T>(data: T): CallToolResult {
  const wrapped: Record<string, unknown> = { ok: true, data: data as unknown };
  return {
    content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    structuredContent: wrapped,
  };
}

export function failure(error: ResultError): CallToolResult {
  const payload: Record<string, unknown> = {
    ok: false,
    error: {
      source: error.source,
      message: error.message,
      ...(error.statusCode !== undefined ? { statusCode: error.statusCode } : {}),
    },
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}
```

This emits both `structuredContent` (typed JSON for modern clients) and
a `text` block (readable fallback for older clients). Don't pick one.

### 3b. `src/schemas.ts` — shared Zod fragments

Centralize the `.describe()` strings so every tool inherits the glossary.
Field names recur across pondlog sources — extract them once.

```ts
import { z } from "zod";

export const latField = z.number().min(-90).max(90)
  .describe("WGS84 latitude in decimal degrees, between -90 and 90. Example: 48.118 for Port Angeles, WA.");

export const lngField = z.number().min(-180).max(180)
  .describe("WGS84 longitude in decimal degrees, between -180 and 180. Example: -123.4307 for Port Angeles, WA.");

export const radiusField = z.number().positive().max(500)
  .describe("Search radius in kilometers. Maximum 500. Default 25.");

export const daysField = z.number().int().min(1).max(365)
  .describe("Time window in days, counted backwards from today. Default 7.");
```

Per-source enums (iNat iconic taxa, eBird region codes, USGS parameter
codes) live in the same file with their full glossaries inlined into the
description.

### 3c. `src/server.ts` — factory split from entry

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools.js";

export const SERVER_NAME = "pondlog-mcp-<source>";
export const SERVER_VERSION = "0.1.0";

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );
  registerAllTools(server);
  return server;
}
```

And `src/index.ts`:

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `pondlog-mcp-<source>: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
```

The split lets you boot a server in tests without binding stdio.

---

## 4. Tool annotations baseline

Every read-only network tool in pondlog gets:

```ts
annotations: { readOnlyHint: true, openWorldHint: true }
```

- `readOnlyHint: true` — the tool doesn't mutate any external state.
- `openWorldHint: true` — the tool reaches outside the local environment
  (network call). Tells the client the response can vary across calls.

Mutating tools (none in pondlog yet) need different annotations. If a
future server mutates state, look up `destructiveHint` and
`idempotentHint` in the SDK types — don't guess.

The source clients (`@pondlog/source-*`) already enforce rate limits and
return `Result<T>`, so MCP just exposes them. Don't re-implement
throttling at the MCP layer.

---

## 5. Description writing checklist

The tool `description` is consumed by the LLM picking which tool to call.
Treat it like a function docstring written for someone who can't read the
code.

For every tool description:

- [ ] **Lead with what it does** and the typical caller intent. Example:
      "Search recent iNaturalist observations with rich filters: …"
- [ ] **Inline the domain glossary** so the LLM doesn't have to guess. For
      iNat that means listing what each iconic-taxa group means; for eBird
      it means region-code conventions; for USGS it means parameter codes.
- [ ] **Cross-reference siblings.** "For a simple 'what's nearby' query,
      prefer `get_nearby_observations`. For aggregate counts, prefer
      `get_species_counts`." Without this, the LLM picks the wrong tool.
- [ ] **Per-field `.describe()` calls** with example values inside the
      `inputSchema`. Don't only describe the tool — describe each field.
- [ ] Note defaults explicitly ("Default 25 km. Maximum 500.").
- [ ] Note when an arg is required vs optional and what the omission
      means.

Bad: `description: "Search observations"`
Good: see `packages/mcp-inaturalist/src/tools.ts` (Sticky 3 reference).

---

## 6. JSON-RPC verification template

Use this script as the verification step for every MCP server. Cheaper
and more deterministic than MCP Inspector. No extra deps — just
`node:child_process`.

Save as `/tmp/mcp-handshake.mjs`, point `binPath` at the built bin, and
adjust the `tools/call` arguments for the server under test.

```js
import { spawn } from "node:child_process";

const binPath = "/abs/path/to/packages/mcp-<source>/dist/index.js";
const server = spawn(process.execPath, [binPath], { stdio: ["pipe", "pipe", "pipe"] });

let stderr = "";
server.stderr.on("data", (b) => { stderr += b.toString(); });

let buffer = "";
const pending = new Map();

server.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const raw of lines) {
    if (!raw.trim()) continue;
    let msg;
    try { msg = JSON.parse(raw); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

let nextId = 1;
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout ${method}`)); }
    }, 30000);
  });
}
function notify(method, params) {
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params: params ?? {} }) + "\n");
}

try {
  const init = await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.0.0" },
  });
  console.log("server:", init.result.serverInfo);
  notify("notifications/initialized");

  const list = await send("tools/list", {});
  const names = (list.result?.tools ?? []).map((t) => t.name);
  console.log("tools:", names.length, names.sort().join(", "));

  // Live golden-path call — replace name + arguments per server
  const call = await send("tools/call", {
    name: "get_nearby_observations",
    arguments: { lat: 48.118, lng: -123.4307, radius_km: 25, days: 3 },
  });
  if (call.result?.isError) { console.error("tool returned isError:", call.result); process.exit(1); }
  console.log("structuredContent ok:", call.result.structuredContent?.ok);

  // Negative case — bad input must be rejected by SDK Zod before handler
  const bad = await send("tools/call", {
    name: "get_nearby_observations",
    arguments: { lat: 999, lng: 0 },
  });
  console.log("bad input -> isError:", bad.result?.isError ?? !!bad.error);
} finally {
  server.stdin.end();
  setTimeout(() => server.kill("SIGTERM"), 200);
  if (stderr.trim()) console.error("stderr:", stderr.slice(0, 500));
}
```

The required checks for every MCP server before commit:
1. `initialize` returns the expected `serverInfo`.
2. `tools/list` returns the expected count and names.
3. One `tools/call` against a known-live source returns
   `structuredContent.ok === true`.
4. One bad-input `tools/call` returns `isError: true` (proves the SDK is
   actually validating against the Zod input schema).

After it passes, delete the script. Don't commit it.

---

## 7. `server.json` template

For MCP Registry submission. Lives next to `package.json`.

```json
{
  "$schema": "https://modelcontextprotocol.io/schemas/draft/2025-07-09/server.json",
  "name": "io.github.andrewchristison/pondlog-<source>",
  "description": "<one paragraph: what this exposes, no key needed if applicable>.",
  "repository": {
    "url": "https://github.com/andrewchristison/pondlog",
    "source": "github",
    "subfolder": "packages/mcp-<source>"
  },
  "version_detail": {
    "version": "0.1.0",
    "release_date": "<YYYY-MM-DD>",
    "is_latest": true
  },
  "packages": [
    {
      "registry_name": "npm",
      "name": "@pondlog/mcp-<source>",
      "version": "0.1.0",
      "runtime_hint": "node",
      "transport": { "type": "stdio" }
    }
  ]
}
```

Add `server.json` to the package's `files` array in `package.json` so it
ships in the published tarball.

If the source requires an env var (eBird's `EBIRD_API_KEY`), declare it
in `packages[0].environment_variables` per the registry spec.

---

## 8. README boilerplate

Every MCP package ships with a README at this minimum. Mirror the
section structure from `packages/mcp-inaturalist/README.md`.

```md
# @pondlog/mcp-<source>

One-paragraph description: what data this exposes, who it's for, what
key (if any) the user needs.

Part of [pondlog](https://github.com/andrewchristison/pondlog).

## Install / run
\`\`\`sh
npx -y @pondlog/mcp-<source>
\`\`\`

## Configure

### Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):
\`\`\`json
{
  "mcpServers": {
    "pondlog-<source>": {
      "command": "npx",
      "args": ["-y", "@pondlog/mcp-<source>"],
      "env": { "<REQUIRED_KEY>": "<value>" }
    }
  }
}
\`\`\`

### Cursor
Edit `~/.cursor/mcp.json`:
\`\`\`json
{ "mcpServers": { "pondlog-<source>": { "command": "npx", "args": ["-y", "@pondlog/mcp-<source>"] } } }
\`\`\`

### MCP Inspector (debug)
\`\`\`sh
npx @modelcontextprotocol/inspector npx -y @pondlog/mcp-<source>
\`\`\`

## Tools
| Tool | What it does |
|------|--------------|
| `<tool_1>` | … |

## Example prompts
- *<one prompt that exercises a typical use-case>*

## License
MIT.
```

The Claude Desktop and Cursor config blocks are NOT identical —
Claude Desktop wraps in `mcpServers` with per-server objects;
Cursor uses the same shape but in `~/.cursor/mcp.json`. Don't combine
them or skip one.

---

## 9. Anti-patterns

Things that look reasonable and aren't:

- ❌ **Business logic in tool handlers.** Handlers should be 5-10 lines:
  validate (the SDK does this), call the source-* function, wrap the
  `Result<T>` via `success` / `failure`. If you need to massage data,
  put it in the source package, not the MCP package.
- ❌ **Custom `interface ToolResponse {…}`.** Use `CallToolResult` from
  the SDK. Custom types fail in strict mode (§2).
- ❌ **`z.object(...)` for `inputSchema`.** Raw shape, not wrapped (§1).
- ❌ **Deprecated `server.tool(...)` overloads.** They emit `@deprecated`
  warnings. Use `registerTool` (§1).
- ❌ **Re-implementing rate limiting at the MCP layer.** The source
  client already does it. Adding a second limiter creates duplicate
  failure modes.
- ❌ **Catching errors and returning `success({error: …})`.** Use
  `failure(error)` so `isError: true` is set on the response. Clients
  rely on it.
- ❌ **Skipping the `text` content block** ("modern clients only need
  `structuredContent`"). Older Claude Desktop builds and other clients
  still parse `text`. Cost is negligible.
- ❌ **Forgetting to add `server.json` to the package's `files` array.**
  npm won't ship it; the MCP Registry submission will 404 the metadata.
- ❌ **Committing the JSON-RPC verification script.** It's a one-shot;
  delete it after passing.
- ❌ **Tool descriptions like `"Search observations"`.** The LLM has no
  way to choose between siblings without the cross-references and
  domain glossary (§5).

---

## Reference implementation

`packages/mcp-inaturalist/` (committed in Sticky 3, commit `5af103d`) is
the canonical example. When in doubt, mirror its structure:

```
packages/mcp-<source>/
├── package.json          ← bin: pondlog-mcp-<source>; files includes server.json
├── tsconfig.json
├── tsup.config.ts        ← banner: { js: "#!/usr/bin/env node" }
├── README.md
├── server.json
└── src/
    ├── index.ts          ← stdio entry only
    ├── server.ts         ← buildServer() factory
    ├── schemas.ts        ← shared Zod fragments + glossary descriptions
    ├── respond.ts        ← success() / failure() → CallToolResult
    └── tools.ts          ← registerAllTools(server); one register* per tool
```
