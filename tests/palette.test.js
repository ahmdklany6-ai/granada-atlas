// Build 5.13 palette contract: tree cover uses the approved cream → olive sequence (light → dark), 0 % and missing are
// distinct from every class, and study-area marks are black. Run: node tests/palette.test.js
const P = require('../js/palette.js'); const assert = require('assert'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
ok(JSON.stringify(P.canopy.map(c => c.toUpperCase())) === JSON.stringify(['#E5E3DA', '#BFB065', '#A49250', '#53461C']), 'tree-cover classes are #E5E3DA, #BFB065, #A49250, #53461C');
const L = (h) => { const [r, g, b] = P.rgb(h); return 0.3 * r + 0.59 * g + 0.11 * b; };
ok(P.canopy.every((c, i) => i === 0 || L(c) < L(P.canopy[i - 1])), 'tree-cover classes get darker with density');
ok(P.canopyZero.toUpperCase() === '#FFFFFF' && !P.canopy.includes(P.canopyZero) && !P.canopy.includes(P.canopyMissing), '0 % and missing have their own styles');
ok(L(P.mark.boundary) < 40 && P.mark.number === P.mark.boundary && P.mark.boundary.toUpperCase() !== P.red.toUpperCase(), 'study-area boundaries and numbers are near-black, red kept for thematic content');
ok([P.tree3d.recorded, P.tree3d.known, P.tree3d.leaf].every(c => ['#53461C', '#A49250', '#BFB065'].includes(c.toUpperCase())), 'trees use the approved olive sequence');
console.log('palette.test.js: ' + n + ' checks passed');
