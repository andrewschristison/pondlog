import {
  findCrop,
  getCropsForZone,
  getFrostDates,
  getHardinessZone,
  getHardinessZoneByZip,
  getPlantingPlan,
  searchCrops,
  type CropCategory,
  type ZoneInfo,
} from "@pondlog/core";
import {
  getGrowingGuide,
  hasTrefleToken,
  searchPlants,
} from "@pondlog/source-trefle";
import { Command } from "commander";
import { loadConfig } from "../config.js";
import {
  formatCropEntry,
  formatCropSummaryRow,
  formatPlantingPlan,
  formatTrefleGuide,
  formatTrefleSummaryRow,
  formatZoneBlock,
} from "../format-garden.js";
import { printJson } from "../format.js";
import { resolveLocation } from "../resolve-location.js";

interface ZoneOpts {
  lat?: string;
  lng?: string;
  zip?: string;
  json?: boolean;
}

interface NowOpts {
  lat?: string;
  lng?: string;
  zone?: string;
  date?: string;
  category?: string;
  limit?: string;
  json?: boolean;
  includeIndoor?: boolean;
}

interface PlantOpts {
  json?: boolean;
}

interface SearchOpts {
  zone?: string;
  category?: string;
  source?: string;
  json?: boolean;
}

const VALID_CATEGORIES: CropCategory[] = [
  "vegetable",
  "herb",
  "fruit",
  "flower",
  "cover-crop",
  "root",
  "legume",
];

