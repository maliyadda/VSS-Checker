import { parseCoord, toRunwayXY, surfaces, evaluateWithAccuracy, checkDesignator, distance } from './calc.js';
const $ = (id) => document.getElementById(id), num = (id) => { const v = $(id).value.trim(); return v === '' ? NaN : parseFloat(v); };
let DB, last = null, phiDirty = false, saved = [];
try { saved = JSON.parse(localStorage.getItem('vss-saved') || '[]'); } catch {}
const store = () => { try { localStorage.setItem('vss-saved', JSON.stringify(saved)); } catch {} };
const ap = () => DB.aerodromes.find((a) => a.icao === $('ap').value);
const rwy = () => ap().runways.find((r) => r.id === $('rw').value);

function fillRunway() {
  const a = ap(); $('rw').innerHTML = a.runways.map((r) => `<option>${r.id}</option>`).join('');
  $('strip').value = a.strip; $('inner').value = a.inner; $('flags').innerHTML = a.flags.map((f) => `<div class="msg w">${f}</div>`).join('');
  fillRwyW();
}
const fillRwyW = () => { $('rwyw').value = rwy().width; };
function autoPhi() {
  if (phiDirty) return; const t = $('type').value, th = num('theta'), cold = num('cold');
  const v = t === 'npa' ? th - 1 : t === 'apvg' ? th - 0.5 : t === 'apvb' ? cold - 0.5 : NaN;
  $('phi').value = Number.isFinite(v) ? +v.toFixed(2) : '';
}
function onType() { const t = $('type').value; $('coldwrap').hidden = t !== 'apvb'; if (t === 'pa') $('loc').checked = true; autoPhi(); }

function config() {
  const a = ap(), r = rwy(), o = a.runways.find((x) => x.id === r.opp), errs = [];
  const thr = { lat: parseCoord(r.lat, false), lon: parseCoord(r.lon, true) }, oth = { lat: parseCoord(o.lat, false), lon: parseCoord(o.lon, true) };
  if ([thr.lat, thr.lon, oth.lat, oth.lon].some(Number.isNaN)) errs.push('Threshold coordinates in the data file are invalid.');
  const c = { thrElev: r.elev, rwyWidth: num('rwyw'), strip: num('strip'), inner: num('inner'), och: num('och'), rdh: num('rdh'), theta: num('theta'), phi: num('phi'), locAligned: $('loc').checked, origin: $('origin').value };
  if (!(c.och > 0)) errs.push('Enter the OCH (m above threshold).');
  for (const k of ['rdh', 'theta', 'rwyWidth', 'strip', 'inner']) if (!Number.isFinite(c[k])) errs.push(`Missing value: ${k}.`);
  if (!Number.isFinite(c.phi)) errs.push('OCS slope φ is missing (PA: enter it, it is not defined in the supplied extract).');
  if (c.theta > 3.5) errs.push('Approach angle above 3.5°: the OCS values are not applicable.');
  if (c.och <= c.rdh) errs.push('OCH must be greater than RDH.');
  let warn = [];
  if (!errs.length) { const d = checkDesignator(thr, oth, r.id); if (!d.ok) { const m = `Runway ${r.id}: bearing to the opposite threshold is ${d.bearing.toFixed(0)}°, expected about ${d.expected}°. Designators or coordinates may be swapped.`; ($('override').checked ? warn : errs).push(m); } }
  return { c, thr, oth, errs, warn, r, a };
}

