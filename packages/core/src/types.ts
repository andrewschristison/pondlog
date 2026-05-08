export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export type IconicTaxon =
  | "Aves"
  | "Amphibia"
  | "Mammalia"
  | "Reptilia"
  | "Insecta"
  | "Arachnida"
  | "Mollusca"
  | "Plantae"
  | "Fungi"
  | "Protozoa"
  | "Chromista"
  | "Animalia"
  | "Actinopterygii"
  | "Unknown";

export type SourceId =
  | "inaturalist"
  | "ebird"
  | "npn"
  | "usgs"
  | "noaa"
  | "suncalc"
  | "mushroomobserver"
  | "trefle"
  | "crop-calendar"
  | "usda-zones";

export interface Observation {
  id: string;
  source: SourceId;
  taxonName: string;
  commonName: string;
  iconicTaxon: IconicTaxon;
  observedAt: string;
  coordinates: Coordinates | null;
  placeGuess: string;
  qualityGrade?: string;
  observerName: string;
  url: string;
}

export interface SpeciesCount {
  taxonName: string;
  commonName: string;
  iconicTaxon: IconicTaxon;
  count: number;
  source: SourceId;
}

export interface IconicTaxaSummary {
  coordinates: Coordinates;
  radiusKm: number;
  days: number;
  totals: Record<IconicTaxon, number>;
  topPerGroup: Record<IconicTaxon, SpeciesCount[]>;
}

export interface Place {
  id: string;
  name: string;
  displayName: string;
  source: SourceId;
  coordinates?: Coordinates;
  bbox?: { swLat: number; swLng: number; neLat: number; neLng: number };
}

export interface Observer {
  id: string;
  loginName: string;
  displayName: string;
  observationCount: number;
  speciesCount: number;
  source: SourceId;
}

export interface Taxon {
  id: string;
  name: string;
  commonName: string;
  rank: string;
  iconicTaxon: IconicTaxon;
  source: SourceId;
}

export interface TaxonDetail extends Taxon {
  ancestry?: string[];
  wikipediaUrl?: string;
  observationsCount?: number;
  defaultPhotoUrl?: string;
}

export interface ObservationDetail extends Observation {
  description?: string;
  photoUrls: string[];
  identificationsCount?: number;
  commentsCount?: number;
}

export interface TideEvent {
  time: string;
  heightFt: number;
  type: "high" | "low";
}

// ---------------------------------------------------------------------------
// Night-sky types (relocated from @pondlog/source-nightsky so the aggregate
// NatureBriefing in core can typed-reference them without a circular dep).
// source-nightsky still re-exports these from its public surface.
// ---------------------------------------------------------------------------

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
  date: string;
  coordinates: Coordinates;
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string | null;
  civilDawn: string | null;
  civilDusk: string | null;
  nauticalDawn: string | null;
  nauticalDusk: string | null;
  astronomicalDawn: string | null;
  astronomicalDusk: string | null;
  goldenHourMorningEnd: string | null;
  goldenHourEveningStart: string | null;
}

export interface MoonPhase {
  date: string;
  phase: MoonPhaseName;
  emoji: string;
  phaseAngleDeg: number;
  illuminationFraction: number;
  ageDays: number;
  rise: string | null;
  set: string | null;
}

export interface PlanetPosition {
  name: string;
  magnitude: number;
  altitudeDeg: number;
  azimuthDeg: number;
  direction: CompassDirection;
  rise: string | null;
  set: string | null;
  isVisible: boolean;
  highlight: string | null;
}

export interface PlanetPositions {
  referenceTime: string;
  coordinates: Coordinates;
  isDark: boolean;
  planets: PlanetPosition[];
}

export interface MeteorShower {
  id: string;
  name: string;
  activeStart: string;
  activeEnd: string;
  peakDate: string;
  daysToPeak: number;
  zhr: number;
  radiantRaHours: number;
  radiantDecDeg: number;
  parentObject: string;
  hemisphere: "northern" | "southern" | "both" | "equatorial";
  notes: string;
  moonInterference: "none" | "low" | "moderate" | "high";
}

export interface MeteorShowerListing {
  date: string;
  active: MeteorShower[];
  upcoming: MeteorShower[];
}

export interface DarkSkyWindow {
  date: string;
  coordinates: Coordinates;
  start: string | null;
  end: string | null;
  hours: number;
  quality: 1 | 2 | 3 | 4 | 5;
  qualityLabel: string;
  moonIlluminationAtMid: number;
  moonAltAtMid: number;
}

export interface ConstellationVisibility {
  iauCode: string;
  name: string;
  altitudeDeg: number;
  azimuthDeg: number;
  direction: CompassDirection;
  culminationAltDeg: number;
  hemisphere: "northern" | "southern" | "equatorial";
  bestMonths: number[];
  notableStars: string[];
  description: string;
  isInSeason: boolean;
}

export interface ConstellationListing {
  referenceTime: string;
  coordinates: Coordinates;
  visible: ConstellationVisibility[];
}

