/* Persistent project storage in the browser (localStorage), plus JSON backup/restore.
   Data stays on this computer and browser. Clearing browser data deletes it, so the
   status panel offers a backup file. */
(function (root) {
  const KEY = 'granada-atlas.project.v1';
  const blank = () => ({ version: 1, name: 'Granada', created: new Date().toISOString(), areas: [], observations: [], materials: [], exercises: [], sections: [] }) // sections: standalone sections (no study area);
  let project = null; let listeners = [];

  function load() {
    try { const raw = localStorage.getItem(KEY); project = raw ? JSON.parse(raw) : blank(); }
    catch (e) { project = blank(); project._loadError = String(e); }
    ['areas', 'observations', 'materials', 'exercises', 'sections'].forEach(k => project[k] = project[k] || []);
    return project;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(project)); listeners.forEach(f => f(project)); return true; }
    catch (e) { // usually storage quota: drop the cached map geometry of old analyses and retry
      project.areas.forEach(a => { if (a.analysis && a.analysis.result && a.analysis.result.osm) delete a.analysis.result.osm.geo; });
      try { localStorage.setItem(KEY, JSON.stringify(project)); listeners.forEach(f => f(project)); return true; } catch (e2) { return false; }
    }
  }
  const uid = (p) => (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function upsertArea(a) {
    const i = project.areas.findIndex(x => x.id === a.id); a.updated = new Date().toISOString();
    if (i >= 0) project.areas[i] = a; else { a.created = a.updated; project.areas.push(a); }
    return save();
  }
  function removeArea(id) { project.areas = project.areas.filter(a => a.id !== id); project.observations = project.observations.filter(o => o.areaId !== id); return save(); }
  function addObservation(o) { o.id = uid('obs'); o.created = new Date().toISOString(); project.observations.push(o); return save(); }
  function removeObservation(id) { project.observations = project.observations.filter(o => o.id !== id); return save(); }
  function addMaterial(m) { if (project.materials.some(x => x.id === m.id)) return false; m.added = new Date().toISOString(); project.materials.push(m); return save(); }
  function exportJSON() { return JSON.stringify(project, null, 1); }
  function importJSON(text) {
    const p = JSON.parse(text); if (!p || !Array.isArray(p.areas)) throw new Error(root.GA.i18n.t('err.backup'));
    project = p; ['areas', 'observations', 'materials', 'exercises', 'sections'].forEach(k => project[k] = project[k] || []); return save();
  }
  root.GA = root.GA || {};
  root.GA.store = { load, save, get: () => project, uid, upsertArea, removeArea, addObservation, removeObservation, addMaterial, exportJSON, importJSON, onChange: f => listeners.push(f) };
})(window);
