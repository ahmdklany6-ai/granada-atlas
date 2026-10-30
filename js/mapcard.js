/* Analytical map renderer. Draws real features at true scale in EPSG:25830 (metres) on a
   canvas: context, thematic layers, optional raster, study boundary, scale bar and north.
   The same renderer serves the gallery, comparisons, enlargements, PNG export and sheets,
   so a given metres-per-pixel always means the same drawing scale. */
(function (root) {
  const PJ = root.GA.proj, P = root.GA.palette;
  const U = (c) => PJ.EPSG25830.forward(c);
  // Convert a GeoJSON-like geometry (lon/lat) to UTM, cached on the object
  function utm(g) {
    if (g._u) return g._u;
    const w = (c) => typeof c[0] === 'number' ? U(c) : c.map(w);
    Object.defineProperty(g, '_u', { value: w(g.coordinates || g), enumerable: false }); return g._u;
  }
  function ringUTM(ring) { return ring.map(U); }
  function bboxUTM(ringU) { const xs = ringU.map(p => p[0]), ys = ringU.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }

  let hatchPat = null;
  function hatch(ctx, col) {
    const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 8, 8); x.strokeStyle = col || '#8A8F96'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(0, 8); x.lineTo(8, 0); x.stroke();
    return ctx.createPattern(c, 'repeat');
  }

  // spec: { center:[x,y] UTM, mpp, w, h (css px), ratio, ring (lon/lat), areaStyle:{color,dash,label},
  //         context:{buildings:[geom], streets:[geom]}, layers:[{type:'fill'|'line'|'point', items:[{g, fill, stroke, width, r, hatch}]}],
  //         raster:{grid, colour:fn(v)->[r,g,b,a]|null}, fadeOutside:0..1, scaleBar, north, frame }
  function render(canvas, spec) {
    const ratio = spec.ratio || (root.devicePixelRatio || 1); const W = spec.w, H = spec.h;
    canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const mpp = spec.mpp, cx = spec.center[0], cy = spec.center[1];
    const X = (x) => (x - cx) / mpp + W / 2, Y = (y) => H / 2 - (y - cy) / mpp;
    const px = (p) => [X(p[0]), Y(p[1])];
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    const path = (rings) => { rings.forEach(r => { r.forEach((p, i) => { const q = px(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }); };
    const polys = (c, type) => type === 'MultiPolygon' ? c : [c];
    const lines = (c, type) => type === 'MultiLineString' ? c : [c];

    // raster (sampled per output pixel, at reduced resolution for speed)
    if (spec.raster) {
      const step = spec.rasterStep || 2; const iw = Math.ceil(W / step), ih = Math.ceil(H / step);
      const img = ctx.createImageData(iw, ih); const g = spec.raster.grid;
      for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) {
        const x = cx + ((i + 0.5) * step - W / 2) * mpp, y = cy - ((j + 0.5) * step - H / 2) * mpp;
        const v = root.GA.data.sampleGrid(g, x, y, spec.raster.nearest); if (v == null) continue;
        const col = spec.raster.colour(v); if (!col) continue; const o = (j * iw + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col[3] == null ? 255 : col[3];
      }
      const tmp = document.createElement('canvas'); tmp.width = iw; tmp.height = ih; tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, 0, 0, W, H);
    }
    // georeferenced images in EPSG:25830 (WMS snapshots: flood, noise, historical maps)
    (spec.images || []).forEach(im => { if (!im.img) return; ctx.save(); ctx.globalAlpha = im.alpha == null ? 1 : im.alpha; ctx.imageSmoothingEnabled = true; ctx.drawImage(im.img, X(im.x0), Y(im.y1), (im.x1 - im.x0) / mpp, (im.y1 - im.y0) / mpp); ctx.restore(); });
    // context
    if (spec.context) {
      if (spec.context.streets) { ctx.strokeStyle = spec.context.streetColor || '#D3D5D8'; ctx.lineWidth = 0.8; ctx.beginPath(); spec.context.streets.forEach(g => lines(utm(g), g.type).forEach(l => l.forEach((p, i) => { const q = px(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }))); ctx.stroke(); }
      if (spec.context.buildings) { ctx.fillStyle = spec.context.buildingColor || '#E3E4E6'; ctx.beginPath(); spec.context.buildings.forEach(g => polys(utm(g), g.type).forEach(pl => path(pl))); ctx.fill('evenodd'); }
    }
    // thematic layers
    (spec.layers || []).forEach(L => {
      L.items.forEach(it => {
        const g = it.g; const c = utm(g);
        if (L.type === 'fill') {
          ctx.beginPath(); polys(c, g.type).forEach(pl => path(pl));
          if (it.hatch) { ctx.fillStyle = hatch(ctx, it.hatch); ctx.fill('evenodd'); } else if (it.fill) { ctx.globalAlpha = it.alpha == null ? 1 : it.alpha; ctx.fillStyle = it.fill; ctx.fill('evenodd'); ctx.globalAlpha = 1; }
          if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.width || 0.5; ctx.stroke(); }
        } else if (L.type === 'line') {
          ctx.beginPath(); lines(c, g.type).forEach(l => l.forEach((p, i) => { const q = px(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }));
          ctx.strokeStyle = it.stroke; ctx.lineWidth = it.width || 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(it.dash || []); ctx.stroke(); ctx.setLineDash([]);
        } else if (L.type === 'point') {
          const q = px(c); const r = it.r || 3.5; ctx.beginPath();
          if (it.shape === 'square') ctx.rect(q[0] - r, q[1] - r, 2 * r, 2 * r); else if (it.shape === 'diamond') { ctx.moveTo(q[0], q[1] - r * 1.3); ctx.lineTo(q[0] + r * 1.3, q[1]); ctx.lineTo(q[0], q[1] + r * 1.3); ctx.lineTo(q[0] - r * 1.3, q[1]); ctx.closePath(); } else ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
          ctx.fillStyle = it.fill || P.red; ctx.fill(); ctx.strokeStyle = it.stroke || '#FFFFFF'; ctx.lineWidth = it.width || 1; ctx.stroke();
        }
      });
    });
    // fade outside the study boundary, then draw the boundary
    if (spec.ring) {
      const R = ringUTM(spec.ring);
      if (spec.fadeOutside) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); path([R]); ctx.fillStyle = `rgba(255,255,255,${spec.fadeOutside})`; ctx.fill('evenodd'); ctx.restore(); }
      const st = spec.areaStyle || {}; ctx.beginPath(); path([R]); ctx.strokeStyle = st.color || P.red; ctx.lineWidth = st.width || 1.8; ctx.setLineDash(st.dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    // overlay lines (e.g. section line) drawn above the boundary
    (spec.overlays || []).forEach(o => {
      const c = o.coords.map(U); ctx.beginPath(); c.forEach((p, i) => { const q = px(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.strokeStyle = o.color || P.red; ctx.lineWidth = o.width || 2; ctx.setLineDash(o.dash || [6, 3]); ctx.stroke(); ctx.setLineDash([]);
      if (o.labels) { ctx.font = `600 ${11}px ${font()}`; ctx.fillStyle = o.color || P.red; ctx.textBaseline = 'middle'; const a = px(c[0]), b = px(c[c.length - 1]); ctx.textAlign = 'center'; label(ctx, o.labels[0], a[0], a[1] - 10); label(ctx, o.labels[1], b[0], b[1] - 10); }
    });
    if (spec.scaleBar !== false) scaleBar(ctx, W, H, mpp, spec.scaleBarAlign);
    if (spec.north !== false) north(ctx, W);
    if (spec.areaStyle && spec.areaStyle.label) { ctx.font = `700 13px ${font()}`; ctx.fillStyle = spec.areaStyle.color || P.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; const t = spec.areaStyle.label; const w = ctx.measureText(t).width + 10; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(6, 6, w, 20); ctx.fillStyle = spec.areaStyle.color || P.red; ctx.fillText(t, 11, 9); }
    if (spec.frame !== false) { ctx.strokeStyle = '#C9CACC'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1); }
    return { X, Y };
  }
  function label(ctx, t, x, y) { const w = ctx.measureText(t).width + 6; ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x - w / 2, y - 8, w, 16); ctx.restore(); ctx.fillText(t, x, y); }
  const font = () => getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif';
  function niceLen(target) { const c = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]; return c.reduce((b, v) => Math.abs(v - target) < Math.abs(b - target) ? v : b, c[0]); }
  function scaleBar(ctx, W, H, mpp, align) {
    const len = niceLen(W * 0.22 * mpp); const px = len / mpp; const x0 = 10, y0 = H - 16;
    ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(x0 - 4, y0 - 15, px + 54, 26);
    ctx.fillStyle = '#222428'; ctx.fillRect(x0, y0, px / 2, 4); ctx.strokeStyle = '#222428'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, px - 1, 3);
    ctx.font = `10px ${font()}`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.direction = 'ltr';
    ctx.fillText('0', x0, y0 - 2); ctx.textAlign = 'center'; ctx.fillText(len >= 1000 ? (len / 1000) + ' km' : len + ' m', x0 + px, y0 - 2);
  }
  function north(ctx, W) {
    const x = W - 18, y = 12; ctx.fillStyle = '#222428'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 18); ctx.lineTo(x, y + 14); ctx.lineTo(x - 6, y + 18); ctx.closePath(); ctx.fill();
    ctx.font = `700 10px ${font()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.direction = 'ltr'; ctx.fillText('N', x, y + 20);
  }

  // Fit a ring into a w×h box with a margin; returns {center, mpp}
  function fit(ringsLonLat, w, h, margin) {
    const all = ringsLonLat.flatMap(r => r.map(U)); const bb = bboxUTM(all); const m = margin == null ? 0.08 : margin;
    const mpp = Math.max((bb[2] - bb[0]) / (w * (1 - 2 * m)), (bb[3] - bb[1]) / (h * (1 - 2 * m)));
    return { center: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], mpp, bbox: bb };
  }
  const api = { render, fit, utm, ringUTM, bboxUTM, niceLen };
  root.GA = root.GA || {}; root.GA.mapcard = api;
})(window);
