/* Build 5.33 — the two train pictograms of the southern axis, drawn here (original flat SVG, no copied images):
   'tram'  — an early-20th-century electric tram seen from the side: boxy car, clerestory roof, trolley pole, two wheels;
   'metro' — a modern light-rail car: long low body, rounded nose, window band, pantograph, two bogies.
   Each takes the colour of its line from GA.palette.south (tram = the 1931 line, metro = the extension) and has a white
   halo (stroke under the fill) so it reads over the basemap and the air-base fill. ONE definition serves the map image
   (map.addImage at 2×), the Layers / map legend, the tour legend and the popups — never drawn twice.
   Placement (where the owner marked it): the tram on the 1931 trunk line just north-east of Armilla (towards Granada),
   the metro on the extension's track near its Armilla end (the current terminus), both moved along the line so they do
   not sit on the line ends (AT below), the station circle or the town name. */
(function (root) {
  // 5.44 (owner, with two reference photos as inspiration only): an old steam locomotive for the 1931 line and a modern
  // high-speed train for the metro, drawn here as original flat pictograms; 50 % larger than 5.43 (69 px wide from zoom 14)
  const W = 69, H = 38, R = 2; // on-screen size (px) at zoom ≥ 14 on a white badge; images are made at 2×
  const VB = '-3 -3 54 30';
  const C = () => root.GA.palette.south;
  // the white badge with a border in the line's colour, so the pictogram reads on any basemap
  const badge = (c) => `<rect x="-2.2" y="-2.2" width="52.4" height="28.4" rx="5" fill="#FFFFFF" stroke="${c}" stroke-width="1.6"/>`;
  function svg(kind) {
    const c = kind === 'tram' ? C().tram : C().metro, w = '#FFFFFF', open = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * R}" height="${H * R}" viewBox="${VB}">` + badge(c);
    if (kind === 'tram') { const sm = C().smoke; // old steam locomotive, facing left
      return open
        + `<circle cx="17" cy="1.6" r="2.4" fill="${sm}"/><circle cx="21.5" cy="0.6" r="2.9" fill="${sm}"/><circle cx="26.6" cy="1.2" r="2.2" fill="${sm}"/>` // smoke
        + `<path d="M11.2 9.2 L11.8 5 L10.4 3.4 L16.6 3.4 L15.2 5 L15.8 9.2 Z" fill="${c}"/>` // flared chimney
        + `<rect x="20.5" y="6.2" width="4.6" height="3.6" rx="1.8" fill="${c}"/>` // steam dome
        + `<rect x="8.6" y="9" width="25" height="8.6" rx="4.3" fill="${c}"/>` // boiler
        + `<circle cx="9.4" cy="13.3" r="1.5" fill="${w}"/>` // headlamp / smokebox door
        + `<rect x="31.5" y="4.6" width="13" height="2.2" rx="0.8" fill="${c}"/><rect x="33" y="6" width="10.5" height="11.6" fill="${c}"/><rect x="35.6" y="8" width="5.2" height="4.4" rx="0.6" fill="${w}"/>` // cab, roof, window
        + `<rect x="6.5" y="17" width="38.5" height="2" fill="${c}"/><path d="M8.2 17.6 L2.6 22.4 L8.2 22.4 Z" fill="${c}"/>` // frame, cow-catcher
        + `<circle cx="18" cy="21" r="3.6" fill="${c}"/><circle cx="26.6" cy="21" r="3.6" fill="${c}"/><circle cx="11.6" cy="22.4" r="2" fill="${c}"/><circle cx="38.6" cy="22" r="2.6" fill="${c}"/>`
        + `<circle cx="18" cy="21" r="1.2" fill="${w}"/><circle cx="26.6" cy="21" r="1.2" fill="${w}"/><path d="M18 21 L26.6 21" stroke="${w}" stroke-width="0.9"/></svg>`; } // drivers and rod
    const g = C().glass; // modern high-speed train, facing left
    return open
      + `<path d="M27 7.6 L30.4 3.6 L28.4 2.6 M30.4 3.6 L34 3.6" fill="none" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/>` // pantograph
      + `<path d="M1.8 19.4 C1.8 15.2 5.6 8.6 15.6 7.6 L47.6 7.6 L47.6 19.4 Z" fill="${c}"/>` // long nose and body
      + `<path d="M5.2 13.2 C7.4 10.6 10.6 9.6 15.2 9.4 L15.2 12.4 C11.2 12.5 8 12.8 5.2 13.2 Z" fill="${g}"/>` // windscreen
      + `<rect x="18" y="10" width="28" height="2.8" rx="1.2" fill="${g}"/>` // window band
      + `<path d="M3.6 16.2 C14 14.6 30 15 47.6 15" fill="none" stroke="${w}" stroke-width="1.1"/>` // stripe
      + `<rect x="7" y="19.6" width="8" height="2" rx="1" fill="${c}"/><rect x="34.4" y="19.6" width="8" height="2" rx="1" fill="${c}"/>` // bogies
      + `<path d="M1.6 23.6 L46.4 23.6" stroke="${c}" stroke-width="0.8"/></svg>`; // rail
  }
  const url = (kind) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(kind));
  const imgId = (kind) => 'ga-rail-' + kind;
  // legend / popup swatch: the same SVG at its on-screen size
  const legendImg = (kind) => `<img class="sw-rail" src="${url(kind)}" width="${Math.round(W * 0.7)}" height="${Math.round(H * 0.7)}" alt="" aria-hidden="true">`;
  const cache = {};
  function bitmap(kind) { if (!cache[kind]) cache[kind] = new Promise((res, rej) => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = W * R; cv.height = H * R; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, cv.width, cv.height); res(g.getImageData(0, 0, cv.width, cv.height)); }; im.onerror = rej; im.src = url(kind); }); return cache[kind]; }
  async function ensure(map) { for (const k of ['tram', 'metro']) { const id = imgId(k); if (map.hasImage && map.hasImage(id)) continue; const data = await bitmap(k); if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: R }); } }
  // a point at `m` metres along a line from its first vertex (local equirectangular metres; fine over a few km)
  function along(coords, m) { const kx = 111320 * Math.cos(coords[0][1] * Math.PI / 180), ky = 111320; let acc = 0;
    for (let i = 1; i < coords.length; i++) { const a = coords[i - 1], b = coords[i]; const d = Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky);
      if (acc + d >= m) { const u = (m - acc) / d; return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]; } acc += d; }
    return coords[coords.length - 1]; }
  // the two icon points, as GeoJSON features ON their lines (the metro's track starts at Armilla; the 1931 trunk starts at
  // its north-east end towards Granada)
  // metres along each line: far enough from the Armilla station circle and the town name at zoom 13 (≥ 40 px), still at the
  // Armilla end of each line
  const AT = { metro: 1000, tram: 100 }; // 5.44: the larger metro pictogram moved to 1 km so it clears the Armilla station and name at zoom 13
  function points(metroFC, tramFC) { const fs = [];
    // the point carries its line's properties, so a click on the pictogram opens the line's own popup
    const pt = (line, kind, m) => ({ type: 'Feature', properties: Object.assign({}, line.properties, { kind, icon: imgId(kind) }), geometry: { type: 'Point', coordinates: along(line.geometry.coordinates, m) } });
    const track = metroFC && metroFC.features.find(f => f.properties.k === 'track'); if (track) fs.push(pt(track, 'metro', AT.metro));
    const trunk = tramFC && tramFC.features.find(f => f.properties.k === 'trunk'); if (trunk) fs.push(pt(trunk, 'tram', AT.tram));
    return { type: 'FeatureCollection', features: fs }; }
  // the symbol layer paint / layout shared by the map layer and the tour (hidden where the lines are only a summary)
  const MINZOOM = 12; // 38 px at zoom 12 → 69 px from zoom 14 (smaller where the map is crowded)
  const layout = () => ({ 'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], MINZOOM, 0.55, 14, 1], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-anchor': 'center' });
  root.GA.railIcons = { svg, url, imgId, legendImg, ensure, points, along, layout, MINZOOM, W, H, AT };
})(window);
