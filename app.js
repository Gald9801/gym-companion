/* Gym Companion — local-first PWA. All data in IndexedDB on this device. */
'use strict';

/* ---------------- IndexedDB ---------------- */
const DB_NAME = 'gymapp';
let db = null;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      for (const s of ['sets', 'food', 'weight', 'library']) {
        if (!d.objectStoreNames.contains(s)) {
          const st = d.createObjectStore(s, { keyPath: 'id' });
          st.createIndex('date', 'date');
        }
      }
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const store = (n, m) => db.transaction(n, m || 'readonly').objectStore(n);
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const dbPut = (n, v) => reqP(store(n, 'readwrite').put(v));
const dbDel = (n, id) => reqP(store(n, 'readwrite').delete(id));
const dbAll = n => reqP(store(n).getAll());
const dbGet = (n, id) => reqP(store(n).get(id));
const dbByDate = (n, date) => reqP(store(n).index('date').getAll(date));
const kvGet = k => reqP(store('kv').get(k));
const kvSet = (k, v) => reqP(store('kv', 'readwrite').put(v, k));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));

/* ---------------- Defaults ---------------- */
const DEFAULT_SETTINGS = {
  calTarget: 1809, calCeiling: 1900, proteinTarget: 140, proteinFloor: 130,
  goalWeight: 75, startWeight: 86.2, defaultRest: 90,
};

const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

const DEFAULT_PLAN = {
  FBA: { name: 'Full Body A', day: 1, exercises: [
    { id: 'goblet-squat', name: 'Goblet Squat', sets: 3, reps: '8-12', rest: 120, suggest: '12 kg (restart; was 14.9×12)', cue: 'Hold 1 DB vertical at chest. Feet slightly wider than shoulders. Squat to parallel or below, knees over toes. Gym alt: leg press once comfortable.', video: yt('goblet squat proper form') },
    { id: 'flat-db-bench', name: 'Flat DB Bench Press', sets: 3, reps: '8-12', rest: 120, suggest: '10 kg/hand (restart; was 12.4 top)', cue: 'Lower to mid-chest, elbows ~45°. Shoulder blades pinched. Press straight up.', video: yt('flat dumbbell bench press form') },
    { id: 'bent-row', name: 'Bent-over DB Row', sets: 3, reps: '8-12', rest: 120, suggest: '10 kg/hand (restart; was 12.4)', cue: 'Hinge ~45°, back FLAT. Row to lower ribs, squeeze blades. Gym alt: chest-supported row machine or seated cable row — easier on lower back.', video: yt('bent over dumbbell row form') },
    { id: 'shoulder-press', name: 'Seated DB Shoulder Press', sets: 3, reps: '8-12', rest: 120, suggest: '8 kg/hand (restart; was 10.75)', cue: 'Bench fully upright, back on pad. Press straight up. KEEP TENSION AT TOP — no free-fall release (prevents right-shoulder click).', video: yt('seated dumbbell shoulder press form') },
    { id: 'bicep-curls', name: 'DB Bicep Curls', sets: 2, reps: '10-12', rest: 60, suggest: '6 kg/hand, strict', cue: 'Standing, elbows pinned to sides. No swinging, no back arch. Earn the jump with 12,12 clean.', video: yt('dumbbell bicep curl strict form') },
    { id: 'tricep-ext', name: 'Overhead Tricep Extension', sets: 2, reps: '10-12', rest: 60, suggest: '8 kg (restart; was 10)', cue: 'One DB, both hands. Lower behind head, elbows still. Gym alt: cable rope pushdown — kinder to the right elbow.', video: yt('overhead dumbbell tricep extension form') },
  ]},
  FBB: { name: 'Full Body B', day: 3, exercises: [
    { id: 'rdl', name: 'DB Romanian Deadlift', sets: 3, reps: '8-12', rest: 120, suggest: '12 kg/hand — FULL ROM to mid-shin', cue: 'Slight knee bend, LOCKED. Push hips BACK, DBs slide down legs to MID-SHIN. Hamstring stretch = the rep worked. Range > load.', video: yt('dumbbell romanian deadlift form') },
    { id: 'incline-bench', name: 'Incline DB Bench Press', sets: 3, reps: '8-12', rest: 120, suggest: '10 kg/hand (restart; was 10.75)', cue: 'Bench 30-45°. Lower to upper chest, press up. Loose grip, no white-knuckling.', video: yt('incline dumbbell bench press form') },
    { id: 'assisted-pullup', name: 'Assisted Pull-up (machine)', sets: 3, reps: '6-10', rest: 120, suggest: 'Set assist so 6-10 clean reps', cue: 'Kneel on pad, palms away, pull until chin clears bar. Progress = LESS assist weight, not more reps. No machine? Lat pulldown, same muscles.', video: yt('assisted pull up machine how to use') },
    { id: 'lateral-raises', name: 'DB Lateral Raises', sets: 3, reps: '12-15', rest: 60, suggest: '4-5 kg/hand, stay until 3×15 clean', cue: 'Slight elbow bend, raise to shoulder height. Shoulders DOWN (no shrugging). Breathe out on raise.', video: yt('dumbbell lateral raise proper form') },
    { id: 'hammer-curls', name: 'DB Hammer Curls', sets: 2, reps: '10-12', rest: 60, suggest: '6 kg/hand (was 6.75×10)', cue: 'Palms face each other, thumbs up. Controlled, no swing.', video: yt('dumbbell hammer curl form') },
    { id: 'skull-crushers', name: 'DB Skull Crushers', sets: 2, reps: '10-12', rest: 60, suggest: '4-5 kg/hand', cue: 'Lying on bench, lower DBs toward forehead, elbows still. Aim 12,12 clean before adding weight.', video: yt('dumbbell skull crusher form') },
  ]},
  FBC: { name: 'Full Body C', day: 5, exercises: [
    { id: 'bulgarian-split', name: 'Bulgarian Split Squat', sets: 3, reps: '8-12/leg', rest: 120, suggest: 'BW; match weaker LEFT leg first', cue: 'Rear foot on bench, lower until front thigh parallel, drive through front heel. KEY EXERCISE. Add DBs only after 10-12 clean each leg.', video: yt('bulgarian split squat form') },
    { id: 'bench-variation', name: 'Flat or Incline DB Bench', sets: 3, reps: '10-12', rest: 120, suggest: '10 kg/hand, higher reps today', cue: 'Pick whichever angle was lighter earlier this week. Slightly higher reps.', video: yt('dumbbell bench press form') },
    { id: 'single-arm-row', name: 'Single-arm DB Row', sets: 3, reps: '8-12/side', rest: 90, suggest: '12 kg/side (restart; was 14 target)', cue: 'Knee + hand on bench. Row DB to hip, elbow close. Switch sides.', video: yt('single arm dumbbell row form') },
    { id: 'face-pulls', name: 'Cable Face Pulls', sets: 3, reps: '15', rest: 60, suggest: 'Light cable, rope attachment', cue: 'Cable at face height, pull rope to face, elbows flare HIGH. Squeeze rear delts. Slow tempo, hold the contraction. No cable? Band works.', video: yt('cable face pull form') },
    { id: 'walking-lunges', name: 'DB Walking Lunges', sets: 2, reps: '10-15/leg', rest: 90, suggest: '5-6 kg/hand', cue: 'DB each hand. Step forward, back knee near floor, push off front foot.', video: yt('dumbbell walking lunges form') },
    { id: 'hanging-leg-raises', name: 'Hanging Leg Raises', sets: 2, reps: '10-15', rest: 60, suggest: '15-20 reps or 2-sec holds', cue: 'Hang from bar, raise legs to parallel, no swinging. Gym alt: captain’s chair.', video: yt('hanging leg raise form') },
  ]},
};

