// Night-sky types live in @pondlog/core/types so the aggregate NatureBriefing
// can reference them without a circular dependency. This file re-exports them
// for direct consumers of @pondlog/source-nightsky.
export type {
  CompassDirection,
  ConstellationListing,
  ConstellationVisibility,
  DarkSkyWindow,
  MeteorShower,
  MeteorShowerListing,
  MoonPhase,
  MoonPhaseName,
  NightSkyBriefing,
  PlanetPosition,
  PlanetPositions,
  SunTimes,
} from "@pondlog/core";
