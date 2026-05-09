# Changelog

All notable changes to this monorepo are recorded here. Each publishable
package may also keep its own CHANGELOG once it ships.

## [0.14.1] - 2026-05-08

### Added — Sticky 18.1: `growingContext` field + `includeIndoor` filter

Pre-publish polish surfaced during Sticky 18 smoke testing. The 16
microgreen/sprout entries use indoor-only year-round windows
(`-180..180` from frost dates) and were dominating the earliest-harvest
sort at `pondlog garden now`. This release adds the missing piece of
context to the schema and a default filter that pushes them out of the
way unless asked for.

#### `crop-calendar.schema.json` — schema v1, additive change

- New optional `growingContext` field on every entry, enum:
  `"outdoor" | "indoor" | "both" | "greenhouse"`.
- `outdoor` (396 entries) — standard garden crop. Default for missing
  values to keep the schema backward-compatible.
- `indoor` (16 entries) — year-round indoor production: 12 microgreens +
  4 sprouts.
- `both` (58 entries) — windowsill OR garden: most culinary herbs
  (basil, parsley, cilantro, chive, oregano, thyme, rosemary, sage, dill,
  mint, lemon balm, marjoram, savory, chervil, fennel, bay laurel,
  lemon verbena, stevia, tarragon, kaffir lime adjacent), salad-green
  lettuces and asian greens (lettuce types, arugula, mache, watercress,
  mizuna, tatsoi), and herb cultivars added in Sticky 18 (tulsi, shiso,
  Thai/lemon/cinnamon basil, oregano cultivars, sage cultivars,
  rosemary cultivars, mint cultivars, garlic chive, salad burnet,
  Mexican tarragon, lemongrass, epazote).
- `greenhouse` (30 entries) — needs season-extension or frost-free
  protection in most US zones: papaya, pineapple, guava, macadamia,
  moringa, edible & shampoo ginger, turmeric, taro, cassava, jicama,
  chayote, calamondin, kaffir lime, curry leaf, Vietnamese coriander,
  gotu kola, lemongrass-east cultivars, true African yam, arracacha,
  Cuban oregano, roselle, pigeon pea, winged bean, loquat, passionfruit,
  pineapple guava, plus auto-classified entries with `zoneRange.min ≥ 9`.

Schema version stays `"1"` — existing fixtures without `growingContext`
continue to validate. `additionalProperties: false` on the entry shape
allows the new optional field via the schema's enum addition.

#### `@pondlog/core` (`getPlantingPlan` filter)

- New `includeIndoor?: boolean` parameter, default `false`. Indoor
  entries are excluded from `plan.plantNow` unless explicitly requested,
  so the year-round microgreen/sprout windows no longer drown out
  outdoor sowing windows in the earliest-harvest sort.
- New exported type `CropGrowingContext` for downstream consumers.

#### Verification

- All 500 entries got the `growingContext` field via a slug-aware
  text-injection script (preserves existing JSON formatting).
- Zod schema parse passes; `pnpm -r typecheck` clean.
- Smoke at Port Angeles (zone 8b, 2026-05-08): default plan returns
  outdoor warm-season crops (Buckwheat, Callaloo, Vegetable Amaranth,
  Purslane, Zucchini, Amaranth, Bush Bean, Cucumber); same call with
  `includeIndoor: true` brings sprouts/microgreens back as expected.
- @pondlog/core: 0.5.0 → **0.5.1** (additive feature; sub-minor because
  the new field is opt-in and the new behavior preserves correctness for
  the headline use case).

## [0.14.0] - 2026-05-08

### Added — Sticky 18: Crop calendar 150 → 500

The hand-curated calendar in `@pondlog/core` triples in size from 150 to
500 entries. Same schema (`crop-calendar.schema.json`), same frost-anchored
window model, same Zod validation gate at module load. No code changes —
the JSON fixture grows, and every consumer (`pondlog garden now`, the
`get_planting_plan` MCP tool, the `🌱 garden` section of `pondlog today`
and `mcp-pondlog get_nature_briefing`) picks up the new entries
automatically.

#### What's new in the calendar

- **+25 vegetable cultivar groups** — cherry/paste/beefsteak/grape tomato,
  jalapeño/poblano/serrano/habanero/ghost/banana/shishito/anaheim/cayenne
  pepper, delicata/kabocha/spaghetti/hubbard/patty-pan/banana/turban squash,
  pickling/lemon/Armenian/asian cucumber.
- **+12 brassicas and asian greens** — romanesco, broccolini, broccoli
  raab, gai lan, choy sum, yu choy, komatsuna, shanghai bok choy, kalette,
  savoy/red/pointed cabbage, purple kohlrabi, purple Brussels sprouts.
- **+4 lettuce types** — romaine, butterhead, iceberg, batavian.
- **+12 specialty greens** — orach, purslane, lamb's quarters, miner's
  lettuce, agretti, shungiku, molokhia, mustard spinach, callaloo,
  vegetable amaranth, Italian dandelion, sea beet.
- **+15 microgreens & sprouts** — sunflower, pea-shoot, radish, broccoli,
  wheatgrass, kale, basil, arugula, mustard, beet, cilantro, fenugreek
  microgreens; alfalfa, mung bean, clover, lentil sprouts.
- **+10 perennial vegetables** — good king henry, sea kale, walking onion,
  Daubenton's perennial kale, Turkish rocket, perennial leek, ramp,
  oysterleaf, groundnut (Apios), nine-star broccoli.
- **+18 grains and pseudocereals** — winter & spring wheat, hulless barley,
  rye, spelt, einkorn, emmer, triticale, pearl & proso millet, grain
  sorghum, teff, flint/dent corn, popcorn, upland rice, grain amaranth.
- **+15 nut trees** — English & black walnut, hazelnut, chestnut, almond,
  pecan, shagbark hickory, pistachio, macadamia, pinyon pine, heartnut,
  butternut, monkey puzzle, ginkgo.
- **+25 tropical / subtropical crops** — sweet potato cultivars
  (Beauregard, Japanese, Okinawan), Clemson Spineless & Burgundy okra,
  roselle, luffa, bitter melon, yardlong/asparagus bean, winged bean,
  moringa, papaya, guava, pineapple guava (feijoa), passionfruit, pineapple,
  cold-hardy banana, edible ginger, turmeric, taro, cassava, jicama,
  chayote.
- **+30 fruit additions** — Asian & European pear, apple, crabapple, peach,
  nectarine, apricot, European & Japanese plum, sweet/sour/bush cherry,
  cold-hardy fig, jostaberry, lingonberry, aronia, serviceberry, medlar,
  cornelian cherry, huckleberry, salal, olallieberry, loganberry, tayberry,
  marionberry, boysenberry, wineberry, white currant, Brown Turkey fig,
  yuzu, kumquat, calamondin, loquat, large pomegranate (Wonderful), jujube,
  che fruit.
- **+25 culinary herbs** — lemongrass (2 cultivars), green & red shiso,
  epazote, angelica, Rama/Krishna/holy basil (tulsi), Thai/lemon/cinnamon
  basil, Mexican tarragon, anise, caraway, cumin, coriander seed, fennel
  seed, dill seed, fenugreek, nigella, ajowan, creeping rosemary, Arp
  rosemary, creeping & lemon thyme, Greek & Italian oregano, purple &
  pineapple sage, chocolate & apple mint, catnip, catmint, kaffir lime,
  Vietnamese coriander, curry leaf, rue, hyssop, Cuban oregano, Mexican
  marigold (huacatay), salad burnet, garlic chive, leafy celery, shampoo
  ginger.
- **+18 medicinal herbs** — valerian, St John's wort, ashwagandha,
  marshmallow, skullcap, passionflower (maypop), milk thistle, feverfew,
  mullein, broadleaf plantain, medicinal yarrow, elderflower, medicinal
  calendula & lemon balm, Echinacea purpurea (root) & angustifolia, gobo
  burdock (medicinal & culinary), nettle, raspberry leaf, wild bergamot,
  tansy, wormwood.
- **+18 flowers (edible + companion + cut)** — Johnny jump up, pansy,
  culinary lavender, edible hibiscus, rugosa rose, squash blossom, daylily,
  dianthus, bachelor's button, rose hip, edible chrysanthemum, tithonia,
  gomphrena, ageratum, signet marigold, scabiosa, tropical sage, orange
  hummingbird mint, tall verbena, black-eyed Susan, plains coreopsis,
  three milkweed species (common, swamp, butterfly), annual phlox,
  snapdragon, stock, sweet pea, larkspur, love-in-a-mist, hollyhock,
  foxglove, delphinium, lupine.
