import { Command } from "commander";
import {
  getConfigPath,
  loadConfig,
  saveConfig,
  setSavedLocation,
} from "../config.js";
import { parseLat, parseLng } from "../validate.js";
import { printJson } from "../format.js";

export function buildConfigCommand(): Command {
  const cmd = new Command("config")
    .description("Manage pondlog config (saved location, etc.)");

  cmd
    .command("set-location")
    .description("Save default coordinates to ~/.pondlog/config.json")
    .requiredOption("--lat <lat>", "Latitude (-90..90)")
    .requiredOption("--lng <lng>", "Longitude (-180..180)")
    .option("-n, --name <name>", "Friendly place name (e.g. \"Port Angeles\")")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog config set-location --lat 48.118 --lng -123.4307 --name \"Port Angeles\"",
      ].join("\n"),
    )
    .action(async (opts: { lat: string; lng: string; name?: string }) => {
      const lat = parseLat(opts.lat);
      if (!lat.ok) return fail(lat.error.message);
      const lng = parseLng(opts.lng);
      if (!lng.ok) return fail(lng.error.message);

      const existing = await loadConfig();
      if (!existing.ok) return fail(existing.error.message);

      const next = setSavedLocation(
        existing.data,
        { lat: lat.data, lng: lng.data },
        opts.name?.trim() || undefined,
      );
      const written = await saveConfig(next);
      if (!written.ok) return fail(written.error.message);

      const where = getConfigPath();
      const label = opts.name ? ` (${opts.name})` : "";
      console.log(`Saved default location ${lat.data}, ${lng.data}${label} -> ${where}`);
    });

  cmd
    .command("show")
    .description("Print the current config")
    .option("--json", "Print raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const cfg = await loadConfig();
      if (!cfg.ok) return fail(cfg.error.message);
      if (opts.json) return printJson(cfg.data ?? null);
      if (!cfg.data) {
        console.log(`No config yet. Path: ${getConfigPath()}`);
        console.log("Run: pondlog config set-location --lat <lat> --lng <lng> [--name <name>]");
        return;
      }
      const loc = cfg.data.defaultLocation;
      console.log(`Config: ${getConfigPath()}`);
      console.log(`Version: ${cfg.data.version}`);
      if (loc) {
        const name = loc.name ? ` (${loc.name})` : "";
        console.log(`Default location: ${loc.lat}, ${loc.lng}${name}`);
      } else {
        console.log("Default location: (none)");
      }
    });

  return cmd;
}

function fail(message: string): never {
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
}