const DEFAULT_LIBRARY = [
  ['Mirabol Whey 94 (30g scoop)', 123, 23, 1, 2], ['Whole milk 100ml', 62, 3, 5, 3.5],
  ['Sugar 5g (1 tsp)', 20, 0, 5, 0], ['Sugar 12g (treat shake)', 48, 0, 12, 0],
  ['Creatine gummies (4 = 5g)', 45, 0, 10, 0],
  ['Iced Spanish latte (medium)', 250, 7, 28, 9], ['Starbucks iced Spanish latte (med)', 270, 8, 30, 9],
  ['Raw chicken breast 100g', 120, 22.5, 0, 2.6], ['Raw chicken breast 250g', 300, 56, 0, 6.5],
  ['Whole egg (large)', 70, 6, 0.5, 5], ['Khubz (1 piece, 62g)', 183, 6.5, 27, 5.4],
  ['Khubz half (31g)', 92, 3.25, 13.5, 2.7], ['Sadia french fries 100g', 138, 2.4, 23, 4.4],
  ['Jumbo beef patty 100g', 199, 13, 2.6, 15], ['Ketchup 50g', 55, 0, 13, 0],
  ['Indomie noodles (1 packet)', 400, 7, 55, 16], ['Pringles 100g', 528, 4, 49, 33],
  ['Pepperoni pizza slice', 285, 12, 30, 13], ['Greek yogurt full fat 200g', 130, 18, 9, 5],
  ['Classic diet burger', 473, 31, 40, 21], ['Chicken quesadilla', 343, 39, 20, 10],
  ['Mushroom beef slider', 420, 30, 41, 15], ['Lamb biryani', 410, 23, 61, 8],
  ['McRoyale', 576, 28, 40, 30], ['Hardee’s Big Deluxe', 630, 28, 45, 35],
  ['Hardee’s 3-pc tenders', 260, 25, 15, 10], ['Tik dessert', 200, 5, 26, 8],
  ['KDD half cream milk 100ml', 52, 3.4, 5, 2],
].map((f, i) => ({ id: 'lib-' + String(i).padStart(3, '0'), name: f[0], cal: f[1], protein: f[2], carbs: f[3], fat: f[4], ts: 0 }));

/* ---------------- State ---------------- */
const state = {
  tab: 'workout',
  date: todayStr(),
  session: null,       // FBA | FBB | FBC
  settings: { ...DEFAULT_SETTINGS },
  plan: null,
  foodSearch: '',
};

function todayStr(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function fmtDate(s) {
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function shiftDate(s, days) {
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + days); return todayStr(d);
}
function sessionForDate(s) {
  const wd = new Date(s + 'T12:00:00').getDay();
  for (const k of Object.keys(state.plan)) if (state.plan[k].day === wd) return k;
  return null;
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------------- Toast / modal ---------------- */
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}
function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '<div class="modal-back" data-action="modal-close"><div class="modal">' + html + '</div></div>';
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

/* ---------------- Rest timer ---------------- */
const timer = { end: 0, total: 0, left: 0, running: false, iv: null, label: '' };
function startTimer(seconds, label) {
  timer.total = seconds; timer.left = seconds; timer.end = Date.now() + seconds * 1000;
  timer.running = true; timer.label = label || 'Rest';
  clearInterval(timer.iv);
  timer.iv = setInterval(tickTimer, 250);
  document.getElementById('timerbar').classList.remove('hidden', 'finished');
  document.getElementById('timer-pause-btn').textContent = 'Pause';
  tickTimer();
}
function tickTimer() {
  if (timer.running) timer.left = Math.max(0, Math.round((timer.end - Date.now()) / 1000));
  const m = Math.floor(timer.left / 60), s = timer.left % 60;
  document.getElementById('timer-time').textContent = m + ':' + String(s).padStart(2, '0');
  document.getElementById('timer-label').textContent = timer.label + (timer.left === 0 ? ' — GO!' : '');
  if (timer.left === 0 && timer.running) {
    timer.running = false; clearInterval(timer.iv);
    document.getElementById('timerbar').classList.add('finished');
    beep();
    setTimeout(hideTimer, 8000);
  }
}
function hideTimer() {
  clearInterval(timer.iv); timer.running = false;
  document.getElementById('timerbar').classList.add('hidden');
}
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx(); const now = ctx.currentTime;
    [0, 0.28, 0.56].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i === 2 ? 1318 : 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.35, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.22);
      o.start(now + t); o.stop(now + t + 0.24);
    });
  } catch (e) { /* audio blocked until first tap; vibration below still fires */ }
  if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 500]);
}

