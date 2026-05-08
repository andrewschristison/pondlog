import { Command } from "commander";
import { buildConfigCommand } from "./commands/config.js";
import { buildEbirdCommand } from "./commands/ebird.js";
import { buildGardenCommand } from "./commands/garden.js";
import { buildInatCommand } from "./commands/inat.js";
import { buildMushroomCommand } from "./commands/mushroom.js";
import { buildNightskyCommand } from "./commands/nightsky.js";
import { buildNpnCommand } from "./commands/npn.js";
import { buildTodayCommand } from "./commands/today.js";
import { buildUsgsCommand } from "./commands/usgs.js";

const program = new Command();

program
  .name("pondlog")
  .description("Place-aware nature data aggregation CLI")
  .version("0.4.0");

program.addCommand(buildConfigCommand());
program.addCommand(buildTodayCommand());
program.addCommand(buildInatCommand());
program.addCommand(buildEbirdCommand());
program.addCommand(buildNpnCommand());
program.addCommand(buildUsgsCommand());
program.addCommand(buildMushroomCommand());
program.addCommand(buildNightskyCommand());
program.addCommand(buildGardenCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
});
