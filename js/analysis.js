/* Turns raw source responses into measured quantities. Pure functions, no DOM.
   Every quantity returned here is either a direct count/measure of the source data
   inside the study area, or an explicitly labelled estimate. Nothing is filled in. */
(function (root) {
  const G = (typeof module !== 'undefined' && module.exports) ? require('./geo.js') : root.GA.geo;

  // ---------- OSM / Overpass parsing ----------
  function llList(geom) { return (geom || []).filter(Boolean).map(g => [g.lon, g.lat]); }
  function isClosed(c) { return c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1]; }

  // Join open way segments into closed rings (multipolygon members).
  function joinRings(lines) {
    const rings = []; let pool = lines.map(l => l.slice());
    while (pool.length) {
      let cur = pool.shift(); let grew = true;
      while (!isClosed(cur) && grew) {
        grew = false;
        for (let i = 0; i < pool.length; i++) {
          const s = pool[i], a = cur[cur.length - 1], b = cur[0];
          const eq = (p, q) => p[0] === q[0] && p[1] === q[1];
          if (eq(a, s[0])) cur = cur.concat(s.slice(1));
          else if (eq(a, s[s.length - 1])) cur = cur.concat(s.slice(0, -1).reverse());
          else if (eq(b, s[s.length - 1])) cur = s.concat(cur.slice(1));
          else if (eq(b, s[0])) cur = s.slice().reverse().concat(cur.slice(1));
          else continue;
          pool.splice(i, 1); grew = true; break;
        }
      }
      if (isClosed(cur)) rings.push(cur);
    }
    return rings;
  }

  const LINEAR_HIGHWAY_AREA = { pedestrian: 1, footway: 1 };
  function isAreaTagged(t) {
    if (t.area === 'yes') return true;
    if (t.highway && !(t.area === 'yes' && LINEAR_HIGHWAY_AREA[t.highway])) return false;
    return !!(t.building || t.landuse || t.leisure || t.natural || t.amenity || t.tourism || t.historic || t.shop || t.waterway === 'riverbank' || t.place || t.man_made);
  }

  function parseOverpass(json) {
    const byKey = new Map();
    (json.elements || []).forEach(e => {
      const k = e.type + '/' + e.id; const prev = byKey.get(k);
      const hasGeom = !!(e.geometry || e.members || e.lat != null);
      if (!prev || (hasGeom && !(prev.geometry || prev.members))) byKey.set(k, Object.assign({}, prev || {}, e));
    });
    const out = { buildings: [], streets: [], areas: [], pois: [], admin: [], osmBase: (json.osm3s && json.osm3s.timestamp_osm_base) || null };
    byKey.forEach(e => {
      const t = e.tags || {};
      if (e.type === 'area') { out.admin.push(t); return; }
      let point = null, outers = [], inners = [], line = null;
      if (e.type === 'node') point = [e.lon, e.lat];
      else if (e.type === 'way') {
        if (e.geometry) {
          const c = llList(e.geometry);
          if (isClosed(c) && isAreaTagged(t)) outers = [c]; else line = c;
          point = G.centroidLL(c);
        } else if (e.center) point = [e.center.lon, e.center.lat];
      } else if (e.type === 'relation') {
        if (e.members) {
          const o = [], i = [];
          e.members.forEach(m => { if (m.type === 'way' && m.geometry) (m.role === 'inner' ? i : o).push(llList(m.geometry)); });
          outers = joinRings(o); inners = joinRings(i);
          if (outers[0]) point = G.centroidLL(outers[0]);
        } else if (e.center) point = [e.center.lon, e.center.lat];
      }
      const id = e.type + '/' + e.id;
      if (t.building && t.building !== 'no' && outers.length) out.buildings.push({ id, outers, inners, tags: t });
      if (t.highway && line) out.streets.push({ id, coords: line, tags: t });
      if (outers.length && !t.building && (t.landuse || t.leisure || t.natural || t.amenity || t.waterway || t.tourism)) out.areas.push({ id, outers, inners, tags: t });
      if (point && (t.amenity || t.shop || t.tourism || t.historic || t.heritage || t.public_transport || t.highway === 'bus_stop' || t.railway || t.leisure || t.office || t.craft))
        out.pois.push({ id, pt: point, tags: t, isArea: outers.length > 0 });
    });
    return out;
  }

  // ---------- Classification ----------
  const PUBLIC = {
    education: ['school', 'kindergarten', 'college', 'university', 'childcare', 'language_school', 'music_school'],
    health: ['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist', 'health_post'],
    civic: ['townhall', 'courthouse', 'police', 'fire_station', 'post_office', 'public_building'],
    social: ['community_centre', 'social_facility', 'social_centre', 'library', 'arts_centre', 'theatre', 'cinema'],
    market: ['marketplace'],
  };
  const PUBLIC_LOOKUP = {}; Object.keys(PUBLIC).forEach(k => PUBLIC[k].forEach(v => PUBLIC_LOOKUP[v] = k));
  const EVERYDAY_SHOPS = ['supermarket', 'convenience', 'bakery', 'butcher', 'greengrocer', 'hairdresser', 'hardware', 'kiosk', 'newsagent', 'laundry', 'dry_cleaning', 'optician', 'doityourself', 'chemist', 'frozen_food', 'seafood', 'deli', 'beverages', 'tobacco', 'stationery', 'florist', 'pastry', 'confectionery', 'variety_store', 'mobile_phone', 'shoes', 'clothes'];
  const TOURISM_STAY = ['hotel', 'hostel', 'guest_house', 'apartment', 'motel', 'chalet'];
  const TOURISM_SIGHT = ['attraction', 'museum', 'viewpoint', 'gallery', 'information', 'artwork'];
  const FOOD = ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'biergarten'];
  const GREEN_LEISURE = ['park', 'garden', 'playground', 'pitch', 'sports_centre', 'nature_reserve', 'recreation_ground', 'dog_park', 'fitness_station'];

  function poiCategory(t) {
    if (t.amenity && PUBLIC_LOOKUP[t.amenity]) return 'public:' + PUBLIC_LOOKUP[t.amenity];
    if (t.amenity === 'place_of_worship') return 'worship';
    if (t.highway === 'bus_stop' || (t.public_transport === 'platform' && (t.bus === 'yes' || !t.railway))) return 'transit:bus';
    if (t.railway && /^(station|tram_stop|halt|subway_entrance)$/.test(t.railway)) return 'transit:rail';
    if (t.tourism && TOURISM_STAY.includes(t.tourism)) return 'tourism:stay';
    if (t.tourism && TOURISM_SIGHT.includes(t.tourism)) return 'tourism:sight';
    if (t.shop === 'souvenir' || t.shop === 'gift') return 'tourism:souvenir';
    if (t.amenity && FOOD.includes(t.amenity)) return 'food';
    if (t.shop && EVERYDAY_SHOPS.includes(t.shop)) return 'everyday';
    if (t.shop) return 'shop:other';
    if (t.leisure && GREEN_LEISURE.includes(t.leisure)) return 'green';
    if (t.historic || t.heritage) return 'heritage';
    if (t.office) return 'office';
    if (t.craft) return 'craft';
    return null;
  }

  // Land-use classes, in priority order (first match wins where polygons overlap).
  const LU_ORDER = ['public', 'religious', 'water', 'green', 'cemetery', 'agri', 'commercial', 'industrial', 'construction', 'residential'];
  function luCategory(t) {
    if ((t.amenity && PUBLIC_LOOKUP[t.amenity]) || t.landuse === 'education' || t.landuse === 'institutional') return 'public';
    if (t.landuse === 'religious' || t.amenity === 'place_of_worship') return 'religious';
    if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin') return 'water';
    if ((t.leisure && GREEN_LEISURE.includes(t.leisure)) || /^(grass|recreation_ground|village_green|forest|meadow)$/.test(t.landuse || '') || /^(wood|scrub|grassland|heath)$/.test(t.natural || '')) return 'green';
    if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') return 'cemetery';
    if (/^(farmland|orchard|vineyard|farmyard|allotments|greenhouse_horticulture|plant_nursery)$/.test(t.landuse || '')) return 'agri';
    if (t.landuse === 'commercial' || t.landuse === 'retail') return 'commercial';
    if (t.landuse === 'industrial' || t.landuse === 'railway') return 'industrial';
    if (/^(construction|brownfield|greenfield)$/.test(t.landuse || '')) return 'construction';
    if (t.landuse === 'residential') return 'residential';
    return null;
  }

  function streetTier(t) {
    const h = t.highway;
    if (/^(motorway|trunk|primary)(_link)?$/.test(h)) return 'primary';
    if (/^(secondary|tertiary)(_link)?$/.test(h)) return 'collector';
    if (/^(residential|unclassified|living_street|service|road)$/.test(h)) return 'local';
    if (/^(pedestrian|footway|steps|path|cycleway|track|bridleway|corridor)$/.test(h)) return 'pedestrian';
    return null;
  }

  function levelBand(n) { return n <= 2 ? '1-2' : n <= 4 ? '3-4' : n <= 8 ? '5-8' : '9+'; }
  // Stable period codes (also used as GIS attribute values)
  const PERIODS = [[0, 1899, 'pre_1900'], [1900, 1939, '1900_1939'], [1940, 1959, '1940_1959'], [1960, 1979, '1960_1979'], [1980, 1999, '1980_1999'], [2000, 9999, '2000_plus']];
  function periodOf(y) { const p = PERIODS.find(p => y >= p[0] && y <= p[1]); return p ? p[2] : null; }
  function parseYear(s) { const m = String(s || '').match(/(1[0-9]{3}|20[0-9]{2})/); return m ? +m[1] : null; }

  function inPoly(pt, ring, bb) { return G.inBBox(pt, bb) && G.pointInRing(pt, ring); }
  function inFeature(pt, f) { return f.outers.some(o => G.pointInRing(pt, o)) && !f.inners.some(i => G.pointInRing(pt, i)); }
  function featArea(f) { return f.outers.reduce((s, o) => s + G.ringArea(o), 0) - f.inners.reduce((s, i) => s + G.ringArea(i), 0); }

  // ---------- Main OSM metrics ----------
  function osmMetrics(parsed, ring) {
    const bb = G.bbox(ring), selArea = G.ringArea(ring);
    // Buildings: counted when the footprint centroid falls inside the selection.
    const B = parsed.buildings.map(b => ({ b, c: G.centroidLL(b.outers[0]), a: featArea(b) })).filter(x => inPoly(x.c, ring, bb));
    const bands = { '1-2': 0, '3-4': 0, '5-8': 0, '9+': 0 }, bandArea = { '1-2': 0, '3-4': 0, '5-8': 0, '9+': 0 };
    const periods = {}; PERIODS.forEach(p => periods[p[2]] = 0);
    let levelsTagged = 0, levelsSum = 0, startTagged = 0, heightTagged = 0, roofShape = 0, footprint = 0;
    const types = {};
    const features = [];
    B.forEach(({ b, a }) => {
      footprint += a; const t = b.tags;
      const lv = parseFloat(t['building:levels']);
      let band = null;
      if (isFinite(lv) && lv > 0) { levelsTagged++; levelsSum += lv; band = levelBand(lv); bands[band]++; bandArea[band] += a; }
      if (t.height) heightTagged++;
      if (t['roof:shape']) roofShape++;
      const y = parseYear(t.start_date || t['building:start_date']); let period = null;
      if (y) { startTagged++; period = periodOf(y); if (period) periods[period]++; }
      types[t.building] = (types[t.building] || 0) + 1;
      features.push({ type: 'Feature', properties: { band: band || 'no_data', levels: isFinite(lv) ? lv : null, period: period || 'no_data', btype: t.building, name: t.name || '' }, geometry: { type: 'Polygon', coordinates: [G.closeRing(b.outers[0])].concat(b.inners.map(G.closeRing)) } });
    });

    // Streets
    const tiers = { primary: 0, collector: 0, local: 0, pedestrian: 0 }; const streetFeatures = [];
    parsed.streets.forEach(s => {
      const tier = streetTier(s.tags); if (!tier) return;
      const L = G.lengthInside(s.coords, ring, 5, bb); if (L <= 0) return;
      tiers[tier] += L; streetFeatures.push({ type: 'Feature', properties: { tier, name: s.tags.name || '', highway: s.tags.highway }, geometry: { type: 'LineString', coordinates: s.coords } });
    });
    const streetTotal = Object.values(tiers).reduce((a, b) => a + b, 0);

    // Land use via grid sampling
    const grid = G.gridSample(ring, 15000);
    const luFeats = parsed.areas.map(f => ({ f, cat: luCategory(f.tags), bb: G.bbox(f.outers.flat()) })).filter(x => x.cat);
    luFeats.sort((a, b) => LU_ORDER.indexOf(a.cat) - LU_ORDER.indexOf(b.cat));
    const lu = {}; LU_ORDER.forEach(k => lu[k] = 0); let unclassified = 0;
    grid.points.forEach(p => {
      const hit = luFeats.find(x => G.inBBox(p, x.bb) && inFeature(p, x.f));
      if (hit) lu[hit.cat] += grid.cellArea; else unclassified += grid.cellArea;
    });
    const sampled = grid.points.length * grid.cellArea || 1, scale = selArea / sampled; // rescale to exact selection area
    Object.keys(lu).forEach(k => lu[k] *= scale); unclassified *= scale;
    const luGeo = luFeats.filter(x => x.f.outers.some(o => o.some(p => inPoly(p, ring, bb))) || inFeature(G.centroidLL(ring), x.f))
      .map(x => ({ type: 'Feature', properties: { cat: x.cat, name: x.f.tags.name || '' }, geometry: { type: 'Polygon', coordinates: [G.closeRing(x.f.outers[0])] } }));

    // POIs (nodes + polygon centroids)
    const seen = new Set(); const cats = {}; const lists = {}; const poiFeatures = [];
    parsed.pois.forEach(p => {
      if (seen.has(p.id) || !inPoly(p.pt, ring, bb)) return; seen.add(p.id);
      const c = poiCategory(p.tags); if (!c) return;
      cats[c] = (cats[c] || 0) + 1;
      (lists[c] = lists[c] || []).push({ name: p.tags.name || null, kind: p.tags.amenity || p.tags.tourism || p.tags.shop || p.tags.leisure || p.tags.historic || p.tags.railway || p.tags.highway || '', id: p.id });
      poiFeatures.push({ type: 'Feature', properties: { cat: c.split(':')[0], sub: c, name: p.tags.name || '' }, geometry: { type: 'Point', coordinates: p.pt } });
    });
    const parks = parsed.areas.filter(f => luCategory(f.tags) === 'green' && f.tags.name && (inPoly(G.centroidLL(f.outers[0]), ring, bb) || f.outers[0].some(p => inPoly(p, ring, bb))))
      .map(f => ({ name: f.tags.name, kind: f.tags.leisure || f.tags.landuse || f.tags.natural, area: featArea(f) }));

    const adminLevels = parsed.admin.filter(t => t.admin_level).map(t => ({ level: +t.admin_level, name: t.name, nameEs: t['name:es'] || t.name })).sort((a, b) => a.level - b.level);

    return {
      selArea,
      buildings: {
        count: B.length, footprint, gsi: footprint / selArea,
        levelsTagged, levelsCoverage: B.length ? levelsTagged / B.length : 0, meanLevelsTagged: levelsTagged ? levelsSum / levelsTagged : null,
        bands, bandArea, heightTagged, roofShape,
        startTagged, startCoverage: B.length ? startTagged / B.length : 0, periods,
        types: Object.entries(types).sort((a, b) => b[1] - a[1]),
        // Gross floor area only from tagged levels, and only when coverage is high enough to be meaningful.
        floorAreaTagged: B.reduce((s, x) => { const lv = parseFloat(x.b.tags['building:levels']); return isFinite(lv) && lv > 0 ? s + x.a * lv : s; }, 0),
      },
      streets: { tiers, total: streetTotal, density: (streetTotal / 1000) / (selArea / 1e6) },
      landuse: { areas: lu, unclassified, cell: grid.cell },
      pois: { cats, lists, parks },
      admin: adminLevels,
      geo: { buildings: { type: 'FeatureCollection', features }, streets: { type: 'FeatureCollection', features: streetFeatures }, landuse: { type: 'FeatureCollection', features: luGeo }, pois: { type: 'FeatureCollection', features: poiFeatures } },
    };
  }

  // ---------- Terrain profile ----------
  function profileMetrics(points, elevations) {
    if (!elevations || !elevations.length) return null;
    const dist = [0]; for (let i = 1; i < points.length; i++) dist.push(dist[i - 1] + G.haversine(points[i - 1], points[i]));
    let maxSlope = 0; for (let i = 1; i < elevations.length; i++) { const run = dist[i] - dist[i - 1]; if (run > 0) maxSlope = Math.max(maxSlope, Math.abs(elevations[i] - elevations[i - 1]) / run); }
    const min = Math.min(...elevations), max = Math.max(...elevations);
    return { dist, elev: elevations, min, max, relief: max - min, maxSlopePct: maxSlope * 100, length: dist[dist.length - 1] };
  }

  // ---------- Climate (daily reanalysis series) ----------
  function climateMetrics(d) {
    if (!d || !d.daily || !d.daily.time) return null;
    const T = d.daily.time, tmax = d.daily.temperature_2m_max, tmin = d.daily.temperature_2m_min, pr = d.daily.precipitation_sum;
    const months = Array.from({ length: 12 }, () => ({ max: [], min: [], p: 0 }));
    let hot35 = 0, trop20 = 0, precip = 0, valid = 0;
    T.forEach((t, i) => {
      const m = +t.slice(5, 7) - 1;
      if (tmax[i] != null) { months[m].max.push(tmax[i]); if (tmax[i] >= 35) hot35++; valid++; }
      if (tmin[i] != null) { months[m].min.push(tmin[i]); if (tmin[i] >= 20) trop20++; }
      if (pr[i] != null) { months[m].p += pr[i]; precip += pr[i]; }
    });
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return { year: T[0].slice(0, 4), days: valid, hot35, trop20, precip, monthly: months.map(m => ({ max: avg(m.max), min: avg(m.min), p: m.p })), gridLat: d.latitude, gridLon: d.longitude, elevation: d.elevation };
  }

  // Flat numeric snapshot used to detect what changed after a data refresh.
  function snapshot(r) {
    const s = {};
    if (r.osm) {
      const o = r.osm; s['buildings.count'] = o.buildings.count; s['buildings.gsi'] = +o.buildings.gsi.toFixed(4);
      s['buildings.levelsCoverage'] = +o.buildings.levelsCoverage.toFixed(3); s['streets.total'] = Math.round(o.streets.total);
      Object.keys(o.pois.cats).forEach(k => s['pois.' + k] = o.pois.cats[k]);
      Object.keys(o.landuse.areas).forEach(k => s['landuse.' + k] = Math.round(o.landuse.areas[k] / 100) * 100);
    }
    if (r.profile) s['terrain.relief'] = Math.round(r.profile.relief);
    if (r.climate) s['climate.hot35'] = r.climate.hot35;
    if (r.photos) s['photos.count'] = r.photos.length;
    return s;
  }
  function diff(prev, next) {
    const changed = [];
    Object.keys(Object.assign({}, prev, next)).forEach(k => { if (prev[k] !== next[k]) changed.push({ key: k, from: prev[k], to: next[k] }); });
    return changed;
  }

  const api = { parseOverpass, osmMetrics, featArea, inFeature, parseYear, periodOf, profileMetrics, climateMetrics, snapshot, diff, poiCategory, luCategory, streetTier, levelBand, LU_ORDER, PERIODS: PERIODS.map(p => p[2]) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.analysis = api; }
})(typeof window !== 'undefined' ? window : globalThis);