- **+15 cover crops** — field pea (cover & food), red clover, oilseed/
  tillage radish, sunn hemp, sorghum-sudangrass, cover cowpea (Iron Clay),
  yellow mustard, Japanese millet, subterranean clover, common vetch,
  lacy phacelia, lentil, berseem clover, yellow & white sweet clover,
  rapeseed, purple vetch, barley.
- **+15 dry beans + pulses** — black, pinto, kidney, navy, cranberry
  (borlotti), great northern, tepary, soybean, mung, adzuki, hyacinth,
  pigeon pea, pole lima, broad bean, scarlet runner, kabuli chickpea,
  green/red/beluga/French green lentil, yellow & green field pea.
- **+12 root vegetables** — yacon, oca, mashua, scorzonera, Chinese yam,
  true African yam, arracacha, purple salsify, purple/yellow/white carrot,
  celeriac, rooting parsley, skirret.
- **+15 onion/garlic/beet cultivar groups** — cipollini, red Tropea,
  Walla Walla onions; rocambole, music, purple stripe garlic; golden,
  Chioggia, cylindra beets; Beauregard/Japanese/Okinawan sweet potato;
  watermelon, French breakfast, Easter egg, Korean radishes.

#### Quality rules followed (per `feedback_curation_quality.md`)

- All entries pass `crop-calendar.schema.json` — the Zod parse at module
  load is the gate. Module init throws on the first validation error.
- `daysToHarvest` ranges sourced from extension service publications
  (Cornell, Penn State, OSU, WSU, UC ANR, UF/IFAS, UGA, Texas A&M, NMSU,
  Iowa State, Colorado State, NDSU, Montana State, UH CTAHR, Clemson,
  USDA NRCS). The schema caps `daysToHarvest.max` at 3650 days; a handful
  of long-establishment trees (black walnut, shagbark hickory, pinyon
  pine, monkey puzzle, ginkgo) note "15-30 years to bearing" in their
  `notes` and cap the value at the schema max.
- `minSoilTempF` is `null` for transplants, perennials, and dormant tree
  stock where the field doesn't apply.
- `zoneRange` reflects realistic cold-limits — banana 6-11 (Musa basjoo),
  papaya 9-11, pineapple 10-11, almond 7-10, etc.
- Every new entry includes a `source` field citing the extension service.
- Notes flag toxicity (foxglove, sweet pea seed, lupine seed, raw cassava,
  raw lima/kidney beans, true African yam) and regulatory restrictions
  (Ribes white-pine-rust, milk thistle in CA, wineberry invasiveness in
  eastern US, Chinese yam invasiveness in southeast US, St John's wort in
  some western states).

#### Microgreens caveat

15 microgreen/sprout entries use frost-anchored windows of -180..180 days
because production is indoor and year-round. They will dominate the
`pondlog garden now` results sorted by earliest-harvest. Filter them out
with `--category` (use a different category) or pass an outdoor-relevant
category. A future minor release may add an `outdoor-only` flag.

#### Stale text refreshed

Every "150-crop" mention across the monorepo (`@pondlog/core`,
`@pondlog/source-trefle`, `@pondlog/mcp-garden`, `@pondlog/mcp-pondlog`,
`pondlog` CLI, root README) updated to "500-crop".

#### Versions

- `@pondlog/core` 0.4.0 → **0.5.0** (data growth, no API change)
- `pondlog` CLI 0.4.1 → **0.5.0** (visible content change at
  `pondlog garden now`; help text refreshed)
- Other workspace packages that depend on `@pondlog/core` via
  `workspace:^` (mcp-garden, mcp-pondlog, source-trefle) recompile
  against 0.5.0; their next publish picks up the expanded calendar.

## [0.13.0] - 2026-05-08

### Added — Sticky 17: Garden planning (the world's first plant/garden MCP)

Pondlog gardens. The first dedicated garden-planning MCP server lands as
`@pondlog/mcp-garden`, alongside `@pondlog/source-trefle`, a `pondlog
garden` CLI command group, and a hand-curated 150-crop planting calendar
baked into `@pondlog/core`. The aggregate `pondlog today` and
`mcp-pondlog get_nature_briefing` gain a 🌱 garden section.

#### Why it matters

Every other pondlog source observes nature. The garden surface
*plans* it. We're shipping ahead of any competing plant/garden MCP — at
publish time the niche is empty.

#### Research-driven plan adjustments

The original sticky's spec was rebuilt against the live Trefle API before
any code:

- **Trefle's `growth.minimum_temperature` is NOT USDA hardiness.**
  It's the growing-season minimum (e.g. 15°C/59°F for tomato — the cold
  threshold for *fruit set*, not winter survival). The proposed
  hardiness-zone filter through Trefle was unbuildable.
- **Trefle horticulture data is universally null for cultivated
  vegetables.** Live-probed tomato, lettuce, pepper, squash, carrot,
  bean, etc — all return `null` for `days_to_harvest`, `sowing`,
  `growth_months`, `duration`. Trefle's `filter[duration]=annual`
  returns 0 plants. Trefle is bibliographic, not horticultural.
- **Solution:** Trefle becomes the *taxonomy* layer (search, common ↔
  scientific name, sun, pH, image). The 150-crop calendar baked into
  core handles all planting-window logic — frost-anchored windows
  curated from USDA Cooperative Extension publications.
- **Trefle's `distributions/zones` is WGSRPD, not USDA.** Different
  classification entirely (continental biogeography). Skipped.

#### `@pondlog/core` (new helpers + data)

- `usda-zones.ts` — `getHardinessZone(coords)` and
  `getHardinessZoneByZip(zip)` resolve to USDA zone via the bundled
  PRISM 2023 dataset (40,283 ZIP centroids, ~1.8 MB JSON). Coordinate
  lookup uses a 1° lat/lng grid index for sub-millisecond response.
- `getFrostDates(zone)` — typical continental-US frost-date table
  keyed by zone; returns `lastSpring` / `firstFall` (MM-DD) and
  `seasonDays`.
- `crop-calendar.ts` — `findCrop`, `searchCrops`, `listCrops`,
  `getCropsForZone`, `getPlantingPlan`. The plan helper cross-
  references the calendar with the zone's frost dates and a target
  date, returning crops whose start/sow/transplant window is open.
- `data/crop-calendar.json` — 150 hand-curated entries across
  vegetables (53), herbs (28), fruits (23), flowers (14), legumes
  (11), roots (11), cover-crops (10). Each entry has multiple frost-
  anchored windows (`start_indoors`, `direct_sow`, `transplant`,
  `plant_now`) so spring + fall + perennial actions all live in one
  record. JSON Schema lives next to it for community PR validation.
- New types: `ZoneInfo`, `FrostDates`, `PlantSuggestion`,
  `GardenBriefing`. `SourceId` extends to include `"trefle"`,
  `"crop-calendar"`, `"usda-zones"`. `NatureBriefing.garden` (optional)
  is the briefing-level field.

#### `@pondlog/source-trefle` (new package)

- 4 functions: `searchPlants`, `getPlant`, `searchSpecies`,
  `getGrowingGuide`. All return `Result<T>`, never throw.
- Rate limiter: 100 req/min (Trefle posts 120/min) with burst of 5.
- Retries on 429 *and* transient 5xx — Trefle's beta status produces
  occasional 500s on the search endpoint per its public issue
  tracker.
- `TREFLE_API_TOKEN` required; `hasTrefleToken()` exported so the
  aggregate can silently degrade when no token is set.
- Schemas tolerate extensive `null` because Trefle's data is sparse;
  the `GrowingGuide` flat type only surfaces fields that are
  populated.

#### `pondlog garden` CLI (new)

Four subcommands:

- `pondlog garden zone [--lat] [--lng] [--zip]` — show USDA zone +
  frost dates.
- `pondlog garden now [--lat] [--lng] [--zone] [--date] [--category]`
  — what to plant in window today (or `--date` for any date). Output
  groups by action (start indoors → direct sow → transplant → plant
  now), shows window range, and computes `expectedHarvestEarliest`
  from `daysToHarvest.min`.
- `pondlog garden plant <name>` — calendar entry + Trefle botanical
  detail (when token set) for a single crop.
- `pondlog garden search <query> [--zone] [--category]` — searches
  calendar and Trefle in parallel; calendar matches first (precise),
  Trefle next (broad).

All commands support `--json`. CLI version → 0.4.0.

#### `@pondlog/mcp-garden` (new package, replaces planned mcp-trefle)

The package is named `mcp-garden`, not `mcp-trefle`, because it's not
a Trefle proxy — it's a garden-planning surface that uses Trefle as
one data source.

