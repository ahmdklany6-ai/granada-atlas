/* One palette for the map, the report, the legends and the exported QGIS styles.
   Identity: #992B2A red on off-white and neutral grey, charcoal text.
   Red carries the selection, primary actions, building heights and highlights;
   categorical data keeps distinct hues so categories stay readable. */
(function (root) {
  const RED = '#992B2A';
  const P = {
    red: RED, redDark: '#6E1C1B', redSoft: '#F7E8E8', redTint: '#EBC9C8',
    ink: '#222428', ink2: '#4B4F55', ink3: '#7A7F86', paper: '#FBFBFA', gray1: '#F2F2F1', gray2: '#E4E4E2', line: '#D5D5D3',
    blue: '#2F5F8A',
    // Land-use categories (stable codes are used in exported data)
    landuse: { public: '#2F5F8A', religious: '#7B5EA7', water: '#8FB8CC', green: '#5E9A5B', cemetery: '#A6B39C', agri: '#C9C27A', commercial: '#D98A2B', industrial: '#6E7177', construction: '#B9B9B6', residential: '#E3D7D6' },
    // Building heights: sequential red
    band: { '1-2': '#F2D6D5', '3-4': '#D98E8C', '5-8': '#B04746', '9+': '#6E1C1B', no_data: '#FFFFFF' },
    // Construction period: charcoal ramp (older = darker)
    period: { pre_1900: '#222428', '1900_1939': '#4B4F55', '1940_1959': '#6F747B', '1960_1979': '#9A9EA4', '1980_1999': '#C3C6CA', '2000_plus': '#E4E5E7', no_data: '#FFFFFF' },
    tier: { primary: RED, collector: '#222428', local: '#8A8F96', pedestrian: '#2F5F8A', other: '#C3C6CA' },
    tierWidth: { primary: 3.2, collector: 2, local: 1.1, pedestrian: 0.9, other: 0.6 },
    poi: { public: '#2F5F8A', transit: '#222428', tourism: RED, food: '#D98A2B', everyday: '#5E9A5B', worship: '#7B5EA7', heritage: '#6E1C1B', shop: '#9A9EA4', green: '#5E9A5B', office: '#B9B9B6', craft: '#B9B9B6' },
    basemap: { land: '#F6F6F4', block: '#EFEFED', green: '#E2EADF', agri: '#EEEEE4', water: '#D3DFE7', waterLine: '#B4C7D3', bld: '#E2E2DF', bldLine: '#CFCFCC', road: '#FFFFFF', casing: '#D2D2CF', casingMajor: '#B5B5B2', rail: '#8A8F96', label: '#383B40', labelSoft: '#6E737A', halo: '#F6F6F4', boundary: '#A9ADB2' },
  };
  // Old saved analyses used en dashes and Arabic period labels as keys.
  P.bandKey = (k) => String(k).replace('–', '-').replace('none', 'no_data');
  const OLD_PERIOD = { 'قبل 1900': 'pre_1900', '1900–1939': '1900_1939', '1940–1959': '1940_1959', '1960–1979': '1960_1979', '1980–1999': '1980_1999', '2000+': '2000_plus', none: 'no_data' };
  P.periodKey = (k) => OLD_PERIOD[k] || k;
  P.rgba = (hex, a) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), Math.round((a == null ? 1 : a) * 255)].join(','); };
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  else { root.GA = root.GA || {}; root.GA.palette = P; }
})(typeof window !== 'undefined' ? window : globalThis);
