// VSS / OCS screening maths — ICAO Doc 8168 Vol II, Part I, Sec 4, Ch 5, para 5.4.6 (see README for assumptions)
const D2R = Math.PI / 180, R2D = 180 / Math.PI, T = (d) => Math.tan(d * D2R);
export function parseCoord(s, isLon) {
  s = String(s).trim().toUpperCase();
  const m = s.match(new RegExp(`^(\\d{${isLon ? 3 : 2}})(\\d{2})(\\d{2}(?:\\.\\d+)?)([NSEW])$`));
  if (m) {
    const v = +m[1] + m[2] / 60 + m[3] / 3600;
    if (+m[2] >= 60 || +m[3] >= 60 || v > (isLon ? 180 : 90)) return NaN;
    return /[SW]/.test(m[4]) ? -v : v;
  }
  return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
}
export function enOffset(lat0, lon0, lat, lon) {
  const p = lat0 * D2R;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
  const mLon = 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p);
  return { e: (lon - lon0) * mLon, n: (lat - lat0) * mLat };
}
export function bearing(lat1, lon1, lat2, lon2) {
  const { e, n } = enOffset(lat1, lon1, lat2, lon2);
  return (Math.atan2(e, n) * R2D + 360) % 360;
}
export function distance(lat1, lon1, lat2, lon2) { const { e, n } = enOffset(lat1, lon1, lat2, lon2); return Math.hypot(e, n); }
// Runway designator must agree with the bearing from this threshold to the opposite one (tolerance covers magnetic variation).
export function checkDesignator(thr, other, desig, tol = 15) {
  const b = bearing(thr.lat, thr.lon, other.lat, other.lon);
  const exp = (parseInt(desig, 10) % 36) * 10;
  const d = Math.abs(((b - exp + 540) % 360) - 180);
  return { ok: d <= tol, bearing: b, expected: exp };
}
// Runway frame: origin = threshold, x = metres outward along extended centreline (away from runway), y = lateral.
export function toRunwayXY(thr, other, lat, lon) {
  const B = (bearing(thr.lat, thr.lon, other.lat, other.lon) + 180) * D2R;
  const { e, n } = enOffset(thr.lat, thr.lon, lat, lon);
  return { x: e * Math.sin(B) + n * Math.cos(B), y: e * Math.cos(B) - n * Math.sin(B) };
}
export function surfaces(c) {
  const caseA = !!c.locAligned, tv = T(c.theta - 1.12), xo = c.origin === 'thr' ? 0 : 60;
  const xEnd = xo + c.och / tv;
  const D = (c.och - c.rdh) / T(c.theta), E = 120 + D * T(2), w0 = c.rwyWidth / 2 + 30, wA = c.inner / 2;
  const h0 = c.rdh > 15 ? c.rdh - 15 : 0, tphi = T(c.phi);
  return {
    caseA, xEnd, D, E,
    vssW: (x) => (caseA ? wA : c.strip / 2 + 0.15 * (x - 60)),
    vssH: (x) => (x - xo) * tv,
    ocsW: (x) => (caseA ? (x <= 60 ? w0 + ((wA - w0) * x) / 60 : wA) : w0 + ((E - w0) * x) / D),
    ocsH: (x) => h0 + x * tphi,
  };
}
export function evaluate(xy, c, s = surfaces(c)) {
  const { x, y } = xy, ay = Math.abs(y);
  const vss = x >= 60 && x <= s.xEnd && ay <= s.vssW(x);
  const ocs = x >= 0 && x <= s.D && ay <= s.ocsW(x);
  return {
    x, y, vss, ocs,
    vssLimitAMSL: vss ? c.thrElev + s.vssH(x) : null,
    ocsLimitAMSL: ocs ? c.thrElev + s.ocsH(x) : null,
  };
}
// Position uncertainty: test centre + 8 points on the accuracy circle; mixed answers => uncertain, limit = lowest across samples.
export function evaluateWithAccuracy(xy, acc, c) {
  const s = surfaces(c), pts = [xy];
  for (let i = 0; i < 8; i++) pts.push({ x: xy.x + acc * Math.cos((i * Math.PI) / 4), y: xy.y + acc * Math.sin((i * Math.PI) / 4) });
  const r = pts.map((p) => evaluate(p, c, s)), mixed = (k) => r.some((q) => q[k]) && r.some((q) => !q[k]);
  const low = (k) => Math.min(...r.filter((q) => q[k]).map((q) => q[k === 'vss' ? 'vssLimitAMSL' : 'ocsLimitAMSL']));
  return { ...r[0], vssUncertain: mixed('vss'), ocsUncertain: mixed('ocs'), vssLowest: r.some((q) => q.vss) ? low('vss') : null, ocsLowest: r.some((q) => q.ocs) ? low('ocs') : null };
}
