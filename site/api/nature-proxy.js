// site/api/nature-proxy.js
//
// Vercel serverless proxy for three nature sources that can't be called
// directly from the browser:
//   - eBird    : requires an API key (X-eBirdApiToken) — can't expose in JS.
//   - Mushroom : XML by default and CORS-unfriendly on some routes.
//   - NPN      : CORS-unfriendly; needs a station-lookup round trip.
//
// All requests share one handler. Routing is by ?source=ebird|mushroom|npn.
// Per-IP rate limit and a small in-memory cache supplement Vercel's
// CDN cache headers (s-maxage). The CDN cache is the real backstop — the
// in-memory map only helps when the same function instance handles a burst.

const CACHE = new Map();
const IP_BUCKETS = new Map();

const RATE = { max: 30, windowMs: 60_000 };
const TTL = {
  ebird:    30 * 60,        // 30 minutes
  mushroom: 2 * 60 * 60,    // 2 hours
  npn:      2 * 60 * 60,    // 2 hours
};

function getCache(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { CACHE.delete(key); return null; }
  return hit.data;
}
function setCache(key, data, ttlSec) {
  CACHE.set(key, { data, expires: Date.now() + ttlSec * 1000 });
}

function rateLimit(ip) {
  const now = Date.now();
  const prior = (IP_BUCKETS.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  prior.push(now);
  IP_BUCKETS.set(ip, prior);
  return prior.length <= RATE.max;
}

function bbox(lat, lng, km) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng };
}
function isoDay(d) { return d.toISOString().slice(0, 10); }

// ---------- eBird ----------
async function ebird(lat, lng) {
  const key = process.env.EBIRD_API_KEY;
  if (!key) return { error: 'EBIRD_API_KEY not set' };
  const headers = { 'X-eBirdApiToken': key, Accept: 'application/json' };

  const recentUrl = `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=25&back=7`;
  const recent = await fetch(recentUrl, { headers }).then((r) => r.ok ? r.json() : []);
  const speciesSet = new Set(recent.map((o) => o.speciesCode));
  const notableUrl = `https://api.ebird.org/v2/data/obs/geo/recent/notable?lat=${lat}&lng=${lng}&dist=25`;
  const notable = await fetch(notableUrl, { headers }).then((r) => r.ok ? r.json() : []).catch(() => []);
  const hotspotUrl = `https://api.ebird.org/v2/ref/hotspot/geo?lat=${lat}&lng=${lng}&dist=25&fmt=json`;
  const hotspots = await fetch(hotspotUrl, { headers }).then((r) => r.ok ? r.json() : []).catch(() => []);

  return {
    speciesCount: speciesSet.size,
    notableCount: notable.length,
    topHotspot: hotspots[0] ? hotspots[0].locName : null,
    topSpecies: [...new Set(recent.map((o) => o.comName))].slice(0, 3),
  };
}

// ---------- Mushroom Observer ----------
async function mushroom(lat, lng) {
  const b = bbox(lat, lng, 50);
  const today = new Date();
  const start = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  // detail=low returns observations with `consensus_name` directly on the
  // result object. Higher detail levels nest it; we don't need them here.
  const url = `https://mushroomobserver.org/api2/observations`
    + `?north=${b.north.toFixed(4)}&south=${b.south.toFixed(4)}`
    + `&east=${b.east.toFixed(4)}&west=${b.west.toFixed(4)}`
    + `&date=${isoDay(start)}-${isoDay(today)}&format=json&detail=low`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`MO ${r.status}`);
  const data = await r.json();
  const results = Array.isArray(data.results) ? data.results : [];
  // Most recent observation by date (MO returns oldest-first by default).
  let topName = null;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    const obs = results[i];
    if (obs && typeof obs.consensus_name === 'string' && obs.consensus_name) {
      topName = obs.consensus_name;
      break;
    }
  }
  return {
    recentCount: data.number_of_records || results.length || 0,
    topName,
  };
}

// ---------- USA-NPN ----------
// NPN's data is sparse and its observations endpoint can return tens of
// megabytes for unfiltered queries. We do best-effort: find a handful of
// nearby stations via the WKT polygon endpoint, fetch their observations
// for the current year, and surface the most recent active phenophase.
// If anything fails or returns nothing, the browser falls back to baked
// example text and labels the line accordingly.
function bboxWkt(lat, lng, km) {
  const b = bbox(lat, lng, km);
  const ring = [
    `${b.west.toFixed(4)} ${b.south.toFixed(4)}`,
    `${b.east.toFixed(4)} ${b.south.toFixed(4)}`,
    `${b.east.toFixed(4)} ${b.north.toFixed(4)}`,
    `${b.west.toFixed(4)} ${b.north.toFixed(4)}`,
    `${b.west.toFixed(4)} ${b.south.toFixed(4)}`,
  ].join(', ');
  return `POLYGON((${ring}))`;
}

