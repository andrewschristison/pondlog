# API Audit — Pondlog Data Sources

## 1. iNaturalist API v1 ✅ FIRST BUILD

**Base URL:** `https://api.inaturalist.org/v1`
**Auth (reads):** None. Only a `User-Agent` header is required.
**Auth (writes):** OAuth2 (not needed for pondlog — read-only)
**Rate limit:** 100 requests/minute (by IP). 429 response on exceed.
**Response format:** JSON
**Docs:** https://api.inaturalist.org/v1/docs/ (Swagger)
**Terms:** https://www.inaturalist.org/pages/api+recommended+practices

### Key endpoints to implement

#### Observations
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/observations` | GET | Search observations with filters | P0 |
| `/observations/{id}` | GET | Single observation detail | P0 |
| `/observations/species_counts` | GET | Species count breakdown for query | P0 |
| `/observations/observers` | GET | Top observers for query | P1 |
| `/observations/identifiers` | GET | Top identifiers for query | P2 |
| `/observations/histogram` | GET | Temporal distribution of observations | P2 |

**Key query params for `/observations`:**
- `lat`, `lng`, `radius` — geo search (radius in km, max 500)
- `taxon_id` — filter by taxon (numeric ID)
- `taxon_name` — filter by taxon name (search string)
- `iconic_taxa` — filter by broad group: Aves, Amphibia, Mammalia, Reptilia, Insecta, Plantae, Fungi, etc.
- `d1`, `d2` — date range (YYYY-MM-DD)
- `quality_grade` — research, needs_id, casual
- `order_by` — created_at, observed_on, species_guess, votes, id
- `place_id` — named place filter
- `project_id` — project filter
- `per_page` — max 200 per request
- `page` — pagination
- `locale` — language for common names (default en)

**Response shape (observation):**
```json
{
  "id": 12345,
  "species_guess": "Pacific Chorus Frog",
  "taxon": {
    "id": 65,
    "name": "Pseudacris regilla",
    "preferred_common_name": "Pacific Chorus Frog",
    "iconic_taxon_name": "Amphibia",
    "rank": "species"
  },
  "observed_on_string": "2025-04-15",
  "location": "48.118,-123.43",
  "place_guess": "Port Angeles, WA",
  "quality_grade": "research",
  "photos": [{ "url": "..." }],
  "user": { "login": "username", "name": "..." },
  "created_at": "2025-04-15T10:30:00Z"
}
```

#### Taxa
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/taxa` | GET | Search taxa by name | P0 |
| `/taxa/{id}` | GET | Single taxon detail | P0 |
| `/taxa/autocomplete` | GET | Autocomplete taxon names | P1 |

**Key query params for `/taxa`:**
- `q` — search query (name)
- `is_active` — only active taxa
- `rank` — species, genus, family, order, etc.
- `per_page`, `page`

#### Places
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/places/autocomplete` | GET | Search places by name | P1 |
| `/places/{id}` | GET | Place detail with bounding box | P1 |

#### Projects
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/projects` | GET | Search projects | P2 |
| `/projects/{id}` | GET | Project detail | P2 |

