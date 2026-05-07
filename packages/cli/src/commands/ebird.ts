import { Command } from "commander";
import {
  assertEbirdApiKey,
  getChecklist,
  getHistoricOnDate,
  getNearbyHotspots,
  getNearbyNotable,
  getNearbyOfSpecies,
  getNearbyRecent,
} from "@pondlog/source-ebird";
import { locationLine, printJson } from "../format.js";
import {
  computeEbirdObsWidths,
  computeHotspotWidths,
  formatChecklistHeader,
  formatEbirdObs,
  formatHotspot,
  groupObsByLocation,
} from "../format-ebird.js";
import { resolveLocation } from "../resolve-location.js";
import {
  parseDays,
  parseHistoricDate,
  parseRadiusKm,
  parseRegionCode,
  parseSpeciesCode,
} from "../validate.js";

const DEFAULT_RADIUS = 25;
const DEFAULT_DAYS = 7;

interface LocationOpts {
  lat?: string;
  lng?: string;
  radius?: string;
  days?: string;
  json?: boolean;
}

type RecentOpts = LocationOpts;
type NotableOpts = LocationOpts;
type SpeciesOpts = Omit<LocationOpts, "days">;
type HotspotsOpts = Omit<LocationOpts, "days">;

interface HistoricOpts {
  region?: string;
  json?: boolean;
}

interface ChecklistOpts {
  json?: boolean;
}

