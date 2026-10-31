const { parse } = require('../js/dates.js');
const cases = [
  ['2019-09-20 10:00:00', '2019-09-20'], ['2019:09:20 10:00:00', '2019-09-20'], ['Taken on 3 March 2019', '2019-03-03'], ['20 September 2019', '2019-09-20'],
  ['September 20, 2019', '2019-09-20'], ['20 de septiembre de 2019', '2019-09-20'], ['March 2019', '2019-03'], ['1895', '1895'], ['circa 1900', null], ['1890s', null],
  ['<time class="dtstart" datetime="2012-05-12">12 May 2012</time>', '2012-05-12'], ['31/12/2010', '2010-12-31'], ['03/04/2010', null], ['2019-02-30', null], ['', null], [null, null],
];
let bad = 0; cases.forEach(([s, want]) => { const got = parse(s).iso; if (got !== want) { bad++; console.log('FAIL', JSON.stringify(s), got, '!=', want); } });
console.log(bad ? bad + ' FAILED' : 'ALL PASSED');