export function buildGardenCommand(): Command {
  const cmd = new Command("garden").description(
    "Garden planning — USDA hardiness zone, frost dates, planting plan, and plant lookup. Backed by the bundled 500-crop calendar (always available) plus Trefle.io taxonomy when TREFLE_API_TOKEN is set.",
  );

  cmd
    .command("zone")
    .description(
      "Show USDA hardiness zone, average winter min temp, and typical frost dates for a location.",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--zip <zip>", "5-digit US ZIP (alternative to lat/lng)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog garden zone --lat 48.118 --lng -123.4307",
        "  $ pondlog garden zone --zip 10001",
        "  $ pondlog garden zone        # falls back to saved location",
        "",
        "Notes:",
        "  Zone data: PRISM Climate Group 2023 USDA Plant Hardiness Zone Map.",
        "  Coords resolve to the nearest of 40,283 ZIP centroids.",
        "  Frost dates are continental-US averages by zone — your microclimate",
        "  may shift them by 2-3 weeks (especially coastal/mountain/desert).",
      ].join("\n"),
    )
    .action(async (opts: ZoneOpts) => {
      const zoneRes = await resolveZoneFromOpts(opts);
      if (!zoneRes.ok) return fail(zoneRes.error.message);
      const frost = getFrostDates(zoneRes.data.zone);
      if (opts.json) {
        return printJson({
          zone: zoneRes.data,
          frostDates: frost.ok ? frost.data : null,
        });
      }
      console.log(formatZoneBlock(zoneRes.data, frost.ok ? frost.data : undefined));
    });

  cmd
    .command("now")
    .description(
      "What to plant this week, given a location's zone + frost dates. Cross-references the 500-crop calendar with today's date and the typical frost dates for the zone, returning crops whose start/sow/transplant window is open right now.",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option(
      "--zone <zone>",
      'USDA hardiness zone "1a".."13b" (overrides location lookup)',
    )
    .option(
      "--date <YYYY-MM-DD>",
      "Plan against a specific date instead of today (handy for previewing a week ahead)",
    )
    .option(
      "--category <name>",
      "Filter by category: vegetable, herb, fruit, flower, cover-crop, root, legume",
    )
    .option("-l, --limit <n>", "Cap on suggestions (1..500, default 50)")
    .option(
      "--include-indoor",
      "Include indoor-only crops (microgreens, sprouts). Off by default because their year-round windows otherwise dominate the earliest-harvest sort.",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog garden now",
        "  $ pondlog garden now --lat 48.118 --lng -123.4307",
        "  $ pondlog garden now --zone 5b --date 2026-04-01",
        "  $ pondlog garden now --category herb",
        "  $ pondlog garden now --include-indoor   # add microgreens/sprouts",
        "",
        "Output groups by action: start_indoors → direct_sow → transplant → plant_now.",
        "expectedHarvestEarliest is calculated from the crop's daysToHarvest.min;",
        "if it lands past your typical first fall frost, the crop is unlikely to",
        "finish — pick a faster cultivar or skip.",
      ].join("\n"),
    )
    .action(async (opts: NowOpts) => {
      const zoneRes = await resolveZoneFromAny(opts);
      if (!zoneRes.ok) return fail(zoneRes.error.message);
      const limit = takeLimit(opts.limit);
      let category: CropCategory | undefined;
      if (opts.category) {
        if (!(VALID_CATEGORIES as string[]).includes(opts.category)) {
          return fail(
            `--category must be one of: ${VALID_CATEGORIES.join(", ")}; got "${opts.category}"`,
          );
        }
        category = opts.category as CropCategory;
      }
      if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
        return fail(`--date must be YYYY-MM-DD, got "${opts.date}"`);
      }
      const planRes = getPlantingPlan({
        zone: zoneRes.data,
        ...(opts.date ? { date: opts.date } : {}),
        ...(category ? { category } : {}),
        limit,
        ...(opts.includeIndoor ? { includeIndoor: true } : {}),
      });
      if (!planRes.ok) return fail(planRes.error.message);
      if (opts.json) return printJson(planRes.data);
      console.log(
        formatPlantingPlan(
          planRes.data.zone,
          planRes.data.frostDates,
          planRes.data.asOf,
          planRes.data.plantNow,
        ),
      );
    });

  cmd
    .command("plant <name>")
    .description(
      "Look up a single plant by common name, scientific name, or slug. Shows the crop calendar entry (planting windows, days to harvest, zone range) and Trefle botanical detail when TREFLE_API_TOKEN is set.",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog garden plant tomato",
        "  $ pondlog garden plant 'Solanum lycopersicum'",
        "  $ pondlog garden plant kale --json",
      ].join("\n"),
    )
    .action(async (nameArg: string, opts: PlantOpts) => {
      const crop = findCrop(nameArg);
      // Trefle detail — only fetched if a token is set.
      let guide: import("@pondlog/source-trefle").GrowingGuide | undefined;
      let trefleErr: string | undefined;
      if (hasTrefleToken()) {
        const slug = crop?.scientificName.toLowerCase().replace(/\s+/g, "-");
        const lookupKey = slug ?? nameArg;
        const guideRes = await getGrowingGuide(lookupKey);
        if (guideRes.ok) guide = guideRes.data;
        else trefleErr = guideRes.error.message;
      }
      if (!crop && !guide) {
        if (trefleErr) {
          return fail(
            `no calendar match for "${nameArg}"; Trefle lookup also failed: ${trefleErr}`,
          );
        }
        return fail(
          `no calendar match for "${nameArg}". Try \`pondlog garden search ${JSON.stringify(nameArg)}\` for fuzzy matches.`,
        );
      }
      if (opts.json) {
        return printJson({
          crop: crop ?? null,
          trefle: guide ?? null,
          ...(trefleErr ? { trefleError: trefleErr } : {}),
        });
      }
      const out: string[] = [];
      if (crop) out.push(formatCropEntry(crop));
      else out.push(`No crop calendar entry for "${nameArg}".`);
      if (guide) {
        out.push("");
        out.push(formatTrefleGuide(guide));
      } else if (trefleErr) {
        out.push("");
        out.push(`  Trefle lookup failed: ${trefleErr}`);
      } else if (!hasTrefleToken()) {
        out.push("");
        out.push(
          `  ${dimText("(set TREFLE_API_TOKEN for botanical detail from Trefle)")}`,
        );
      }
      console.log(out.join("\n"));
    });

  cmd
    .command("search <query>")
    .description(
      "Search for plants by name. Combines the 500-crop calendar with Trefle's 1M+ plant database when TREFLE_API_TOKEN is set.",
    )
    .option(
      "--zone <zone>",
      'Filter calendar matches to the USDA zone "1a".."13b"',
    )
    .option(
      "--category <name>",
      "Filter calendar matches by category (vegetable, herb, fruit, flower, cover-crop, root, legume)",
    )
    .option(
      "--source <name>",
      "Restrict to a single source: 'calendar' or 'trefle' (default: both when token set)",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog garden search bean",
        "  $ pondlog garden search 'cucurbit' --category vegetable",
        "  $ pondlog garden search 'Lactuca' --source trefle",
        "  $ pondlog garden search bean --zone 8b --json",
      ].join("\n"),
    )
    .action(async (queryArg: string, opts: SearchOpts) => {
      const sourceFilter = opts.source ?? "both";
      if (!["both", "calendar", "trefle"].includes(sourceFilter)) {
        return fail(`--source must be 'both', 'calendar', or 'trefle'`);
      }
      let category: CropCategory | undefined;
      if (opts.category) {
        if (!(VALID_CATEGORIES as string[]).includes(opts.category)) {
          return fail(
            `--category must be one of: ${VALID_CATEGORIES.join(", ")}; got "${opts.category}"`,
          );
        }
        category = opts.category as CropCategory;
      }
      const calendarMatches =
        sourceFilter === "trefle"
          ? []
          : searchCrops(queryArg, 50).filter((c) => {
              if (category && c.category !== category) return false;
              if (opts.zone) {
                const num = parseInt(opts.zone.replace(/[^0-9]/g, ""), 10);
                if (num < c.zoneRange.min || num > c.zoneRange.max) return false;
              }
              return true;
            });

      let trefleMatches: import("@pondlog/source-trefle").TreflePlantSummary[] =
        [];
      let trefleErr: string | undefined;
      if (sourceFilter !== "calendar" && hasTrefleToken()) {
        const r = await searchPlants({ query: queryArg });
        if (r.ok) trefleMatches = r.data.plants;
        else trefleErr = r.error.message;
      }

      if (opts.json) {
        return printJson({
          query: queryArg,
          calendar: calendarMatches,
          trefle: trefleMatches,
          ...(trefleErr ? { trefleError: trefleErr } : {}),
        });
      }

      const out: string[] = [];
      if (calendarMatches.length > 0) {
        out.push(
          `🌱 Crop calendar matches (${calendarMatches.length}):`,
        );
        for (const c of calendarMatches) out.push(formatCropSummaryRow(c));
        out.push("");
      }
      if (trefleMatches.length > 0) {
        out.push(`🌍 Trefle matches (${trefleMatches.length}):`);
        for (const p of trefleMatches) out.push(formatTrefleSummaryRow(p));
      } else if (
        sourceFilter !== "calendar" &&
        !hasTrefleToken() &&
        calendarMatches.length === 0
      ) {
        out.push(
          `No crop calendar matches. Set TREFLE_API_TOKEN to also search Trefle's 1M+ plant database.`,
        );
      } else if (calendarMatches.length === 0 && trefleMatches.length === 0) {
        out.push(`No matches for "${queryArg}".`);
        if (trefleErr) out.push(`  (Trefle error: ${trefleErr})`);
      }
      console.log(out.join("\n"));
    });

  return cmd;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveZoneFromOpts(
  opts: ZoneOpts,
): Promise<{ ok: true; data: ZoneInfo } | { ok: false; error: { message: string } }> {
  if (opts.zip) {
    const r = getHardinessZoneByZip(opts.zip);
    return r;
  }
  const loc = await resolveLocation({
    ...(opts.lat ? { lat: opts.lat } : {}),
    ...(opts.lng ? { lng: opts.lng } : {}),
  });
  if (!loc.ok) return loc;
  return getHardinessZone(loc.data.coords);
}

