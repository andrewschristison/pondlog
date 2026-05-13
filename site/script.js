/* ============================================================
   pondlog.co — script
   typewriter · location switching · cropgraph fetch
   ============================================================ */

(() => {
  'use strict';

  /* ── location data (baked nature lines + live garden) ─── */
  const LOCATIONS = {
    'port-angeles': {
      label: 'Port Angeles, WA',
      lat: 48.118, lng: -123.431,
      noaaStation: '9444090',
      usgsSite: '12045500',
      lines: [
        ['🦅 Birds',     'src-bird',   '12 species near hotspot Ediz Hook this week', '(eBird)'],
        ['🌿 Wildlife',  'src-wild',   '47 observations within 25km',                 '(iNaturalist)'],
        ['🍄 Fungi',     'src-fungi',  '3 recent observations',                       '(Mushroom Obs.)'],
        ['🌊 Tides',     'src-tide',   'next high 4:32pm  6.2 ft',                   '(NOAA)'],
        ['💧 Streamflow','src-flow',   'Elwha at McDonald  342 cfs',                  '(USGS)'],
        ['🌙 Tonight',   'src-sky',    'waxing gibbous, 82% illuminated',             '(local)'],
        ['🌸 Phenology', 'src-pheno',  'red flowering currant: first bloom',          '(USA-NPN)'],
        ['🌱 Garden',    'src-garden', null,                                          '(cropgraph)'],
      ],
      garden: { zone: '8b', climate: 'maritime', plantNow: ['bush bean', 'cucumber', 'kale', 'cilantro'] },
    },

    'portland': {
      label: 'Portland, OR',
      lat: 45.515, lng: -122.678,
      noaaStation: '9435380',
      usgsSite: '14211720',
      lines: [
        ['🦅 Birds',     'src-bird',   '38 species near Smith & Bybee this week',    '(eBird)'],
        ['🌿 Wildlife',  'src-wild',   '211 observations within 25km',               '(iNaturalist)'],
        ['🍄 Fungi',     'src-fungi',  '9 recent observations',                      '(Mushroom Obs.)'],
        ['🌊 Tides',     'src-tide',   'Willamette tidal · next high 3:18pm  2.4 ft','(NOAA)'],
        ['💧 Streamflow','src-flow',   'Willamette at Portland  21,400 cfs',         '(USGS)'],
        ['🌙 Tonight',   'src-sky',    'waxing gibbous, 82% illuminated',            '(local)'],
        ['🌸 Phenology', 'src-pheno',  'Pacific dogwood: first bloom',               '(USA-NPN)'],
        ['🌱 Garden',    'src-garden', null,                                         '(cropgraph)'],
      ],
      garden: { zone: '8b', climate: 'maritime', plantNow: ['tomato', 'basil', 'pepper', 'bean'] },
    },

    'austin': {
      label: 'Austin, TX',
      lat: 30.267, lng: -97.743,
      noaaStation: null,
      usgsSite: '08158000',
      lines: [
        ['🦅 Birds',     'src-bird',   '67 species near Hornsby Bend this week',     '(eBird)'],
        ['🌿 Wildlife',  'src-wild',   '312 observations within 25km',               '(iNaturalist)'],
        ['🍄 Fungi',     'src-fungi',  '14 recent observations',                     '(Mushroom Obs.)'],
        ['🌊 Tides',     'src-tide',   'inland · nearest station Galveston Bay',     '(NOAA)'],
        ['💧 Streamflow','src-flow',   'Colorado at Austin  124 cfs',                '(USGS)'],
        ['🌙 Tonight',   'src-sky',    'waxing gibbous, 82% illuminated',            '(local)'],
        ['🌸 Phenology', 'src-pheno',  'Texas bluebonnet: peak bloom',               '(USA-NPN)'],
        ['🌱 Garden',    'src-garden', null,                                         '(cropgraph)'],
      ],
      garden: { zone: '8b', climate: 'humid subtropical', plantNow: ['okra', 'sweet potato', 'southern pea', 'sorghum'] },
    },

    'brooklyn': {
      label: 'Brooklyn, NY',
      lat: 40.678, lng: -73.944,
      noaaStation: '8518750',
      usgsSite: '01311000',
      lines: [
        ['🦅 Birds',     'src-bird',   '28 species near Prospect Park this week',    '(eBird)'],
        ['🌿 Wildlife',  'src-wild',   '156 observations within 25km',               '(iNaturalist)'],
        ['🍄 Fungi',     'src-fungi',  '5 recent observations',                      '(Mushroom Obs.)'],
        ['🌊 Tides',     'src-tide',   'next high 5:47pm  4.1 ft',                  '(NOAA)'],
        ['💧 Streamflow','src-flow',   'Hudson at Green Island  8,920 cfs',          '(USGS)'],
        ['🌙 Tonight',   'src-sky',    'waxing gibbous, 82% illuminated',            '(local)'],
        ['🌸 Phenology', 'src-pheno',  'white oak: leaf out',                        '(USA-NPN)'],
        ['🌱 Garden',    'src-garden', null,                                         '(cropgraph)'],
      ],
      garden: { zone: '7b', climate: 'humid continental', plantNow: ['basil', 'cucumber', 'kale', 'snap bean'] },
    },
  };

  const CROPGRAPH_BASE = 'https://api.cropgraph.com';

  /* ── helpers ────────────────────────────────────────── */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pad = (s, n) => (s + ' '.repeat(Math.max(0, n - s.length)));

  /* ── live garden lookup via api.cropgraph.com ───────── */
  async function fetchLiveGarden(lat, lng, signal) {
    try {
      const ctrl = new AbortController();
      const linked = signal ? signal.addEventListener('abort', () => ctrl.abort()) : null;
      const timeoutId = setTimeout(() => ctrl.abort(), 4000);

      const r = await fetch(`${CROPGRAPH_BASE}/api/planting?lat=${lat}&lng=${lng}`, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();

      // cropgraph returns { zone: { zone: "8b", ... }, climateType, plantNow: [...] }
      const zone = (data.zone && (data.zone.zone || data.zone.code))
        || (typeof data.zone === 'string' ? data.zone : null)
        || data.zoneCode || data.hardiness || '-';
      const climate = data.climateType || data.climate || '-';
      const list = (data.plantNow || data.recommendations || []).slice(0, 4);
      const plant = list
        .map((c) => (typeof c === 'string' ? c : (c.commonName || c.slug || c.name)))
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());

      return { zone, climate, plantNow: plant.length ? plant : null, live: true };
    } catch (err) {
      return null; // caller falls back to baked data
    }
  }

  function gardenSummary(g) {
    const head = `zone ${g.zone} · ${g.climate}`;
    const plants = g.plantNow ? g.plantNow.slice(0, 4).join(', ') : '-';
    return `${head} · plant now: ${plants}`;
  }

  /* ── live source fetchers (CORS-friendly + proxy) ─────── */

  // 3-second budget per source. The hero waits for all fetches to settle
  // before swapping in live data; anything slower than the typewriter run
  // would arrive after the user has already scrolled.
  function makeAbortable(timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
  }

  // iNaturalist · species observed within 25km in the past 7 days.
  async function fetchLiveINat(lat, lng) {
    const a = makeAbortable(3000);
    try {
      const d2 = new Date();
      const d1 = new Date(d2.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fmt = (d) => d.toISOString().slice(0, 10);
      const url = `https://api.inaturalist.org/v1/observations/species_counts`
        + `?lat=${lat}&lng=${lng}&radius=25`
        + `&d1=${fmt(d1)}&d2=${fmt(d2)}&per_page=1`;
      const r = await fetch(url, { signal: a.signal, headers: { Accept: 'application/json' } });
      a.cancel();
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      const total = data.total_results || 0;
      if (!total) return null;
      return `${total} species observed within 25km this week`;
    } catch {
      a.cancel();
      return null;
    }
  }

  // NOAA tides · next predicted high or low at the given station.
  async function fetchLiveTide(stationId) {
    if (!stationId) return null;
    const a = makeAbortable(3000);
    try {
      const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`
        + `?station=${stationId}&date=today&product=predictions`
        + `&datum=MLLW&time_zone=lst_ldt&units=english`
        + `&interval=hilo&application=pondlog&format=json`;
      const r = await fetch(url, { signal: a.signal, headers: { Accept: 'application/json' } });
      a.cancel();
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      const preds = data.predictions || [];
      const now = Date.now();
      const next = preds.find((p) => new Date(p.t.replace(' ', 'T')).getTime() > now);
      if (!next) return null;
      const time = new Date(next.t.replace(' ', 'T'));
      const hh = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
      const label = next.type === 'H' ? 'high' : 'low';
      const ft = parseFloat(next.v).toFixed(1);
      return `next ${label} ${hh}  ${ft} ft`;
    } catch {
      a.cancel();
      return null;
    }
  }

  // USGS · most recent instantaneous discharge reading at the given site.
  async function fetchLiveFlow(siteId) {
    if (!siteId) return null;
    const a = makeAbortable(3000);
    try {
      const url = `https://waterservices.usgs.gov/nwis/iv/`
        + `?sites=${siteId}&parameterCd=00060&format=json`;
      const r = await fetch(url, { signal: a.signal, headers: { Accept: 'application/json' } });
      a.cancel();
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      const ts = data && data.value && data.value.timeSeries && data.value.timeSeries[0];
      if (!ts) return null;
      const fullName = ts.sourceInfo && ts.sourceInfo.siteName ? ts.sourceInfo.siteName : 'gage';
      const vals = ts.values && ts.values[0] && ts.values[0].value;
      const last = vals && vals[vals.length - 1];
      if (!last) return null;
      const cfs = parseFloat(last.value);
      if (Number.isNaN(cfs)) return null;
      // Site names are uppercase and verbose. Title-case the first comma
      // chunk and keep it short.
      const short = fullName.split(',')[0].trim()
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bAt\b/g, 'at')
        .replace(/\bNr\b/gi, 'near')
        .replace(/\bRiv\b/gi, 'River');
      const fmt = (n) => Math.round(n).toLocaleString();
      return `${short}  ${fmt(cfs)} cfs`;
    } catch {
      a.cancel();
      return null;
    }
  }

  // Moon phase · Conway approximation from a known reference new moon.
  // Pure math, accurate to ~1% illumination — fine for a hero line.
  function moonPhaseText(date = new Date()) {
    const synodic = 29.53058867;
    const refNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0); // 2000-01-06 18:14 UTC
    const days = (date.getTime() - refNewMoon) / 86400000;
    let phase = (days % synodic) / synodic;
    if (phase < 0) phase += 1;
    const illum = Math.round(50 * (1 - Math.cos(2 * Math.PI * phase)));
    const buckets = [
      [0.03, 'new moon'],
      [0.22, 'waxing crescent'],
      [0.28, 'first quarter'],
      [0.47, 'waxing gibbous'],
      [0.53, 'full moon'],
      [0.72, 'waning gibbous'],
      [0.78, 'last quarter'],
      [0.97, 'waning crescent'],
      [1.01, 'new moon'],
    ];
    const name = buckets.find((b) => phase < b[0])[1];
    return `${name}, ${illum}% illuminated`;
  }

  // Vercel serverless proxy · eBird, Mushroom Observer, USA-NPN.
  // These three sources can't be called directly from the browser
  // (CORS, XML default, or API-key requirement), so site/api/nature-proxy.js
  // makes the upstream call server-side and returns normalized JSON.
  // Longer budget than the direct fetchers because the proxy may be on a
  // cold edge cache (eBird and NPN can take a few seconds upstream).
  async function fetchProxy(source, lat, lng) {
    const a = makeAbortable(5000);
    try {
      const url = `/api/nature-proxy?source=${source}&lat=${lat}&lng=${lng}`;
      const r = await fetch(url, { signal: a.signal, headers: { Accept: 'application/json' } });
      a.cancel();
      if (!r.ok) return null;
      return await r.json();
    } catch {
      a.cancel();
      return null;
    }
  }

  // Formatters return null only when the proxy itself failed (timeout,
  // network error, non-JSON response). When the proxy succeeded but the
  // upstream genuinely has no data for these coords + this season, we
  // return an honest empty-state string and the line still labels (live).
  function fmtEbird(data) {
    if (!data) return null;
    if (!data.speciesCount) return 'no recent sightings nearby';
    const hotspot = data.topHotspot ? ` near ${data.topHotspot}` : '';
    return `${data.speciesCount} bird species${hotspot} this week`;
  }
  function fmtMushroom(data) {
    if (!data) return null;
    if (!data.recentCount) return 'no recent observations nearby';
    if (data.topName) {
      return `${data.recentCount} recent observations · latest ${data.topName}`;
    }
    return `${data.recentCount} recent observations within 50km`;
  }
  function fmtNpn(data) {
    if (!data) return null;
    const events = data.activeEvents || [];
    if (!events.length) return 'no active events recorded';
    const top = events[0];
    const name = (top.common_name || top.commonName || '').toLowerCase();
    const phase = (top.phenophase || top.phenophase_description || '').toLowerCase();
    if (name && phase) return `${name}: ${phase}`;
    return `${events.length} active phenophases nearby`;
  }

  /* ── render a single line into the terminal element ── */
  // Tails starting with "<" are emitted as raw HTML so callers can apply
  // styles like .term-live; plain-text tails get the standard muted wrap.
  function buildLineHTML(line) {
    const [label, klass, body, tail] = line;
    const labelPad = pad(label, 14);
    let tailPart = '';
    if (tail) {
      tailPart = tail.startsWith('<')
        ? `  ${tail}`
        : `  <span class="muted">${tail}</span>`;
    }
    return `<span class="${klass}">${labelPad}</span>${body}${tailPart}\n`;
  }

  function buildLineText(line) {
    const [label, _k, body, tail] = line;
    return `${pad(label, 14)}${body}${tail ? '  ' + tail : ''}\n`;
  }

  /* ── typewriter ──────────────────────────────────────── */
  let activeRun = 0;

  function renderInstant(el, lines) {
    el.innerHTML = lines.map(buildLineHTML).join('');
  }

  // Stagger-reveal one whole line at a time with a blinking cursor
  // riding the active line. Total runtime ≈ lineGap × lines.length.
  function typewriter(el, lines, opts = {}) {
    activeRun += 1;
    const run = activeRun;
    const lineGap = opts.lineGap || 180;

    el.innerHTML = '';

    return new Promise((resolve) => {
      let i = 0;
      const cursor = document.createElement('span');
      cursor.className = 'tw-cursor';
      el.appendChild(cursor);

      const writeLine = () => {
        if (run !== activeRun) {
          cursor.remove();
          return resolve('cancelled');
        }
        if (i >= lines.length) {
          cursor.remove();
          return resolve('done');
        }
        const line = lines[i++];
        const span = document.createElement('span');
        span.innerHTML = buildLineHTML(line);
        el.insertBefore(span, cursor);
        setTimeout(writeLine, lineGap);
      };

      writeLine();
    });
  }

  /* ── compose final lines from baked + live results ────── */
  // Each src-* line has a baked fallback in LOCATIONS; when the matching
  // live fetch succeeds we swap in the live text + green "(... · live)"
  // tail. Failures keep the baked text and pick up an "· example" tail.
  function buildFinalLines(baked, live) {
    const liveTail = (src) => `<span class="term-live">(${src} · live)</span>`;
    return baked.map((ln) => {
      const [label, klass, body, tail] = ln;
      if (klass === 'src-garden') {
        if (live.garden) {
          return [label, klass, gardenSummary(live.garden), liveTail('cropgraph')];
        }
        return [label, klass, body, '<span class="muted">(cropgraph · example)</span>'];
      }
      if (klass === 'src-sky') {
        return [label, klass, live.moon, liveTail('local')];
      }
      if (klass === 'src-wild' && live.inat)    return [label, klass, live.inat,    liveTail('iNaturalist')];
      if (klass === 'src-tide' && live.tide)    return [label, klass, live.tide,    liveTail('NOAA')];
      if (klass === 'src-flow' && live.flow)    return [label, klass, live.flow,    liveTail('USGS')];
      if (klass === 'src-bird' && live.ebird)   return [label, klass, live.ebird,   liveTail('eBird')];
      if (klass === 'src-fungi' && live.mushroom) return [label, klass, live.mushroom, liveTail('Mushroom Obs.')];
      if (klass === 'src-pheno' && live.npn)    return [label, klass, live.npn,     liveTail('USA-NPN')];
      const exTail = tail ? tail.replace(/^\((.*)\)$/, '($1 · example)') : '(example)';
      return [label, klass, body, exTail];
    });
  }

  // Fire every live fetch in parallel; moon phase is local and synchronous.
  // Tide and flow take optional station IDs so renderCustomLocation can
  // borrow the nearest preset's stations for the user's coords.
  function fireAllLive(lat, lng, noaaStation, usgsSite) {
    return Promise.allSettled([
      fetchLiveGarden(lat, lng),       // 0
      fetchLiveINat(lat, lng),         // 1
      fetchLiveTide(noaaStation),      // 2
      fetchLiveFlow(usgsSite),         // 3
      fetchProxy('ebird', lat, lng),   // 4
      fetchProxy('mushroom', lat, lng),// 5
      fetchProxy('npn', lat, lng),     // 6
    ]);
  }
  function collectLive(settled) {
    const v = (i) => settled[i].status === 'fulfilled' ? settled[i].value : null;
    return {
      garden: v(0),
      inat: v(1),
      tide: v(2),
      flow: v(3),
      ebird: fmtEbird(v(4)),
      mushroom: fmtMushroom(v(5)),
      npn: fmtNpn(v(6)),
      moon: moonPhaseText(),
    };
  }

  /* ── compose & render for a preset location ─────────── */
  async function renderLocation(locKey, opts = {}) {
    const loc = LOCATIONS[locKey];
    if (!loc) return;

    const term = $('#terminal-output');
    const title = $('#terminal-title');
    title.textContent = `$ pondlog today --location "${loc.label}"`;

    // Fire everything before the typewriter starts so live data is usually
    // ready by the time the last line types out.
    const settledPromise = fireAllLive(loc.lat, loc.lng, loc.noaaStation, loc.usgsSite);
    const moon = moonPhaseText();

    // Placeholder pass: baked text everywhere except garden (which shows
    // a fetching status) and tonight (which is already live from local math).
    const placeholder = loc.lines.map((ln) => {
      const [label, klass, body, tail] = ln;
      if (klass === 'src-garden') {
        return [label, klass, `<span class="term-status">// fetching from api.cropgraph.com…</span>`, '(cropgraph)'];
      }
      if (klass === 'src-sky') {
        return [label, klass, moon, '<span class="term-live">(local · live)</span>'];
      }
      return [label, klass, body, tail];
    });

    if (opts.instant || prefersReducedMotion) {
      renderInstant(term, placeholder);
    } else {
      await typewriter(term, placeholder, opts);
    }

    const settled = await settledPromise;
    if (!title.textContent.includes(loc.label)) return; // user moved on

    const live = collectLive(settled);
    term.innerHTML = buildFinalLines(loc.lines, live).map(buildLineHTML).join('');
  }

  /* ── location chips ─────────────────────────────────── */
  function bindChips() {
    const chips = $$('.chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const loc = chip.dataset.loc;
        if (chip.classList.contains('is-active')) return;
        chips.forEach((c) => {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-selected', c === chip ? 'true' : 'false');
        });
        renderLocation(loc);
      });
    });
  }

  /* ── use my location ─────────────────────────────────── */
  function bindLocate() {
    const btn = $('#locate');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        showLocateError('// geolocation not supported · try a preset →');
        return;
      }

      btn.dataset.state = 'locating';
      btn.querySelector('.locate-label').textContent = 'locating…';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(3);
          const lng = pos.coords.longitude.toFixed(3);
          // deactivate chips
          $$('.chip').forEach((c) => {
            c.classList.remove('is-active');
            c.setAttribute('aria-selected', 'false');
          });
          btn.dataset.state = '';
          btn.querySelector('.locate-label').textContent = 'use my location';
          renderCustomLocation(parseFloat(lat), parseFloat(lng));
        },
        () => {
          btn.dataset.state = '';
          btn.querySelector('.locate-label').textContent = 'use my location';
          showLocateError('// permission denied · try a preset →');
        },
        { timeout: 8000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }

  function showLocateError(msg) {
    const term = $('#terminal-output');
    if (!term) return;
    const note = document.createElement('div');
    note.className = 'term-status';
    note.textContent = msg;
    term.appendChild(note);
    setTimeout(() => note.remove(), 4000);
  }

  // Find the nearest baked preset to a given lat/lng using haversine.
  // Squared euclidean on (lat, lng) under-weights longitude near the
  // equator and over-weights it near the poles, so a Florida user pulls
  // Brooklyn instead of Austin. Haversine fixes it.
  function nearestPreset(lat, lng) {
    const toRad = (d) => (d * Math.PI) / 180;
    const haversine = (a, b, c, d) => {
      const dLat = toRad(c - a);
      const dLng = toRad(d - b);
      const x = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
      return 2 * Math.asin(Math.sqrt(x)); // 6371 * (...) for km, but we
                                          // only care about ordering
    };

    let best = null;
    let bestDist = Infinity;
    for (const [key, loc] of Object.entries(LOCATIONS)) {
      const d = haversine(lat, lng, loc.lat, loc.lng);
      if (d < bestDist) { bestDist = d; best = key; }
    }
    return best;
  }

  async function renderCustomLocation(lat, lng) {
    const term = $('#terminal-output');
    const title = $('#terminal-title');
    title.textContent = `$ pondlog today --lat ${lat.toFixed(3)} --lng ${lng.toFixed(3)}`;

    // Use the nearest preset for baked fallback text and for NOAA/USGS
    // station IDs. Tide and flow are point-station data, so live results
    // come from the nearest station, not the user's exact coords. The
    // live label is still accurate: it's the real reading from that station.
    const nearest = LOCATIONS[nearestPreset(lat, lng)];
    const settledPromise = fireAllLive(lat, lng, nearest.noaaStation, nearest.usgsSite);
    const moon = moonPhaseText();

    const baked = nearest.lines.map((ln) => [...ln]);
    const placeholder = baked.map((ln) => {
      const [label, klass, body, tail] = ln;
      if (klass === 'src-garden') {
        return [label, klass, `<span class="term-status">// fetching from api.cropgraph.com…</span>`, '(cropgraph)'];
      }
      if (klass === 'src-sky') {
        return [label, klass, moon, '<span class="term-live">(local · live)</span>'];
      }
      return [label, klass, body, tail];
    });

    if (prefersReducedMotion) {
      renderInstant(term, placeholder);
    } else {
      await typewriter(term, placeholder);
    }

    const settled = await settledPromise;
    if (!title.textContent.includes(lat.toFixed(3))) return; // user moved on

    const live = collectLive(settled);
    // If the live garden fetch failed we want the example fallback to use
    // the nearest preset's baked garden data, not just plain text.
    const finalBaked = baked.map((ln) => {
      if (ln[1] === 'src-garden') {
        return [ln[0], ln[1], gardenSummary({ ...nearest.garden }), ln[3]];
      }
      return ln;
    });
    term.innerHTML = buildFinalLines(finalBaked, live).map(buildLineHTML).join('');
  }

  /* ── skip typewriter ─────────────────────────────────── */
  function bindSkip() {
    const btn = $('#skip-typewriter');
    if (!btn) return;
    btn.addEventListener('click', () => {
      activeRun += 1; // cancel any running run
      const activeChip = $('.chip.is-active');
      const loc = activeChip ? activeChip.dataset.loc : 'port-angeles';
      renderLocation(loc, { instant: true });
    });
  }

  /* ── MCP card expand ─────────────────────────────────── */
  function bindMcpCards() {
    $$('.mcp-card').forEach((card) => {
      const toggle = card.querySelector('.mcp-toggle');
      const tools = card.dataset.tools || '';
      if (!toggle) return;

      // build the tools panel once on first expand
      let panel = null;
      const ensurePanel = () => {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.className = 'mcp-tools';
        panel.textContent = tools.split(' • ').join('\n');
        card.appendChild(panel);
        return panel;
      };

      toggle.addEventListener('click', () => {
        const open = card.dataset.expanded === 'true';
        // close any other expanded card in the same grid
        if (!open) {
          $$('.mcp-card[data-expanded="true"]').forEach((c) => {
            if (c !== card) {
              c.dataset.expanded = 'false';
              c.querySelector('.mcp-toggle')?.setAttribute('aria-expanded', 'false');
            }
          });
        }
        ensurePanel();
        card.dataset.expanded = open ? 'false' : 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    });
  }

  /* ── copy install command ────────────────────────────── */
  function bindCopy() {
    $$('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy || '';
        try {
          await navigator.clipboard.writeText(text);
          btn.classList.add('is-copied');
          btn.setAttribute('aria-label', 'copied');
          setTimeout(() => {
            btn.classList.remove('is-copied');
            btn.setAttribute('aria-label', 'copy install command');
          }, 1500);
        } catch {
          // legacy fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch {}
          ta.remove();
          btn.classList.add('is-copied');
          setTimeout(() => btn.classList.remove('is-copied'), 1500);
        }
      });
    });
  }

  /* ── reveal-on-scroll ────────────────────────────────── */
  function bindReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px 600px 0px', threshold: 0 });
    els.forEach((el) => io.observe(el));

    // Safety net: anything still unrevealed after 6s gets shown.
    // Protects users on browsers that don't scroll the observer's root
    // for full-page tools (print, screenshot), and users with fast scrolls.
    setTimeout(() => {
      els.forEach((el) => el.classList.add('is-visible'));
    }, 6000);
  }

  /* ── init ────────────────────────────────────────────── */
  function init() {
    bindChips();
    bindLocate();
    bindSkip();
    bindMcpCards();
    bindCopy();
    bindReveal();

    // first render — start when the terminal scrolls into view, or
    // immediately if it's already in view at load.
    const term = $('#hero-terminal');
    if (!term) return;
    const start = () => renderLocation('port-angeles');
    const rect = term.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      start();
    } else {
      const io = new IntersectionObserver((entries, obs) => {
        if (entries.some((e) => e.isIntersecting)) {
          obs.disconnect();
          start();
        }
      });
      io.observe(term);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
