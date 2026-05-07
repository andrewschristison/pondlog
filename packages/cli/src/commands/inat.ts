import { Command } from "commander";
import {
  getNearbyObservations,
  getSpeciesCounts,
  searchObservations,
  searchTaxa,
} from "@pondlog/source-inaturalist";
import {
  computeObservationWidths,
  computeSpeciesWidths,
  formatObservation,
  formatSpeciesRow,
  formatTaxon,
  groupByIconic,
  groupSpeciesByIconic,
  locationLine,
  printJson,
} from "../format.js";
import { parseDays, parseRadiusKm } from "../validate.js";
import { resolveLocation } from "../resolve-location.js";

const DEFAULT_RADIUS = 10;
const DEFAULT_DAYS = 7;

interface NearbyOpts {
  lat?: string;
  lng?: string;
  radius?: string;
  days?: string;
  taxon?: string;
  json?: boolean;
}

interface SpeciesOpts extends Omit<NearbyOpts, "taxon"> {}

interface SearchOpts {
  lat?: string;
  lng?: string;
  radius?: string;
  json?: boolean;
}

export function buildInatCommand(): Command {
  const inat = new Command("inat").description("iNaturalist commands");

  inat
    .command("nearby")
    .description("Recent observations near a location, grouped by iconic taxa")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 500)`)
    .option("-d, --days <days>", `Window in days (default ${DEFAULT_DAYS})`)
    .option("-t, --taxon <name>", "Filter by taxon name (e.g. \"frog\")")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog inat nearby",
        "  $ pondlog inat nearby --lat 48.118 --lng -123.4307 --radius 25",
        "  $ pondlog inat nearby --days 14 --taxon frog",
        "  $ pondlog inat nearby --json | jq '.[0]'",
      ].join("\n"),
    )
    .action(async (opts: NearbyOpts) => {
      const radius = takeRadius(opts.radius);
      const days = takeDays(opts.days);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = opts.taxon
        ? await searchObservations({
            lat: loc.coords.lat,
            lng: loc.coords.lng,
            radiusKm: radius,
            taxonName: opts.taxon,
            d1: isoDaysAgo(days),
            orderBy: "observed_on",
            perPage: 50,
          })
        : await getNearbyObservations(loc.coords, radius, days);

      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log(
        locationLine({
          name: loc.name,
          lat: loc.coords.lat,
          lng: loc.coords.lng,
          radiusKm: radius,
          days,
        }),
      );
      console.log("");

      if (result.data.length === 0) {
        console.log("No observations found in this window.");
        return;
      }

      const grouped = groupByIconic(result.data);
      const widths = computeObservationWidths(result.data);
      let first = true;
      for (const [group, list] of grouped) {
        if (!first) console.log("");
        first = false;
        console.log(`${group} (${list.length})`);
        for (const obs of list) console.log(formatObservation(obs, widths));
      }
    });

  inat
    .command("species")
    .description("Species counts near a location, grouped by iconic taxa")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 500)`)
    .option("-d, --days <days>", `Window in days (default ${DEFAULT_DAYS})`)
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog inat species",
        "  $ pondlog inat species --radius 25 --days 30",
      ].join("\n"),
    )
    .action(async (opts: SpeciesOpts) => {
      const radius = takeRadius(opts.radius);
      const days = takeDays(opts.days);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = await getSpeciesCounts({
        lat: loc.coords.lat,
        lng: loc.coords.lng,
        radiusKm: radius,
        d1: isoDaysAgo(days),
        perPage: 100,
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log(
        locationLine({
          name: loc.name,
          lat: loc.coords.lat,
          lng: loc.coords.lng,
          radiusKm: radius,
          days,
        }),
      );
      console.log("");

      if (result.data.length === 0) {
        console.log("No species observed in this window.");
        return;
      }

      const grouped = groupSpeciesByIconic(result.data);
      const widths = computeSpeciesWidths(result.data);
      let first = true;
      for (const [group, list] of grouped) {
        if (!first) console.log("");
        first = false;
        const total = list.reduce((acc, r) => acc + r.count, 0);
        console.log(`${group} — ${list.length} species, ${total} obs`);
        for (const row of list) console.log(formatSpeciesRow(row, widths));
      }
    });

  inat
    .command("search <query>")
    .description("Search observations by taxon name")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 500)`)
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog inat search \"pacific chorus frog\"",
        "  $ pondlog inat search owl --radius 50",
      ].join("\n"),
    )
    .action(async (query: string, opts: SearchOpts) => {
      const trimmed = query.trim();
      if (!trimmed) return fail("search query is empty");
      const radius = takeRadius(opts.radius);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = await searchObservations({
        lat: loc.coords.lat,
        lng: loc.coords.lng,
        radiusKm: radius,
        taxonName: trimmed,
        orderBy: "observed_on",
        perPage: 30,
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log(
        locationLine({
          name: loc.name,
          lat: loc.coords.lat,
          lng: loc.coords.lng,
          radiusKm: radius,
        }),
      );
      console.log(`Search: ${trimmed} — ${result.data.length} matches`);
      console.log("");

      if (result.data.length === 0) {
        console.log("No matching observations.");
        return;
      }
      const widths = computeObservationWidths(result.data);
      for (const obs of result.data) console.log(formatObservation(obs, widths));
    });

  inat
    .command("taxon <name>")
    .description("Look up a taxon by name")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog inat taxon \"bald eagle\"",
        "  $ pondlog inat taxon \"Pseudacris regilla\"",
      ].join("\n"),
    )
    .action(async (name: string, opts: { json?: boolean }) => {
      const trimmed = name.trim();
      if (!trimmed) return fail("taxon name is empty");

      const result = await searchTaxa(trimmed);
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      if (result.data.length === 0) {
        console.log(`No taxa matching "${trimmed}".`);
        return;
      }
      console.log(`Taxa matching "${trimmed}" (${result.data.length}):`);
      console.log("");
      for (const t of result.data.slice(0, 10)) {
        console.log(formatTaxon(t));
      }
      if (result.data.length > 10) {
        console.log(`  …and ${result.data.length - 10} more`);
      }
    });

  return inat;
}

function takeRadius(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_RADIUS;
  const r = parseRadiusKm(raw);
  if (!r.ok) return fail(r.error.message);
  return r.data;
}

function takeDays(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_DAYS;
  const r = parseDays(raw);
  if (!r.ok) return fail(r.error.message);
  return r.data;
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

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