#### Search
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/search` | GET | Unified search across types | P2 |

### Gotchas
- `location` field is a string "lat,lng" — needs parsing
- Photos have multiple sizes via URL manipulation (replace `square` with `medium`, `large`, `original`)
- `species_counts` returns taxon objects with count — the most useful endpoint for "what's around here"
- Pagination maxes at 10,000 results total (page * per_page ≤ 10,000)
- User-Agent header MUST identify your app: `"pondlog/1.0 (andrew@andrewchristison.com)"`
- Dates are in observer's local timezone, not UTC

### MCP tools to build (9 tools)
1. `search_observations` — `/observations` with geo + taxon + date filters
2. `get_observation` — `/observations/{id}`
3. `get_species_counts` — `/observations/species_counts` with geo + date filters
4. `search_taxa` — `/taxa` by name
5. `get_taxon` — `/taxa/{id}`
6. `get_nearby_observations` — `/observations` with lat/lng/radius shortcut
7. `get_iconic_taxa_summary` — `/observations/species_counts` grouped by iconic_taxa
8. `search_places` — `/places/autocomplete`
9. `get_observers` — `/observations/observers` for a location

### CLI commands to build
- `pondlog inat nearby [--lat] [--lng] [--radius] [--days]` — recent observations near coordinates
- `pondlog inat species [--lat] [--lng] [--radius] [--days]` — species counts near coordinates
- `pondlog inat search <query>` — search observations by taxon name
- `pondlog inat taxon <name>` — look up a taxon

---

## 2. eBird API 2.0 — SECOND BUILD

**Base URL:** `https://api.ebird.org/v2`
**Auth:** API key required (free, request at https://ebird.org/api/keygen)
**Header:** `X-eBirdApiToken: {key}`
**Rate limit:** ~100 req/min (not formally published, throttle at 429)
**Response format:** JSON
**Docs:** https://documenter.getpostman.com/view/664302/S1ENwy59

### Endpoints — FULL COVERAGE (21 endpoints)

#### Observations (7)
- `GET /data/obs/{regionCode}/recent` — recent observations in region
- `GET /data/obs/{regionCode}/recent/{speciesCode}` — recent of species in region
- `GET /data/obs/{regionCode}/recent/notable` — notable in region
- `GET /data/obs/geo/recent` — nearby recent (lat/lng)
- `GET /data/obs/geo/recent/notable` — nearby notable
- `GET /data/obs/geo/recent/{speciesCode}` — nearby of species
- `GET /data/obs/{regionCode}/historic/{y}/{m}/{d}` — historic on date ⭐

#### Product (3)
- `GET /product/lists/{regionCode}` — recent checklists
- `GET /product/top100/{regionCode}/{y}/{m}/{d}` — top 100 contributors
- `GET /product/checklist/view/{subId}` — view checklist

#### Hotspots (3)
- `GET /ref/hotspot/{regionCode}` — hotspots in region
- `GET /ref/hotspot/geo` — nearby hotspots
- `GET /ref/hotspot/info/{locId}` — hotspot detail

#### Taxonomy (5)
- `GET /ref/taxonomy/ebird` — full taxonomy
- `GET /ref/taxonomy/forms/{speciesCode}` — taxonomic forms
- `GET /ref/taxonomy/locales` — available locales
- `GET /ref/taxonomy/versions` — taxonomy versions
- `GET /ref/taxonomy/groups/{speciesGrouping}` — taxonomic groups

#### Regions (3)
- `GET /ref/region/info/{regionCode}` — region info
- `GET /ref/region/list/{regionType}/{parentRegionCode}` — sub-regions
- `GET /ref/region/adjacent/{regionCode}` — adjacent regions

### Gotchas
- Region codes: country (US), subnational1 (US-WA), subnational2 (US-WA-009 for Clallam County)
- `back` param = days back, max 30
- API key exposed in header, not query param — good for security
- Species codes are 6-letter abbreviations (amecro = American Crow)
- `detail=full` significantly increases response size — default to simple

---

## 3. USA National Phenology Network (NPN) — THIRD BUILD

**Base URL:** `https://data.usanpn.org/npn_portal/`
**Auth:** None for most endpoints. API key available but optional.
**Rate limit:** Undocumented. Be polite (1 req/sec).
**Docs:** https://docs.google.com/document/d/1yNjupricKOAXn6tY1sI7-EwkcfwdGUZ7lxYv7fcPjO8

### Key endpoints
- `/species/getSpecies.json` — species list
- `/observations/getObservations.json` — observation data by location/date/species
- `/observations/getSiteLevelData.json` — site-level phenology data
- `/stations/getStations.json` — observation stations

### Notes
- Phenology = seasonal timing of biological events (first bloom, first leaf, first flight)
- Most useful for: "What's blooming/emerging now near me?"
- Data is thinner than iNat/eBird but scientifically curated

---

## 4. USGS Water Services — FOURTH BUILD

**Base URL:** `https://waterservices.usgs.gov/nwis/`
**Auth:** None
**Rate limit:** Undocumented. Be polite.
**Response format:** JSON (via `format=json` param)
**Docs:** https://waterservices.usgs.gov/docs/

### Key endpoints
- `/iv/` — instantaneous (real-time) values
- `/dv/` — daily values
- `/site/` — site information

### Key params
- `sites` — USGS site number (e.g., 12045500 for Elwha River at McDonald Bridge)
- `parameterCd` — 00060 (discharge/streamflow in cfs), 00065 (gage height)
- `period` — e.g., P7D for past 7 days

### Notes
- Elwha River station: 12045500
- Simple API, small surface area — fast build
- Most useful for: "What's the river doing right now?"

---

## 5. SunCalc — LOCAL COMPUTATION (no API)

**Library:** `suncalc` npm package
**Auth:** N/A — pure math, no network calls
**Inputs:** date, latitude, longitude
**Outputs:** sunrise, sunset, solar noon, dawn, dusk, moon phase, moon illumination, moon rise/set

### Notes
- Zero rate limits, zero latency, zero failure modes
- Include in `packages/core/` as a utility, not a separate source package
- Powers the celestial section of `pondlog today`

---

## 6. NOAA Tides & Currents — EXISTING MCP (consume, don't rebuild)

**Existing MCP:** `@ryancardin/noaa-tides-currents-mcp-server` (25+ tools, well-maintained)
**Direct API:** `https://api.tidesandcurrents.noaa.gov/api/prod/`
**Port Angeles station:** 9444090

### Decision
Build a thin NOAA client in `packages/core/` for the CLI's `pondlog today` command (direct API calls). For MCP users, recommend the existing NOAA MCP as a companion rather than rebuilding it. If we later decide to include NOAA in `mcp-pondlog` aggregate, wrap the direct API — don't depend on another MCP server at runtime.
