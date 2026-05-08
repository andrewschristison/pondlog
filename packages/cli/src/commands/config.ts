import { Command } from "commander";
import {
  getConfigPath,
  loadConfig,
  saveConfig,
  setEbirdRegion,
  setMushroomObserverRegion,
  setNoaaStation,
  setSavedLocation,
  setUsgsSite,
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
    .command("set-station")
    .description("Save default NOAA tide station to config (e.g. 9444090 for Port Angeles)")
    .argument("<stationId>", "NOAA CO-OPS station id (6–8 digits)")
    .action(async (stationId: string) => {
      const existing = await loadConfig();
      if (!existing.ok) return fail(existing.error.message);
      const next = setNoaaStation(existing.data, stationId);
      if (!next.ok) return fail(next.error.message);
      const written = await saveConfig(next.data);
      if (!written.ok) return fail(written.error.message);
      console.log(`Saved NOAA station ${stationId} -> ${getConfigPath()}`);
    });

  cmd
    .command("set-usgs-site")
    .description("Save default USGS NWIS site for streamflow (e.g. 12045500 = Elwha River)")
    .argument("<siteNumber>", "USGS site number (8–15 digits)")
    .action(async (siteNumber: string) => {
      const existing = await loadConfig();
      if (!existing.ok) return fail(existing.error.message);
      const next = setUsgsSite(existing.data, siteNumber);
      if (!next.ok) return fail(next.error.message);
      const written = await saveConfig(next.data);
      if (!written.ok) return fail(written.error.message);
      console.log(`Saved USGS site ${siteNumber} -> ${getConfigPath()}`);
    });

  cmd
    .command("set-ebird-region")
    .description("Save default eBird region code (e.g. US-WA-009 for Clallam County)")
    .argument("<regionCode>", "eBird region code")
    .action(async (regionCode: string) => {
      const existing = await loadConfig();
      if (!existing.ok) return fail(existing.error.message);
      const next = setEbirdRegion(existing.data, regionCode);
      if (!next.ok) return fail(next.error.message);
      const written = await saveConfig(next.data);
      if (!written.ok) return fail(written.error.message);
      console.log(`Saved eBird region ${next.data.ebirdRegion} -> ${getConfigPath()}`);
    });

  cmd
    .command("set-mushroom-region")
    .description(
      'Save default Mushroom Observer region suffix (e.g. "Clallam Co., Washington, USA")',
    )
    .argument("<region>", "MO location-name suffix string")
    .action(async (region: string) => {
      const existing = await loadConfig();
      if (!existing.ok) return fail(existing.error.message);
      const next = setMushroomObserverRegion(existing.data, region);
      if (!next.ok) return fail(next.error.message);
      const written = await saveConfig(next.data);
      if (!written.ok) return fail(written.error.message);
      console.log(
        `Saved mushroom-observer region "${next.data.mushroomObserverRegion}" -> ${getConfigPath()}`,
      );
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
      console.log(`NOAA station: ${cfg.data.noaaStation ?? "(none)"}`);
      console.log(`USGS site: ${cfg.data.usgsSite ?? "(none)"}`);
      console.log(`eBird region: ${cfg.data.ebirdRegion ?? "(none)"}`);
      console.log(
        `Mushroom Observer region: ${cfg.data.mushroomObserverRegion ?? "(none)"}`,
      );
    });

  return cmd;
}

function fail(message: string): never {
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
}
