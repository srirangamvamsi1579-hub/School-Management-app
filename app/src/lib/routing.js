// Route planning for school buses, in the spirit of ride apps: suggest the best order of stops, nearer pickup points
// for riders, and new stops where riders live far from any stop. Stops and homes sit on the school's route map
// (x, y in map units; 1 unit = 0.5 km, school at the centre). In production the map uses real coordinates and
// road distances from a maps API; the rules stay the same.
export const KM_PER_UNIT = 0.5;
export const SPEED_KMH = 22;        // average city bus speed at school times
export const STOP_MIN = 2;          // minutes at each stop
export const SCHOOL = { x: 50, y: 50, name: 'School' };
export const WALK_OK_KM = 0.6;      // a stop this close counts as walkable

export const km = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_UNIT;
const mins = (k) => (k / SPEED_KMH) * 60;
const r1 = (n) => Math.round(n * 10) / 10;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

// Morning drive: first stop → … → last stop → school
export function pathKm(stops) {
  let t = 0;
  stops.forEach((s, i) => { t += km(s, stops[i + 1] || SCHOOL); });
  return t;
}
export const pathMinutes = (stops) => Math.round(mins(pathKm(stops)) + STOP_MIN * stops.length);

function permutations(a) {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}
// Shortest order: every order for up to 7 stops; nearest-neighbour + 2-opt beyond that
export function shortestOrder(stops) {
  if (stops.length <= 7) return permutations(stops).reduce((best, p) => (pathKm(p) < pathKm(best) ? p : best), stops);
  let order = [...stops].sort((a, b) => km(b, SCHOOL) - km(a, SCHOOL));
  let better = true;
  while (better) {
    better = false;
    for (let i = 0; i < order.length - 1; i++) for (let j = i + 1; j < order.length; j++) {
      const next = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
      if (pathKm(next) + 1e-9 < pathKm(order)) { order = next; better = true; }
    }
  }
  return order;
}

export const ridersAt = (db, routeId, stopName) => db.students.filter((s) => s.status === 'Active' && s.routeId === routeId && s.stop === stopName);

// Stops closer than WALK_OK_KM merge into the one with more riders
function mergeClose(db, route) {
  const keep = [...route.stops].sort((a, b) => ridersAt(db, route.id, b.name).length - ridersAt(db, route.id, a.name).length);
  const kept = [], merges = [];
  keep.forEach((s) => { const near = kept.find((k) => km(k, s) < WALK_OK_KM); if (near) merges.push({ from: s.name, into: near.name, walkKm: r1(km(s, near)), riders: ridersAt(db, route.id, s.name).length }); else kept.push(s); });
  return { kept, merges };
}

// Options for one route, best first. Each can be applied as it is.
export function routeOptions(db, routeId) {
  const route = db.routes.find((r) => r.id === routeId);
  const stops = route.stops.filter((s) => s.x != null);
  const now = { key: 'CURRENT', name: 'Keep the current order', desc: 'The order the driver follows today.', order: stops, merges: [] };
  const best = { key: 'SHORTEST', name: 'Shortest drive', desc: 'Same stops, in the order with the least driving.', order: shortestOrder(stops), merges: [] };
  const outIn = { key: 'OUTSIDE_IN', name: 'Farthest stop first', desc: 'Start at the stop farthest from school and work inwards. Easy for drivers to remember.', order: [...stops].sort((a, b) => km(b, SCHOOL) - km(a, SCHOOL)), merges: [] };
  const { kept, merges } = mergeClose(db, route);
  const fewer = { key: 'FEWER_STOPS', name: 'Fewer stops', desc: merges.length ? `Combine stops within ${WALK_OK_KM * 1000} m walking of each other, then the shortest order.` : `No two stops are within ${WALK_OK_KM * 1000} m of each other, so no stop can be combined.`, order: shortestOrder(kept), merges };
  const base = pathKm(stops);
  return [now, best, outIn, ...(merges.length ? [fewer] : [])].map((o) => {
    const k = pathKm(o.order);
    return { ...o, km: r1(k), minutes: pathMinutes(o.order), saveKm: r1(base - k), saveMin: pathMinutes(stops) - pathMinutes(o.order), names: o.order.map((s) => s.name) };
  }).sort((a, b) => (a.key === 'CURRENT') - (b.key === 'CURRENT') || a.minutes - b.minutes);
}

// Stop times from the order: morning times work back from when the bus must reach school; afternoon drops run in reverse after it leaves
export function timingsFor(order, schoolArrive, schoolLeave) {
  const am = []; let t = toMin(schoolArrive) - 5;
  for (let i = order.length - 1; i >= 0; i--) { t -= mins(km(order[i], order[i + 1] || SCHOOL)); am[i] = t; t -= STOP_MIN; }
  const pm = []; let p = toMin(schoolLeave) + 10;
  [...order].reverse().forEach((s, j, rev) => { p += mins(km(rev[j - 1] || SCHOOL, s)); pm[order.length - 1 - j] = p; p += STOP_MIN; });
  return order.map((s, i) => ({ ...s, order: i + 1, am: toTime(Math.floor(am[i])), pm: toTime(Math.ceil(pm[i])) }));
}

