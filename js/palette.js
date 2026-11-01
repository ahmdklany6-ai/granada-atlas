/* One palette for the interface, the map, the charts, the sections, the legends and the exported QGIS styles.
   Identity (build 5.8): the studio red #992B2A on warm cream, with a mood-board family of muted blues, olives and
   burgundies. Every colour used anywhere is defined here; renderers and legends read the same entries, so a legend
   can never drift from its map. Derived tints/shades are mixes of the base colours (see BASE) and are named as such.
   Rules: red carries primary actions, selection and the architectural cut; yellow/chartreuse is used sparingly
   (one class at most on climate maps); sequential data uses one hue family light→dark; diverging data has a neutral
   cream middle. Reference photos, historical maps and service tiles shown as originals are never recoloured. */
(function (root) {
  const RED = '#992B2A';
  // the supplied mood-board colours (names as given by the owner)
  const BASE = {
    red: RED, cream: '#E5E3DA', lightBlue: '#A9C0CB', blueGrey: '#9DBCD1', chartreuse: '#BFB065', khaki: '#A49250',
    olive: '#53461C', oxblood: '#5A1D22', burgundy: '#74362D', wine: '#452928', brown: '#29100C',
  };
  // derived tints/shades (mixes of BASE with white or with the darkest brown), used where contrast needs more steps
  const D = {
    paper: '#F6F5F0',      // cream 35 % on white: page background
    paper2: '#EFEEE7',     // cream 60 % on white: panel strips, hover
    panel: '#FCFBF8',      // near-white cream: floating panels
    line: '#DDDAD0', line2: '#C5C0B3',
    ink: '#29100C',        // dark brown: text
    ink2: '#4D3D37',       // brown 80 % on cream: secondary text
    ink3: '#6F625B',       // brown 62 % on cream: captions (≥ 4.5:1 on white)
    redSoft: '#F5EAE6', redTint: '#E6CBC3', rose: '#C98B80', blush: '#EBD9D3',
    blueDeep: '#4F6E80',   // blue-grey shade: water lines, public, pedestrian
    blueDark: '#2F4654',
    blueMid: '#7F9DAE', bluePale: '#C9D8DF',
    oliveMid: '#7E7B43',   // khaki/olive mix: parks, everyday
    khakiPale: '#D6CDA6', olivePale: '#E4E5D3',
    warmGrey: '#8C817A', warmGrey2: '#BDB5AA', stone: '#D3CFC2',
  };
  const P = {
    base: BASE,
    red: RED, redDark: BASE.oxblood, redSoft: D.redSoft, redTint: D.redTint,
    ink: D.ink, ink2: D.ink2, ink3: D.ink3, paper: D.paper, gray1: D.paper2, gray2: BASE.cream, line: D.line,
    blue: D.blueDeep, white: '#FFFFFF', grey: D.warmGrey, grey2: D.warmGrey2, grey3: D.stone, line2: D.line2, rose: D.rose, blush: D.blush, olive: D.oliveMid,
    // interface tokens (written to CSS custom properties on load, so the stylesheet uses the same values)
    ui: {
      red: RED, red2: BASE.oxblood, redSoft: D.redSoft, redTint: D.redTint, paper: D.paper, paper2: D.paper2, paper3: BASE.cream, panel: D.panel,
      white: '#FFFFFF', ink: D.ink, ink2: D.ink2, ink3: D.ink3, line: D.line, line2: D.line2, blue: D.blueDeep, ok: BASE.olive, okSoft: '#F1F0E4', okLine: '#B5AE7E',
      warn: BASE.burgundy, mapBg: '#F1F0EA', shadow: 'rgba(41,16,12,.14)', dark: BASE.wine,
    },
    // Land-use categories (stable codes are used in exported data): blues = public/water, olives = green/agriculture,
    // burgundies = religious/commercial, warm neutrals = built fabric
    // 5.9: more distinct hues — each category takes a different family member, no two neighbours alike
    landuse: { public: D.blueDeep, religious: BASE.khaki, water: BASE.lightBlue, green: D.oliveMid, cemetery: BASE.olive, agri: BASE.chartreuse, commercial: RED, industrial: BASE.burgundy, construction: D.stone, residential: D.blush },
    luOther: BASE.cream,
    // Building heights (floors): sequential red, light → our red → deep wine
    band: { '1-2': D.blush, '3-4': D.rose, '5-8': RED, '9+': BASE.oxblood, no_data: '#FFFFFF' },
    // Construction period: sequential blue-grey, older = darker (distinct from the red height ramp)
    period: { pre_1900: D.blueDark, '1900_1939': D.blueDeep, '1940_1959': D.blueMid, '1960_1979': BASE.blueGrey, '1980_1999': D.bluePale, '2000_plus': BASE.cream, no_data: '#FFFFFF' },
    periodNoData: D.paper2,
    tier: { primary: RED, collector: BASE.wine, local: D.warmGrey, pedestrian: D.blueDeep, other: '#CFC9BE' },
    tierWidth: { primary: 3.2, collector: 2, local: 1.1, pedestrian: 0.9, other: 0.6 },
    poi: { public: D.blueDeep, transit: RED, tourism: BASE.oxblood, food: BASE.khaki, everyday: D.oliveMid, worship: BASE.burgundy, heritage: BASE.olive, shop: '#9C918A', green: D.oliveMid, office: D.warmGrey2, craft: D.warmGrey2 },
    // facilities (health / education / stay) — one colour per class, shared by map, cards and legends
    fac: { hospital: RED, clinic: D.rose, doctors: BASE.wine, dentist: D.warmGrey, pharmacy: D.blueDeep, university: BASE.wine, college: D.ink3, school: RED, early_years: D.redTint, hotel: RED, hostel: BASE.wine, guest_house: D.blueDeep, apartment: D.warmGrey },
    // Overture places groups
    places: { food_and_drink: BASE.khaki, shopping: RED, services_and_business: D.ink3, health_care: D.blueDeep, lifestyle_services: D.rose, lodging: BASE.oxblood, travel_and_transportation: BASE.brown, education: D.blueMid, sports_and_recreation: D.oliveMid, arts_and_entertainment: BASE.burgundy, community_and_government: BASE.olive, other: D.line2 },
    // bus service level (sequential red, as heights)
    bus: { 'High': BASE.oxblood, 'Medium-high': RED, 'Medium-low': D.rose, 'Low': D.blush, 'No scheduled service': '#FFFFFF' }, // light → dark red
    stop: RED, // public-transport stop markers
    choro: ['#F6ECE9', '#E8C9C1', D.rose, RED, BASE.oxblood], // 5-class light → dark red for neighbourhood choropleths
    // terrain: slope classes (degrees, sequential cream → khaki → burgundy, earthy so it never reads as building heights)
    // and the elevation ramp (cream → khaki → burgundy)
    slope: [['0-2', '#F4F1EA'], ['2-5', '#E8E1C8'], ['5-10', D.khakiPale], ['10-15', '#BFA97A'], ['15-25', '#9C7A55'], ['25-35', BASE.burgundy], ['35+', BASE.wine]],
    slopeAlpha: [0, 150, 175, 195, 210, 225, 235],
    elevRamp: [[560, '#EEEEE6'], [650, '#E2E3D3'], [700, '#E2DCC0'], [800, '#D3C6A0'], [950, '#BBA67F'], [1200, '#A08066'], [1600, '#83655A'], [1860, '#F2F1EC']],
    contour: '#8C7A55', trees: RED, waterLine: D.blueDeep, blueDark: D.blueDark,
    // water and runoff (water keeps the blue family): terrain flow paths by upslope area, small → large; mapped ditches
    flow: [D.bluePale, BASE.blueGrey, D.blueDeep, D.blueDark], drain: D.blueMid,
    // seasonal wind rose speed classes (0.5–2, 2–4, 4–6, ≥ 6 m/s): light → dark red
    wind: ['#E8C9C1', D.rose, RED, BASE.oxblood],
    // boundaries: neighbourhoods in our red; districts darker; the municipality's outer line in dark ink (not red, so it
    // never reads as a neighbourhood line); the GHSL urban centre stays a separate dashed line
    admin: { distrito: BASE.oxblood, barrio: RED, municipio: D.ink, urban: D.ink3 },
    // climate and environment (classified external rasters and live layers); no more than one muted yellow class
    lst: ['#4F6E80', BASE.blueGrey, BASE.cream, '#DCC3B5', '#C08572', BASE.burgundy, BASE.wine], // < 30 … ≥ 55 °C, diverging around cream
    noise: ['#F6ECE9', '#E8C9C1', '#D49E93', '#B8645A', RED, BASE.oxblood],     // 50 … 75 dB(A): pale → dark red, clearly ordered
    flood: { q10: D.blueDark, q50: D.blueDeep, q100: BASE.blueGrey, q500: D.bluePale }, arpsi: BASE.brown,
    canopy: ['#EFEEE4', '#DCD8B6', '#B9B27A', D.oliveMid, BASE.olive],                // tree-cover density, sequential olive
    // charts (cards, sheets, climate board): neutral bar, highlight bar, and two topic colours
    chart: { bar: D.warmGrey, barSoft: D.stone, hi: RED, flood: D.blueDeep, green: D.oliveMid, grid: D.line, axis: D.ink3 },
    // street sections: architectural drawing tones
    section: {
      cut: RED, ink: D.ink, grey: D.ink3, soil: '#E9E4D8', soilEdge: '#C8BFAE', bgFill: '#E9DFCD', bgLine: '#8C7A55', bgFloor: '#CAB890', bgGround: '#EFEBE1',
      treeOn: BASE.olive, treeBg: BASE.khaki, treeFillBg: '#F5F3EA', fig: D.warmGrey, water: D.blueDeep, green: D.oliveMid, kerb: '#DCD6CB', window: D.rose,
      locBg: '#FAF9F5', locLine: '#C9C3B7', locBld: '#D9D4CA', locSt: '#CBC5BA', locBand: '#E9DFCD', rule: D.line, src: D.ink3, text2: D.ink2,
    },
    // documented materials drawn in sections (only when the user records them with a source)
    material: { tiles: '#B5654A', slate: '#5B5F66', metal: '#8A9097', green: D.oliveMid, membrane: '#A8A8A8', render: '#D9D3C7', brick: '#B9785C', stone: '#BFB6A4', concrete: '#B3B5B8', glass: BASE.lightBlue, timber: '#A07A52' },
    // study areas, comparison and locator marks
    mark: { area: RED, other: D.ink3, mask: D.paper, section: D.ink, sectionBg: D.ink3, corridor: BASE.olive },
    basemap: { land: '#F4F3EE', block: '#ECEAE3', green: D.olivePale, agri: '#EFEEE2', water: '#D6E2E8', waterLine: BASE.lightBlue, bld: '#E3DFD6', bldLine: '#CFC9BD', road: '#FFFFFF', casing: '#D8D3C8', casingMajor: '#BAB3A6', rail: D.warmGrey, label: '#3A2C27', labelSoft: '#6F625C', halo: '#F4F3EE', boundary: '#A9A096', waterLabel: D.blueDeep },
  };
  // Old saved analyses used en dashes and Arabic period labels as keys.
  P.bandKey = (k) => String(k).replace('–', '-').replace('none', 'no_data');
  const OLD_PERIOD = { 'قبل 1900': 'pre_1900', '1900–1939': '1900_1939', '1940–1959': '1940_1959', '1960–1979': '1960_1979', '1980–1999': '1980_1999', '2000+': '2000_plus', none: 'no_data' };
  P.periodKey = (k) => OLD_PERIOD[k] || k;
  P.rgba = (hex, a) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), Math.round((a == null ? 1 : a) * 255)].join(','); };
  P.rgb = (hex) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  else {
    root.GA = root.GA || {}; root.GA.palette = P;
    // the stylesheet reads the same interface colours (custom properties), so CSS and canvas drawings agree
    try { const s = root.document && root.document.documentElement && root.document.documentElement.style; if (s) Object.entries(P.ui).forEach(([k, v]) => s.setProperty('--c-' + k.replace(/[A-Z0-9]/g, m => '-' + m.toLowerCase()), v)); } catch (e) { }
  }
})(typeof window !== 'undefined' ? window : globalThis);