export interface NightSkyBriefing {
  date: string;
  referenceTime: string;
  coordinates: Coordinates;
  sun: SunTimes;
  moon: MoonPhase;
  darkSky: DarkSkyWindow;
  visiblePlanets: PlanetPosition[];
  activeMeteorShowers: MeteorShower[];
  upcomingMeteorShowers: MeteorShower[];
  visibleConstellations: ConstellationVisibility[];
  highlight: string;
}

export interface PhenologyEntry {
  species: string;
  phenophase: string;
  /** Days since meanLastYesDate (or 0 if currently in the active window). */
  daysSinceLastYes?: number;
  distanceKm?: number;
}

export interface StreamflowReading {
  siteId: string;
  siteName: string;
  flowCfs?: number;
  gageHeightFt?: number;
  observedAt?: string;
}

export interface FungiObservation {
  /** Mushroom Observer observation id. */
  id: number;
  /** Vote-weighted consensus name (genus or species, e.g. "Cantharellus formosus"). */
  consensusName: string;
  /** Vote-weighted ID confidence in [-3..3]. May be absent for very new records. */
  confidence?: number;
  date?: string;
  locationName?: string;
  /** Distance from the briefing's coords in km. Absent when source query was
   *  region-based (no centroid to measure against). */
  distanceKm?: number;
  hasImages: boolean;
  url: string;
}

// ---------------------------------------------------------------------------
// Garden — USDA hardiness zone, frost dates, planting plan.
//
// Zone data: PRISM 2023 USDA Plant Hardiness Zone Map (zip-centroid lookup).
// Crop calendar: hand-curated list in @pondlog/core/data, sourced from USDA
// Cooperative Extension publications. Trefle (when configured) augments with
// taxonomy/sun/pH detail but is not required.
// ---------------------------------------------------------------------------

export interface ZoneInfo {
  /** USDA hardiness zone, e.g. "5a", "8b". 26 zones from "1a" to "13b". */
  zone: string;
  /** Numeric zone (1..13). */
  zoneNumber: number;
  /** "a" = colder half (-5°F), "b" = warmer half (+5°F). */
  subzone: "a" | "b";
  /** Average annual minimum winter temperature low end of band, °F. */
  minTempF: number;
  /** Average annual minimum winter temperature high end of band, °F. */
  maxTempF: number;
  /** Source of the zone determination. */
  source: "prism-2023";
  /** How the zone was found from the input. */
  resolvedFrom: "coords-nearest" | "zip-exact";
  /** Distance from query coords to nearest known ZIP centroid (km). Set
   *  only when resolvedFrom = "coords-nearest". */
  distanceKm?: number;
  /** The ZIP code used for the lookup (input ZIP for "zip-exact", nearest
   *  centroid for "coords-nearest"). */
  zip: string;
}

export interface FrostDates {
  /** Zone these dates apply to (e.g. "5a"). */
  zone: string;
  /** Mean last spring frost as MM-DD (e.g. "04-25"). */
  lastSpring: string;
  /** Mean first fall frost as MM-DD (e.g. "10-05"). */
  firstFall: string;
  /** Frost-free growing season length in days. */
  seasonDays: number;
}

export type PlantSuggestionAction =
  /** Sow seed indoors and transplant out later. */
  | "start_indoors"
  /** Sow seed directly in the garden bed. */
  | "direct_sow"
  /** Move existing seedlings (yours or nursery) to the bed. */
  | "transplant"
  /** Tree/perennial — plant the dormant root or potted plant now. */
  | "plant_now";

export interface PlantSuggestion {
  slug: string;
  commonName: string;
  scientificName: string;
  category: string;
  action: PlantSuggestionAction;
  /** Window start (ISO date YYYY-MM-DD). */
  windowStart: string;
  /** Window end (ISO date YYYY-MM-DD). */
  windowEnd: string;
  daysToHarvest: { min: number; max: number };
  /** Approximate harvest start if planted on the window's first day. */
  expectedHarvestEarliest?: string;
  /** Crop calendar notes — short, gardener-facing. */
  notes?: string;
}

export interface GardenBriefing {
  zone: ZoneInfo;
  frostDates: FrostDates;
  /** Crops to plant in the briefing's date window, sorted by category then
   *  action then crop name. May be empty in deep winter / extreme zones. */
  plantNow: PlantSuggestion[];
  /** ISO date the plan was computed against (defaults to today). */
  asOf: string;
}

export interface NatureBriefing {
  coordinates: Coordinates;
  generatedAt: string;
  /** Legacy convenience block. Derived from `nightSky` when present. */
  celestial: {
    sunrise: string | null;
    sunset: string | null;
    daylightHours: number;
    moonPhase: string;
    moonIllumination: number;
  };
  /** Full night-sky briefing — preferred consumer surface. */
  nightSky?: NightSkyBriefing;
  tides?: { high: TideEvent[]; low: TideEvent[] };
  recentObservations: Observation[];
  speciesCounts: SpeciesCount[];
  streamflow?: StreamflowReading;
  phenology?: PhenologyEntry[];
  fungi?: FungiObservation[];
  garden?: GardenBriefing;
  errors: { source: string; message: string }[];
}
