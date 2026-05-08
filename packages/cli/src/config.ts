import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok, type Coordinates, type Result } from "@pondlog/core";
import { z } from "zod";

const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const NOAA_STATION_RE = /^[0-9]{6,8}$/;
const USGS_SITE_RE = /^[0-9]{8,15}$/;
const EBIRD_REGION_RE = /^[A-Z0-9-]{2,12}$/;

const PondlogConfigSchema = z.object({
  version: z.literal(1),
  defaultLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      name: z.string().min(1).max(120).optional(),
    })
    .optional(),
  /** NOAA CO-OPS station id used for tide predictions (e.g. "9444090"). */
  noaaStation: z.string().regex(NOAA_STATION_RE).optional(),
  /** USGS NWIS site number used for streamflow (e.g. "12045500"). */
  usgsSite: z.string().regex(USGS_SITE_RE).optional(),
  /** eBird region code used for region-scoped queries (e.g. "US-WA-009"). */
  ebirdRegion: z.string().regex(EBIRD_REGION_RE).optional(),
});

export type PondlogConfig = z.infer<typeof PondlogConfigSchema>;
export type SavedLocation = NonNullable<PondlogConfig["defaultLocation"]>;

export function setNoaaStation(
  cfg: PondlogConfig | null,
  stationId: string,
): Result<PondlogConfig> {
  if (!NOAA_STATION_RE.test(stationId)) {
    return err({
      source: "cli/config",
      message: `invalid NOAA station "${stationId}" — expected 6–8 digits (e.g. "9444090")`,
    });
  }
  return ok({ ...(cfg ?? { version: 1 as const }), noaaStation: stationId });
}

export function setUsgsSite(
  cfg: PondlogConfig | null,
  siteNumber: string,
): Result<PondlogConfig> {
  if (!USGS_SITE_RE.test(siteNumber)) {
    return err({
      source: "cli/config",
      message: `invalid USGS site "${siteNumber}" — expected 8–15 digits (e.g. "12045500")`,
    });
  }
  return ok({ ...(cfg ?? { version: 1 as const }), usgsSite: siteNumber });
}

export function setEbirdRegion(
  cfg: PondlogConfig | null,
  regionCode: string,
): Result<PondlogConfig> {
  const upper = regionCode.toUpperCase();
  if (!EBIRD_REGION_RE.test(upper)) {
    return err({
      source: "cli/config",
      message: `invalid eBird region "${regionCode}" — expected pattern like "US", "US-WA", or "US-WA-009"`,
    });
  }
  return ok({ ...(cfg ?? { version: 1 as const }), ebirdRegion: upper });
}

export const CONFIG_DIR_ENV = "PONDLOG_CONFIG_DIR";

function configDir(): string {
  const fromEnv = process.env[CONFIG_DIR_ENV];
  if (fromEnv && fromEnv.trim() !== "") return fromEnv;
  return join(homedir(), ".pondlog");
}

export function getConfigPath(): string {
  return join(configDir(), "config.json");
}

export async function loadConfig(): Promise<Result<PondlogConfig | null>> {
  const path = getConfigPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    if (isENOENT(cause)) return ok(null);
    return err({
      source: "cli/config",
      message: `failed to read ${path}: ${stringifyCause(cause)}`,
      cause,
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    return err({
      source: "cli/config",
      message: `${path} is not valid JSON: ${stringifyCause(cause)}`,
      cause,
    });
  }
  const parsed = PondlogConfigSchema.safeParse(json);
  if (!parsed.success) {
    return err({
      source: "cli/config",
      message: `${path} schema invalid: ${parsed.error.message}`,
    });
  }
  return ok(parsed.data);
}

export async function saveConfig(cfg: PondlogConfig): Promise<Result<void>> {
  const validated = PondlogConfigSchema.safeParse(cfg);
  if (!validated.success) {
    return err({
      source: "cli/config",
      message: `refusing to save invalid config: ${validated.error.message}`,
    });
  }
  const path = getConfigPath();
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(tmp, `${JSON.stringify(validated.data, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(tmp, path);
    return ok(undefined);
  } catch (cause) {
    return err({
      source: "cli/config",
      message: `failed to write ${path}: ${stringifyCause(cause)}`,
      cause,
    });
  }
}

export function setSavedLocation(
  cfg: PondlogConfig | null,
  coords: Coordinates,
  name: string | undefined,
): PondlogConfig {
  const validated = CoordinatesSchema.parse(coords);
  const next: PondlogConfig = {
    version: 1,
    defaultLocation: {
      lat: validated.lat,
      lng: validated.lng,
      ...(name ? { name } : {}),
    },
  };
  return { ...(cfg ?? {}), ...next };
}

function isENOENT(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

function stringifyCause(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
