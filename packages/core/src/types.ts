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
  /** Full night-sky briefing, preferred consumer surface. */
  nightSky?: NightSkyBriefing;
  tides?: { high: TideEvent[]; low: TideEvent[] };
  recentObservations: Observation[];
  speciesCounts: SpeciesCount[];
  streamflow?: StreamflowReading;
  phenology?: PhenologyEntry[];
  fungi?: FungiObservation[];
  errors: { source: string; message: string }[];
}