Five tools, each with full glossary descriptions per the
`mcp-server` skill:

- `get_hardiness_zone` — USDA zone + frost dates for lat/lng or ZIP.
  Pure offline.
- `get_planting_plan` — calendar-driven planting plan for a zone +
  date. Pure offline.
- `get_crop_details` — calendar entry + Trefle botanical detail.
- `search_plants` — calendar + Trefle parallel search.
- `get_crops_for_zone` — all calendar entries suited to a zone.

`TREFLE_API_TOKEN` is optional; the four calendar/zone tools always
work, the two Trefle-blended tools fall back to calendar-only.

JSON-RPC handshake verified pre-commit; bad-input rejection
confirmed for `get_hardiness_zone(lat=999)`.

#### Aggregate changes

- `cli/aggregate.ts` and `mcp-pondlog/briefing.ts` both compute the
  garden section as pure local work (no rate-limited fetch). When
  coordinates fall outside US/AK/HI/PR coverage, an entry is added
  to `errors[]` and the briefing continues without garden.
- `pondlog today` renders a 🌱 garden block beneath fungi, showing
  zone, frost dates, and the top 5 in-window suggestions.
- `mcp-pondlog` bumps to 0.3.0.

#### Calendar provenance

USDA Cooperative Extension publications, Washington State University
Extension, Cornell Cooperative Extension, and The Old Farmer's
Almanac. Conservative ranges so a coastal/mountain/desert
microclimate user sees usable suggestions. JSON Schema published
alongside the data file so the community can PR new entries to a
common standard.

#### Files

- New: `packages/core/src/usda-zones.ts`,
  `packages/core/src/crop-calendar.ts`,
  `packages/core/src/data/usda-zones.json` (1.8 MB),
  `packages/core/src/data/crop-calendar.json` (150 entries),
  `packages/core/src/data/crop-calendar.schema.json`.
- New: `packages/source-trefle/` (full package).
- New: `packages/mcp-garden/` (full package incl. server.json and
  README).
- New: `packages/cli/src/commands/garden.ts`,
  `packages/cli/src/format-garden.ts`.
- Modified: `packages/core/src/types.ts` (new types + `SourceId`
  extension), `packages/core/src/index.ts` (re-exports).
- Modified: `packages/cli/src/aggregate.ts`,
  `packages/cli/src/index.ts`, `packages/cli/src/commands/today.ts`.
- Modified: `packages/cli/package.json` → 0.4.0.
- Modified: `packages/mcp-pondlog/src/briefing.ts`,
  `packages/mcp-pondlog/src/server.ts`,
  `packages/mcp-pondlog/server.json`,
  `packages/mcp-pondlog/package.json` → 0.3.0.

## [0.12.0] - 2026-05-07

### Added — Sticky 16: Mushroom Observer (the world's first mycology MCP)

Pondlog grows fungi. `@pondlog/source-mushroomobserver`, `pondlog mushroom`
CLI, and `@pondlog/mcp-mushroomobserver` ship in one pass — the first
dedicated mycology MCP on any registry, fronted by Mushroom Observer's
500,000+ fungal observations with vote-weighted ID confidence. The
aggregate `pondlog today` and `mcp-pondlog get_nature_briefing` gain a
🍄 fungi section as their seventh source.

#### Why it matters

Every other source pondlog covers (iNat, eBird, NPN, USGS) is a
generalist platform. Mushroom Observer is mycology-first: its taxonomy,
voting model, and geography are designed around fungi. The MCP space
had zero dedicated mycology servers before this commit.

#### Research-driven plan adjustments

The sticky's spec was refined against the live API before any code:

- **Locations endpoint has no name filter.** MO's `/locations`
  parameters are bbox + ID only — no `pattern=` or `name=`. The
  proposed `searchLocations(query)` was unbuildable as written.
  Replaced with `searchRegions(query)` which scans observations with
  the suffix and harvests unique location-name strings.
- **Spatial queries DO work via observations bbox.** Contrary to the
  sticky's claim that MO uses named locations only, the
  `/observations` endpoint accepts `north/south/east/west` lat/lng.
  Pondlog stays consistent with eBird/iNat/NPN/USGS by using
  coords+radius (converted to bbox internally) as the primary spatial
  interface, with `region:` suffix as a secondary string filter.
- **Default response is XML.** MO defaults to XML on every endpoint.
  The client appends `.json` to every path automatically.
- **Detail levels.** `detail=low` is flat IDs (~1KB/record);
  `detail=high` nests location/consensus/owner/images (~3-4KB/record).
  The client defaults to `low` for list calls and `high` only for
  single-record `getObservation`.

#### `@pondlog/source-mushroomobserver` (new package)

- 7 functions: `searchObservations`, `getObservation`, `searchNames`,
  `searchRegions`, `getRecentNearLocation`, `getSpeciesCountByLocation`,
  `getLocationsInBbox`. All return `Result<T>`, never throw.
- Required-narrowing guard on `searchObservations`: at least one of
  coords+radius / region / name / date must be supplied. Unbounded
  queries can return tens of MB.
- Rate limiter: 20 req/min (1 every 3s) with burst of 3, matching MO's
  posted limit. `withRetry` on 429 with 3s backoff.
- HTML-stripped notes via cheap regex + entity decoder (no parser dep).
- `bboxAround(coords, radiusKm)` helper local to the package
  (mirroring `source-usgs`); rounds to 6 decimal places.
- Local fixtures + 8 unit tests + 8 live smoke tests at Port Angeles
  (`searchObservations`, `searchNames`, `searchRegions`,
  `getObservation`, `getRecentNearLocation`,
  `getSpeciesCountByLocation` all verified against the real API).

#### `pondlog mushroom` (CLI subcommand group)

- `pondlog mushroom recent [--lat --lng | --region] [--radius] [--days]
  [--limit] [--has-images] [--min-confidence] [--json]` — the headline
  command, falls back to saved location or `mushroomObserverRegion`
  config setting when no flags are passed.
- `pondlog mushroom search <name> [--rank Genus|Species|...] [--json]` —
  fungal taxonomy substring search.
- `pondlog mushroom observation <id> [--json]` — full record detail
  with location centroid, observer, image URL, and HTML-stripped notes.
- `pondlog mushroom regions <query> [--pages N] [--json]` — discover
  MO location-name suffixes by harvesting observations for the suffix.
- `pondlog config set-mushroom-region <name>` — saves the region
  suffix to `~/.pondlog/config.json` for use by both `mushroom` and
  the aggregate.
- New `format-mushroom.ts` (column-aligned picocolors output, --json
  on every subcommand).

#### `@pondlog/mcp-mushroomobserver` (new package, 5 tools)

- `get_recent_fungi` — the headline tool. Coords+radius OR region.
  Pages through MO internally to fill the requested limit.
- `search_observations` — full filter set: bbox, region, taxon name,
  date range, has_images, confidence threshold.
- `get_observation` — single record, high-detail.
- `search_fungal_names` — `text_name_has` substring search with rank
  filter (Class | Domain | Family | Form | Genus | Species | … — MO's
  full set is exposed).
- `search_regions` — discovers location-name suffixes; documents in
  the description that MO's `/locations` has no name filter.
- All tools `readOnlyHint: true, openWorldHint: true`. Descriptions
  emphasize mycology expertise and 500,000+ observations. Cross-
  references siblings per `mcp-server` SKILL §5.
- `server.json` for MCP Registry, README with Claude Desktop + Cursor
  configs.
- JSON-RPC handshake live-verified: 5 tools listed, golden-path
  `get_recent_fungi` returns 5 obs near Port Angeles, bad-input
  rejected, `search_fungal_names("Cantharellus", rank=Species)`
  returns 182 names.

#### Aggregate wiring

- New `FungiObservation` type in `@pondlog/core`; `NatureBriefing`
  gains optional `fungi?: FungiObservation[]`. `SourceId` adds
  `"mushroomobserver"`.
- `packages/cli/src/aggregate.ts` and `packages/mcp-pondlog/src/
  briefing.ts` both fan out to MO via `Promise.allSettled`. Failure
  pushes onto `errors[]` without crashing.
- `pondlog today` renders a 🍄 Fungi block (top 4 by date+confidence,
  picocolors output, `(cached)` tag honored).
- CLI cache TTL inherits the default 1h.
- `mcp-pondlog` v0.2.0: `get_nature_briefing` description updated
  ("seven data sources"), gains `mushroom_observer_region` optional
  input (also reads `MUSHROOM_OBSERVER_REGION` env var).

#### Versions

