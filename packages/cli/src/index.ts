import { Command } from "commander";

const program = new Command();

program
  .name("pondlog")
  .description("Place-aware nature data aggregation CLI")
  .version("0.1.0");

program
  .command("inat")
  .description("iNaturalist commands (subcommands coming in Sticky 2)")
  .action(() => {
    console.log("iNaturalist subcommands not yet implemented. See Sticky 2.");
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