export function applyOption(db, routeId, key, by) {
  const route = db.routes.find((r) => r.id === routeId);
  const opt = routeOptions(db, routeId).find((o) => o.key === key);
  if (!opt) throw new Error('Option not found');
  opt.merges.forEach((m) => db.students.filter((s) => s.routeId === routeId && s.stop === m.from).forEach((s) => { s.stop = m.into; }));
  route.stops = timingsFor(opt.order, route.schoolArrive, route.schoolLeave);
  db.routePlans = db.routePlans || [];
  db.routePlans.unshift({ routeId, option: opt.name, km: opt.km, minutes: opt.minutes, saveMin: opt.saveMin, merged: opt.merges.length, by, at: new Date().toISOString() });
  return route;
}

// Ride-app style pickup suggestions: a nearer stop (same or another route with seats), or a new stop where riders live far from any stop
export function pickupSuggestions(db, routeId = null) {
  const riders = db.students.filter((s) => s.status === 'Active' && s.routeId && s.home && (!routeId || s.routeId === routeId));
  const seatsLeft = Object.fromEntries(db.routes.map((r) => [r.id, r.capacity - db.students.filter((s) => s.status === 'Active' && s.routeId === r.id).length]));
  const allStops = db.routes.flatMap((r) => r.stops.filter((s) => s.x != null).map((s) => ({ ...s, routeId: r.id })));
  const moves = [], far = [];
  riders.forEach((s) => {
    const cur = allStops.find((x) => x.routeId === s.routeId && x.name === s.stop);
    if (!cur) return;
    const nowKm = km(s.home, cur);
    const nearest = allStops.filter((x) => x.routeId === s.routeId || seatsLeft[x.routeId] > 0).sort((a, b) => km(s.home, a) - km(s.home, b))[0];
    const newKm = km(s.home, nearest);
    if (newKm > 1.2) far.push({ s, k: newKm });
    else if (nearest && (nearest.name !== cur.name || nearest.routeId !== cur.routeId) && nowKm - newKm >= 0.4) {
      moves.push({ studentId: s.id, name: `${s.first} ${s.last || ''}`.trim(), fromRoute: s.routeId, fromStop: cur.name, toRoute: nearest.routeId, toStop: nearest.name, nowKm: r1(nowKm), newKm: r1(newKm) });
    }
  });
  // Group far-away riders on the same route who live within 1 km of each other
  const groups = [];
  far.forEach(({ s }) => {
    const g = groups.find((x) => x.routeId === s.routeId && x.members.some((m) => km(m.home, s.home) < 1));
    if (g) g.members.push(s); else groups.push({ routeId: s.routeId, members: [s] });
  });
  const newStops = groups.filter((g) => g.members.length >= 2).map((g) => {
    const x = g.members.reduce((a, m) => a + m.home.x, 0) / g.members.length, y = g.members.reduce((a, m) => a + m.home.y, 0) / g.members.length;
    const cur = g.members.map((m) => km(m.home, allStops.find((st) => st.routeId === m.routeId && st.name === m.stop) || SCHOOL));
    return { routeId: g.routeId, x: r1(x), y: r1(y), riders: g.members.map((m) => ({ id: m.id, name: `${m.first} ${m.last || ''}`.trim() })), nowKm: r1(cur.reduce((a, b) => a + b, 0) / cur.length),
      newKm: r1(g.members.reduce((a, m) => a + km(m.home, { x, y }), 0) / g.members.length) };
  });
  return { moves, newStops };
}

export function moveRider(db, studentId, routeId, stop) {
  const s = db.students.find((x) => x.id === studentId);
  s.routeId = routeId; s.stop = stop;
  return s;
}

// Add a stop on the map; it goes where it adds the least driving, and the route's times are worked out again
export function addStop(db, routeId, { name, x, y, riders = [] }) {
  const route = db.routes.find((r) => r.id === routeId);
  if (!name?.trim()) throw new Error('Give the stop a name (a landmark parents know)');
  if (route.stops.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('This route already has a stop with that name');
  const stop = { name: name.trim(), x: r1(x), y: r1(y) };
  let best = null;
  for (let i = 0; i <= route.stops.length; i++) { const o = [...route.stops.slice(0, i), stop, ...route.stops.slice(i)]; if (!best || pathKm(o) < pathKm(best)) best = o; }
  route.stops = timingsFor(best, route.schoolArrive, route.schoolLeave);
  riders.forEach((id) => moveRider(db, id, routeId, stop.name));
  return route;
}
export function moveStop(db, routeId, stopName, x, y) {
  const route = db.routes.find((r) => r.id === routeId);
  const s = route.stops.find((st) => st.name === stopName);
  s.x = r1(x); s.y = r1(y);
  route.stops = timingsFor(route.stops, route.schoolArrive, route.schoolLeave);
  return route;
}
export function removeStop(db, routeId, stopName) {
  const route = db.routes.find((r) => r.id === routeId);
  if (ridersAt(db, routeId, stopName).length) throw new Error('Move the riders at this stop to another stop first');
  if (route.stops.length <= 1) throw new Error('A route needs at least one stop');
  route.stops = timingsFor(route.stops.filter((s) => s.name !== stopName), route.schoolArrive, route.schoolLeave);
  return route;
}