- `@pondlog/core`: 0.2.0 → 0.3.0 (new `FungiObservation`,
  `NatureBriefing.fungi`, `SourceId` extension — additive).
- `pondlog` (CLI): 0.2.0 → 0.3.0.
- `@pondlog/mcp-pondlog`: 0.1.0 → 0.2.0.
- New: `@pondlog/source-mushroomobserver` 0.1.0,
  `@pondlog/mcp-mushroomobserver` 0.1.0.

## [0.11.0] - 2026-05-07

### Added — Sticky 15: `@pondlog/mcp-pondlog` aggregate MCP server

The aggregate MCP server ships. **One MCP tool call replaces six API
integrations.** This is the product — the unified "what's happening at
these coordinates" briefing exposed as a stdio MCP server, NPX-runnable,
no install step.

#### `@pondlog/mcp-pondlog` (new package, 5 tools)

- `get_nature_briefing` — the headline tool. Inputs: `lat`, `lng`, plus
  optional `date`, `noaa_station`, `usgs_site`, `ebird_api_key`.
  Returns a full `NatureBriefing` (defined in `@pondlog/core`) — recent
  iNaturalist + eBird observations sorted by date, NOAA tides
  high/low for the day, USGS instantaneous discharge + gage height,
  USA-NPN site-level phenology, and a complete night-sky briefing
  (sun, moon, dark-sky window, planets, meteor showers, constellations).
  All six sources fanned out via `Promise.allSettled`; partial failures
  populate `errors[]` without crashing the briefing.
- `get_nearby_wildlife` — focused tool. iNaturalist + eBird merged,
  chronologically sorted. For when the caller wants wildlife only.
- `get_water_conditions` — focused tool. USGS streamflow + NOAA tides,
  both keys always present (`null` when not configured) so consumers
  don't branch on shape.
- `get_tonight_sky` — focused tool. Pure local computation via
  `astronomy-engine`. No API key, no network, never rate-limited.
  `openWorldHint: false` (the only one) since the answer is
  deterministic for given coords + date.
- `get_phenology` — focused tool. USA-NPN site-level phenometric data
  for plants near the location. No API key.
- All tools `readOnlyHint: true`. All input fields use shared Zod
  fragments with full `.describe()` glossaries (lat/lng/date/radius/
  days/years_back/noaa_station/usgs_site/ebird_api_key).
- `briefing.ts` adapts the `buildTodayBriefing` logic from
  `packages/cli/src/aggregate.ts` without the disk-cache or
  `PondlogConfig` layer — the MCP server runs cacheless and accepts
  station/site/key directly. (Reusing the CLI's exported builder would
  pull `commander` and disk-cache into every MCP install.)
- `withEbirdApiKey()` helper temporarily sets `process.env.EBIRD_API_KEY`
  around a call so the `ebird_api_key` tool input can override the env
  var. Restored in `finally`. Documented caveat: stdio MCP servers
  process JSON-RPC sequentially so this is safe in practice, but
  shared deployments should prefer the env-var path.

#### Configuration

- All env vars optional. `EBIRD_API_KEY` enables eBird, `NOAA_STATION`
  enables tides, `USGS_SITE` enables streamflow. Without them, the
  briefing still returns — affected sections are omitted (or report
  the missing-key error in `errors[]` for eBird specifically). iNat,
  night-sky, and NPN phenology always work without any keys.
- `server.json` declares all three env vars per MCP Registry schema
  with `is_required: false` since none are mandatory.
- README documents Claude Desktop, Cursor, and MCP Inspector configs
  with realistic Port Angeles values (`9444090` / `12045500`) baked in.

#### Verified

- MCP JSON-RPC handshake clean: `initialize` returns expected
  `serverInfo`, `tools/list` returns 5 tools, golden-path
  `get_tonight_sky` at Port Angeles returns Waning Gibbous +
  highlight string + visible constellations, golden-path
  `get_nature_briefing` returns 217 observations + nightSky +
  phenology in one call.
- Bad input rejection: `lat: 999` → SDK Zod returns `isError: true`
  before the handler runs.
- Graceful degrade verified: with `EBIRD_API_KEY` unset, briefing
  still returns ok, iNat populates 50 observations, eBird's
  missing-key error surfaces in `errors[]`, no crash.
- `pnpm typecheck` clean across all 12 typechecked packages;
  `pnpm build` clean across all packages (mcp-pondlog ships at
  20.2 KB ESM).

## [0.10.0] - 2026-05-07

### Added — Sticky 14: `pondlog today` aggregate command

The unified "what's happening at these coordinates" briefing ships. One
command, six sources fanned out in parallel, partial-failure tolerant,
file-cached. This closes the loop on the original pondlog charter.

#### `@pondlog/core`

- `getTidePredictions({stationId, date?})` — thin NOAA CO-OPS client.
  No API key. Token-bucket rate limiter at 5 req/sec (NOAA's documented
  limit). Zod-validated response. Surfaces NOAA's HTTP-200-with-error
  envelope as `Result.err` rather than letting it propagate as a
  malformed success. `splitHighLow()` companion for partitioning by
  type.
- `TideEvent` now carries a `type: "high" | "low"` discriminator.
- Night-sky public types relocated from `@pondlog/source-nightsky` to
  `@pondlog/core` so the aggregate `NatureBriefing` can typed-reference
  `NightSkyBriefing` without a circular dep. `source-nightsky` re-exports
  these for direct consumers — no breaking change to existing imports.
- `NatureBriefing` extended: optional `nightSky?: NightSkyBriefing` field
  alongside the legacy `celestial` block (which is now derived from
  night-sky data when present). New `PhenologyEntry` and
  `StreamflowReading` shared types.

#### `pondlog` CLI

- `pondlog today [--lat] [--lng] [--date] [--json] [--no-cache]` —
  composes iNat + eBird + NPN + USGS + Night Sky + NOAA in parallel via
  `Promise.allSettled`. Failed sources collect into `errors[]` with an
  inline ⚠ warning block; the rest of the briefing renders normally.
  Picocolors output, emoji bullets, `--json` returns the full
  `NatureBriefing` plus a `cacheHits` map.
- File cache at `~/.pondlog/cache/<source>/<sha256>.json` with per-source
  TTLs from METHODOLOGY.md (tides 1h, observations 15m, USGS 15m, NPN 1h).
  Honors `PONDLOG_CONFIG_DIR` for sandboxing in tests. `--no-cache`
  bypasses both read and write. Atomic writes via temp-then-rename.
- Config schema extended with `noaaStation`, `usgsSite`, `ebirdRegion`
  fields. Three new subcommands: `pondlog config set-station <id>`,
  `set-usgs-site <id>`, `set-ebird-region <code>`. `pondlog config show`
  surfaces all three. Each setter validates format at the boundary
  (NOAA: 6–8 digits; USGS: 8–15 digits; eBird: `[A-Z0-9-]{2,12}`).
- 12 new unit tests (cache: stable hashing, TTL expiry, bypass, no-cache
  on failure; aggregate: partial-failure routing, legacy `celestial`
  derivation, NOAA + USGS round-trip with mocked clients). Plus 6 unit
  tests in core/noaa for input validation and response handling.
- Live-verified at Port Angeles: cold run ~2.5s, warm run ~0.13s
  (~20× cache speedup); partial-failure path tested by unsetting
  `EBIRD_API_KEY` (briefing renders, eBird absence reported as warning,
  exit 0); JSON shape inspected with `jq`/`python3` and matches the
  documented `NatureBriefing` type.

## [0.9.0] - 2026-05-07

### Added — Sticky 13: Night Sky source client + CLI

A fifth source ships, but with a different shape: pure local
computation. No API, no rate limit, no key. Replaces the original
"SunCalc + NOAA in core" plan with a full standalone source built on
`astronomy-engine` (a strict superset of SunCalc that adds planets,
constellations, magnitudes, and ±1 arcminute accuracy).

**Deliberate scope decision:** no `@pondlog/mcp-nightsky` standalone
package. The astronomy MCP space already has 5+ servers
(CelestialMCP, Astro MCP, ephemeris.fyi, NASA APIs MCP, Astronomy
Event Tracker) — shipping a sixth doesn't differentiate. The
night-sky data will surface through `mcp-pondlog` (Sticky 15) as
part of the aggregate "what's happening at these coordinates"
briefing. The source client + CLI ship because both are useful in
their own right.

#### `@pondlog/source-nightsky` (new package)

- 7 functions, all returning `Result<T>`, all pure synchronous
  computation. No network, no rate limiter.
- `getTonightsBriefing({ coords, date? })` — top-level composer.
  Returns sun times, moon phase, dark-sky window, visible planets,
  active + upcoming meteor showers, top constellations, and a
  one-line human-readable `highlight`.
