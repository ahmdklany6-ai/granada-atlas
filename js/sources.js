/* Live data connections. Every call runs at analysis time from the user's browser.
   All sources here are keyless and CORS-enabled; none requires payment.
   Sources that need keys or a server proxy are listed in SOURCE_REGISTRY with status 'planned'. */
(function (root) {
  const G = root.GA.geo; const T = (k, v) => root.GA.i18n.t(k, v);

  async function fetchJSON(url, opts) {
    opts = opts || {}; const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 30000);
    try {
      const res = await fetch(url, { method: opts.method || 'GET', body: opts.body, headers: opts.headers, signal: ctrl.signal });
      if (!res.ok) { const err = new Error(T('err.http', { v: res.status })); err.status = res.status; throw err; }
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(T('err.timeout'));
      if (e instanceof TypeError) throw new Error(T('err.network'));
      throw e;
    } finally { clearTimeout(timer); }
  }

  const today = () => new Date().toISOString().slice(0, 10);

  // ---- OpenStreetMap via Overpass API (with mirror fallback) ----
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

  function polyString(ring) {
    let r = G.openRing(ring); const step = Math.max(1, Math.ceil(r.length / 80));
    r = r.filter((_, i) => i % step === 0);
    return r.map(p => p[1].toFixed(6) + ' ' + p[0].toFixed(6)).join(' ');
  }
  function overpassQuery(ring, center) {
    const P = 'poly:"' + polyString(ring) + '"';
    return `[out:json][timeout:60];
(way["building"](${P});relation["building"](${P}););out geom;
way["highway"](${P});out geom;
(way["landuse"](${P});relation["landuse"](${P});way["leisure"](${P});relation["leisure"](${P});
 way["natural"~"water|wood|scrub|grassland|heath"](${P});relation["natural"~"water|wood|scrub|grassland"](${P});
 way["amenity"](${P});relation["amenity"](${P});way["waterway"="riverbank"](${P});way["tourism"](${P});way["historic"](${P}););out geom;
(node["amenity"](${P});node["shop"](${P});node["tourism"](${P});node["historic"](${P});node["heritage"](${P});
 node["highway"="bus_stop"](${P});node["public_transport"="platform"](${P});node["railway"~"^(station|tram_stop|halt|subway_entrance)$"](${P});
 node["leisure"](${P});node["office"](${P});node["craft"](${P});way["shop"](${P});way["office"](${P}););out center tags;
is_in(${center[1].toFixed(6)},${center[0].toFixed(6)})->.c;area.c["boundary"="administrative"];out tags;`;
  }
  async function overpass(ring, center, onAttempt) {
    const body = 'data=' + encodeURIComponent(overpassQuery(ring, center)); let lastErr;
    for (const ep of OVERPASS) {
      try {
        onAttempt && onAttempt(ep);
        const json = await fetchJSON(ep, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 75000 });
        if (json.remark && /runtime error|timed out/i.test(json.remark)) throw new Error(json.remark);
        return { json, endpoint: ep };
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  // ---- Terrain: Open-Meteo Elevation API (Copernicus DEM GLO-90) ----
  async function elevation(points) {
    const lat = points.map(p => p[1].toFixed(5)).join(','), lon = points.map(p => p[0].toFixed(5)).join(',');
    const j = await fetchJSON(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, { timeout: 20000 });
    return j.elevation;
  }

  // ---- Climate: Open-Meteo Historical Weather API (ERA5 reanalysis) for the last full year ----
  async function climate(center) {
    const y = new Date().getFullYear() - 1;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${center[1].toFixed(4)}&longitude=${center[0].toFixed(4)}&start_date=${y}-01-01&end_date=${y}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FMadrid`;
    return { json: await fetchJSON(url, { timeout: 30000 }), url };
  }

  // ---- Photographs: Wikimedia Commons geosearch with licence metadata ----
  function stripHtml(s) { const d = document.createElement('div'); d.innerHTML = s || ''; return (d.textContent || '').trim(); }
  // Camera position and depicted place are kept apart: Commons stores the camera location
  // ({{Location}}) as the primary coordinate and an object location ({{Object location}}) as a
  // second coordinate when both exist. With a single coordinate of unstated type we do not
  // guess which one it is.
  async function commons(center, radius, ring) {
    const r = Math.min(10000, Math.max(50, Math.round(radius)));
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggsnamespace=6&ggscoord=${center[1]}|${center[0]}&ggsradius=${r}&ggslimit=80&prop=imageinfo|coordinates&coprimary=all&coprop=type|name|dim&colimit=max&iiprop=url|extmetadata|mime&iiurlwidth=480`;
    const j = await fetchJSON(url, { timeout: 25000 });
    if (j.error) throw new Error('Wikimedia Commons: ' + (j.error.info || j.error.code)); // API errors arrive with HTTP 200
    const pages = Object.values((j.query && j.query.pages) || {});
    return pages.map(p => {
      const ii = (p.imageinfo || [])[0] || {}, md = ii.extmetadata || {}; const cs = p.coordinates || [];
      const ll = (c) => c ? [c.lon, c.lat] : null;
      let cam = cs.find(c => /camera/i.test(c.type || '')), obj = cs.find(c => /object/i.test(c.type || ''));
      const prim = cs.find(c => c.primary !== undefined), sec = cs.find(c => c.primary === undefined);
      if (!cam && !obj && prim && sec) { cam = prim; obj = sec; }
      const single = !cam && !obj && cs.length ? cs[0] : null;
      const camera = ll(cam), depicted = ll(obj), loc = ll(single);
      const pt = camera || depicted || loc;
      return {
        id: 'commons:' + p.pageid, title: (p.title || '').replace(/^File:/, ''), thumb: ii.thumburl, page: ii.descriptionurl, mime: ii.mime,
        author: stripHtml(md.Artist && md.Artist.value), license: stripHtml(md.LicenseShortName && md.LicenseShortName.value), licenseUrl: md.LicenseUrl && md.LicenseUrl.value,
        date: stripHtml(md.DateTimeOriginal && md.DateTimeOriginal.value) || stripHtml(md.DateTime && md.DateTime.value), dateKind: md.DateTimeOriginal ? 'taken' : 'uploaded', pt,
        camera, depicted, locUnknownKind: !!loc,
        inside: pt ? G.pointInRing(pt, ring) : false, cameraInside: camera ? G.pointInRing(camera, ring) : null, depictedInside: depicted ? G.pointInRing(depicted, ring) : null,
      };
    }).filter(x => x.thumb && /^image\/(jpeg|png|webp|tiff)/.test(x.mime || 'image/jpeg'));
  }

  // ---- Articles: Wikipedia geosearch (es, en, ar) ----
  async function wikipedia(center, radius) {
    const r = Math.min(10000, Math.max(50, Math.round(radius))); const out = [];
    const errors = [];
    for (const lang of ['es', 'en', 'ar']) {
      try {
        const j = await fetchJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=geosearch&gscoord=${center[1]}|${center[0]}&gsradius=${r}&gslimit=15`, { timeout: 15000 });
        if (j.error) throw new Error(j.error.info || j.error.code); // the API reports errors (e.g. "too busy") with HTTP 200
        ((j.query && j.query.geosearch) || []).forEach(g => out.push({ lang, title: g.title, dist: g.dist, url: `https://${lang}.wikipedia.org/?curid=${g.pageid}`, pt: [g.lon, g.lat] }));
      } catch (e) { errors.push(lang + ': ' + e.message); } // one language failing does not block the others
    }
    if (errors.length === 3) throw new Error(T('err.wiki', { v: errors[0] }));
    out.partialErrors = errors;
    return out;
  }

  // ---- Research candidates: OpenAlex (no key; results are search hits, not verified relevance) ----
  async function openalex(terms) {
    const q = encodeURIComponent(terms.filter(Boolean).join(' '));
    const j = await fetchJSON(`https://api.openalex.org/works?search=${q}&per-page=10&sort=relevance_score:desc&select=id,display_name,publication_year,doi,primary_location,open_access,authorships`, { timeout: 20000 });
    return (j.results || []).map(w => ({
      title: w.display_name, year: w.publication_year, doi: w.doi, url: w.doi || w.id, oa: w.open_access && w.open_access.is_oa,
      venue: w.primary_location && w.primary_location.source && w.primary_location.source.display_name,
      authors: (w.authorships || []).slice(0, 3).map(a => a.author && a.author.display_name).filter(Boolean).join(', '),
    }));
  }

  // Registry shown in the status panel: what is connected now and what is planned.
  const SOURCE_REGISTRY = [
    { name: 'OpenStreetMap · Overpass API', status: 'live', use: 'reg.osm', license: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright' },
    { name: 'OpenFreeMap (OpenMapTiles)', status: 'live', use: 'reg.ofm', license: 'OSM ODbL · OpenMapTiles', url: 'https://openfreemap.org' },
    { name: 'Open-Meteo Elevation · Copernicus DEM GLO-90', status: 'live', use: 'reg.elev', license: 'CC BY 4.0', url: 'https://open-meteo.com/en/docs/elevation-api' },
    { name: 'Open-Meteo Historical · ERA5', status: 'live', use: 'reg.era5', license: 'CC BY 4.0', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
    { name: 'Wikimedia Commons', status: 'live', use: 'reg.commons', license: '—', url: 'https://commons.wikimedia.org' },
    { name: 'Wikipedia (es/en/ar)', status: 'live', use: 'reg.wiki', license: 'CC BY-SA', url: 'https://www.wikipedia.org' },
    { name: 'OpenAlex', status: 'live', use: 'reg.openalex', note: 'reg.openalexNote', license: 'CC0', url: 'https://openalex.org' },
    { name: 'Catastro INSPIRE (Edificios BU)', status: 'planned', use: 'reg.catastro', note: 'reg.catastroNote', url: 'https://www.catastro.hacienda.gob.es/webinspire/index.html' },
    { name: 'IGN MDT25 (terrain, supplied)', status: 'live', use: 'reg.mdt', license: 'CC BY 4.0', url: 'https://centrodedescargas.cnig.es/' },
    { name: 'OpenStreetMap extract (supplied, 23 Oct 2026) + Overpass facilities snapshot (30 Oct 2026)', status: 'live', use: 'reg.osmLocal', license: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright' },
    { name: 'Google Street View (link-out only)', status: 'live', use: 'reg.sv', note: 'reg.svNote', license: 'Google Maps Terms', url: 'https://developers.google.com/maps/documentation/urls/get-started' },
    { name: 'Google Maps Platform (Street View Static / Places Photos)', status: 'planned', key: true, use: 'reg.gmp', note: 'reg.gmpNote', url: 'https://developers.google.com/maps/documentation/streetview/overview' },
    { name: 'GTFS · Granada city bus (NAP)', status: 'planned', key: true, use: 'reg.gtfs', note: 'reg.gtfsNote', url: 'https://mobilitydatabase.org/feeds/gtfs/mdb-2769' },
    { name: 'INE · secciones censales', status: 'planned', use: 'reg.ine', note: 'reg.ineNote', url: 'https://www.ine.es' },
    { name: 'GHSL (GHS-POP / GHS-BUILT-S)', status: 'planned', use: 'reg.ghsl', note: 'reg.ghslNote', url: 'https://human-settlement.emergency.copernicus.eu/download.php' },
    { name: 'Landsat · LST', status: 'planned', use: 'reg.lst', note: 'reg.lstNote', url: 'https://www.usgs.gov/landsat-missions' },
  ];

  root.GA = root.GA || {};
  root.GA.sources = { fetchJSON, overpass, overpassQuery, elevation, climate, commons, wikipedia, openalex, today, SOURCE_REGISTRY };
})(window);
