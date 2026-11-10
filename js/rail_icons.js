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
  const W = 46, H = 33, R = 2; // 5.43 (owner: bigger, clearer): on-screen size (px) at zoom ≥ 14 on a white badge; images are made at 2×
  const C = () => root.GA.palette.south;
  // the white badge with a border in the line's colour, so the pictogram reads on any basemap
  const badge = (c) => `<rect x="-3" y="-3" width="34" height="24" rx="4.5" fill="#FFFFFF" stroke="${c}" stroke-width="1.6"/>`;
  function svg(kind) {
    const c = kind === 'tram' ? C().tram : C().metro, w = '#FFFFFF';
    const halo = `stroke="${w}" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round"`;
    if (kind === 'tram') return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * R}" height="${H * R}" viewBox="-4 -4 36 26">` + badge(c)
      + `<path d="M14.5 6.2 L21.5 1.2" stroke="${w}" stroke-width="3" stroke-linecap="round"/><path d="M14.5 6.2 L21.5 1.2" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>` // trolley pole
      + `<rect x="5" y="4.6" width="16" height="2.2" rx="0.6" fill="${c}" ${halo}/>` // clerestory roof
      + `<rect x="3" y="6.4" width="20" height="7.6" rx="1" fill="${c}" ${halo}/>` // boxy car
      + `<rect x="5" y="7.8" width="3" height="3" fill="${w}"/><rect x="9.5" y="7.8" width="3" height="3" fill="${w}"/><rect x="14" y="7.8" width="3" height="3" fill="${w}"/><rect x="18.5" y="7.8" width="2.6" height="3" fill="${w}"/>`
      + `<circle cx="8" cy="15.4" r="1.9" fill="${c}" ${halo}/><circle cx="18" cy="15.4" r="1.9" fill="${c}" ${halo}/></svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * R}" height="${H * R}" viewBox="-4 -4 36 26">` + badge(c)
      + `<path d="M11 5.4 L13 2.6 L11.4 1.6 M13 2.6 L15.6 2.6" fill="none" stroke="${w}" stroke-width="2.6" stroke-linecap="round"/><path d="M11 5.4 L13 2.6 L11.4 1.6 M13 2.6 L15.6 2.6" fill="none" stroke="${c}" stroke-width="1" stroke-linecap="round"/>` // pantograph
      + `<path d="M2.2 13.6 L2.2 7.6 Q2.2 5.4 4.4 5.4 L20 5.4 Q24.6 5.4 26 10.2 L26.6 13.6 Z" fill="${c}" ${halo}/>` // long low body, rounded nose
      + `<path d="M4.4 7.4 L19.8 7.4 Q22.8 7.4 23.8 10.2 L4.4 10.2 Z" fill="${w}"/>` // window band
      + `<rect x="3.6" y="14.2" width="6.4" height="2" rx="1" fill="${c}" ${halo}/><rect x="17" y="14.2" width="6.4" height="2" rx="1" fill="${c}" ${halo}/></svg>`; // bogies
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
  const AT = { metro: 700, tram: 100 };
  function points(metroFC, tramFC) { const fs = [];
    // the point carries its line's properties, so a click on the pictogram opens the line's own popup
    const pt = (line, kind, m) => ({ type: 'Feature', properties: Object.assign({}, line.properties, { kind, icon: imgId(kind) }), geometry: { type: 'Point', coordinates: along(line.geometry.coordinates, m) } });
    const track = metroFC && metroFC.features.find(f => f.properties.k === 'track'); if (track) fs.push(pt(track, 'metro', AT.metro));
    const trunk = tramFC && tramFC.features.find(f => f.properties.k === 'trunk'); if (trunk) fs.push(pt(trunk, 'tram', AT.tram));
    return { type: 'FeatureCollection', features: fs }; }
  // the symbol layer paint / layout shared by the map layer and the tour (hidden where the lines are only a summary)
  const MINZOOM = 12; // 37 px at zoom 12 → 46 px from zoom 14
  const layout = () => ({ 'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], MINZOOM, 0.8, 14, 1], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-anchor': 'center' });
  root.GA.railIcons = { svg, url, imgId, legendImg, ensure, points, along, layout, MINZOOM, W, H, AT };
})(window);