/* ---------------- Wake lock ---------------- */
let wakeLock = null;
async function toggleWakeLock() {
  const btn = document.getElementById('wake-btn');
  if (wakeLock) { await wakeLock.release(); wakeLock = null; btn.classList.remove('on'); toast('Screen can sleep again'); return; }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; btn.classList.remove('on'); });
    btn.classList.add('on'); toast('Screen will stay on');
  } catch (e) { toast('Wake lock not available'); }
}
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && wakeLock === null && document.getElementById('wake-btn').classList.contains('on')) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
});

/* ---------------- Session stopwatch ---------------- */
const SW_KEY = 'gymapp-stopwatch';
let swIv = null;
function swState() { try { return JSON.parse(localStorage.getItem(SW_KEY)) || { run: false, acc: 0, t0: 0 }; } catch (e) { return { run: false, acc: 0, t0: 0 }; } }
function swSave(s) { localStorage.setItem(SW_KEY, JSON.stringify(s)); }
function swElapsed(s) { return s.acc + (s.run ? Date.now() - s.t0 : 0); }
function swFmt(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(x).padStart(2, '0');
}
function swTick() {
  const el = document.getElementById('sw-display');
  if (!el) { clearInterval(swIv); swIv = null; return; }
  el.textContent = swFmt(swElapsed(swState()));
}
function swEnsureTicking() {
  if (swState().run && !swIv) swIv = setInterval(swTick, 500);
}
function swStart() {
  const s = swState();
  if (!s.run) { s.run = true; s.t0 = Date.now(); swSave(s); swEnsureTicking(); }
}

/* ---------------- Workout tab ---------------- */
async function renderWorkout() {
  const v = document.getElementById('view');
  const sess = state.session;
  const daySets = (await dbByDate('sets', state.date)).sort((a, b) => a.ts - b.ts);
  const allSets = await dbAll('sets');

  let html = datebarHTML();
  html += '<div class="chips">' + Object.keys(state.plan).map(k =>
    `<button class="chip ${sess === k ? 'active' : ''}" data-action="pick-session" data-k="${k}">${esc(state.plan[k].name)}</button>`
  ).join('') + '</div>';

  const sws = swState();
  html += `<div class="card row between" style="padding:10px 14px">
    <div class="row"><span class="tiny">SESSION&nbsp;</span><b id="sw-display" style="font-size:18px;font-variant-numeric:tabular-nums">${swFmt(swElapsed(sws))}</b></div>
    <div class="row">
      <button class="pill" data-action="sw-toggle">${sws.run ? '⏸ Pause' : '▶ Start'}</button>
      <button class="pill" data-action="sw-reset">↺</button>
    </div>
  </div>
  <div class="chips">
    <span class="tiny" style="align-self:center">Rest timer:</span>
    <button class="chip small" data-action="quick-rest" data-s="60">1:00</button>
    <button class="chip small" data-action="quick-rest" data-s="90">1:30</button>
    <button class="chip small" data-action="quick-rest" data-s="120">2:00</button>
    <button class="chip small" data-action="quick-rest" data-s="180">3:00</button>
  </div>`;
  swEnsureTicking();

  if (!sess) {
    const auto = sessionForDate(state.date);
    html += `<div class="card"><h3>Rest day 🛋️</h3><div class="muted">${auto ? '' : 'No session scheduled for this date. '}Pick a session above if you’re training. Walk 8-10k steps either way.</div></div>`;
    if (daySets.length) html += `<div class="card"><div class="muted">${daySets.length} sets already logged today — pick the session above to see them.</div></div>`;
    v.innerHTML = html; return;
  }

  const plan = state.plan[sess];
  for (const ex of plan.exercises) {
    const exSets = daySets.filter(s => s.exercise === ex.id);
    const last = lastSession(allSets, ex.id, state.date);
    const imgSrc = ex.img || ('img/' + ex.id + '.jpg');
    html += `<div class="card" data-ex="${ex.id}">
      <div class="ex-head">
        <img class="ex-thumb" src="${esc(imgSrc)}" alt="" loading="lazy" data-action="show-img" data-src="${esc(imgSrc)}" data-name="${esc(ex.name)}" onerror="this.classList.add('noimg')">
        <div class="grow">
          <div class="ex-title">${esc(ex.name)}</div>
          <div class="ex-target">${ex.sets}×${esc(ex.reps)} · ${ex.rest >= 60 ? (ex.rest / 60) + 'min' : ex.rest + 's'}</div>
        </div>
      </div>`;
    if (last) html += `<div class="lastline">Last (${fmtDate(last.date)}): <b>${last.txt}</b></div>`;
    if (ex.suggest) html += `<div class="suggest">→ ${esc(ex.suggest)}</div>`;

    exSets.forEach((s, i) => {
      html += `<div class="setline"><span class="setno">S${i + 1}</span>
        <span class="done">${s.weight > 0 ? s.weight + ' kg' : 'BW'} × ${s.reps}${s.note ? ' <small>' + esc(s.note) + '</small>' : ''}</span>
        <button class="del" data-action="del-set" data-id="${s.id}">✕</button></div>`;
    });

    const pre = prefill(exSets, last);
    html += `<div class="setline"><span class="setno">S${exSets.length + 1}</span>
      <input type="number" inputmode="decimal" step="0.25" placeholder="kg" value="${pre.w}" id="w-${ex.id}">
      <span class="x">×</span>
      <input type="number" inputmode="numeric" placeholder="reps" value="${pre.r}" id="r-${ex.id}">
      <button class="btn green mini grow" data-action="log-set" data-ex="${ex.id}" data-rest="${ex.rest}">Log set ▸ rest</button>
    </div>
    <div class="exlinks">
      <a class="linkbtn" href="${esc(ex.video)}" target="_blank" rel="noopener">🎬 Form video</a>
      <button class="linkbtn" data-action="toggle-cues" style="border:none;background:var(--bg3)">📋 Cues</button>
      <button class="linkbtn" data-action="quick-rest" data-s="${ex.rest}" style="border:none;background:var(--bg3)">⏱ Rest ${ex.rest >= 60 ? Math.floor(ex.rest / 60) + ':' + String(ex.rest % 60).padStart(2, '0') : ex.rest + 's'}</button>
    </div>
    <div class="cues">${esc(ex.cue)}</div>
    </div>`;
  }
  html += `<button class="btn sec wide" data-action="add-note-set">+ Log extra exercise (not in plan)</button>`;
  v.innerHTML = html;
}
function lastSession(allSets, exId, beforeDate) {
  const dates = [...new Set(allSets.filter(s => s.exercise === exId && s.date < beforeDate).map(s => s.date))].sort();
  if (!dates.length) return null;
  const d = dates[dates.length - 1];
  const sets = allSets.filter(s => s.exercise === exId && s.date === d).sort((a, b) => a.ts - b.ts);
  return { date: d, txt: sets.map(s => (s.weight > 0 ? s.weight : 'BW') + '×' + s.reps).join(', '), sets };
}
function prefill(todaySets, last) {
  if (todaySets.length) { const s = todaySets[todaySets.length - 1]; return { w: s.weight || '', r: s.reps || '' }; }
  if (last && last.sets.length) { const s = last.sets[last.sets.length - 1]; return { w: s.weight || '', r: '' }; }
  return { w: '', r: '' };
}
async function logSet(exId, rest) {
  const w = parseFloat(document.getElementById('w-' + exId).value) || 0;
  const r = parseInt(document.getElementById('r-' + exId).value, 10);
  if (!r) { toast('Enter reps'); return; }
  await dbPut('sets', { id: uid(), date: state.date, session: state.session, exercise: exId, weight: w, reps: r, note: '', ts: Date.now() });
  swStart(); // first set of the day starts the session clock
  const ex = state.plan[state.session].exercises.find(e => e.id === exId);
  startTimer(rest || state.settings.defaultRest, 'Rest — ' + (ex ? ex.name : exId));
  render();
}
function extraExerciseModal() {
  openModal(`<h3>Log extra exercise</h3>
    <label>Exercise name</label><input type="text" id="xx-name" placeholder="e.g. Lat Pulldown">
    <div class="formgrid"><div><label>Weight (kg, 0=BW)</label><input type="number" id="xx-w" inputmode="decimal"></div>
    <div><label>Reps</label><input type="number" id="xx-r" inputmode="numeric"></div></div>
    <button class="btn wide" data-action="save-extra">Log it</button>`);
}
async function saveExtra() {
  const name = document.getElementById('xx-name').value.trim();
  const w = parseFloat(document.getElementById('xx-w').value) || 0;
  const r = parseInt(document.getElementById('xx-r').value, 10);
  if (!name || !r) { toast('Name and reps required'); return; }
  await dbPut('sets', { id: uid(), date: state.date, session: state.session || 'EXTRA', exercise: 'custom:' + name, weight: w, reps: r, note: '', ts: Date.now() });
  closeModal(); toast('Logged'); render();
}

