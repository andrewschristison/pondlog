# DEPRECATED

`@pondlog/mcp-garden` has been replaced by
[`@cropgraph/mcp`](https://www.npmjs.com/package/@cropgraph/mcp).

Install the replacement:

```sh
npx @cropgraph/mcp
```

Or wire it into Claude Desktop:

```json
{
  "mcpServers": {
    "cropgraph": {
      "command": "npx",
      "args": ["-y", "@cropgraph/mcp"]
    }
  }
}
```

Garden planning lives at [cropgraph.com](https://cropgraph.com).

## What changed

CropGraph spun out of pondlog as its own product. The 1,000-crop calendar,
121 companion relationships, USDA hardiness zones, and climate-aware
planting tools all moved to the new package without losing any features.

The published `@pondlog/mcp-garden` is now a stub: it prints this
migration notice on launch and exits.

## License

MIT.
