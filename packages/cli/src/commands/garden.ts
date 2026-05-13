// Garden planning moved to CropGraph (https://cropgraph.com). The `pondlog
// garden` command is kept as a redirect stub so existing scripts surface a
// clear migration hint instead of an "unknown command" error. Any
// invocation (`pondlog garden`, `pondlog garden zone --lat ...`, etc.)
// prints this notice and exits 0.

import { Command } from "commander";

const REDIRECT_MESSAGE = [
  "Garden planning has moved to CropGraph.",
  "",
  "Install: npm install -g cropgraph",
  "Run:     cropgraph zone, cropgraph planting, cropgraph companions",
  "Docs:    https://cropgraph.com",
].join("\n");

export function buildGardenCommand(): Command {
  const cmd = new Command("garden").description(
    "Moved to CropGraph (https://cropgraph.com). Install: npm install -g cropgraph.",
  );

  cmd
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(() => {
      console.log(REDIRECT_MESSAGE);
    });

  // Swallow any subcommand (e.g. `pondlog garden zone`, `pondlog garden plan`)
  // with the same redirect. commander would otherwise print "unknown command".
  cmd.command("*").allowUnknownOption(true).action(() => {
    console.log(REDIRECT_MESSAGE);
  });

  return cmd;
}
