import type { Coordinates } from "@pondlog/core";

export type CompassDirection =
  | "N"
  | "NNE"
  | "NE"
  | "ENE"
  | "E"
  | "ESE"
  | "SE"
  | "SSE"
  | "S"
  | "SSW"
  | "SW"
  | "WSW"
  | "W"
  | "WNW"
  | "NW"
  | "NNW";

export type MoonPhaseName =
  | "New Moon"
  | "Waxing Crescent"
  | "First Quarter"
  | "Waxing Gibbous"
  | "Full Moon"
  | "Waning Gibbous"
  | "Last Quarter"
  | "Waning Crescent";

export interface SunTimes {
  /** Reference date the times were computed for (UTC ISO). */
  date: string;
  coordinates: Coordinates;
  /** Sunrise — sun upper limb at horizon, normal refraction. ISO 8601 UTC, or null if the sun never rises (polar night) within ±24h. */
  sunrise: string | null;
  sunset: string | null;
  /** Solar noon (sun transit). */
  solarNoon: string | null;
  /** Civil dawn / dusk: sun at -6°. Soft light, naked-eye horizon visible. */
  civilDawn: string | null;
  civilDusk: string | null;
  /** Nautical dawn / dusk: sun at -12°. Brightest stars visible, sea horizon faint. */
  nauticalDawn: string | null;
  nauticalDusk: string | null;
  /** Astronomical dawn / dusk: sun at -18°. True astronomical dark. */
  astronomicalDawn: string | null;
  astronomicalDusk: string | null;
  /** Golden hour ends at sunrise + 1h, starts at sunset - 1h. Soft warm light. */
  goldenHourMorningEnd: string | null;
  goldenHourEveningStart: string | null;
}

export interface MoonPhase {
  /** Reference date (UTC ISO). */
  date: string;
  /** Phase name. */
  phase: MoonPhaseName;
  /** Emoji glyph: 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 (sequence is northern-hemisphere convention). */
  emoji: string;
  /** Phase angle 0..360°. 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. */
  phaseAngleDeg: number;
  /** Illuminated fraction 0..1 (0 = new, 1 = full). */
  illuminationFraction: number;
  /** Approximate days since last new moon (synodic age, 0..29.5). */
  ageDays: number;
  /** Moonrise / set for the location (UTC ISO). null if location not provided or moon doesn't rise/set within ±24h. */
  rise: string | null;
  set: string | null;
}

export interface PlanetPosition {
  /** "Mercury" | "Venus" | "Mars" | "Jupiter" | "Saturn" | "Uranus" | "Neptune" */
  name: string;
  /** Apparent magnitude. Lower is brighter. Negative for Venus near peak; ≈ 5–6 for Uranus (near naked-eye limit). */
  magnitude: number;
  /** Altitude above horizon in degrees, at the reference time. Negative = below horizon. */
  altitudeDeg: number;
  /** Azimuth in degrees (0 = north, 90 = east, 180 = south, 270 = west). */
  azimuthDeg: number;
  /** Compass direction label ("SW", "ENE", …) corresponding to azimuth. */
  direction: CompassDirection;
  /** Rise / set today (UTC ISO), or null if circumpolar/below or no event in ±24h. */
  rise: string | null;
  set: string | null;
  /** True iff sun ≤ -6° AND altitude > 5° AND magnitude ≤ 6 — i.e. realistically visible to the naked eye against a dark sky. */
  isVisible: boolean;
  /** A short human-friendly highlight, e.g. "Bright in the SW after sunset (mag −2.3)" or null if not noteworthy. */
  highlight: string | null;
}

export interface PlanetPositions {
  /** Reference time used for the altitude/azimuth snapshot (UTC ISO). */
  referenceTime: string;
  coordinates: Coordinates;
  /** True iff the sun was below -6° at the reference time (i.e. it's at least civil twilight). */
  isDark: boolean;
  planets: PlanetPosition[];
}

export interface MeteorShower {
  id: string;
  name: string;
  /** Annual active window. Active if the query date falls inside [activeStart, activeEnd] (handling Dec→Jan wrap). */
  activeStart: string;
  activeEnd: string;
  peakDate: string;
  /** Days from query date to peak (negative = past, positive = future). */
  daysToPeak: number;
  /** Zenith Hourly Rate at peak under ideal conditions. */
  zhr: number;
  radiantRaHours: number;
  radiantDecDeg: number;
  parentObject: string;
  hemisphere: "northern" | "southern" | "both" | "equatorial";
  notes: string;
  /** Qualitative interference from current moon phase: "none" | "low" | "moderate" | "high". */
  moonInterference: "none" | "low" | "moderate" | "high";
}

export interface MeteorShowerListing {
  date: string;
  /** Showers active on the query date (sorted by closeness to peak, then by ZHR). */
  active: MeteorShower[];
  /** Showers peaking within the next 14 days. */
  upcoming: MeteorShower[];
}

export interface DarkSkyWindow {
  /** Reference date — the night this window represents (UTC ISO). */
  date: string;
  coordinates: Coordinates;
  /** Start of astronomical dark (sun ≤ -18°). null if it never gets dark enough at this latitude/season. */
  start: string | null;
  end: string | null;
  /** Length of the dark window in hours. 0 if no astronomical dark. */
  hours: number;
  /** Quality 1..5: 5 = new moon + true astronomical dark, 1 = full moon overhead during dark. */
  quality: 1 | 2 | 3 | 4 | 5;
  /** Human label: "Excellent" | "Good" | "Fair" | "Poor" | "Bright". */
  qualityLabel: string;
  /** Moon illumination fraction at the midpoint of the dark window (or sunset if no dark window). */
  moonIlluminationAtMid: number;
  /** Moon altitude at the midpoint, in degrees. */
  moonAltAtMid: number;
}

export interface ConstellationVisibility {
  iauCode: string;
  name: string;
  /** Altitude in degrees at the reference time. */
  altitudeDeg: number;
  azimuthDeg: number;
  direction: CompassDirection;
  /** Geometric culmination altitude at the latitude (90 - |lat - dec|). */
  culminationAltDeg: number;
  hemisphere: "northern" | "southern" | "equatorial";
  bestMonths: number[];
  notableStars: string[];
  description: string;
  /** Set if the current month is in `bestMonths` for this constellation. */
  isInSeason: boolean;
}

export interface ConstellationListing {
  referenceTime: string;
  coordinates: Coordinates;
  /** Constellations currently above 15° at the reference time, sorted by altitude. */
  visible: ConstellationVisibility[];
}

export interface NightSkyBriefing {
  /** Reference date used for sun/moon/meteor calculations (UTC ISO date or full datetime). */
  date: string;
  /** The reference time used for the planet / constellation snapshot (UTC ISO datetime). */
  referenceTime: string;
  coordinates: Coordinates;
  sun: SunTimes;
  moon: MoonPhase;
  darkSky: DarkSkyWindow;
  visiblePlanets: PlanetPosition[];
  activeMeteorShowers: MeteorShower[];
  upcomingMeteorShowers: MeteorShower[];
  visibleConstellations: ConstellationVisibility[];
  /** One-line summary string — what to look at tonight. */
  highlight: string;
}