/* ---------------- Food tab ---------------- */
async function renderFood() {
  const v = document.getElementById('view');
  const s = state.settings;
  const entries = (await dbByDate('food', state.date)).sort((a, b) => a.ts - b.ts);
  const cal = Math.round(entries.reduce((t, e) => t + (e.cal || 0), 0));
  const pro = Math.round(entries.reduce((t, e) => t + (e.protein || 0), 0) * 10) / 10;

  let chip, cls;
  if (!entries.length) { chip = 'Nothing logged'; cls = 'st-none'; }
  else if (cal > s.calCeiling) { chip = '⚠ Over calories'; cls = 'st-over'; }
  else if (pro >= s.proteinFloor) { chip = '✓ On track'; cls = 'st-hit'; }
  else { chip = 'Low protein'; cls = 'st-low'; }

  let html = datebarHTML();
  html += `<div class="totals">
    <div class="total-box"><div class="tiny">CALORIES</div>
      <div class="val">${cal}<small> / ${s.calTarget}</small></div>
      <div class="bar"><i class="${cal > s.calCeiling ? 'over' : ''}" style="width:${Math.min(100, cal / s.calTarget * 100)}%"></i></div></div>
    <div class="total-box"><div class="tiny">PROTEIN</div>
      <div class="val">${pro}<small> / ${s.proteinTarget}g</small></div>
      <div class="bar"><i style="width:${Math.min(100, pro / s.proteinTarget * 100)}%"></i></div></div>
  </div>
  <div class="row between" style="margin-bottom:12px">
    <span class="status-chip ${cls}">${chip}</span>
    <span class="tiny">${cal <= s.calTarget ? (s.calTarget - cal) + ' kcal left' : (cal - s.calTarget) + ' over target'}</span>
  </div>
  <div class="row" style="margin-bottom:10px">
    <button class="btn grow" data-action="food-add">+ Add food</button>
    <button class="btn sec" data-action="food-custom">Custom</button>
  </div>`;

  html += '<div class="card">';
  if (!entries.length) html += '<div class="muted">No food logged for this day yet.</div>';
  for (const e of entries) {
    html += `<div class="foodline"><span class="fname">${esc(e.name)}</span>
      <span class="fmacro">${Math.round(e.cal)} kcal · ${Math.round(e.protein * 10) / 10}g</span>
      <button class="del" data-action="del-food" data-id="${e.id}">✕</button></div>`;
  }
  html += '</div>';
  v.innerHTML = html;
}
async function foodAddModal() {
  const lib = (await dbAll('library')).sort((a, b) => a.name.localeCompare(b.name));
  openModal(`<h3>Add food</h3>
    <div class="searchwrap"><input type="text" id="food-q" placeholder="Search your food library…" autocomplete="off"></div>
    <div class="libresults" id="lib-results"></div>`);
  const renderResults = q => {
    const ql = q.toLowerCase();
    const hits = lib.filter(f => f.name.toLowerCase().includes(ql)).slice(0, 30);
    document.getElementById('lib-results').innerHTML = hits.map(f =>
      `<div class="libitem"><span class="fname">${esc(f.name)}<br><span class="tiny">${f.cal} kcal · ${f.protein}g protein</span></span>
       <div class="qtybtns">
         <button class="btn sec mini" data-action="lib-add" data-id="${f.id}" data-qty="0.5">½</button>
         <button class="btn green mini" data-action="lib-add" data-id="${f.id}" data-qty="1">+1</button>
         <button class="btn sec mini" data-action="lib-add" data-id="${f.id}" data-qty="2">+2</button>
       </div></div>`).join('') || '<div class="muted">No match — use Custom to add a new food.</div>';
  };
  renderResults('');
  document.getElementById('food-q').addEventListener('input', e => renderResults(e.target.value));
  document.getElementById('food-q').focus();
}
async function libAdd(id, qty) {
  const f = await dbGet('library', id);
  if (!f) return;
  await dbPut('food', { id: uid(), date: state.date, name: f.name + (qty !== 1 ? ' ×' + qty : ''), cal: f.cal * qty, protein: f.protein * qty, carbs: (f.carbs || 0) * qty, fat: (f.fat || 0) * qty, ts: Date.now() });
  toast('Added ' + f.name); render();
}
function foodCustomModal() {
  openModal(`<h3>Custom food</h3>
    <label>Name</label><input type="text" id="cf-name" placeholder="e.g. Shawarma wrap">
    <div class="formgrid">
      <div><label>Calories</label><input type="number" id="cf-cal" inputmode="numeric"></div>
      <div><label>Protein (g)</label><input type="number" id="cf-pro" inputmode="decimal"></div>
      <div><label>Carbs (g, optional)</label><input type="number" id="cf-carb" inputmode="decimal"></div>
      <div><label>Fat (g, optional)</label><input type="number" id="cf-fat" inputmode="decimal"></div>
    </div>
    <label class="row" style="margin-top:12px"><input type="checkbox" id="cf-save" style="width:auto" checked> <span class="muted">Save to library for next time</span></label>
    <button class="btn wide" data-action="save-custom-food">Add to today</button>`);
}
async function saveCustomFood() {
  const name = document.getElementById('cf-name').value.trim();
  const cal = parseFloat(document.getElementById('cf-cal').value) || 0;
  const pro = parseFloat(document.getElementById('cf-pro').value) || 0;
  const carb = parseFloat(document.getElementById('cf-carb').value) || 0;
  const fat = parseFloat(document.getElementById('cf-fat').value) || 0;
  if (!name || !cal) { toast('Name and calories required'); return; }
  await dbPut('food', { id: uid(), date: state.date, name, cal, protein: pro, carbs: carb, fat, ts: Date.now() });
  if (document.getElementById('cf-save').checked)
    await dbPut('library', { id: uid(), name, cal, protein: pro, carbs: carb, fat, ts: Date.now() });
  closeModal(); toast('Added'); render();
}