async function npn(lat, lng) {
  // One shared AbortController bounds the whole sequence (both fetches and
  // their body reads). Vercel hobby functions get ~10s; we cap NPN at 6s
  // so the wrapping handler can still respond before edge timeout.
  const ctrl = new AbortController();
  const budget = setTimeout(() => ctrl.abort(), 6000);
  try {
    const wkt = bboxWkt(lat, lng, 50);
    const stationsUrl = `https://services.usanpn.org/npn_portal/stations/getStationsByLocation.json`
      + `?wkt=${encodeURIComponent(wkt)}&request_src=pondlog`;
    const sr = await fetch(stationsUrl, { signal: ctrl.signal });
    if (!sr.ok) return { activeEvents: [] };
    const stationsRaw = await sr.json();
    const stations = Array.isArray(stationsRaw)
      ? stationsRaw.filter((s) => typeof s.station_id === 'number')
      : [];
    if (!stations.length) return { activeEvents: [] };

    // Keep the closest 10 stations only. getObservations response size is
    // proportional to (stations × years × individuals × phenophases) and
    // can balloon into tens of MB; trimming aggressively here is what keeps
    // the function under its time budget.
    const dist = (s) => {
      const dLat = s.latitude - lat;
      const dLng = s.longitude - lng;
      return dLat * dLat + dLng * dLng;
    };
    const top = stations.sort((a, b) => dist(a) - dist(b)).slice(0, 10);

    const year = new Date().getUTCFullYear();
    const obsParams = [`years%5B0%5D=${year}`, 'request_src=pondlog'];
    top.forEach((s, i) => { obsParams.push(`station_ids%5B${i}%5D=${s.station_id}`); });
    const obsUrl = `https://services.usanpn.org/npn_portal/observations/getObservations.json?${obsParams.join('&')}`;
    const or = await fetch(obsUrl, { signal: ctrl.signal });
    if (!or.ok) return { activeEvents: [] };
    const obsRaw = await or.json();
    const obs = Array.isArray(obsRaw) ? obsRaw : [];

  const active = obs
    .filter((o) => String(o.phenophase_status) === '1')
    .sort((a, b) => String(b.observation_date || '').localeCompare(String(a.observation_date || '')))
    .slice(0, 3)
    .map((o) => ({
      common_name: o.common_name,
      phenophase: o.phenophase_description,
      date: o.observation_date,
    }));
    return { activeEvents: active };
  } catch {
    return { activeEvents: [] };
  } finally {
    clearTimeout(budget);
  }
}

// ---------- handler ----------
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    const ipHeader = req.headers['x-forwarded-for'] || '';
    const ip = String(ipHeader).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    if (!rateLimit(ip)) {
      res.status(429).json({ error: 'rate limited' });
      return;
    }

    const { source, lat: latStr, lng: lngStr } = req.query || {};
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!source || Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: 'source, lat, lng required' });
      return;
    }
    if (!TTL[source]) {
      res.status(400).json({ error: `unknown source: ${source}` });
      return;
    }

    const cacheKey = `${source}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
    const hit = getCache(cacheKey);
    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, s-maxage=${TTL[source]}, stale-while-revalidate=600`);
      res.status(200).json(hit);
      return;
    }

    let data;
    if (source === 'ebird') data = await ebird(lat, lng);
    else if (source === 'mushroom') data = await mushroom(lat, lng);
    else if (source === 'npn') data = await npn(lat, lng);

    // Empty results (no recent MO obs in 14 days, no active NPN phenophases)
    // get a short TTL so they retry sooner instead of being pinned to the
    // long TTL the source would normally enjoy. Real data uses the full TTL.
    const isEmpty =
      (source === 'mushroom' && (!data || !data.recentCount)) ||
      (source === 'npn' && (!data || !data.activeEvents || !data.activeEvents.length));
    const ttl = isEmpty ? 300 : TTL[source];

    setCache(cacheKey, data, ttl);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=600`);
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: (err && err.message) || 'upstream error' });
  }
};
