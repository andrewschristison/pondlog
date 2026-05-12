import { Command } from "commander";
import {
  bboxAround,
  getDailyValues,
  getInstantaneousValues,
  searchSites,
} from "@pondlog/source-usgs";
import { printJson } from "../format.js";
import {
  computeDailyTableWidths,
  computeSiteTableWidths,
  formatDailyRow,
  formatDailyTableHeader,
  formatFlowReading,
  formatSiteRow,
} from "../format-usgs.js";
import { resolveLocation } from "../resolve-location.js";
import { parseRadiusKm } from "../validate.js";

const SITE_NUMBER_RE = /^[0-9]{8,15}$/;
const PERIOD_RE = /^P(?:T?\d+[YMDHS])+$/;
const DEFAULT_RADIUS = 25;
const DEFAULT_FLOW_PERIOD = "PT2H";
const DEFAULT_DAILY_PERIOD = "P7D";

interface FlowOpts {
  site?: string;
  period?: string;
  json?: boolean;
}

interface DailyOpts {
  site?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  json?: boolean;
}

interface SitesOpts {
  lat?: string;
  lng?: string;
  radius?: string;
  state?: string;
  json?: boolean;
}

export function buildUsgsCommand(): Command {
  const usgs = new Command("usgs").description(
    "USGS Water Services commands, real-time and historic streamflow, gage height, and site search",
  );

  usgs
    .command("flow")
    .description(
      "Current real-time discharge + gage height for a USGS gauge site",
    )
    .option(
      "-s, --site <number>",
      "USGS site number, 8–15 digits (e.g. 12045500 = Elwha River at McDonald Br)",
    )
    .option(
      "-p, --period <iso8601>",
      `ISO-8601 duration ending now (default ${DEFAULT_FLOW_PERIOD}, e.g. PT2H, P1D, P7D)`,
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog usgs flow --site 12045500",
        "  $ pondlog usgs flow --site 12048000 --period P1D",
        "  $ pondlog usgs flow --site 12045500 --json | jq '.[0].series[0].values[-1]'",
        "",
        "Notes:",
        "  Returns the latest discharge (parameter 00060, ft³/s) and gage height",
        "  (00065, ft) over the requested period. USGS rejects historic dates on",
        "  the /iv/ endpoint, use `pondlog usgs daily` for past data.",
      ].join("\n"),
    )
    .action(async (opts: FlowOpts) => {
      const site = takeSite(opts.site);
      const period = takePeriod(opts.period, DEFAULT_FLOW_PERIOD);

      const result = await getInstantaneousValues({
        sites: [site],
        period,
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      if (result.data.length === 0) {
        console.log(`No data for site ${site}. Site may not exist or have no recent readings.`);
        return;
      }
      for (const reading of result.data) {
        console.log(formatFlowReading(reading));
      }
    });

  usgs
    .command("daily")
    .description(
      "Daily streamflow statistics (mean) for a USGS gauge site, current or historic",
    )
    .option("-s, --site <number>", "USGS site number")
    .option(
      "-p, --period <iso8601>",
      `ISO-8601 duration ending now (default ${DEFAULT_DAILY_PERIOD}). Mutually exclusive with --start-date.`,
    )
    .option("--start-date <date>", "Historic range start (YYYY-MM-DD)")
    .option(
      "--end-date <date>",
      "Historic range end (YYYY-MM-DD). Defaults to today when --start-date is set.",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog usgs daily --site 12045500",
        "  $ pondlog usgs daily --site 12045500 --period P30D",
        "  $ pondlog usgs daily --site 12045500 --start-date 2024-01-01 --end-date 2024-01-31",
        "  $ pondlog usgs daily --site 12045500 --json",
        "",
        "Returns daily mean discharge (parameter 00060). For real-time readings",
        "use `pondlog usgs flow`. Use --start-date for historic queries, /iv/",
        "rejects historic dates but /dv/ accepts them.",
      ].join("\n"),
    )
    .action(async (opts: DailyOpts) => {
      const site = takeSite(opts.site);
      const usingDates =
        opts.startDate !== undefined || opts.endDate !== undefined;
      if (usingDates && opts.period !== undefined) {
        return fail("--period and --start-date/--end-date are mutually exclusive");
      }

      const params: Parameters<typeof getDailyValues>[0] = { sites: [site] };
      if (usingDates) {
        if (opts.startDate) params.startDt = opts.startDate;
        if (opts.endDate) params.endDt = opts.endDate;
      } else {
        params.period = takePeriod(opts.period, DEFAULT_DAILY_PERIOD);
      }

      const result = await getDailyValues(params);
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      if (result.data.length === 0) {
        console.log(`No data for site ${site}.`);
        return;
      }

      for (const reading of result.data) {
        const coords = reading.site.coordinates
          ? `${reading.site.coordinates.lat.toFixed(3)}, ${reading.site.coordinates.lng.toFixed(3)}`
          : "no coords";
        console.log(`${reading.site.siteName} (USGS ${reading.site.siteNumber})`);
        console.log(`  ${coords}`);
        for (const series of reading.series) {
          console.log("");
          console.log(formatDailyTableHeader(series));
          const widths = computeDailyTableWidths(series);
          for (const v of series.values) {
            console.log(formatDailyRow(v, widths));
          }
        }
      }
    });

  usgs
    .command("sites")
    .description(
      "Find USGS stream gauge sites by location (bounding box) or US state",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option(
      "-r, --radius <km>",
      `Search radius in km around lat/lng (default ${DEFAULT_RADIUS}, max ~350)`,
    )
    .option(
      "--state <code>",
      "US two-letter state postal code (e.g. WA). Mutually exclusive with --lat/--lng.",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog usgs sites",
        "  $ pondlog usgs sites --lat 48.118 --lng -123.4307 --radius 25",
        "  $ pondlog usgs sites --state WA --json",
        "",
        "Returns active stream-gauge sites (siteType=ST, hasDataTypeCd=iv). Use",
        "the resulting site numbers with `pondlog usgs flow` or `pondlog usgs",
        "daily`. Falls back to your saved location if --lat/--lng are absent.",
      ].join("\n"),
    )
    .action(async (opts: SitesOpts) => {
      if (opts.state && (opts.lat || opts.lng)) {
        return fail("--state and --lat/--lng are mutually exclusive");
      }

      let result;
      if (opts.state) {
        const code = opts.state.trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) {
          return fail(`invalid --state "${opts.state}", expected two letters`);
        }
        result = await searchSites({ stateCode: code });
      } else {
        const radius = takeRadius(opts.radius);
        const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });
        const bbox = bboxAround(loc.coords, radius);
        result = await searchSites({ bbox });
      }
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      if (result.data.length === 0) {
        console.log("No USGS stream-gauge sites match those filters.");
        return;
      }
      const widths = computeSiteTableWidths(result.data);
      console.log(
        `${result.data.length} stream-gauge site${result.data.length === 1 ? "" : "s"}:`,
      );
      console.log("");
      for (const r of result.data) console.log(formatSiteRow(r, widths));
    });

  return usgs;
}

function takeSite(raw: string | undefined): string {
  if (raw === undefined || raw.trim() === "") {
    return fail("--site is required (e.g. 12045500 = Elwha River at McDonald Br)");
  }
  const v = raw.trim();
  if (!SITE_NUMBER_RE.test(v)) {
    return fail(`invalid --site "${raw}", expected 8–15 digits`);
  }
  return v;
}

function takePeriod(raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback;
  if (!PERIOD_RE.test(raw)) {
    return fail(`invalid --period "${raw}", expected ISO-8601 duration (e.g. PT2H, P7D)`);
  }
  return raw;
}

function takeRadius(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_RADIUS;
  const r = parseRadiusKm(raw);
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