- `getSunTimes` — sunrise/sunset/solar noon plus civil/nautical/
  astronomical dawn & dusk plus golden hour. Uses
  `astronomy-engine`'s `SearchAltitude` for arbitrary-altitude
  twilight thresholds; null at high latitudes when never crossed.
- `getMoonPhase` — phase name, emoji, illumination %, age in days,
  rise/set. Location optional (phase is location-independent).
- `getPlanetPositions` — Mercury through Neptune with magnitude,
  altitude/azimuth, compass direction, rise/set, and `isVisible`
  flag. Visibility filter: sun ≤ -6° AND altitude > 5° AND mag ≤ 6.
- `getActiveMeteorShowers` — handles year-wrapping windows
  (Quadrantids 12-28 → 01-12), surfaces both currently-active
  showers and upcoming peaks within 14 days, includes moon
  interference rating for each.
- `getDarkSkyWindow` — astronomical dark window plus 1–5 quality
  score weighted by `moonAltitude × moonIlluminationFraction`.
  5 = astronomical dark + moon below horizon or new; 1 = full moon
  overhead. Caps at 3 when astronomical dark never happens.
- `getVisibleConstellations` — 25 curated constellations, filtered
  to those currently above 15°, ranked in-season first then by
  altitude.
- Curated fixtures bundled into the JS:
  - `src/data/meteor-showers.json` — 12 IMO-recognized annual
    showers (Quadrantids, Lyrids, Eta Aquariids, Perseids, Draconids,
    Orionids, Taurids north & south, Leonids, Geminids, Ursids,
    Southern Delta Aquariids).
  - `src/data/constellations.json` — 25 high-recognition
    constellations with hemisphere, best months, notable named stars,
    one-line descriptions.
- 28 unit tests cover compass mapping, phase naming, dark-sky scoring
  rules (5 boundary cases), moon-interference thresholds, meteor
  shower window detection (mid-window + year-wrap + outside-window +
  upcoming), planet visibility filtering (daytime), arctic dark-sky
  edge case (polar day → no dark, score ≤ 3), constellation
  filtering + in-season ranking, plus boundary checks (out-of-range
  lat, NaN coords, unparseable dates).
- 2 deterministic smoke tests verify `getTonightsBriefing` at Port
  Angeles on Aug 12 2026 (Perseids peak — should and does surface)
  and at 70°N on June 21 (no astronomical dark; quality ≤ 3;
  circumpolar constellations correctly above 15°).

#### `pondlog nightsky …` CLI subcommand group

- `pondlog nightsky [briefing] [--lat] [--lng] [--date] [--json]` —
  default subcommand, full curated briefing.
- `pondlog nightsky planets [--lat] [--lng] [--date] [--json]` —
  planet positions with `isVisible` partition.
- `pondlog nightsky moon [--lat] [--lng] [--date] [--json]` — phase
  + emoji + illumination + age + rise/set; coords optional.
- `pondlog nightsky sun [--lat] [--lng] [--date] [--json]` — sun
  times grid with civil/nautical/astronomical twilight.
- `pondlog nightsky meteors [--date] [--json]` — active and upcoming
  showers.
- `sky` alias on the top-level group (`pondlog sky` works).
- Picocolors output: emoji moon (🌒), 16-point compass on every
  body, `★★★★☆` quality bars on dark-sky line, peak-proximity
  language ("peaks tonight", "peaked 13d ago"). `--json` on every
  command. Saved-location fallback works on every nightsky
  subcommand.

### Why astronomy-engine over SunCalc

`astronomy-engine` (^2.1.19) is a strict superset of `suncalc`. It
adds planet ephemerides + magnitudes, constellation lookup,
configurable refraction, and ±1 arcminute accuracy across all bodies
in ~30 KB bundled, pure JS, zero native deps. No remaining reason to
add SunCalc separately.

### NOAA cloud cover — deferred

Original Sticky 13 mentioned "SunCalc + NOAA in core." NOAA cloud
cover is a *network* call with rate limits — fundamentally different
from astronomy-engine's pure computation. It belongs in the
aggregate `pondlog today` (Sticky 14) where it can be parallel-
fetched alongside the iNat / eBird / NPN / USGS clients, not bolted
onto a pure-math source.

## [0.8.0] - 2026-05-07

### Added — Stickies 11 & 12: USGS source client + CLI + MCP (one ship)

USGS Water Services is the smallest API in the stack — keyless, two
data endpoints (`/iv`, `/dv`) plus a site service. All three
deliverables ship together. Live-probed before writing schemas; the
audit doc was correct on shape but missed two practical gotchas
captured below.

#### `@pondlog/source-usgs` (new package)

- 4 source functions, all returning `Result<T>`, Zod-validated,
  polite-rate-limited (1 req/sec sustained, bursts to 5).
- `getInstantaneousValues({ sites, parameterCodes?, period? })` —
  real-time gauge readings (typically 15-min cadence). Defaults to
  discharge (00060) + gage height (00065) over the last 2 hours.
- `getDailyValues({ sites, parameterCodes?, period?, startDt?, endDt?,
  statisticCodes? })` — daily statistics. Use `period` for
  relative-to-now or `startDt`/`endDt` for historic windows. The two
  modes are mutually exclusive at the source boundary.
- `getSiteInfo({ siteNumber })` — single-site metadata via the RDB-only
  `/site/` endpoint. Client parses the tab-delimited RDB format
  internally and returns a normalized record (name, coords, HUC, state,
  county, altitude).
- `searchSites({ bbox?, stateCode?, hucCode?, siteType?,
  hasDataTypeCode? })` — find active stream gauges. Defaults
  `siteType=ST` (streams) and `hasDataTypeCd=iv` (real-time enabled).
