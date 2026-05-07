import {
  getActiveMeteorShowers,
  getMoonPhase,
  getPlanetPositions,
  getSunTimes,
  getTonightsBriefing,
} from "@pondlog/source-nightsky";
import { Command } from "commander";
import { printJson } from "../format.js";
import {
  formatBriefingHeader,
  formatConstellationList,
  formatDarkSkyLine,
  formatMoonLine,
  formatPlanetRow,
  formatPlanetsTable,
  formatShowerList,
  formatShowerRow,
  formatSunTimes,
} from "../format-nightsky.js";
import { resolveLocation } from "../resolve-location.js";

interface BaseOpts {
  lat?: string;
  lng?: string;
  date?: string;
  json?: boolean;
}

export function buildNightskyCommand(): Command {
  const ns = new Command("nightsky")
    .alias("sky")
    .description(
      "Tonight's sky for a location: sun/moon/planets/twilight/meteor-showers/constellations. Pure local computation, no network.",
    );

  ns.command("briefing", { isDefault: true })
    .description(
      "Curated 'what to look at tonight' — sun times, moon phase, dark-sky window, visible planets, active meteor showers, top constellations.",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--date <iso>", "Reference date/time (ISO 8601). Defaults to now.")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ pondlog nightsky",
        "  $ pondlog nightsky --lat 48.118 --lng -123.4307",
        "  $ pondlog nightsky --date 2026-08-12T08:00:00Z   # Perseids peak",
        "  $ pondlog nightsky --json | jq '.darkSky'",
      ].join("\n"),
    )
    .action(async (opts: BaseOpts) => {
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });
      const result = getTonightsBriefing({
        coords: loc.coords,
        ...(opts.date ? { date: opts.date } : {}),
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      const b = result.data;
      console.log(formatBriefingHeader(b));
      console.log("");
      console.log(b.highlight);
      console.log("");

      console.log("Sun");
      console.log(formatSunTimes(b.sun));
      console.log("");

      console.log("Moon");
      console.log(formatMoonLine(b.moon));
      console.log("");

      console.log("Dark sky");
      console.log(formatDarkSkyLine(b.darkSky));
      console.log("");

      console.log("Visible planets");
      console.log(formatPlanetsTable(b.visiblePlanets));
      console.log("");

      console.log("Meteor showers");
      if (b.activeMeteorShowers.length > 0) {
        console.log(formatShowerList(b.activeMeteorShowers));
      } else if (b.upcomingMeteorShowers.length > 0) {
        console.log("  Upcoming:");
        console.log(
          formatShowerList(b.upcomingMeteorShowers.slice(0, 3)),
        );
      } else {
        console.log("  (none active or in the next 14 days)");
      }
      console.log("");

      console.log("Constellations above 15°");
      console.log(formatConstellationList(b.visibleConstellations));
    });

  ns.command("planets")
    .description("Planet positions and visibility for tonight")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--date <iso>", "Reference date/time (ISO 8601). Defaults to now.")
    .option("--json", "Print raw JSON")
    .action(async (opts: BaseOpts) => {
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });
      const result = getPlanetPositions({
        coords: loc.coords,
        ...(opts.date ? { date: opts.date } : {}),
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log(
        result.data.isDark
          ? "Sun is below civil twilight — dark enough for naked-eye planets."
          : "Sun is above civil twilight — most planets washed out.",
      );
      console.log("");
      const visible = result.data.planets.filter((p) => p.isVisible);
      const others = result.data.planets.filter((p) => !p.isVisible);
      if (visible.length > 0) {
        console.log("Visible:");
        for (const p of visible) console.log(formatPlanetRow(p));
        console.log("");
      }
      if (others.length > 0) {
        console.log("Below threshold:");
        for (const p of others) console.log(formatPlanetRow(p));
      }
    });

  ns.command("moon")
    .description("Moon phase, illumination, age, and rise/set")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--date <iso>", "Reference date/time (ISO 8601). Defaults to now.")
    .option("--json", "Print raw JSON")
    .action(async (opts: BaseOpts) => {
      const hasLat = opts.lat !== undefined;
      const hasLng = opts.lng !== undefined;
      // Coords are optional for `moon` — phase is location-independent.
      let coords: { lat: number; lng: number } | undefined;
      if (hasLat || hasLng) {
        const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });
        coords = loc.coords;
      }
      const result = getMoonPhase({
        ...(coords ? { coords } : {}),
        ...(opts.date ? { date: opts.date } : {}),
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log(formatMoonLine(result.data));
    });

  ns.command("sun")
    .description("Sun times and twilight (civil/nautical/astronomical)")
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--date <iso>", "Reference date/time (ISO 8601). Defaults to now.")
    .option("--json", "Print raw JSON")
    .action(async (opts: BaseOpts) => {
      const loc = await takeLocation({ lat: opts.lat, lng: opts.lng });
      const result = getSunTimes({
        coords: loc.coords,
        ...(opts.date ? { date: opts.date } : {}),
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log(formatSunTimes(result.data));
    });

  ns.command("meteors")
    .description("Active and upcoming meteor showers")
    .option("--date <iso>", "Reference date/time (ISO 8601). Defaults to now.")
    .option("--json", "Print raw JSON")
    .action((opts: { date?: string; json?: boolean }) => {
      const result = getActiveMeteorShowers({
        ...(opts.date ? { date: opts.date } : {}),
      });
      if (!result.ok) return fail(result.error.message);

      if (opts.json) return printJson(result.data);

      console.log("Active:");
      if (result.data.active.length === 0) {
        console.log("  (none)");
      } else {
        for (const s of result.data.active) console.log(formatShowerRow(s));
      }
      console.log("");
      console.log("Upcoming (next 14 days):");
      if (result.data.upcoming.length === 0) {
        console.log("  (none)");
      } else {
        for (const s of result.data.upcoming) console.log(formatShowerRow(s));
      }
    });

  return ns;
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
