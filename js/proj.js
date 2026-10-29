/* Transverse Mercator (Krüger n-series to n⁶, sub-millimetre within a UTM zone) and
   EPSG:25830 — ETRS89 / UTM zone 30N, the official projected CRS for Granada.
   Datum note: OSM coordinates are WGS 84; they are treated as ETRS89 without a datum shift.
   The two frames differ by under 1 m in Spain in 2026, below OSM's typical accuracy.
   This is also QGIS/PROJ's default (null) transformation between them. */
(function (root) {
  function TM(p) {
    const f = 1 / p.invf, n = f / (2 - f), e = Math.sqrt(f * (2 - f));
    const n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
    const A = p.a / (1 + n) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
    const al = [0, n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180 - 127 * n5 / 288 + 7891 * n6 / 37800,
      13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440 + 281 * n5 / 630 - 1983433 * n6 / 1935360,
      61 * n3 / 240 - 103 * n4 / 140 + 15061 * n5 / 26880 + 167603 * n6 / 181440,
      49561 * n4 / 161280 - 179 * n5 / 168 + 6601661 * n6 / 7257600,
      34729 * n5 / 80640 - 3418889 * n6 / 1995840, 212378941 * n6 / 319334400];
    const be = [0, n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360 - 81 * n5 / 512 + 96199 * n6 / 604800,
      n2 / 48 + n3 / 15 - 437 * n4 / 1440 + 46 * n5 / 105 - 1118711 * n6 / 3870720,
      17 * n3 / 480 - 37 * n4 / 840 - 209 * n5 / 4480 + 5569 * n6 / 90720,
      4397 * n4 / 161280 - 11 * n5 / 504 - 830251 * n6 / 7257600,
      4583 * n5 / 161280 - 108847 * n6 / 3991680, 20648693 * n6 / 638668800];
    const de = [0, 2 * n - 2 * n2 / 3 - 2 * n3 + 116 * n4 / 45 + 26 * n5 / 45 - 2854 * n6 / 675,
      7 * n2 / 3 - 8 * n3 / 5 - 227 * n4 / 45 + 2704 * n5 / 315 + 2323 * n6 / 945,
      56 * n3 / 15 - 136 * n4 / 35 - 1262 * n5 / 105 + 73814 * n6 / 2835,
      4279 * n4 / 630 - 332 * n5 / 35 - 399572 * n6 / 14175,
      4174 * n5 / 315 - 144838 * n6 / 6237, 601676 * n6 / 22275];
    const D = Math.PI / 180, lon0 = p.lon0 * D;
    function raw(lon, lat) { // returns [eta*A, xi*A]
      const phi = lat * D, lam = lon * D - lon0;
      const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
      const xi1 = Math.atan2(t, Math.cos(lam)), eta1 = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
      let xi = xi1, eta = eta1;
      for (let j = 1; j <= 6; j++) { xi += al[j] * Math.sin(2 * j * xi1) * Math.cosh(2 * j * eta1); eta += al[j] * Math.cos(2 * j * xi1) * Math.sinh(2 * j * eta1); }
      return [A * eta, A * xi];
    }
    const N0 = p.lat0 ? raw(p.lon0, p.lat0)[1] : 0;
    return {
      forward(ll) { const r = raw(ll[0], ll[1]); return [p.fe + p.k0 * r[0], p.fn + p.k0 * (r[1] - N0)]; },
      inverse(en) {
        const xi = (en[1] - p.fn + p.k0 * N0) / (p.k0 * A), eta = (en[0] - p.fe) / (p.k0 * A);
        let xi1 = xi, eta1 = eta;
        for (let j = 1; j <= 6; j++) { xi1 -= be[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); eta1 -= be[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); }
        const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1)); let phi = chi;
        for (let j = 1; j <= 6; j++) phi += de[j] * Math.sin(2 * j * chi);
        const lam = Math.atan2(Math.sinh(eta1), Math.cos(xi1));
        return [(lon0 + lam) / D, phi / D];
      },
    };
  }
  const EPSG25830 = TM({ a: 6378137, invf: 298.257222101, lat0: 0, lon0: -3, k0: 0.9996, fe: 500000, fn: 0 });
  const WKT = {
    4326: 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AXIS["Latitude",NORTH],AXIS["Longitude",EAST],AUTHORITY["EPSG","4326"]]',
    25830: 'PROJCS["ETRS89 / UTM zone 30N",GEOGCS["ETRS89",DATUM["European_Terrestrial_Reference_System_1989",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],TOWGS84[0,0,0,0,0,0,0],AUTHORITY["EPSG","6258"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4258"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",-3],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","25830"]]',
  };
  const api = { TM, EPSG25830, WKT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.proj = api; }
})(typeof window !== 'undefined' ? window : globalThis);
