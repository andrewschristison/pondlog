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

export type SourceId = "inaturalist" | "ebird" | "npn" | "usgs" | "noaa" | "suncalc";

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
}

export interface NatureBriefing {
  coordinates: Coordinates;
  generatedAt: string;
  celestial: {
    sunrise: string;
    sunset: string;
    daylightHours: number;
    moonPhase: string;
    moonIllumination: number;
  };
  tides?: { high: TideEvent[]; low: TideEvent[] };
  recentObservations: Observation[];
  speciesCounts: SpeciesCount[];
  streamflow?: { siteName: string; flowCfs: number; gageHeightFt: number };
  phenology?: { species: string; phenophase: string }[];
  errors: { source: string; message: string }[];
}
