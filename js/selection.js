/* Study-area selection: Set Center → circle / square / custom polygon.
   No freehand drawing. Handles are DOM markers so they stay crisp and draggable.
   The selection centre is a geometric reference point chosen by the user; it is not
   the "city centre" studied as a topic in exercise 1.3. */
(function (root) {
  const G = root.GA.geo; const T = (k, v) => root.GA.i18n.t(k, v);
  const LIMITS = { radius: [10, 5000], side: [20, 15000] };
  const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));

  function create(map, opts) {
    let s = blank(); const history = []; const markers = new Map(); let dragging = null; let lastMarkerDown = 0;
    let pendingPopup = null; let cursor = null; let measure = { on: false, pts: [] };
    const emit = () => opts.onChange && opts.onChange(api.info());

    function blank() { return { phase: 'idle', center: null, pending: null, type: null, radius: 125, side: 250, verts: [], closed: false }; }
    const snap = () => JSON.stringify({ phase: s.phase, center: s.center, type: s.type, radius: s.radius, side: s.side, verts: s.verts, closed: s.closed });
    function commit() { history.push(snap()); if (history.length > 100) history.shift(); }

    // ---------- sources & layers ----------
    function ensureLayers() {
      if (map.getSource('sel')) return;
      map.addSource('sel', { type: 'geojson', data: fc([]) });
      map.addSource('sel-draft', { type: 'geojson', data: fc([]) });
      map.addSource('measure', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'sel-fill', type: 'fill', source: 'sel', paint: { 'fill-color': '#992B2A', 'fill-opacity': 0.07 } });
      map.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': '#992B2A', 'line-width': 1.8 } });
      map.addLayer({ id: 'sel-draft', type: 'line', source: 'sel-draft', paint: { 'line-color': '#992B2A', 'line-width': 1.4, 'line-dasharray': [2, 2] } });
      map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', paint: { 'line-color': '#1F1B17', 'line-width': 1.4, 'line-dasharray': [1, 1.5] } });
    }
    const fc = (features) => ({ type: 'FeatureCollection', features });
    function ring() {
      if (!s.center) return null;
      if (s.type === 'circle') return G.circle(s.center, s.radius, 64);
      if (s.type === 'square') return G.square(s.center, s.side);
      if (s.type === 'polygon' && s.closed && s.verts.length >= 3) return G.closeRing(s.verts);
      return null;
    }
    function draw() {
      if (!map.getSource('sel') && !map.isStyleLoaded()) { map.once('load', draw); return; }
      ensureLayers(); const r = ring();
      map.getSource('sel').setData(fc(r ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [r] } }] : []));
      let draft = [];
      if (s.type === 'polygon' && !s.closed && s.verts.length) {
        const line = cursor ? s.verts.concat([cursor]) : s.verts;
        if (line.length > 1) draft.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } });
      }
      map.getSource('sel-draft').setData(fc(draft));
      map.getSource('measure').setData(fc(measure.pts.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: measure.pts.concat(measure.on && cursor ? [cursor] : []) } }] : []));
      renderHandles();
    }

    // ---------- handles ----------
    function el(cls, title) { const d = document.createElement('div'); d.className = 'h ' + cls; if (title) d.title = title; d.addEventListener('mousedown', () => lastMarkerDown = Date.now()); d.addEventListener('touchstart', () => lastMarkerDown = Date.now(), { passive: true }); return d; }
    function want() {
      const L = [];
      if (s.pending && s.phase === 'pending') L.push({ key: 'pending', cls: 'h-pending', pos: s.pending });
      if (s.center && s.phase !== 'pending') L.push({ key: 'center', cls: 'h-center', pos: s.center, title: T('sel.dragCenter'), drag: true,
        onStart: () => { dragStart = { c: s.center.slice(), v: s.verts.map(p => p.slice()) }; },
        onDrag: (ll) => { if (s.type === 'polygon') s.verts = G.translate(dragStart.v, dragStart.c, ll); s.center = ll; },
      });
      if (s.type === 'circle' && s.center) L.push({ key: 'radius', cls: 'h-edge', pos: G.proj(s.center).toLL([s.radius, 0]), title: T('sel.dragEdge'), drag: true,
        onDrag: (ll) => { s.radius = Math.round(clamp(G.haversine(s.center, ll), LIMITS.radius)); } });
      if (s.type === 'square' && s.center) L.push({ key: 'corner', cls: 'h-edge', pos: G.proj(s.center).toLL([s.side / 2, s.side / 2]), title: T('sel.dragCorner'), drag: true,
        onDrag: (ll) => { const xy = G.proj(s.center).toXY(ll); s.side = Math.round(clamp(2 * Math.max(Math.abs(xy[0]), Math.abs(xy[1])), LIMITS.side)); } });
      if (s.type === 'polygon') {
        s.verts.forEach((v, i) => L.push({ key: 'v' + i, cls: 'h-vert' + (i === 0 && !s.closed ? ' h-first' : ''), pos: v, drag: true,
          title: i === 0 && !s.closed ? T('sel.firstVertex') : T('sel.vertex'),
          onDrag: (ll) => { s.verts[i] = ll; },
          onClick: () => { if (i === 0 && !s.closed && s.verts.length >= 3) api.closePolygon(); },
          onDbl: () => { if (s.closed && s.verts.length > 3) { commit(); s.verts.splice(i, 1); draw(); emit(); } } }));
        if (s.closed) s.verts.forEach((v, i) => { const w = s.verts[(i + 1) % s.verts.length];
          L.push({ key: 'm' + i, cls: 'h-mid', pos: [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2], title: T('sel.mid'), onClick: () => { commit(); s.verts.splice(i + 1, 0, [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2]); draw(); emit(); } }); });
      }
      measure.pts.forEach((p, i) => L.push({ key: 'ms' + i, cls: 'h-measure', pos: p }));
      return L;
    }
    let dragStart = null;
    function renderHandles() {
      const W = want(); const keys = new Set(W.map(w => w.key));
      markers.forEach((m, k) => { if (!keys.has(k) || m._cls !== W.find(w => w.key === k).cls) { m.remove(); markers.delete(k); } });
      W.forEach(w => {
        let m = markers.get(w.key);
        if (!m) {
          const e = el(w.cls, w.title); m = new maplibregl.Marker({ element: e, draggable: !!w.drag }).setLngLat(w.pos).addTo(map); m._cls = w.cls; markers.set(w.key, m);
          if (w.drag) {
            m.on('dragstart', () => { dragging = w.key; commit(); const cur = want().find(x => x.key === w.key); cur && cur.onStart && cur.onStart(); });
            m.on('drag', () => { const cur = want().find(x => x.key === w.key); const ll = m.getLngLat(); cur && cur.onDrag([ll.lng, ll.lat]); draw(); emit(); });
            m.on('dragend', () => { dragging = null; draw(); emit(); });
          }
          e.addEventListener('click', (ev) => { ev.stopPropagation(); const cur = want().find(x => x.key === w.key); cur && cur.onClick && cur.onClick(); });
          e.addEventListener('dblclick', (ev) => { ev.stopPropagation(); ev.preventDefault(); const cur = want().find(x => x.key === w.key); cur && cur.onDbl && cur.onDbl(); });
        } else if (dragging !== w.key) m.setLngLat(w.pos);
        if (w.title) m.getElement().title = w.title;
      });
    }

    // ---------- map events ----------
    map.on('click', (e) => {
      if (Date.now() - lastMarkerDown < 350) return;
      if (opts.intercept && opts.intercept(e)) return; // another tool (e.g. section drawing) owns the click
      const ll = [e.lngLat.lng, e.lngLat.lat];
      if (measure.on) { measure.pts.push(ll); draw(); emit(); return; }
      if (s.type === 'polygon' && !s.closed) {
        // close when clicking near the first vertex
        if (s.verts.length >= 3) { const p0 = map.project(s.verts[0]); if (Math.hypot(p0.x - e.point.x, p0.y - e.point.y) < 12) { api.closePolygon(); return; } }
        commit(); s.verts.push(ll); draw(); emit(); return;
      }
      if (s.phase === 'idle' || s.phase === 'pending') { api.propose(ll); return; }
    });
    map.on('mousemove', (e) => { if ((s.type === 'polygon' && !s.closed && s.verts.length) || (measure.on && measure.pts.length)) { cursor = [e.lngLat.lng, e.lngLat.lat]; draw(); } });

    // ---------- public API ----------
    const api = {
      propose(ll) {
        s.phase = 'pending'; s.pending = ll; if (pendingPopup) pendingPopup.remove();
        const box = document.createElement('div'); box.className = 'popup-setcenter';
        box.innerHTML = `<div class="coords" dir="ltr">${ll[1].toFixed(5)}, ${ll[0].toFixed(5)}</div><button class="btn btn-primary" id="btn-setcenter">${T('sel.setCenter')}</button>`;
        pendingPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 14, className: 'atlas-popup' }).setLngLat(ll).setDOMContent(box).addTo(map);
        pendingPopup.on('close', () => { if (s.phase === 'pending') { s.phase = s.center ? 'shape' : 'idle'; s.pending = null; draw(); emit(); } });
        box.querySelector('button').addEventListener('click', () => api.setCenter());
        draw(); emit();
      },
      setCenter() {
        if (!s.pending) return; commit();
        const prev = s.center; s.center = s.pending; s.pending = null;
        if (s.type === 'polygon' && prev && s.verts.length) s.verts = G.translate(s.verts, prev, s.center);
        if (!s.type) s.type = 'square'; // default: a 250 m north-oriented square
        s.phase = 'shape';
        if (pendingPopup) { const p = pendingPopup; pendingPopup = null; p.remove(); }
        draw(); emit();
      },
      chooseTool(t) {
        if (!s.center) return; commit(); s.type = t; s.phase = 'shape';
        if (t === 'polygon') { s.verts = []; s.closed = false; }
        draw(); emit();
      },
      armCenter() { s.phase = 'idle'; emit(); },
      setRadius(m) { if (!isFinite(m)) return; commit(); s.radius = Math.round(clamp(m, LIMITS.radius)); draw(); emit(); },
      setSide(m) { if (!isFinite(m)) return; commit(); s.side = Math.round(clamp(m, LIMITS.side)); draw(); emit(); },
      closePolygon() { if (s.verts.length < 3) return; commit(); s.closed = true; cursor = null; draw(); emit(); },
      undo() { const h = history.pop(); if (!h) return; Object.assign(s, JSON.parse(h)); if (s.phase === 'pending') s.phase = s.center ? 'shape' : 'idle'; cursor = null; draw(); emit(); },
      reset() { commit(); s = blank(); cursor = null; if (pendingPopup) { const p = pendingPopup; pendingPopup = null; p.remove(); } draw(); emit(); },
      ring,
      spec() { return { type: s.type, center: s.center, radius: s.radius, side: s.side, verts: s.verts.slice(), closed: s.closed }; },
      loadSpec(sp) { commit(); s = Object.assign(blank(), sp, { phase: 'shape', pending: null }); draw(); emit(); },
      fitTo(rings) { const all = (rings || [ring()]).filter(Boolean).flat(); if (!all.length) return; const b = G.bbox(all); map.resize(); const c = map.getContainer(); const pad = Math.max(24, Math.min(70, Math.min(c.clientWidth, c.clientHeight) * 0.1)); map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad, duration: 600, maxZoom: 17.5 }); }, // the map container already sits between the panels
      setCenterDirect(ll) { commit(); const prev = s.center; s.center = ll; if (s.type === 'polygon' && prev && s.verts.length) s.verts = G.translate(s.verts, prev, ll); if (!s.type) s.type = 'square'; s.phase = 'shape'; draw(); emit(); },
      redraw() { draw(); },
      measureToggle(on) { measure.on = on == null ? !measure.on : on; if (!measure.on) cursor = null; draw(); emit(); return measure.on; },
      measureClear() { measure.pts = []; draw(); emit(); },
      info() {
        const r = ring();
        return { phase: s.phase, type: s.type, center: s.center, pending: s.pending, radius: s.radius, side: s.side, verts: s.verts.length, closed: s.closed,
          ring: r, area: r ? G.ringArea(r) : null, perimeter: r ? G.perimeter(r) : null, selfIntersects: (s.type === 'polygon' && r) ? G.selfIntersects(r) : false,
          canUndo: history.length > 0, measure: { on: measure.on, pts: measure.pts.length, length: G.lineLength(measure.pts) } };
      },
      LIMITS,
    };
    map.on('load', () => draw());
    if (map.loaded()) draw();
    return api;
  }
  root.GA = root.GA || {}; root.GA.selection = { create };
})(window);