/* ---------------- Weight tab ---------------- */
async function renderWeight() {
  const v = document.getElementById('view');
  const s = state.settings;
  const entries = (await dbAll('weight')).sort((a, b) => a.date.localeCompare(b.date));
  const cur = entries.length ? entries[entries.length - 1] : null;
  const wk = entries.filter(e => e.date >= shiftDate(todayStr(), -7));
  const wkTrend = wk.length >= 2 ? (wk[wk.length - 1].kg - wk[0].kg) : null;

  let html = `<div class="stat-grid">
    <div class="stat"><div class="k">Current</div><div class="v">${cur ? cur.kg + ' kg' : '—'}</div><div class="tiny">${cur ? fmtDate(cur.date) : ''}</div></div>
    <div class="stat"><div class="k">To goal (${s.goalWeight} kg)</div><div class="v ${cur && cur.kg > s.goalWeight ? '' : 'good'}">${cur ? (Math.round((cur.kg - s.goalWeight) * 10) / 10) + ' kg' : '—'}</div></div>
    <div class="stat"><div class="k">Since start (${s.startWeight} kg)</div><div class="v ${cur && cur.kg <= s.startWeight ? 'good' : 'bad'}">${cur ? (cur.kg - s.startWeight > 0 ? '+' : '') + (Math.round((cur.kg - s.startWeight) * 10) / 10) + ' kg' : '—'}</div></div>
    <div class="stat"><div class="k">Last 7 days</div><div class="v ${wkTrend === null ? '' : wkTrend <= 0 ? 'good' : 'bad'}">${wkTrend === null ? '—' : (wkTrend > 0 ? '+' : '') + (Math.round(wkTrend * 10) / 10) + ' kg'}</div></div>
  </div>`;

  html += `<div class="card"><h3>Log weight</h3><div class="muted" style="margin-bottom:6px">Fasted, post-pee, before coffee. Same conditions every time.</div>
    <div class="row">
      <input type="date" id="wt-date" value="${state.date}" style="flex:1.2">
      <input type="number" id="wt-kg" inputmode="decimal" step="0.05" placeholder="kg" style="flex:1">
      <button class="btn green" data-action="log-weight">Save</button>
    </div></div>`;

  if (entries.length >= 2) html += `<div class="card"><h3>Trend</h3>${weightChart(entries, s.goalWeight)}</div>`;

  html += '<div class="card"><h3>History</h3>';
  for (const e of [...entries].reverse().slice(0, 30)) {
    html += `<div class="foodline"><span class="fname">${fmtDate(e.date)}${e.note ? ' <span class="tiny">' + esc(e.note) + '</span>' : ''}</span>
      <span class="fmacro">${e.kg} kg</span>
      <button class="del" data-action="del-weight" data-id="${e.id}">✕</button></div>`;
  }
  if (!entries.length) html += '<div class="muted">No weigh-ins yet. Tomorrow morning, fasted — that’s the restart baseline.</div>';
  html += '</div>';
  v.innerHTML = html;
}
function weightChart(entries, goal) {
  const W = 560, H = 180, P = { l: 34, r: 10, t: 12, b: 22 };
  const t0 = new Date(entries[0].date).getTime(), t1 = new Date(entries[entries.length - 1].date).getTime();
  const span = Math.max(t1 - t0, 1);
  const kgs = entries.map(e => e.kg);
  let lo = Math.min(...kgs, goal) - 1, hi = Math.max(...kgs) + 1;
  const X = d => P.l + (new Date(d).getTime() - t0) / span * (W - P.l - P.r);
  const Y = k => P.t + (hi - k) / (hi - lo) * (H - P.t - P.b);
  const pts = entries.map(e => X(e.date).toFixed(1) + ',' + Y(e.kg).toFixed(1)).join(' ');
  let grid = '';
  for (let k = Math.ceil(lo); k <= hi; k += Math.max(1, Math.round((hi - lo) / 5))) {
    grid += `<line x1="${P.l}" y1="${Y(k)}" x2="${W - P.r}" y2="${Y(k)}" stroke="#2a3342" stroke-width="1"/>
             <text x="4" y="${Y(k) + 4}" fill="#66738a" font-size="11">${k}</text>`;
  }
  const goalY = Y(goal);
  const dots = entries.map(e => `<circle cx="${X(e.date).toFixed(1)}" cy="${Y(e.kg).toFixed(1)}" r="3.5" fill="#ffb454"/>`).join('');
  return `<svg class="wchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${grid}
    <line x1="${P.l}" y1="${goalY}" x2="${W - P.r}" y2="${goalY}" stroke="#4ecb8d" stroke-width="1.5" stroke-dasharray="6 4"/>
    <text x="${W - P.r - 4}" y="${goalY - 5}" fill="#4ecb8d" font-size="11" text-anchor="end">goal ${goal}</text>
    <polyline points="${pts}" fill="none" stroke="#ffb454" stroke-width="2.5" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}
async function logWeight() {
  const date = document.getElementById('wt-date').value;
  const kg = parseFloat(document.getElementById('wt-kg').value);
  if (!date || !kg) { toast('Enter a weight'); return; }
  const dup = (await dbByDate('weight', date))[0];
  await dbPut('weight', { id: dup ? dup.id : uid(), date, kg, note: dup ? dup.note : '', ts: Date.now() });
  toast('Saved ' + kg + ' kg'); render();
}

/* ---------------- More tab ---------------- */
async function renderMore() {
  const v = document.getElementById('view');
  const s = state.settings;
  const lib = (await dbAll('library')).sort((a, b) => a.name.localeCompare(b.name));
  const lastSync = await kvGet('lastSync');
  let html = `
  <details class="sect" open><summary>GitHub sync ☁️</summary><div class="inner">
    <div class="muted" style="margin-bottom:8px">One tap syncs everything with your <b>private</b> repo (${GH_REPO}) — Claude reads it from the PC. Token is stored only on this phone.</div>
    <label>Fine-grained personal access token</label>
    <input type="password" id="gh-token" value="${esc(localStorage.getItem(GH_TOKEN_KEY) || '')}" placeholder="github_pat_…" autocomplete="off">
    <button class="btn wide" data-action="gh-sync">⇅ Sync now</button>
    <div class="tiny" id="gh-status" style="margin-top:8px">${lastSync ? 'Last sync: ' + new Date(lastSync).toLocaleString() : 'Never synced yet.'}</div>
  </div></details>

  <details class="sect"><summary>Backup file (offline fallback)</summary><div class="inner">
    <div class="muted" style="margin-bottom:10px">All data lives only on this phone. Export a file and send it to your PC (WhatsApp/USB) — drop it in <b>weight goals/app-data/</b> for Claude. Import files Claude generates the same way.</div>
    <div class="row">
      <button class="btn grow" data-action="export">⬆ Export data</button>
      <button class="btn sec grow" data-action="import">⬇ Import file</button>
    </div>
    <input type="file" id="import-file" accept=".json,application/json" style="display:none">
    <div class="tiny" id="sync-meta" style="margin-top:8px"></div>
  </div></details>

  <details class="sect"><summary>Targets</summary><div class="inner">
    <div class="formgrid">
      <div><label>Calorie target</label><input type="number" id="st-cal" value="${s.calTarget}"></div>
      <div><label>Calorie ceiling</label><input type="number" id="st-ceil" value="${s.calCeiling}"></div>
      <div><label>Protein target (g)</label><input type="number" id="st-pro" value="${s.proteinTarget}"></div>
      <div><label>Protein floor (g)</label><input type="number" id="st-prof" value="${s.proteinFloor}"></div>
      <div><label>Goal weight (kg)</label><input type="number" id="st-goal" value="${s.goalWeight}"></div>
      <div><label>Start weight (kg)</label><input type="number" id="st-start" value="${s.startWeight}"></div>
    </div>
    <button class="btn wide" data-action="save-settings">Save targets</button>
  </div></details>

  <details class="sect"><summary>Workout plan editor</summary><div class="inner">`;
  for (const k of Object.keys(state.plan)) {
    html += `<div class="row between" style="margin-top:8px"><b>${esc(state.plan[k].name)}</b>
      <button class="btn sec mini" data-action="add-exercise" data-k="${k}">+ exercise</button></div>`;
    state.plan[k].exercises.forEach((ex, i) => {
      html += `<div class="planline row between"><span style="font-size:14px">${esc(ex.name)} <span class="tiny">${ex.sets}×${esc(ex.reps)}</span></span>
        <span class="row">
          <button class="btn sec mini" data-action="edit-exercise" data-k="${k}" data-i="${i}">✎</button>
          <button class="del" data-action="del-exercise" data-k="${k}" data-i="${i}">✕</button>
        </span></div>`;
    });
  }
  html += `</div></details>

  <details class="sect"><summary>Food library (${lib.length})</summary><div class="inner">`;
  for (const f of lib) {
    html += `<div class="foodline"><span class="fname">${esc(f.name)}</span>
      <span class="fmacro">${f.cal} / ${f.protein}g</span>
      <button class="del" data-action="del-lib" data-id="${f.id}">✕</button></div>`;
  }
  html += `</div></details>

  <div class="card"><h3>About</h3><div class="muted">Gym Companion · local-first · built by Claude for Gkald’s road to the wedding. Data never leaves this phone unless you export it. 💪</div></div>`;
  v.innerHTML = html;
  const meta = await kvGet('lastExport');
  if (meta) document.getElementById('sync-meta').textContent = 'Last export: ' + new Date(meta).toLocaleString();
}
async function saveSettings() {
  const g = id => parseFloat(document.getElementById(id).value) || 0;
  state.settings = { ...state.settings, calTarget: g('st-cal'), calCeiling: g('st-ceil'), proteinTarget: g('st-pro'), proteinFloor: g('st-prof'), goalWeight: g('st-goal'), startWeight: g('st-start') };
  await kvSet('settings', state.settings);
  toast('Targets saved');
}
function exerciseModal(k, i) {
  const ex = i >= 0 ? state.plan[k].exercises[i] : { name: '', sets: 3, reps: '8-12', rest: 90, suggest: '', cue: '', video: '' };
  openModal(`<h3>${i >= 0 ? 'Edit' : 'Add'} exercise — ${esc(state.plan[k].name)}</h3>
    <label>Name</label><input type="text" id="pe-name" value="${esc(ex.name)}">
    <div class="formgrid">
      <div><label>Sets</label><input type="number" id="pe-sets" value="${ex.sets}"></div>
      <div><label>Reps (text)</label><input type="text" id="pe-reps" value="${esc(ex.reps)}"></div>
      <div><label>Rest (seconds)</label><input type="number" id="pe-rest" value="${ex.rest}"></div>
      <div><label>Suggested weight</label><input type="text" id="pe-sug" value="${esc(ex.suggest || '')}"></div>
    </div>
    <label>Form cues</label><textarea id="pe-cue" rows="3">${esc(ex.cue || '')}</textarea>
    <label>Video URL</label><input type="text" id="pe-video" value="${esc(ex.video || '')}">
    <button class="btn wide" data-action="save-exercise" data-k="${k}" data-i="${i}">Save</button>`);
}
async function saveExercise(k, i) {
  const g = id => document.getElementById(id).value;
  const ex = {
    id: i >= 0 ? state.plan[k].exercises[i].id : 'custom-' + uid().slice(0, 8),
    name: g('pe-name').trim(), sets: parseInt(g('pe-sets'), 10) || 3, reps: g('pe-reps').trim() || '8-12',
    rest: parseInt(g('pe-rest'), 10) || 90, suggest: g('pe-sug').trim(), cue: g('pe-cue').trim(),
    video: g('pe-video').trim() || yt(g('pe-name') + ' form'),
  };
  if (!ex.name) { toast('Name required'); return; }
  if (i >= 0) state.plan[k].exercises[i] = ex; else state.plan[k].exercises.push(ex);
  await kvSet('plan', state.plan);
  closeModal(); toast('Plan updated'); render();
}

/* ---------------- Export / import ---------------- */
async function buildExportPayload() {
  return {
    app: 'gym-companion', version: 1, exportedAt: new Date().toISOString(),
    settings: state.settings, plan: state.plan,
    sets: await dbAll('sets'), food: await dbAll('food'),
    weight: await dbAll('weight'), library: await dbAll('library'),
  };
}
async function mergePayload(data) {
  let added = 0, updated = 0;
  for (const [storeName, rows] of [['sets', data.sets], ['food', data.food], ['weight', data.weight], ['library', data.library]]) {
    for (const row of rows || []) {
      if (!row.id) continue;
      const cur = await dbGet(storeName, row.id);
      if (!cur) { await dbPut(storeName, row); added++; }
      else if ((row.ts || 0) > (cur.ts || 0)) { await dbPut(storeName, row); updated++; }
    }
  }
  if (data.settings && data.settingsWins) { state.settings = { ...DEFAULT_SETTINGS, ...data.settings }; await kvSet('settings', state.settings); }
  if (data.plan && data.planWins) { state.plan = data.plan; await kvSet('plan', state.plan); }
  return { added, updated };
}
async function exportData() {
  const payload = await buildExportPayload();
  const name = 'gym-data-' + todayStr() + '.json';
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  await kvSet('lastExport', Date.now());
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); toast('Exported'); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
  toast('Downloaded ' + name);
}
async function importData(fileInput) {
  const f = fileInput.files[0];
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (e) { toast('Not a valid JSON file'); return; }
  if (data.app !== 'gym-companion') { toast('Not a Gym Companion file'); return; }
  const { added, updated } = await mergePayload(data);
  fileInput.value = '';
  toast(`Imported: ${added} new, ${updated} updated`);
  render();
}

/* ---------------- GitHub sync ---------------- */
const GH_REPO = 'Gald9801/gym-data';
const GH_FILE = 'gym-data.json';
const GH_TOKEN_KEY = 'gymapp-gh-token';
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
async function ghApi(path, opts) {
  const r = await fetch('https://api.github.com/repos/' + GH_REPO + path, {
    ...(opts || {}),
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem(GH_TOKEN_KEY),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub HTTP ' + r.status);
  return r.json();
}
async function ghSync() {
  const tokenEl = document.getElementById('gh-token');
  const token = tokenEl ? tokenEl.value.trim() : localStorage.getItem(GH_TOKEN_KEY);
  if (!token) { toast('Paste your GitHub token first'); return; }
  localStorage.setItem(GH_TOKEN_KEY, token);
  const status = m => { const el = document.getElementById('gh-status'); if (el) el.textContent = m; };
  try {
    status('Pulling from GitHub…');
    const cur = await ghApi('/contents/' + GH_FILE);
    let sha = null, pulled = { added: 0, updated: 0 };
    if (cur) {
      sha = cur.sha;
      const remote = JSON.parse(b64decode(cur.content));
      if (remote.app === 'gym-companion') pulled = await mergePayload(remote);
    }
    status('Pushing…');
    const payload = await buildExportPayload();
    await ghApi('/contents/' + GH_FILE, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'sync ' + new Date().toISOString(),
        content: b64encode(JSON.stringify(payload, null, 1)),
        ...(sha ? { sha } : {}),
      }),
    });
    await kvSet('lastSync', Date.now());
    toast(`Synced ✓ pulled ${pulled.added + pulled.updated}, pushed all`);
    render();
  } catch (e) {
    status('Sync failed: ' + e.message + ' — check token / connection');
    toast('Sync failed');
  }
}

/* ---------------- Shared UI ---------------- */
function datebarHTML() {
  return `<div class="datebar">
    <button data-action="date-prev">‹</button>
    <span class="cur" data-action="date-today">${state.date === todayStr() ? 'Today · ' : ''}${fmtDate(state.date)}</span>
    <button data-action="date-next">›</button>
  </div>`;
}
const TITLES = { workout: 'Workout', food: 'Food', weight: 'Weight', more: 'More' };
function render() {
  document.getElementById('topbar-title').textContent = TITLES[state.tab];
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
  ({ workout: renderWorkout, food: renderFood, weight: renderWeight, more: renderMore })[state.tab]();
}

/* ---------------- Events ---------------- */
document.addEventListener('click', async e => {
  const tab = e.target.closest('.tab');
  if (tab) { state.tab = tab.dataset.tab; render(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  switch (a) {
    case 'modal-close': if (e.target.classList.contains('modal-back')) closeModal(); break;
    case 'date-prev': state.date = shiftDate(state.date, -1); state.session = sessionForDate(state.date); render(); break;
    case 'date-next': state.date = shiftDate(state.date, 1); state.session = sessionForDate(state.date); render(); break;
    case 'date-today': state.date = todayStr(); state.session = sessionForDate(state.date); render(); break;
    case 'pick-session': state.session = state.session === el.dataset.k ? null : el.dataset.k; render(); break;
    case 'log-set': logSet(el.dataset.ex, parseInt(el.dataset.rest, 10)); break;
    case 'del-set': await dbDel('sets', el.dataset.id); render(); break;
    case 'toggle-cues': el.closest('.card').querySelector('.cues').classList.toggle('open'); break;
    case 'add-note-set': extraExerciseModal(); break;
    case 'save-extra': saveExtra(); break;
    case 'timer-add30': timer.end += 30000; timer.running = true; if (!timer.iv) timer.iv = setInterval(tickTimer, 250); document.getElementById('timerbar').classList.remove('finished'); tickTimer(); break;
    case 'timer-pause':
      if (timer.running) { timer.running = false; timer.pausedLeft = timer.left; el.textContent = 'Resume'; }
      else { timer.end = Date.now() + (timer.pausedLeft || timer.left) * 1000; timer.running = true; el.textContent = 'Pause'; }
      break;
    case 'timer-skip': hideTimer(); break;
    case 'quick-rest': startTimer(parseInt(el.dataset.s, 10), 'Rest'); break;
    case 'show-img': openModal(`<h3>${esc(el.dataset.name)}</h3><img src="${esc(el.dataset.src)}" alt="" style="width:100%;border-radius:12px;background:#fff">`); break;
    case 'sw-toggle': {
      const s = swState();
      if (s.run) { s.acc += Date.now() - s.t0; s.run = false; } else { s.run = true; s.t0 = Date.now(); }
      swSave(s); swEnsureTicking(); render();
      break;
    }
    case 'sw-reset': swSave({ run: false, acc: 0, t0: 0 }); render(); break;
    case 'food-add': foodAddModal(); break;
    case 'food-custom': foodCustomModal(); break;
    case 'lib-add': await libAdd(el.dataset.id, parseFloat(el.dataset.qty)); break;
    case 'save-custom-food': saveCustomFood(); break;
    case 'del-food': await dbDel('food', el.dataset.id); render(); break;
    case 'log-weight': logWeight(); break;
    case 'del-weight': await dbDel('weight', el.dataset.id); render(); break;
    case 'save-settings': saveSettings(); break;
    case 'add-exercise': exerciseModal(el.dataset.k, -1); break;
    case 'edit-exercise': exerciseModal(el.dataset.k, parseInt(el.dataset.i, 10)); break;
    case 'del-exercise':
      if (confirm('Remove this exercise from the plan? (Logged history is kept.)')) {
        state.plan[el.dataset.k].exercises.splice(parseInt(el.dataset.i, 10), 1);
        await kvSet('plan', state.plan); render();
      }
      break;
    case 'save-exercise': saveExercise(el.dataset.k, parseInt(el.dataset.i, 10)); break;
    case 'export': exportData(); break;
    case 'import': document.getElementById('import-file').click(); break;
    case 'gh-sync': ghSync(); break;
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'import-file') importData(e.target);
});
document.getElementById('wake-btn').addEventListener('click', toggleWakeLock);

/* ---------------- Boot ---------------- */
window.addEventListener('error', e => {
  const v = document.getElementById('view');
  if (v && !v.innerHTML) v.innerHTML = '<div class="card"><b>App error:</b> ' + esc(e.message) + '<br><span class="tiny">' + esc((e.filename || '') + ':' + e.lineno) + '</span></div>';
});
window.addEventListener('unhandledrejection', e => {
  const v = document.getElementById('view');
  if (v && !v.innerHTML) v.innerHTML = '<div class="card"><b>App error (async):</b> ' + esc(e.reason && (e.reason.message || e.reason)) + '</div>';
});
(async function boot() {
  db = await openDB();
  const savedSettings = await kvGet('settings');
  if (savedSettings) state.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  const savedPlan = await kvGet('plan');
  if (savedPlan) state.plan = savedPlan;
  else { state.plan = JSON.parse(JSON.stringify(DEFAULT_PLAN)); await kvSet('plan', state.plan); }
  if ((await dbAll('library')).length === 0) {
    for (const f of DEFAULT_LIBRARY) await dbPut('library', f);
  }
  state.session = sessionForDate(state.date);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