export function buildEbirdCommand(): Command {
  const ebird = new Command("ebird").description("eBird (birds) commands");

  ebird
    .command("recent")
    .description("Recent bird observations near a location, grouped by species")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 50)`)
    .option("-d, --days <days>", `Window in days (default ${DEFAULT_DAYS}, max 30)`)
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog ebird recent",
        "  $ pondlog ebird recent --lat 48.118 --lng -123.4307 --radius 25",
        "  $ pondlog ebird recent --days 14",
        "  $ pondlog ebird recent --json | jq '.[0]'",
      ].join("\n"),
    )
    .action(async (opts: RecentOpts) => {
      requireEbirdApiKey();
      const radius = takeEbirdRadius(opts.radius);
      const days = takeEbirdDays(opts.days);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = await getNearbyRecent(loc.coords.lat, loc.coords.lng, {
        dist: radius,
        back: days,
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
        console.log("No bird observations in this window.");
        return;
      }

      // eBird /obs/recent returns the most-recent observation per species,
      // so each row is already one species. Sort newest first.
      const sorted = [...result.data].sort((a, b) => b.obsDt.localeCompare(a.obsDt));
      const widths = computeEbirdObsWidths(sorted);
      console.log(`${sorted.length} species`);
      for (const o of sorted) console.log(formatEbirdObs(o, widths));
    });

  ebird
    .command("notable")
    .description("Notable / unusual bird sightings near a location")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 50)`)
    .option("-d, --days <days>", `Window in days (default ${DEFAULT_DAYS}, max 30)`)
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog ebird notable",
        "  $ pondlog ebird notable --radius 50 --days 14",
        "  $ pondlog ebird notable --json",
      ].join("\n"),
    )
    .action(async (opts: NotableOpts) => {
      requireEbirdApiKey();
      const radius = takeEbirdRadius(opts.radius);
      const days = takeEbirdDays(opts.days);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = await getNearbyNotable(loc.coords.lat, loc.coords.lng, {
        dist: radius,
        back: days,
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
        console.log("No notable sightings in this window.");
        return;
      }

      const widths = computeEbirdObsWidths(result.data);
      console.log(`★ ${result.data.length} notable sightings`);
      for (const o of result.data) {
        console.log(formatEbirdObs(o, widths, { notable: true }));
      }
    });

  ebird
    .command("species <speciesCode>")
    .description("Recent sightings of one species near a location (eBird 4–10 char code, e.g. \"barowl\")")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 50)`)
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog ebird species amecro    # American Crow",
        "  $ pondlog ebird species barowl --radius 50  # Barred Owl",
        "  $ pondlog ebird species baleag --lat 48.118 --lng -123.4307",
        "",
        "Find species codes via eBird species pages or the taxonomy endpoint.",
      ].join("\n"),
    )
    .action(async (codeRaw: string, opts: SpeciesOpts) => {
      requireEbirdApiKey();
      const code = parseSpeciesCode(codeRaw);
      if (!code.ok) return fail(code.error.message);
      const radius = takeEbirdRadius(opts.radius);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = await getNearbyOfSpecies(loc.coords.lat, loc.coords.lng, code.data, {
        dist: radius,
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
      console.log("");

      if (result.data.length === 0) {
        console.log(`No recent sightings of "${code.data}" in this radius.`);
        return;
      }
      const sorted = [...result.data].sort((a, b) => b.obsDt.localeCompare(a.obsDt));
      const widths = computeEbirdObsWidths(sorted);
      const sample = sorted[0];
      if (sample) console.log(`${sample.comName} (${sample.sciName}) — ${sorted.length} sightings`);
      for (const o of sorted) console.log(formatEbirdObs(o, widths));
    });

  ebird
    .command("historic <date>")
    .description("Bird observations on a specific date in a region (date as YYYY-MM-DD)")
    .option("--region <code>", "eBird region code (e.g. US-WA-009 for Clallam County)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog ebird historic 2025-05-01 --region US-WA-009",
        "  $ pondlog ebird historic 2024-12-25 --region US-WA",
        "",
        "Region codes are hierarchical:",
        "  US                country",
        "  US-WA             state/province (subnational1)",
        "  US-WA-009         county (subnational2)",
      ].join("\n"),
    )
    .action(async (dateRaw: string, opts: HistoricOpts) => {
      requireEbirdApiKey();
      const date = parseHistoricDate(dateRaw);
      if (!date.ok) return fail(date.error.message);
      if (!opts.region) {
        return fail(
          "missing --region. Pass an eBird region code (e.g. --region US-WA-009 for Clallam County).",
        );
      }
      const region = parseRegionCode(opts.region);
      if (!region.ok) return fail(region.error.message);

      const result = await getHistoricOnDate(
        region.data,
        date.data.year,
        date.data.month,
        date.data.day,
        { maxResults: 200 },
      );
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      const dateLabel = `${date.data.year}-${String(date.data.month).padStart(2, "0")}-${String(date.data.day).padStart(2, "0")}`;
      console.log(`Historic observations · ${region.data} · ${dateLabel}`);
      console.log("");

      if (result.data.length === 0) {
        console.log("No observations on that date.");
        return;
      }
      const widths = computeEbirdObsWidths(result.data);
      const grouped = groupObsByLocation(result.data);
      console.log(`${result.data.length} observations across ${grouped.size} locations`);
      let first = true;
      for (const [locName, list] of grouped) {
        if (!first) console.log("");
        first = false;
        console.log(`\n${locName} (${list.length})`);
        for (const o of list) console.log(formatEbirdObs(o, widths));
      }
    });

  ebird
    .command("hotspots")
    .description("Birding hotspots near a location, ranked by all-time species count")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("-r, --radius <km>", `Search radius in km (default ${DEFAULT_RADIUS}, max 50)`)
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog ebird hotspots",
        "  $ pondlog ebird hotspots --radius 50",
      ].join("\n"),
    )
    .action(async (opts: HotspotsOpts) => {
      requireEbirdApiKey();
      const radius = takeEbirdRadius(opts.radius);
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });

      const result = await getNearbyHotspots(loc.coords.lat, loc.coords.lng, {
        dist: radius,
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
      console.log("");

      if (result.data.length === 0) {
        console.log("No hotspots in this radius.");
        return;
      }

      const sorted = [...result.data].sort((a, b) => {
        const av = a.numSpeciesAllTime ?? -1;
        const bv = b.numSpeciesAllTime ?? -1;
        return bv - av;
      });
      const widths = computeHotspotWidths(sorted);
      console.log(`${sorted.length} hotspots`);
      for (const h of sorted) console.log(formatHotspot(h, widths));
    });

  ebird
    .command("checklist <subId>")
    .description("View a single eBird checklist by submission id (e.g. S987654321)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog ebird checklist S987654321",
        "  $ pondlog ebird checklist S987654321 --json",
      ].join("\n"),
    )
    .action(async (subId: string, opts: ChecklistOpts) => {
      requireEbirdApiKey();
      const trimmed = subId.trim();
      if (!trimmed) return fail("subId is empty");

      const result = await getChecklist(trimmed);
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log(formatChecklistHeader(result.data));
      const obs = result.data.obs ?? [];
      if (obs.length === 0) {
        console.log("\n(no observations)");
        return;
      }
      console.log("");
      for (const o of obs) {
        const count = o.howManyStr ?? (o.present ? "X" : "?");
        console.log(`  ${count.padStart(4)}  ${o.speciesCode}`);
      }
    });

  return ebird;
}

function takeEbirdRadius(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_RADIUS;
  const r = parseRadiusKm(raw);
  if (!r.ok) return fail(r.error.message);
  if (r.data > 50) {
    return fail(`--radius out of range for eBird (max 50 km): ${r.data}`);
  }
  return r.data;
}

function takeEbirdDays(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_DAYS;
  const r = parseDays(raw);
  if (!r.ok) return fail(r.error.message);
  if (r.data > 30) {
    return fail(`--days out of range for eBird (max 30): ${r.data}`);
  }
  return r.data;
}

async function takeLocation(flags: { lat?: string; lng?: string }) {
  const loc = await resolveLocation(flags);
  if (!loc.ok) return fail(loc.error.message);
  return loc.data;
}

function requireEbirdApiKey(): void {
  try {
    assertEbirdApiKey();
  } catch {
    fail(
      "EBIRD_API_KEY is not set. Get a free key at https://ebird.org/api/keygen, then run: export EBIRD_API_KEY=<your-key>",
    );
  }
}

function fail(message: string): never {
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
}