- `bboxAround(coords, radiusKm)` helper builds a square bbox tuple
  ready for `searchSites({ bbox })`. Coordinates are rounded to 7
  decimals because USGS rejects `bBox` arguments with more precision
  than that (HTTP 400 with a "requires a decimal number with at most
  7 digits to the right of the decimal point" message).
- `PARAMETER_CODES` constant exports the three most-asked codes
  (`DISCHARGE`, `GAGE_HEIGHT`, `WATER_TEMP_C`).
- WaterML JSON envelope handled: each request returns one timeSeries
  per (site × parameter × statistic). Normalizer collapses them by
  site so consumers get one reading-per-site with multiple series.
- HTML-entity decode in variable names (`&#179;` → `³`) so terminal
  output is readable.
- `-999999.0` is the noDataValue sentinel — `denull()` translates to
  `undefined` so consumers never see the magic number. Per-value
  parser also catches stray `-999999` payloads in the wire string.
- `.passthrough()` on every Zod object — schemas accept what USGS
  sends even when shapes drift.

#### `pondlog usgs …` CLI subcommands

- `pondlog usgs flow --site <number> [--period] [--json]` — current
  real-time discharge + gage height. Picocolors output with parameter
  code, description, value, unit, and timestamp.
- `pondlog usgs daily --site <number> [--period | --start-date
  --end-date] [--json]` — daily statistics, current or historic. CLI
  enforces the period/range mutual exclusion before any network call.
- `pondlog usgs sites [--lat] [--lng] [--radius] [--state] [--json]` —
  find gauges. `--state` and `--lat/--lng` are mutually exclusive.
  Falls back to saved location when `--lat/--lng` are absent.
- Validation at the CLI boundary: site number regex, ISO-8601 period
  regex, radius clamp, state-code regex — all fail loud with
  descriptive errors before touching the network.
- Help text on every command with worked examples and a note that
  `/iv/` rejects historic dates so you must use `daily` for past data.

#### `@pondlog/mcp-usgs` (new package, 4 MCP tools)

- Tools: `get_instantaneous_values`, `get_daily_values`,
  `get_site_info`, `search_sites`. Stdio transport, NPX-ready
  (`pondlog-mcp-usgs` bin with shebang).
- All tools `readOnlyHint: true, openWorldHint: true`. No env vars
  required (USGS is keyless).
- LLM-targeted descriptions inline the USGS parameter-code glossary
  (`00060` = discharge, `00065` = gage height, `00010` = water temp,
  `00400` = pH, `00095` = specific conductance) and statistic codes
  (`00003` = mean, `00001` = max, `00002` = min, `00008` = median).
- Cross-references between siblings: `get_instantaneous_values`'s
  description tells the LLM to use `get_daily_values` for historic
  ranges; `search_sites` tells it to feed results into the value
  endpoints; `get_site_info` is positioned as a follow-up step after
  search.
- Per-field Zod `.describe()` strings on every input
  (`siteNumberField`, `periodField`, `parameterCodeField`, etc.,
  shared via `schemas.ts`).
- README with Claude Desktop + Cursor config blocks (no env block —
  no key needed), 4-tool table, parameter-code reference, example
  prompts.
- `server.json` for MCP Registry submission.

### Verified

- `pnpm typecheck` + `pnpm build` clean across all 10 workspace
  packages.
- `@pondlog/source-usgs` unit tests: 16 passing (Zod schemas + boundary
  validation + RDB parsing + denull + groupBySite + bboxAround).
- `@pondlog/source-usgs` live smoke: 8/8 passing against the real USGS
  API. `getInstantaneousValues({Elwha 12045500, PT2H})` returned 2
  series (00060=1310 ft³/s, 00065=10.6 ft); `Dungeness 12048000` IV
  returned 418 ft³/s; unknown site `99999999` correctly returned
  `ok: true` with `data: []`; `getDailyValues({Elwha, P7D})` returned
  7 daily means with statistic="Mean"; `getDailyValues({Elwha,
  startDt: 2024-01-01, endDt: 2024-01-05})` returned 5 historic means
  with quality `[A]`; `getSiteInfo({Elwha})` returned correct lat/lng
  and full station name; `searchSites({bbox: PA 25 km})` returned
  8 stream gauges including both Elwha and Dungeness; `searchSites
  ({stateCode: 'WA'})` returned 557 stream gauges.
- CLI manual smoke: `usgs flow --site 12045500` shows live readings
  with timestamps; `usgs daily --site 12045500 --period P10D` renders
  a 10-row table; `usgs daily --site 12045500 --start-date 2024-01-01
  --end-date 2024-01-05` shows historic data with `[A]` qualifiers;
  `usgs sites --lat 48.118 --lng -123.4307 --radius 25` returns
  8 sites; `--json` on every command returns the full structured
  result; bad inputs (`--site abc`, period+date combo,
  `--state WA --lat 48`) all rejected at the CLI boundary with
  descriptive errors.
- MCP JSON-RPC handshake (per `mcp-server` SKILL.md §6) — all 4
  required checks: `initialize` returns `pondlog-mcp-usgs` v0.1.0;
  `tools/list` returns all 4 tools; live `get_instantaneous_values
  ({sites: ['12045500'], period: 'PT1H'})` returns last reading
  1310 ft³/s; live `get_daily_values({sites: ['12045500'], period:
  'P5D'})` returns 5 values; live `search_sites({lat: 48.118, lng:
  -123.4307, radius_km: 25})` returns 8 sites; bad-input
  `get_instantaneous_values({sites: ['abc']})` rejected by SDK Zod
  (`isError: true`). Verification script deleted before commit per
  SKILL.md.

### Gotchas discovered live (worth carrying into mcp-pondlog)

- **`/iv/` rejects historic `startDT`/`endDT`** with HTTP 301 — only
  `period` (relative-to-now) is accepted. For past data the caller
  must use `/dv/` (daily values), which DOES accept date ranges. The
  source client guards both modes correctly; the CLI wires
  mutually-exclusive flags so the user can't trip it.
- **`/site/` returns RDB only.** `format=json` returns an HTML 400
  error page. The client uses an internal RDB parser and returns
  normalized objects regardless of which endpoint was hit.
- **`bBox` argument validation rejects > 7 decimal places.** Naive
  floating-point math (e.g. `48.05 - 25/111.32`) produces 14+ decimals
  and HTTP 400. `bboxAround` rounds to 7 places before constructing
  the tuple.
- **Unknown site numbers don't error.** USGS returns HTTP 200 with
  `timeSeries: []`. Source client surfaces this as `ok: true` with an
  empty array — handled gracefully in the CLI ("No data for site X").
- **Each parameter is a separate timeSeries.** Asking for both 00060
  and 00065 at one site yields 2 timeSeries with the same sourceInfo
  and 1 group of values each. Normalizer collapses these into one
  reading-per-site with N series.

### Notes for future stickies (mcp-pondlog aggregate)

- USGS is the cheapest source in the stack. Real-time discharge belongs
  in any "what's happening at this place right now?" briefing — it's
  context-rich (one number tells you flood / drought / spring melt),
  cheap to fetch, and updates every 15 minutes.
- The RDB parser is generic enough to be promoted to `@pondlog/core`
  if any other USGS subendpoint needs it later. Right now it lives in
  `source-usgs/normalize.ts`.

---

## [0.7.0] - 2026-05-07

### Added — Stickies 9 & 10: NPN source client + CLI + MCP (one ship)

NPN is a small, sparsely documented API; the audit doc had two
pre-existing errors (wrong host + missing WKT spatial model). All three
deliverables shipped together since the surface is small and
co-evolved. NPN's data model required real research to get right —
notes captured below for future reference.

#### `@pondlog/source-npn` (new package)

- 7 source functions + 1 composed helper, all returning `Result<T>`,
  Zod-validated, polite-rate-limited (1 req/sec sustained, bursts to
  5). Real base URL is `https://services.usanpn.org/npn_portal/`
  (audit doc said `data.usanpn.org` — it's wrong).
- Functions: `getSpecies`, `getStations({stateCode?})`,
  `getStationCountByState`, `getStationsWithSpecies`,
  `getStationsByLocation` (WKT polygon), `getObservations`,
  `getSiteLevelData`. Plus the composed `getActivePhenologyNearby` —
  builds a WKT bbox from coords+radius, pulls stations, haversine-
  filters, and returns site-level phenometric rows sorted by
  most-recent activity.
- WKT helpers: `bboxWkt(coords, radiusKm)` builds a closed flat-earth
  polygon (good to a few percent under ~100 km outside the poles);
  `haversineKm(a, b)` for true-radius post-filter.
- `-9999` is NPN's null sentinel — `denull()` translates to
  `undefined` so consumers never see it.
- Hard guards at the source boundary on `getObservations` and
  `getSiteLevelData`: must pass `years[]` AND ≥1 narrowing filter
  (species/station/state/etc). Unfiltered queries can be 95+ MB.
- Generous default fetch timeout (60s) with a `timeoutMs` override on
  the heavy endpoints (state-year `getSiteLevelData` runs ~50s).
- `.passthrough()` on every Zod object — schemas accept what NPN sends
  even when shapes drift; normalizers handle the translation.
- Defensive parsing for known wire quirks:
    - `station_name` can be a number (some integer-named stations).
    - `state` field can be `null` in some `stationCountByState` rows.
    - `state` field can be a number in some `getSiteLevelData` rows.
    - `network_id` can be string, number, null, or empty.
- Empty-body bug handling: NPN returns HTTP 200 with 0-byte body for
  some queries (notably `getStationsWithSpecies({speciesIds:[3]})`,
  rnpn issue #38). The client treats empty body as `[]` so callers
  don't crash on `JSON.parse`.
- Inconsistency NPN didn't document: `station_id` (singular) is the
  filter parameter on `getSiteLevelData`, while `station_ids` (plural)
  is the parameter on `getObservations`. Took live probing to find.

#### `pondlog npn …` CLI subcommands

- `pondlog npn active [--lat] [--lng] [--radius] [--years]
  [--max-stations] [--json]` — recently observed phenology near a
  location. Picocolors output with distance + sample size columns;
  `--json` returns full structured result.
- `pondlog npn species [--query] [--genus] [--kingdom] [--json]` —
  search the ~1,900-species NPN catalog. Cap of 30 alphabetical rows
  with no filter; up to 200 with filters.
- Validation at the CLI boundary (`--radius`, `--years`,
  `--max-stations` all clamped with descriptive errors).
- Help text on every command with worked examples and a coverage
  caveat ("Eastern US and AZ are dense; PNW is sparser").

#### `@pondlog/mcp-npn` (new package, 8 MCP tools)

- Tools: `search_species`, `get_stations_in_state`,
  `get_station_count_by_state`, `get_stations_with_species`,
  `get_stations_by_location`, `get_observations`,
  `get_site_level_data`, `get_active_phenology_nearby`. Stdio
  transport, NPX-ready (`pondlog-mcp-npn` bin with shebang).
- All tools `readOnlyHint: true, openWorldHint: true`. No env vars
  required (NPN is keyless — `server.json` reflects that).
- LLM-targeted tool descriptions inline the NPN glossary: phenophase
  definition, what "first yes" / "last yes" mean, why `-9999` doesn't
  appear in responses, when to pick `get_active_phenology_nearby` vs
  the lower-level tools.
- Per-field `.describe()` calls on every input (`speciesIdField`,
  `stateCodeField`, `phenophaseIdField`, etc., shared via
  `schemas.ts`). Tool descriptions cross-reference siblings so the LLM
  doesn't pick `get_observations` when `get_site_level_data` is
  cheaper.
- README with Claude Desktop + Cursor config blocks (no env block —
  no key needed), 8-tool table, key gotchas (coverage patchiness, data
  lag, sentinel value, species_id=3 bug), example prompts.
- `server.json` for MCP Registry submission.

### Verified

- `pnpm typecheck` + `pnpm build` clean across all 8 workspace
  packages.
- `@pondlog/source-npn` unit tests: 12 passing
  (Zod schemas, denull/normalize, WKT bbox + haversine).
- `@pondlog/source-npn` live smoke: 9/9 passing against the real NPN
  API at Port Angeles + WA. `getSpecies` (1,940 species),
  `getStationCountByState` (202 state buckets, includes territories +
  null bucket), `getStations({stateCode:'WA'})` (1,374 stations),
  `getStationsByLocation` (16 stations in PA bbox 25 km),
  `getStationsWithSpecies({speciesIds:[210]})` (188 stations) and the
  graceful-empty case for the buggy species_id=3,
  `getObservations({states:['WA'], speciesIds:[3], years:[2024]})`
  (803 obs), `getActivePhenologyNearby({Port Angeles, 50 km, 2y})`
  (75 phenometric rows across 40 stations).
- CLI manual smoke: `npn species --query mayapple` (1 result with
  binomial + species_id), `npn species --genus Acer` (14 maples
  alphabetically), `npn active --lat 47.6062 --lng -122.3321
  --radius 50 --years 5` (21 rows incl. dwarf witchalder, herring
  gull, kinnikinnick), `--json` returns the full result envelope, bad
  `--radius 9999` rejected at the CLI boundary.
- MCP JSON-RPC handshake (per `mcp-server` SKILL.md §6) — all 4
  required checks: `initialize` returns `pondlog-mcp-npn` v0.1.0;
  `tools/list` returns all 8 tools; live `search_species(query=saguaro)`
  returns id=210; live `get_active_phenology_nearby(Seattle, 50km, 5y,
  30 stations)` returns the entries; live
  `get_station_count_by_state` returns 202 states; bad-input
  `get_active_phenology_nearby({lat:999})` rejected by SDK Zod
  before the handler runs (`isError: true`). Verification script
  deleted before commit per SKILL.md.

### Notes for future stickies (USGS, mcp-pondlog aggregate)

- NPN's session — three pre-existing errors had to be discovered live
  by probing the real API: wrong host in audit doc, undocumented
  `station_id` vs `station_ids` parameter inconsistency between
  related endpoints, and the `-9999` sentinel + `null`/`number`
  type-drift in fields the docs claimed were strings. Lesson: always
  hit the live API before writing schemas. Don't trust audit notes.
- `getObservations` is bandwidth-bound (80+ MB per station-year). For
  any "is this happening now?" query, prefer site-level summaries.
  Carrying that lens into mcp-pondlog: aggregate "what's recent" is
  best built on site-level data + recent eBird/inat observations,
  not raw NPN status records.
- `bboxWkt` + `haversineKm` are reusable — promote to `@pondlog/core`
  if mcp-pondlog or USGS integration needs them. Right now they live
  in `@pondlog/source-npn` and are re-exported.
- 7 endpoints + 8 MCP tools (the eighth being the composed helper) is
  the right ratio for a bandwidth-constrained API. Don't expose 1:1
  bare wrappers when one composed tool answers the actual question
  better.

---

## [0.6.0] - 2026-05-07

### Added — Sticky 7: eBird MCP server (21 tools, 100% API coverage)
- `@pondlog/mcp-ebird` ships **21 MCP tools** — direct snake_case
  mappings of all 21 `@pondlog/source-ebird` functions. Stdio
  transport, `@modelcontextprotocol/sdk` v1.x, NPX-ready
  (`pondlog-mcp-ebird` bin with shebang).
- Tools split by category to keep files focused (mirrors source-ebird):
  `tools/observations.ts` (7), `tools/product.ts` (3),
  `tools/hotspots.ts` (3), `tools/taxonomy.ts` (5),
  `tools/regions.ts` (3). `tools.ts` is a thin barrel.
- Tool descriptions inline the eBird domain glossary: region-code
  hierarchy (US / US-WA / US-WA-009), species-code format, subId/locId
  formats. Cross-references between siblings (region-scoped vs
  coords-scoped, recent vs notable, etc.) so the LLM picks the right
  tool.
- Per-field Zod `.describe()` strings on every input. Shared field
  fragments live in `schemas.ts` (`latField`, `lngField`, `distField`,
  `backField`, `regionCodeField`, `speciesCodeField`, etc.) — same
  pattern as `mcp-inaturalist`.
- All tools annotated `readOnlyHint: true, openWorldHint: true`.
  Successful responses emit both `structuredContent` and a `text`
  block; failures set `isError: true` with `source/message/statusCode`.
- `EBIRD_API_KEY` enforcement at server startup: `assertEbirdApiKey()`
  runs at the top of `index.ts main()` before `buildServer()`. Missing
  key prints a clear error to stderr (link to keygen + export
  instructions) and exits 1 before binding stdio. `buildServer()` stays
  pure for testability.
- `server.json` for MCP Registry submission, with
  `environment_variables` declaring `EBIRD_API_KEY` as required +
  secret. README with Claude Desktop + Cursor config blocks (both with
  `env` block for the key), full 21-tool table grouped by category,
  region-code glossary, example prompts.

### Verified
- `pnpm --filter @pondlog/mcp-ebird typecheck` + `build` clean
  (~31 KB ESM bundle).
- Missing-key error path: `node dist/index.js` (without
  `EBIRD_API_KEY`) prints the actionable error and exits 1 before
  any other work.
- JSON-RPC handshake: `initialize` returns expected `serverInfo`
  (`pondlog-mcp-ebird` v0.1.0); `tools/list` returns all 21 tools;
  bad-input `tools/call` (`get_nearby_recent` with `lat=999`) is
  rejected by SDK Zod with `isError: true` before the handler runs.
- Live `tools/call` against `get_nearby_recent` (Port Angeles,
  dist=25, back=3) returned `ok: true` with 138 species.

## [0.5.0] - 2026-05-07

### Added — Sticky 6: eBird CLI subcommands
- `pondlog ebird recent [--lat] [--lng] [--radius] [--days] [--json]` —
  recent bird sightings near a location, sorted newest first. eBird's
  `obs/recent` already returns one row per species (the most recent
  sighting), so output is naturally one row per species with `howMany`,
  bold common name, dim scientific name, dim location, relative date.
- `pondlog ebird notable [--lat] [--lng] [--radius] [--days] [--json]` —
  notable / unusual sightings with a yellow ★ marker per row.
- `pondlog ebird species <speciesCode> [--lat] [--lng] [--radius] [--json]`
  — recent sightings of one species (eBird 4–10 char code, e.g.
  `barowl`). Validated lower-case alphanumeric.
- `pondlog ebird historic <date> --region <code> [--json]` — observations
  on a specific date in a region (date as YYYY-MM-DD; region required,
  e.g. `US-WA-009`). Output is grouped by location, with each group
  sorted by sighting count desc.
- `pondlog ebird hotspots [--lat] [--lng] [--radius] [--json]` —
  birding hotspots near a location, sorted by all-time species count
  desc, showing species count and last activity (relative).
- `pondlog ebird checklist <subId> [--json]` — view a single eBird
  checklist (e.g. `S987654321`) with metadata header (observer, date,
  duration, distance, species count) and species list.
- All location-aware commands resolve from `--lat/--lng` flags →
  `~/.pondlog/config.json` saved default → friendly error.
- Every eBird subcommand requires `EBIRD_API_KEY`. Missing key prints
  a clear actionable error to stderr (link to keygen + the export
  command) and exits 1, before any network call.
- eBird radius is clamped to 50 km (eBird's API max), days to 30
  (eBird's API max). Both validated at the CLI boundary with descriptive
  error messages.
- New validators in `validate.ts`: `parseHistoricDate`,
  `parseSpeciesCode`, `parseRegionCode`.
- New `format-ebird.ts` with `formatEbirdObs` (with optional notable
  marker), `formatHotspot`, `formatChecklistHeader`,
  `groupObsByLocation`. Truncation with `…` for long location names.

### Verified
- `pnpm --filter pondlog typecheck` + `build` clean (~35 KB ESM bundle).
- `pondlog ebird --help` lists all 6 subcommands; per-command `--help`
  prints usage examples.
- Manual smoke against the real eBird API (Port Angeles area):
  - `recent`: 166 species rendered cleanly, sorted newest first
  - `notable`: 1 sighting (Mountain Bluebird) with ★ marker
  - `hotspots`: 100 hotspots ranked by all-time species (Rocky Point
    Bird Observatory at 299 spp leading)
  - `historic 2025-05-01 --region US-WA-009`: 125 observations across
    27 locations, grouped neatly
  - `recent --json | jq '.[0]'`: valid JSON observation object
- Missing-key error: `node … ebird recent` (without `EBIRD_API_KEY`)
  prints the actionable error and exits 1 before any fetch.

## [0.4.0] - 2026-05-07

### Added — Sticky 5: eBird source client (100% API coverage)
- `@pondlog/source-ebird` ships all 21 documented eBird API v2 endpoints
  across five categories: Observations (7), Product (3), Hotspots (3),
  Taxonomy (5), Regions (3).
- Every function returns `Result<T>`, validates responses with Zod, and
  shares a single 100 req/min `RateLimiter` instance. 429 → exponential
  backoff via `withRetry` (1s, 2s, 4s, max 3 attempts), same pattern as
  `@pondlog/source-inaturalist`.
- API key handling: `EBIRD_API_KEY` is read on every fetch and surfaced
  as a `Result` error if missing. `assertEbirdApiKey()` is exported for
  callers who want fail-loud-at-startup semantics.
- Normalized convenience variants for endpoints with shared `@pondlog/core`
  analogues: `getNearbyRecentNormalized`, `getNearbyNotableNormalized`,
  `getHotspotsInRegionNormalized`, `getNearbyHotspotsNormalized`,
  `getHotspotInfoNormalized`, `getTaxonomyNormalized`. All eBird
  observations normalize to `iconicTaxon: "Aves"` (eBird is birds-only).
- Param validation at the boundary: `back` clamped 1–30, `dist` clamped
  0–50 km, year/month/day integer-checked, `maxResults` range-checked
  per endpoint. Invalid params return `Result` error without a network
  call.
- Source layout split by category (`observations.ts`, `product.ts`,
  `hotspots.ts`, `taxonomy.ts`, `regions.ts`) plus shared `client.ts`,
  `schemas.ts`, `normalize.ts`. `index.ts` is a barrel.

### Verified
- `pnpm --filter @pondlog/source-ebird typecheck` clean.
- `pnpm --filter @pondlog/source-ebird build` clean (tsup esm + dts;
  ~23 KB JS, ~43 KB d.ts).
- 15/15 Zod schema + normalization unit tests pass.
- 5/5 live smoke tests against the real eBird API (Port Angeles area,
  ran in 3.58s):
  - `getNearbyRecent` (lat=48.118, lng=-123.4307): 166 observations
  - `getNearbyNotable` (lat=48.118, lng=-123.4307): 212 notable
  - `getHotspotsInRegion("US-WA-009")`: 216 hotspots
  - `getHistoricOnDate("US-WA-009", 2025, 5, 1)`: 50 observations
  - `getRegionInfo("US-WA-009")`: "Clallam, Washington, United States"

### Notes
- The `.claude/API_AUDIT.md` listed the species-grouping endpoint as
  `/ref/taxonomy/groups/{speciesGrouping}`, but the actual eBird path
  is `/ref/sppgroup/{speciesGrouping}` — implementation uses the
  correct path.
- Smoke test for `getHistoricOnDate` was originally specified at the
  state level (`US-WA`) but consistently exceeded a 30s timeout in
  practice. Narrowed to county scope (`US-WA-009`) with a 60s timeout
  — the historic endpoint is response-heavy at state granularity.

## [0.3.0] - 2026-05-07

### Added — Sticky 3: iNaturalist MCP server
- `@pondlog/mcp-inaturalist` ships nine tools over `@modelcontextprotocol/sdk`
  v1.29 (stdio transport), each a thin wrapper around a source-inaturalist
  function: `search_observations`, `get_observation`, `get_species_counts`,
  `search_taxa`, `get_taxon`, `get_nearby_observations`,
  `get_iconic_taxa_summary`, `search_places`, `get_observers`.
- Tool input schemas authored as Zod raw shapes with LLM-targeted
  `.describe()` strings (iconic-taxa glossary, example coordinates,
  guidance on when to pick a sibling tool).
- Each tool annotated `readOnlyHint: true, openWorldHint: true`.
- Successful responses emit both `structuredContent` (typed JSON) and a
  pretty `text` block for backwards compatibility. Failures set
  `isError: true` and serialize the source/message/statusCode.
- `server.json` for MCP Registry submission; `bin: pondlog-mcp-inaturalist`
  with shebang for npx; README with Claude Desktop + Cursor config blocks
  and example prompts.

### Verified
- `pnpm typecheck` + `pnpm build` clean across all 4 packages.
- JSON-RPC handshake test: `initialize` (protocol 2025-06-18) succeeds,
  `tools/list` returns all 9 tools with the expected schemas, live
  `tools/call get_nearby_observations` against Port Angeles returns 50
  real observations with the expected normalized shape, and invalid input
  (lat=999) is rejected with `isError: true` before reaching the handler.

## [0.2.0] - 2026-05-07

### Added — Sticky 2: iNaturalist CLI commands
- `pondlog config set-location --lat <lat> --lng <lng> [--name <name>]` —
  saves default coordinates to `~/.pondlog/config.json` (overridable via
  `PONDLOG_CONFIG_DIR`); atomic write, mode 0600 file in mode 0700 dir,
  versioned schema validated by Zod.
- `pondlog config show [--json]`.
- `pondlog inat nearby [--lat] [--lng] [--radius] [--days] [--taxon] [--json]` —
  recent observations grouped by iconic taxa; uses saved config when
  flags absent.
- `pondlog inat species [--lat] [--lng] [--radius] [--days] [--json]` —
  species counts grouped by iconic taxa, count-sorted.
- `pondlog inat search <query> [--lat] [--lng] [--radius] [--json]` —
  observations matching a taxon name.
- `pondlog inat taxon <name> [--json]` — taxon lookup with rank/group.
- Validation layer: lat/lng/radius/days are bounds-checked at the CLI
  boundary (radius capped at 500 km per iNat).
- Output: picocolors for bold/dim, relative-date helper ("today", "N days
  ago", falls back to ISO past 30 days), padded columns with ANSI-aware
  width math.

### Changed
- `@pondlog/source-inaturalist` `pickObserverName`: empty-string user
  fields now fall through to "unknown" alongside null/undefined.

### Verified
- `pnpm typecheck` + `pnpm build` clean across all 4 packages.
- 16 unit tests + 9 live smoke tests still passing.
- Manual CLI: all sticky-listed commands run live against iNat at Port
  Angeles. `pondlog inat nearby --json` produces valid JSON; negative
  cases (bad lat, bad radius, --lat without --lng, no config + no flags)
  all surface friendly errors and exit 1.

## [0.1.0] - 2026-05-07

### Added
- pnpm workspace scaffold (`pnpm-workspace.yaml`, `tsconfig.base.json` with
  strict / ES2022 / NodeNext, `.npmrc`, `.gitignore`).
- `@pondlog/core`: shared types (`Coordinates`, `Result<T>`, `Observation`,
  `SpeciesCount`, `IconicTaxaSummary`, `Place`, `Observer`, `Taxon`,
  `TaxonDetail`, `ObservationDetail`, `NatureBriefing`), token-bucket
  `RateLimiter`, exponential `withRetry`, coordinate parsing/validation,
  `PONDLOG_USER_AGENT` constant.
- `@pondlog/source-inaturalist`: Zod schemas for iNat responses,
  normalizers, rate-limited fetch client (100 req/min, exponential backoff
  on 429), and 9 functions returning `Result<T>`:
  `searchObservations`, `getObservation`, `getSpeciesCounts`,
  `getNearbyObservations`, `searchTaxa`, `getTaxon`,
  `getIconicTaxaSummary`, `searchPlaces`, `getObservers`.
- `pondlog` CLI shell (commander, no commands yet — Sticky 2).
- `@pondlog/mcp-inaturalist` MCP shell (MCP SDK stdio, no tools yet —
  Sticky 3).

### Verified
- `pnpm typecheck` clean across all 4 packages.
- `pnpm build` (tsup) clean across all 4 packages.
- Unit tests: 16 passing (rate limiter, coordinate parsing, Zod schemas,
  normalizers).
- Live smoke tests against iNaturalist API at Port Angeles, WA
  (48.118, -123.4307): 9/9 passing. All Zod schemas parsed real responses
  without warnings.
