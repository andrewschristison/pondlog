import { Command } from "commander";
import {
  getActivePhenologyNearby,
  getSpecies,
} from "@pondlog/source-npn";
import { printJson } from "../format.js";
import {
  computeActivePhenologyWidths,
  computeNpnSpeciesWidths,
  formatActivePhenologyHeader,
  formatActivePhenologyRow,
  formatNpnSpeciesRow,
} from "../format-npn.js";
import { resolveLocation } from "../resolve-location.js";
import { parseRadiusKm } from "../validate.js";

const DEFAULT_RADIUS = 25;
const DEFAULT_YEARS_BACK = 2;

interface ActiveOpts {
  lat?: string;
  lng?: string;
  radius?: string;
  years?: string;
  maxStations?: string;
  json?: boolean;
}

interface SpeciesOpts {
  query?: string;
  genus?: string;
  family?: string;
  kingdom?: string;
  json?: boolean;
}

export function buildNpnCommand(): Command {
  const npn = new Command("npn").description(
    "USA National Phenology Network (NPN) commands, phenology of plants and animals",
  );

  npn
    .command("active")
    .description(
      "Recently observed phenology near a location: which species/phenophases have been recorded at NPN stations within radius",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 500)`)
    .option(
      "-y, --years <n>",
      `How many years of phenometric history to include (default ${DEFAULT_YEARS_BACK}, max 20)`,
    )
    .option(
      "--max-stations <n>",
      "Cap on stations queried (default 40, max 50). Closest first.",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog npn active",
        "  $ pondlog npn active --lat 47.6062 --lng -122.3321 --radius 50",
        "  $ pondlog npn active --years 5",
        "  $ pondlog npn active --json | jq '.entries[0]'",
        "",
        "Notes:",
        "  NPN stations record phenology (first leaf, first bloom, first call,",
        "  etc.). This shows what's been observed at stations within radius",
        "  over the requested years. NPN coverage is patchy. Eastern US and",
        "  Arizona are dense; the Pacific Northwest is sparser.",
      ].join("\n"),
    )
    .action(async (opts: ActiveOpts) => {
      const radius = takeRadius(opts.radius);
      const yearsBack = takeYearsBack(opts.years);
      const maxStations = takeMaxStations(opts.maxStations);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = await getActivePhenologyNearby({
        coords: loc.coords,
        radiusKm: radius,
        yearsBack,
        maxStations,
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      const namePrefix = loc.name ? `${loc.name}  ·  ` : "";
      process.stdout.write(`${namePrefix}`);
      console.log(formatActivePhenologyHeader(result.data));
      console.log("");

      if (result.data.entries.length === 0) {
        if (result.data.stationsInRadius === 0) {
          console.log("No NPN stations within radius. Try a larger --radius.");
        } else {
          console.log(
            `${result.data.stationsSearched} stations queried, no phenometric records in the last ${yearsBack} year${yearsBack === 1 ? "" : "s"}. Try --years 5 or a different location.`,
          );
        }
        return;
      }

      const widths = computeActivePhenologyWidths(result.data.entries);
      // Cap the table at 50 rows to keep terminal output readable; --json gets the full set.
      const rows = result.data.entries.slice(0, 50);
      console.log(
        `${result.data.entries.length} phenometric record${result.data.entries.length === 1 ? "" : "s"}${result.data.entries.length > rows.length ? ` (showing top ${rows.length})` : ""}:`,
      );
      console.log("");
      for (const e of rows) console.log(formatActivePhenologyRow(e, widths));
    });

  npn
    .command("species")
    .description(
      "Search the NPN species catalog by common name, genus, family, or kingdom",
    )
    .option("-q, --query <text>", "Match against common name, genus, or species (case-insensitive substring)")
    .option("--genus <name>", "Filter to a specific genus (case-insensitive exact match)")
    .option("--family <name>", "Filter to a specific family (case-insensitive exact match)")
    .option("--kingdom <name>", 'Filter by kingdom: "Plantae" or "Animalia"')
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog npn species --query mayapple",
        "  $ pondlog npn species --genus Acer",
        "  $ pondlog npn species --family Asteraceae --json",
        "  $ pondlog npn species --kingdom Animalia",
        "",
        "The NPN catalog is ~1900 species. With no filter, this lists the",
        "first 30 alphabetically, please pass at least one filter to narrow.",
      ].join("\n"),
    )
    .action(async (opts: SpeciesOpts) => {
      const result = await getSpecies();
      if (!result.ok) return fail(result.error.message);

      let rows = result.data;
      if (opts.kingdom) {
        const wanted = opts.kingdom.trim();
        rows = rows.filter(
          (r) => r.iconicTaxon.toLowerCase() === wanted.toLowerCase(),
        );
      }
      // Genus/family filters operate on the embedded scientific name. NPN's
      // catalog stores genus and family separately on the wire but our Taxon
      // type only carries scientific binomial. For genus we match the first
      // word of `name`; family is a soft filter against the raw record.
      if (opts.genus) {
        const wanted = opts.genus.trim().toLowerCase();
        rows = rows.filter(
          (r) => r.name.split(" ")[0]?.toLowerCase() === wanted,
        );
      }
      if (opts.family) {
        // We don't have family in the normalized Taxon; raw records do. Fall
        // back to a no-op with a warning when the filter would be more useful
        // than misleading.
        process.stderr.write(
          "pondlog: --family filter is not yet supported (NPN catalog metadata not surfaced in v1)\n",
        );
      }
      if (opts.query) {
        const q = opts.query.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            r.commonName.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q),
        );
      }

      if (opts.json) return printJson(rows);

      if (rows.length === 0) {
        console.log("No species match those filters.");
        return;
      }

      const sorted = [...rows].sort((a, b) =>
        a.commonName.localeCompare(b.commonName),
      );
      const limit = opts.query || opts.genus || opts.kingdom ? 200 : 30;
      const display = sorted.slice(0, limit);
      const widths = computeNpnSpeciesWidths(display);
      console.log(
        `${rows.length} species${rows.length > display.length ? ` (showing first ${display.length} alphabetically)` : ""}:`,
      );
      console.log("");
      for (const r of display) console.log(formatNpnSpeciesRow(r, widths));
    });

  return npn;
}

function takeRadius(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_RADIUS;
  const r = parseRadiusKm(raw);
  if (!r.ok) return fail(r.error.message);
  return r.data;
}

function takeYearsBack(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_YEARS_BACK;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    return fail(`--years out of range (1..20): ${raw}`);
  }
  return n;
}

function takeMaxStations(raw: string | undefined): number {
  if (raw === undefined) return 40;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    return fail(`--max-stations out of range (1..50, NPN URL limit): ${raw}`);
  }
  return n;
}

async function takeLocation(flags: { lat?: string; lng?: string }) {
  const loc = await resolveLocation(flags);
  if (!loc.ok) return fail(loc.error.message);
  return loc.data;
}

function fail(message: string): never {
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
}