const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
function surfaceBlock(name, inside, unc, limit, lowest, ground, thrElev) {
  const cls = unc ? 'warn' : inside ? 'bad' : 'ok';
  const t = unc ? `${name}: uncertain, the GPS error circle crosses the edge` : inside ? `Inside ${name}` : `Outside ${name}`;
  let h = '';
  if (inside || unc) {
    const lim = lowest ?? limit, ag = lim - ground;
    h = `<div class="mute">${unc ? 'Lowest limit within GPS error' : 'Surface elevation here'}: ${f1(lim)} m AMSL</div>` +
      (Number.isFinite(ground) ? `<div class="big">${f1(ag)} <small>m max obstacle height above ground</small></div>${ag < 0 ? '<div class="msg">Ground is already above the surface.</div>' : ''}` : '<div class="msg w">Enter ground elevation to get the maximum height.</div>');
    if (name === 'VSS') h += `<div class="mute">Obstacles under ${f1(thrElev + 15)} m AMSL (15 m above THR) may be disregarded: confirm this reading of 5.4.6.4.</div>`;
  }
  return `<div class="verdict ${cls}"><b>${t}</b>${h}</div>`;
}
function plan(c, s, p) {
  const xm = Math.max(s.xEnd, s.D) * 1.05, ym = Math.max(s.vssW(s.xEnd), s.E, c.inner / 2, 150) * 1.15, X = (x) => 20 + ((x + 300) / (xm + 300)) * 320, Y = (y) => 70 - (y / ym) * 60;
  const poly = (pts, st) => `<polygon points="${pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')}" ${st}/>`;
  const ocsPts = s.caseA ? [[0, s.ocsW(0)], [60, s.ocsW(60)], [s.D, s.ocsW(s.D)]] : [[0, s.ocsW(0)], [s.D, s.E]];
  const ocs = [...ocsPts, ...ocsPts.map(([x, y]) => [x, -y]).reverse()];
  const vss = [[60, s.vssW(60)], [s.xEnd, s.vssW(s.xEnd)], [s.xEnd, -s.vssW(s.xEnd)], [60, -s.vssW(60)]];
  return `<svg viewBox="0 0 360 140" role="img" aria-label="Plan view">${poly(vss, 'fill="#e8b03055" stroke="#e8b030"')}${poly(ocs, 'fill="none" stroke="currentColor" stroke-dasharray="4 3"')}
  <rect x="${X(-300)}" y="${Y(c.rwyWidth / 2)}" width="${X(0) - X(-300)}" height="${Y(-c.rwyWidth / 2) - Y(c.rwyWidth / 2)}" fill="currentColor" opacity=".5"/>
  <circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="5" fill="#b3261e" stroke="#fff"/>
  <text x="22" y="134" font-size="9" fill="currentColor">amber = VSS, dashed = OCS, runway at left. Lateral scale exaggerated.</text></svg>`;
}
function run(pos) {
  const k = config(), out = $('out'); out.hidden = false;
  if (k.errs.length) { out.innerHTML = k.errs.map((e) => `<div class="msg">${e}</div>`).join(''); last = null; return; }
  const lat = pos?.lat ?? parseCoord($('lat').value, false), lon = pos?.lon ?? parseCoord($('lon').value, true), acc = pos?.acc ?? num('acc') ?? 0;
  if (Number.isNaN(lat) || Number.isNaN(lon)) { out.innerHTML = '<div class="msg">Enter a valid position or use GPS.</div>'; return; }
  const xy = toRunwayXY(k.thr, k.oth, lat, lon), ground = num('ground'), s = surfaces(k.c), e = evaluateWithAccuracy(xy, pos?.acc || 0, k.c);
  last = { time: new Date().toISOString(), icao: k.a.icao, rwy: k.r.id, lat, lon, acc: pos?.acc ?? '', x: xy.x, y: xy.y, vss: e.vssUncertain ? 'uncertain' : e.vss ? 'inside' : 'outside', ground, limit: e.vssLowest ?? e.vssLimitAMSL ?? '', och: k.c.och };
  out.innerHTML = k.warn.map((w) => `<div class="msg w">${w}</div>`).join('') +
    `<h2>Result: ${k.a.icao} runway ${k.r.id}</h2><div class="mute">${lat.toFixed(6)}, ${lon.toFixed(6)}${pos ? ` (±${Math.round(pos.acc)} m)` : ''} | ${f1(xy.x)} m out from THR, ${f1(xy.y)} m off centreline</div>` +
    surfaceBlock('VSS', e.vss, e.vssUncertain, e.vssLimitAMSL, e.vssLowest, ground, k.c.thrElev) + surfaceBlock('OCS', e.ocs, e.ocsUncertain, e.ocsLimitAMSL, e.ocsLowest, ground, k.c.thrElev) +
    plan(k.c, s, xy) + '<button class="alt" id="save">Save point</button>';
  $('save').onclick = () => { saved.push(last); store(); renderList(); };
}
function renderList() {
  $('listbox').hidden = !saved.length;
  $('list').innerHTML = '<tr><th>Rwy</th><th>VSS</th><th>Limit AMSL</th><th>Lat, lon</th></tr>' + saved.map((p) => `<tr><td>${p.icao} ${p.rwy}</td><td>${p.vss}</td><td>${p.limit === '' ? '-' : f1(p.limit)}</td><td>${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</td></tr>`).join('');
}
$('gps').onclick = () => {
  if (!navigator.geolocation) return alert('Geolocation is not available.');
  $('gps').textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition((g) => { $('gps').textContent = 'Use my position (GPS)'; $('lat').value = g.coords.latitude.toFixed(7); $('lon').value = g.coords.longitude.toFixed(7); run({ lat: g.coords.latitude, lon: g.coords.longitude, acc: g.coords.accuracy }); },
    (er) => { $('gps').textContent = 'Use my position (GPS)'; $('out').hidden = false; $('out').innerHTML = `<div class="msg">GPS failed: ${er.message}. Allow location for this site in Safari settings, or type the position.</div>`; }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
};
$('calc').onclick = () => run(null);
$('csv').onclick = () => {
  const h = Object.keys(saved[0]); const t = [h.join(','), ...saved.map((p) => h.map((k) => p[k]).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = 'vss-points.csv'; a.click();
};
$('clear').onclick = () => { if (confirm('Delete all saved points?')) { saved = []; store(); renderList(); } };
$('ap').onchange = fillRunway; $('rw').onchange = fillRwyW; $('type').onchange = onType;
for (const id of ['theta', 'cold']) $(id).oninput = autoPhi; $('phi').oninput = () => { phiDirty = true; };
fetch('data/aerodromes.json').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${r.url}`); return r.json(); }).then((d) => { DB = d; $('ap').innerHTML = d.aerodromes.map((a) => `<option value="${a.icao}">${a.icao}</option>`).join(''); fillRunway(); onType(); renderList(); })
  .catch((e) => { $('out').hidden = false; $('out').innerHTML = `<div class="msg">Could not load data/aerodromes.json (${e.message}). ${location.protocol === 'file:' ? 'Opened as a local file: host it on GitHub Pages or run a local server.' : 'Check that the data folder is in the repo next to index.html.'}</div>`; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
