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

  /* ── render a single line into the terminal element ── */
  function buildLineHTML(line) {
    const [label, klass, body, tail] = line;
    const labelPad = pad(label, 14);
    const tailPart = tail ? `  <span class="muted">${tail}</span>` : '';
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

  /* ── compose & render for a location ────────────────── */
  async function renderLocation(locKey, opts = {}) {
    const loc = LOCATIONS[locKey];
    if (!loc) return;

    const term = $('#terminal-output');
    const title = $('#terminal-title');
    title.textContent = `$ pondlog today --location "${loc.label}"`;

    // Kick off the live garden fetch in parallel with the typewriter.
    const gardenPromise = fetchLiveGarden(loc.lat, loc.lng);

    // Build the line list with a placeholder for the garden line.
    const lines = loc.lines.map((ln) => [...ln]);
    const gardenIdx = lines.findIndex((ln) => ln[1] === 'src-garden');
    lines[gardenIdx] = [
      '🌱 Garden', 'src-garden',
      `<span class="term-status">// fetching from api.cropgraph.com…</span>`,
      '(cropgraph)',
    ];

    if (opts.instant || prefersReducedMotion) {
      renderInstant(term, lines);
    } else {
      // Wait for the typewriter to fully complete before swapping.
      await typewriter(term, lines, opts);
    }

    // Resolve garden data and rewrite the garden line in place.
    const live = await gardenPromise;
    const garden = live || { ...loc.garden, live: false };
    const tail = live
      ? '<span class="term-live">(live · cropgraph)</span>'
      : '<span class="muted">(example · cropgraph)</span>';

    // Only update if this is still the active run (chip clicks during
    // the fetch could have moved on to another location).
    if (term && title.textContent.includes(loc.label)) {
      const labelPad = pad('🌱 Garden', 14);
      const finalHTML = lines.map((ln, idx) => {
        if (idx !== gardenIdx) return buildLineHTML(ln);
        return `<span class="src-garden">${labelPad}</span>${gardenSummary(garden)}  ${tail}\n`;
      }).join('');
      term.innerHTML = finalHTML;
    }
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

    const gardenPromise = fetchLiveGarden(lat, lng);

    // Borrow the nearest preset's nature data as realistic illustration.
    // Each non-live line gets an "· example" tag so visitors know it's
    // not actually queried for their coordinates. The garden line is
    // always live for the user's real lat/lng.
    const nearest = LOCATIONS[nearestPreset(lat, lng)];
    const placeholder = nearest.lines.map((ln) => {
      const [label, klass, body, tail] = ln;
      if (klass === 'src-garden') {
        return [label, klass, `<span class="term-status">// fetching from api.cropgraph.com…</span>`, '(cropgraph)'];
      }
      // Tonight is computed locally so it's actually accurate.
      if (klass === 'src-sky') {
        return [label, klass, body, tail];
      }
      const exTail = tail ? tail.replace(/^\((.*)\)$/, '($1 · example)') : '(example)';
      return [label, klass, body, exTail];
    });

    if (prefersReducedMotion) {
      renderInstant(term, placeholder);
    } else {
      await typewriter(term, placeholder);
    }

    const live = await gardenPromise;
    const gardenIdx = placeholder.findIndex((ln) => ln[1] === 'src-garden');
    const labelPad = pad('🌱 Garden', 14);

    if (!title.textContent.includes(lat.toFixed(3))) return; // user moved on

    if (!live) {
      // Fall back to the nearest preset's baked garden data.
      const fallback = { ...nearest.garden };
      term.innerHTML = placeholder.map((ln, i) => {
        if (i !== gardenIdx) return buildLineHTML(ln);
        return `<span class="src-garden">${labelPad}</span>${gardenSummary(fallback)}  <span class="muted">(cropgraph · example)</span>\n`;
      }).join('');
      return;
    }

    const tail = '<span class="term-live">(live · cropgraph)</span>';
    term.innerHTML = placeholder.map((ln, i) => {
      if (i !== gardenIdx) return buildLineHTML(ln);
      return `<span class="src-garden">${labelPad}</span>${gardenSummary(live)}  ${tail}\n`;
    }).join('');
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