async function resolveZoneFromAny(
  opts: NowOpts,
): Promise<{ ok: true; data: ZoneInfo } | { ok: false; error: { message: string } }> {
  if (opts.zone) {
    // Construct a synthetic ZoneInfo from a zone string. We don't know the
    // user's exact ZIP, so fields are best-effort.
    const m = /^(\d{1,2})([ab])$/i.exec(opts.zone.trim().toLowerCase());
    if (!m || !m[1] || !m[2]) {
      return {
        ok: false,
        error: { message: `--zone must look like "5a" or "8b", got "${opts.zone}"` },
      };
    }
    const num = Number(m[1]);
    const sub = m[2].toLowerCase() as "a" | "b";
    const minTempF = -60 + 10 * (num - 1) + (sub === "b" ? 5 : 0);
    return {
      ok: true,
      data: {
        zone: `${num}${sub}`,
        zoneNumber: num,
        subzone: sub,
        minTempF,
        maxTempF: minTempF + 5,
        source: "prism-2023",
        resolvedFrom: "zip-exact",
        zip: "00000",
      },
    };
  }
  const loc = await resolveLocation({
    ...(opts.lat ? { lat: opts.lat } : {}),
    ...(opts.lng ? { lng: opts.lng } : {}),
  });
  if (!loc.ok) return loc;
  return getHardinessZone(loc.data.coords);
}

function takeLimit(raw: string | undefined): number {
  if (raw === undefined) return 50;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 500) {
    return fail(`--limit out of range (1..500): ${raw}`);
  }
  return n;
}

function dimText(s: string): string {
  // Picocolors lazy-imported; here just gray fallback.
  return s;
}

// Suppress unused warning for getCropsForZone — exported via core but not
// directly used in this command file.
void getCropsForZone;

function fail(message: string): never {
  process.stderr.write(`pondlog: ${message}\n`);
  process.exit(1);
}
