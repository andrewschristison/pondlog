import type {
  CropEntry,
  PlantSuggestion,
  ZoneInfo,
  FrostDates,
} from "@pondlog/core";
import type { GrowingGuide, TreflePlantSummary } from "@pondlog/source-trefle";
import pc from "picocolors";

function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Zone summary block
// ---------------------------------------------------------------------------

export function formatZoneBlock(
  zone: ZoneInfo,
  frost: FrostDates | undefined,
): string {
  const lines: string[] = [];
  const titleColor = pc.bold(`USDA Zone ${zone.zone}`);
  const tempLine = `${zone.minTempF}°F to ${zone.maxTempF}°F (avg annual min winter temp)`;
  lines.push(`${titleColor}  ·  ${tempLine}`);
  if (zone.resolvedFrom === "coords-nearest") {
    const distNote =
      typeof zone.distanceKm === "number"
        ? `${zone.distanceKm} km away`
        : "approximate";
    lines.push(pc.dim(`  resolved from nearest ZIP ${zone.zip} (${distNote})`));
  } else {
    lines.push(pc.dim(`  ZIP ${zone.zip} · exact match`));
  }
  if (frost) {
    lines.push("");
    lines.push(`${pc.bold("Typical frost dates")}:`);
    lines.push(
      `  last spring frost  ~${frost.lastSpring}   ·  first fall frost  ~${frost.firstFall}`,
    );
    lines.push(
      pc.dim(
        `  growing season ~${frost.seasonDays} days (continental US average; coastal/mountain microclimates may shift 2-3 weeks)`,
      ),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Planting plan rows
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<string, string> = {
  start_indoors: "start indoors",
  direct_sow: "direct sow",
  transplant: "transplant",
  plant_now: "plant now",
};

const ACTION_ICON: Record<string, string> = {
  start_indoors: "🪴",
  direct_sow: "🌱",
  transplant: "🌿",
  plant_now: "🌳",
};

export function formatPlantSuggestion(s: PlantSuggestion): string {
  const action = pc.cyan(padEnd(ACTION_LABEL[s.action] ?? s.action, 13));
  const name = pc.bold(padEnd(truncate(s.commonName, 22), 22));
  const window = pc.dim(`${s.windowStart}…${s.windowEnd}`);
  const harvest = s.expectedHarvestEarliest
    ? `harvest ${pc.dim("≥")} ${s.expectedHarvestEarliest}`
    : "";
  return `  ${ACTION_ICON[s.action] ?? "·"} ${action} ${name}  ${window}  ${harvest}`;
}

export function formatPlantingPlan(
  zone: ZoneInfo,
  frost: FrostDates,
  asOf: string,
  plantNow: PlantSuggestion[],
): string {
  const out: string[] = [];
  out.push(formatZoneBlock(zone, frost));
  out.push("");
  out.push(
    pc.bold(
      `🌱 Plant now in zone ${zone.zone}  ·  ${asOf}  ·  ${plantNow.length} option${plantNow.length === 1 ? "" : "s"}`,
    ),
  );
  if (plantNow.length === 0) {
    out.push(
      pc.dim(
        "  Nothing in window today. Try `pondlog garden zone` to see frost dates and plan ahead.",
      ),
    );
    return out.join("\n");
  }
  out.push("");
  // Group by action for readability.
  const groups = new Map<string, PlantSuggestion[]>();
  for (const s of plantNow) {
    const arr = groups.get(s.action);
    if (arr) arr.push(s);
    else groups.set(s.action, [s]);
  }
  for (const action of [
    "start_indoors",
    "direct_sow",
    "transplant",
    "plant_now",
  ]) {
    const arr = groups.get(action);
    if (!arr || arr.length === 0) continue;
    for (const s of arr) out.push(formatPlantSuggestion(s));
    out.push("");
  }
  return out.join("\n").trimEnd();
}

// ---------------------------------------------------------------------------
// Crop entry detail (from core's calendar)
// ---------------------------------------------------------------------------

export function formatCropEntry(crop: CropEntry): string {
  const out: string[] = [];
  out.push(
    `${pc.bold(crop.commonName)}  ·  ${pc.italic(crop.scientificName)}  ·  ${pc.dim(crop.category + " / " + crop.season)}`,
  );
  out.push(
    `  Days to harvest: ${crop.daysToHarvest.min}-${crop.daysToHarvest.max}  ·  Zones: ${crop.zoneRange.min}-${crop.zoneRange.max}` +
      (crop.minSoilTempF != null
        ? `  ·  Min soil ${crop.minSoilTempF}°F`
        : ""),
  );
  out.push("");
  out.push(pc.bold("  Planting windows:"));
  for (const w of crop.windows) {
    const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    const line = `    ${ACTION_ICON[w.action] ?? "·"} ${pc.cyan(ACTION_LABEL[w.action] ?? w.action)}  ${sign(w.fromFrostDays)}…${sign(w.toFrostDays)} days from ${w.anchor === "last_spring" ? "last spring frost" : "first fall frost"}`;
    out.push(line);
    if (w.notes) out.push(pc.dim(`        ${w.notes}`));
  }
  if (crop.notes) {
    out.push("");
    out.push(`  ${crop.notes}`);
  }
  if (crop.aliases && crop.aliases.length > 0) {
    out.push(pc.dim(`  aliases: ${crop.aliases.join(", ")}`));
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Trefle growing guide block (rendered after the core crop entry, when a
// token is set). Many fields will be undefined — rendered as "—".
// ---------------------------------------------------------------------------

export function formatTrefleGuide(g: GrowingGuide): string {
  const out: string[] = [];
  out.push(pc.bold("  Trefle botanical detail:"));
  if (g.family || g.genus) {
    out.push(`    family: ${g.family ?? "—"}   genus: ${g.genus ?? "—"}`);
  }
  if (g.edible !== undefined || (g.edibleParts && g.edibleParts.length)) {
    const parts =
      g.edibleParts && g.edibleParts.length > 0
        ? g.edibleParts.join(", ")
        : "—";
    out.push(`    edible: ${g.edible ?? "—"}   parts: ${parts}`);
  }
  if (g.light !== undefined) {
    out.push(`    light: ${g.light}/10 (10 = full sun)`);
  }
  if (g.phMin !== undefined || g.phMax !== undefined) {
    out.push(
      `    soil pH: ${g.phMin ?? "—"} - ${g.phMax ?? "—"}`,
    );
  }
  if (g.minimumGrowthTempF !== undefined) {
    out.push(
      `    growth temp: ${g.minimumGrowthTempF}°F – ${g.maximumGrowthTempF ?? "—"}°F  ${pc.dim("(growing-season range, NOT hardiness)")}`,
    );
  }
  if (g.flowerColors && g.flowerColors.length) {
    out.push(`    flower color: ${g.flowerColors.join(", ")}`);
  }
  if (g.imageUrl) out.push(pc.dim(`    image: ${g.imageUrl}`));
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Plant search summary (one-line per row, used by `garden search`)
// ---------------------------------------------------------------------------

export function formatTrefleSummaryRow(p: TreflePlantSummary): string {
  const common = padEnd(truncate(p.common_name ?? "(no common name)", 28), 28);
  const sci = pc.italic(padEnd(truncate(p.scientific_name, 38), 38));
  const family = pc.dim(p.family ?? "");
  return `  ${common}  ${sci}  ${family}`;
}

export function formatCropSummaryRow(c: CropEntry): string {
  const common = padEnd(truncate(c.commonName, 28), 28);
  const sci = pc.italic(padEnd(truncate(c.scientificName, 38), 38));
  const cat = pc.dim(`${c.category}/${c.season}`);
  return `  ${common}  ${sci}  ${cat}`;
}
