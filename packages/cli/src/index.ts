import { Command } from "commander";
import { buildConfigCommand } from "./commands/config.js";
import { buildInatCommand } from "./commands/inat.js";

const program = new Command();

program
  .name("pondlog")
  .description("Place-aware nature data aggregation CLI")
  .version("0.1.0");

program.addCommand(buildConfigCommand());
program.addCommand(buildInatCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
});
