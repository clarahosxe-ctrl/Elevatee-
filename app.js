'use strict';
/* Elevatee — programmes sportifs, timer, eau & sommeil. Tout est stocké en local (localStorage). */

/* ───────── utilitaires ───────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fr = (d, o) => d.toLocaleDateString('fr-FR', o);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const list = s => String(s).split(',').map(x => x.trim()).filter(Boolean);
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

/* ───────── état ───────── */
const KEY = 'elevatee.v1';
const fresh = () => ({
  programs: structuredClone(window.SEED_PROGRAMS),
  logs: {},          // logs[pid]["ph.wk.sid"] = { done, doneAt, ex: { [exId]: { w, r, s:[bool] } } }
  water: {},         // water["YYYY-MM-DD"] = ml
  waterGoal: 2000,
  sleep: {},         // sleep["YYYY-MM-DD" (jour du réveil)] = { bed, wake, q }
  sleepGoal: 8,
  cur: {},           // cur[pid] = { ph, wk }
  rest: 60,
  steps: {},         // steps["YYYY-MM-DD"] = nombre de pas
  stepGoal: 8000,
  stepsUrl: '',      // URL JSON de synchro (optionnel) : {"steps":1234,"date":"YYYY-MM-DD"}
  stepsAt: 0,
  seedV: window.SEED_VERSION,
});
let S = (() => {
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.programs) return { ...fresh(), ...r, seedV: r.seedV || 1 }; } catch { }
  return fresh();
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } };
const ui = { sleepOff: 0 };

/* ───────── accès données ───────── */
const prog = pid => S.programs.find(p => p.id === pid);
const lkey = (ph, wk, sid) => `${ph}.${wk}.${sid}`;
const getLog = (pid, k, create) => {
  if (!S.logs[pid]) { if (!create) return null; S.logs[pid] = {}; }
  if (!S.logs[pid][k]) { if (!create) return null; S.logs[pid][k] = { ex: {} }; }
  return S.logs[pid][k];
};
const isDone = (pid, ph, wk, sid) => !!getLog(pid, lkey(ph, wk, sid))?.done;

function phaseStats(p, ph) {
  const phase = p.phases[ph]; const total = phase.sessions.length * phase.weeks;
  let done = 0;
  phase.sessions.forEach(s => { for (let w = 0; w < phase.weeks; w++) if (isDone(p.id, ph, w, s.id)) done++; });
  return { done, total };
}
function progStats(p) {
  return p.phases.reduce((a, _, i) => { const s = phaseStats(p, i); return { done: a.done + s.done, total: a.total + s.total }; }, { done: 0, total: 0 });
}
function nextSession(p) {
  for (let ph = 0; ph < p.phases.length; ph++) {
    const phase = p.phases[ph];
    for (let wk = 0; wk < phase.weeks; wk++)
      for (const s of phase.sessions) if (!isDone(p.id, ph, wk, s.id)) return { ph, wk, s };
  }
  return null;
}
function sel(pid) {
  const p = prog(pid);
  let c = S.cur[pid];
  if (!c) { const n = nextSession(p); c = S.cur[pid] = { ph: n ? n.ph : 0, wk: n ? n.wk : 0 }; }
  c.ph = clamp(c.ph, 0, p.phases.length - 1);
  c.wk = clamp(c.wk, 0, Math.max(0, p.phases[c.ph].weeks - 1));
  return c;
}
/* valeur la plus récente saisie pour un exercice (semaine donnée ou précédentes de la même phase) */
function lastVal(pid, ph, wk, sid, exId, f) {
  for (let w = wk; w >= 0; w--) {
    const v = getLog(pid, lkey(ph, w, sid))?.ex?.[exId]?.[f];
    if (v) return { v, wk: w };
  }
  return null;
}
const fmtReps = e => {
  const r = String(e.reps || '').trim();
  const base = /^[\d\-–]+$/.test(r) ? `${r} reps` : r;
  return base + (e.perSide ? '/côté' : '');
};
const exMeta = e => `${plural(e.sets, 'série')} · ${fmtReps(e)}`;
const exCount = s => new Set(s.exercises.filter(e => !isWarm(e)).map(e => e.group)).size;   // blocs « Exercice N »
const isWarm = e => /chauff|récup/i.test(e.group);

/* ───────── routeur ───────── */
const view = $('#view');
const routes = {};
function render() {
  const h = (location.hash || '#/home').slice(2);
  const [name, ...args] = h.split('/');
  const r = routes[name] || routes.home;
  const y = window.scrollY, same = render.last === location.hash;
  view.innerHTML = r(...args.map(decodeURIComponent));
  render.last = location.hash;
  window.scrollTo(0, same ? y : 0);
  const tab = { home: 'home', programs: 'programs', program: 'programs', session: 'programs', edit: 'programs', timer: 'timer', health: 'health', settings: 'home' }[name] || 'home';
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  tick();
}
window.addEventListener('hashchange', render);
const go = h => { if (location.hash === h) render(); else location.hash = h; };
const back = el => `<button class="icon-btn" data-act="go" data-to="${el}">←</button>`;

/* ───────── événements ───────── */
const A = {}, C = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  unlockAudio();
  A[el.dataset.act]?.(el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-ch]'); if (!el) return;
  C[el.dataset.ch]?.(el, e);
});
A.go = el => go(el.dataset.to);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200);
}
function confetti() {
  const set = ['🎉', '💪', '✨', '🔥', '💖', '⭐'];
  for (let i = 0; i < 22; i++) {
    const s = document.createElement('span'); s.className = 'confetti';
    s.textContent = set[i % set.length];
    s.style.setProperty('--x', `${(Math.random() - .5) * 340}px`);
    s.style.setProperty('--y', `${-80 - Math.random() * 280}px`);
    s.style.setProperty('--r', `${(Math.random() - .5) * 720}deg`);
    document.body.appendChild(s); setTimeout(() => s.remove(), 1200);
  }
}

/* ───────── sons / vibration ───────── */
let ac;
function unlockAudio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { } }
function beep(times = 1, freq = 880, dur = .14) {
  try {
    unlockAudio(); if (!ac) return;
    for (let i = 0; i < times; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * (dur + .09);
      o.frequency.value = freq; o.type = 'sine'; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.4, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.start(t); o.stop(t + dur + .02);
    }
  } catch { }
  try { navigator.vibrate?.(times > 1 ? [200, 100, 200] : 120); } catch { }
}
let wake;
async function keepAwake(on) {
  try { if (on) wake = await navigator.wakeLock?.request('screen'); else { await wake?.release(); wake = null; } } catch { }
}

/* ───────── ACCUEIL ───────── */
const GREET = () => { const h = new Date().getHours(); return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Salut' : 'Bonsoir'; };
const water = (k = dkey()) => S.water[k] || 0;
const sleepDur = s => {
  if (!s?.bed || !s?.wake) return 0;
  const [bh, bm] = s.bed.split(':').map(Number), [wh, wm] = s.wake.split(':').map(Number);
  let m = (wh * 60 + wm) - (bh * 60 + bm); if (m <= 0) m += 1440; return m / 60;
};
const fmtH = h => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const MOODS = ['😫', '😕', '😐', '🙂', '🤩'];

function ring(pct, grad, size = 150, stroke = 14) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, id = 'g' + uid();
  return `<svg viewBox="0 0 ${size} ${size}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${grad}</linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(pct, 0, 1))}" style="transition:stroke-dashoffset .6s"/></svg>`;
}

routes.home = () => {
  const today = new Date();
  const days = [...Array(7)].map((_, i) => addDays(today, i - 6));
  const worked = new Set();
  Object.values(S.logs).forEach(l => Object.values(l).forEach(x => x.done && x.doneAt && worked.add(dkey(new Date(x.doneAt)))));
  const nexts = S.programs.map(p => ({ p, n: nextSession(p) })).filter(x => x.n);
  const nx = nexts[0];
  const w = water(), wp = w / S.waterGoal;
  const sl = S.sleep[dkey()], sd = sleepDur(sl);
  return `
  <div class="top"><div><p class="muted small" style="text-transform:capitalize">${fr(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <h1>${GREET()} ✨</h1></div><button class="icon-btn" data-act="go" data-to="#/settings">⚙️</button></div>

  ${nx ? `<a class="hero g${nx.p.color % 4}" data-emoji="${esc(nx.p.emoji)}" href="#/session/${nx.p.id}/${nx.n.ph}/${nx.n.wk}/${nx.n.s.id}">
      <div><span class="pill">À faire · ${esc(nx.p.name)} · ${esc(nx.p.phases[nx.n.ph].name)} · Sem. ${nx.n.wk + 1}</span></div>
      <div><h2 style="font-size:26px">${esc(nx.n.s.name)}</h2><p style="opacity:.9">${nx.n.s.duration} min · ${plural(exCount(nx.n.s), 'exercice')}</p></div>
      <div class="btn sm" style="align-self:flex-start;box-shadow:none">C'est parti 🔥</div></a>`
      : `<div class="card center stack"><h2>Aucune séance à venir 🎉</h2><p class="muted">Crée ou complète un programme pour continuer.</p><a class="btn" href="#/programs">Mes programmes</a></div>`}

  <div class="card"><div class="row between"><h3>7 derniers jours</h3><span class="chip">${days.filter(d => worked.has(dkey(d))).length} séance(s) 💪</span></div>
    <div class="dots" style="margin-top:10px">${days.map((d, i) => `<div class="${worked.has(dkey(d)) ? 'on' : ''} ${i === 6 ? 'today' : ''}">${fr(d, { weekday: 'narrow' }).toUpperCase()}<i></i></div>`).join('')}</div></div>

  <div class="card g1"><div class="row">
    <div class="ring">${ring(wp, '<stop offset="0" stop-color="#20c9a6"/><stop offset="1" stop-color="#3fa9ff"/>')}<div class="t"><b>${(w / 1000).toFixed(2).replace(/\.?0+$/, '')} L</b><span class="small" style="opacity:.85">/ ${S.waterGoal / 1000} L</span></div></div>
    <div class="grow stack"><h2>💧 Eau</h2><p style="opacity:.9">${wp >= 1 ? 'Objectif atteint, bravo !' : `Encore ${S.waterGoal - w} ml aujourd'hui`}</p></div></div>
    <div class="quick" style="margin-top:14px">${[150, 250, 330, 500].map(v => `<button data-act="water" data-v="${v}">+${v}</button>`).join('')}</div></div>

  ${stepsCard()}

  <a class="card g3 row between" href="#/health"><div><h2>😴 Sommeil</h2><p style="opacity:.9">${sd ? `Cette nuit : ${fmtH(sd)}` : 'Pas encore renseigné pour cette nuit'}</p></div><span class="pill">${sd ? (sd >= S.sleepGoal ? '✅ objectif' : `objectif ${S.sleepGoal} h`) : 'Ajouter'}</span></a>`;
};
A.water = el => { const k = dkey(); S.water[k] = Math.max(0, water(k) + num(el.dataset.v)); save(); render(); if (water(k) >= S.waterGoal && water(k) - num(el.dataset.v) < S.waterGoal) { confetti(); toast('Objectif eau atteint 💧'); } };


/* ───────── PAS (synchro Santé iPhone via Raccourcis / URL, ou saisie manuelle) ───────── */
const steps = (k = dkey()) => S.steps[k] || 0;
const fmtN = n => Math.round(n).toLocaleString('fr-FR');
function stepsCard() {
  const n = steps(), p = n / S.stepGoal, t = S.stepsAt ? new Date(S.stepsAt) : null;
  return `<div class="card g2 stack"><div class="row between"><h2>👟 Pas</h2>
    <button class="pill" data-act="stepsEdit">${n ? 'Modifier' : 'Saisir'}</button></div>
    <div class="row" style="align-items:baseline;gap:8px"><b style="font-size:38px;font-weight:900;letter-spacing:-1px">${fmtN(n)}</b><span class="muted">/ ${fmtN(S.stepGoal)}</span></div>
    <div class="bar"><i style="width:${clamp(p, 0, 1) * 100}%"></i></div>
    <p class="small muted">${t ? `Synchronisé à ${t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Pas encore synchronisé'} · <a href="#/settings" style="text-decoration:underline">Synchro</a></p></div>`;
}
function setSteps(n, date, fromSync) {
  n = Math.round(num(n)); if (!(n >= 0 && n < 200000)) return false;
  S.steps[/^\d{4}-\d\d-\d\d$/.test(date || '') ? date : dkey()] = n;
  if (fromSync) S.stepsAt = Date.now();
  save(); return true;
}
routes.steps = (n, d) => {            // #/steps/1234  (utilisé par le raccourci iPhone)
  if (setSteps(n, d, true)) setTimeout(() => toast(`👟 ${fmtN(n)} pas synchronisés`), 60);
  history.replaceState(null, '', '#/home'); return routes.home();
};
A.stepsEdit = () => {
  const v = prompt('Nombre de pas aujourd\'hui', steps() || ''); if (v !== null && setSteps(v)) render();
};
async function pullSteps() {
  if (!S.stepsUrl) return;
  try {
    const r = await fetch(S.stepsUrl, { cache: 'no-store' }); const d = await r.json();
    if (d && setSteps(d.steps, d.date, true)) { if (/^#\/(home|health|settings)?$/.test(location.hash)) render(); }
  } catch { }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) pullSteps(); });

/* ───────── PROGRAMMES ───────── */
routes.programs = () => `
  <div class="top"><h1>Mes programmes</h1></div>
  ${S.programs.map(p => { const st = progStats(p); const n = nextSession(p);
    return `<a class="prog g${p.color % 4}" href="#/program/${p.id}"><div class="em">${esc(p.emoji)}</div>
      <div class="grow stack" style="gap:6px"><h2>${esc(p.name)}</h2>
      <p class="small" style="opacity:.9">${plural(p.phases.length, 'phase')} · ${st.done}/${st.total} séances</p>
      <div class="bar"><i style="width:${st.total ? st.done / st.total * 100 : 0}%"></i></div></div></a>`; }).join('') || '<p class="muted center">Aucun programme pour l\'instant.</p>'}
  <button class="btn" data-act="newProg">＋ Nouveau programme</button>`;

A.newProg = () => {
  const p = { id: uid(), name: 'Nouveau programme', emoji: '🏋️', color: S.programs.length % 4, description: '', phases: [{ name: 'Phase 1', weeks: 4, sessions: [] }] };
  S.programs.push(p); save(); go(`#/edit/${p.id}`);
};

routes.program = pid => {
  const p = prog(pid); if (!p) return routes.programs();
  const c = sel(pid), phase = p.phases[c.ph], st = progStats(p), ps = phaseStats(p, c.ph);
  return `
  <div class="hero g${p.color % 4}" data-emoji="${esc(p.emoji)}">
    <div class="row between">${back('#/programs')}<button class="icon-btn" data-act="go" data-to="#/edit/${p.id}">✏️</button></div>
    <div><h1>${esc(p.name)}</h1><p style="opacity:.9;margin-top:4px">${esc(p.description || '')}</p></div>
    <div><div class="row between small" style="margin-bottom:6px"><b>Progression globale</b><b>${st.done}/${st.total}</b></div><div class="bar"><i style="width:${st.total ? st.done / st.total * 100 : 0}%"></i></div></div>
  </div>
  ${p.phases.length > 1 ? `<div class="seg">${p.phases.map((ph, i) => `<button class="${i === c.ph ? 'on' : ''}" data-act="phase" data-pid="${p.id}" data-i="${i}">${esc(ph.name)}</button>`).join('')}</div>` : ''}
  <div class="row between"><h3>Semaine</h3><span class="small muted">${ps.done}/${ps.total} séances dans cette phase</span></div>
  <div class="weeks">${[...Array(phase.weeks)].map((_, w) => {
    const all = phase.sessions.length && phase.sessions.every(s => isDone(pid, c.ph, w, s.id));
    return `<button class="${w === c.wk ? 'on' : ''} ${all ? 'ok' : ''}" data-act="week" data-pid="${p.id}" data-i="${w}">Sem. ${w + 1}</button>`; }).join('')}</div>
  <div class="stack">${phase.sessions.map((s, i) => {
    const d = isDone(pid, c.ph, c.wk, s.id);
    return `<a class="sess" href="#/session/${pid}/${c.ph}/${c.wk}/${s.id}"><div class="num g${i % 4}">${i + 1}</div>
      <div class="grow"><div class="small" style="color:var(--pink);font-weight:800">Séance ${i + 1}</div><b>${esc(s.name)}</b>
      <div class="small muted">${s.duration} min · ${plural(exCount(s), 'exercice')}</div></div>
      <div class="check ${d ? 'on' : ''}">${d ? '✓' : ''}</div></a>`; }).join('')}
  ${phase.sessions.length ? '' : `<div class="card center stack"><p class="muted">Aucune séance dans cette phase pour l'instant.</p><a class="btn soft" href="#/edit/${p.id}">Ajouter des séances</a></div>`}</div>`;
};
A.phase = el => { S.cur[el.dataset.pid] = { ph: +el.dataset.i, wk: 0 }; save(); render(); };
A.week = el => { sel(el.dataset.pid).wk = +el.dataset.i; save(); render(); };

/* ───────── SÉANCE (suivi) ───────── */
routes.session = (pid, ph, wk, sid) => {
  ph = +ph; wk = +wk;
  const p = prog(pid), s = p?.phases[ph]?.sessions.find(x => x.id === sid);
  if (!s) return routes.programs();
  const log = getLog(pid, lkey(ph, wk, sid)) || { ex: {} };
  const idx = p.phases[ph].sessions.indexOf(s);
  let lastGroup = null;
  const cards = s.exercises.map(e => {
    const l = log.ex[e.id] || {};
    const pw = lastVal(pid, ph, wk - 1, sid, e.id, 'w'), pr = lastVal(pid, ph, wk - 1, sid, e.id, 'r');
    const head = e.group !== lastGroup ? `<h3 class="grp">${esc(e.group)}</h3>` : ''; lastGroup = e.group;
    const prev = (pw || pr) ? `Sem. ${(pw || pr).wk + 1} : ${[pw && pw.v + ' kg', pr && pr.v].filter(Boolean).join(' × ')}` : '';
    return `${head}<div class="ex"><div><div class="ex-name">${esc(e.name)}</div><div class="ex-meta">${exMeta(e)}</div></div>
      <div class="sets">${[...Array(e.sets)].map((_, i) => `<button class="set ${l.s?.[i] ? 'on' : ''}" data-act="set" data-pid="${pid}" data-k="${lkey(ph, wk, sid)}" data-ex="${e.id}" data-i="${i}">${i + 1}</button>`).join('')}</div>
      <div class="inputs">
        <label>Poids (kg)<input type="text" inputmode="decimal" value="${esc(l.w || '')}" placeholder="${esc(pw ? pw.v : '–')}" data-ch="log" data-pid="${pid}" data-k="${lkey(ph, wk, sid)}" data-ex="${e.id}" data-f="w"></label>
        <label>Réalisé<input type="text" value="${esc(l.r || '')}" placeholder="${esc(pr ? pr.v : e.reps)}" data-ch="log" data-pid="${pid}" data-k="${lkey(ph, wk, sid)}" data-ex="${e.id}" data-f="r"></label></div>
      ${prev ? `<div class="prev">↺ ${esc(prev)}</div>` : ''}</div>`;
  }).join('');
  return `
  <div class="hero g${idx % 4}" data-emoji="${esc(p.emoji)}">
    <div class="row between">${back(`#/program/${pid}`)}<span class="pill">${esc(p.phases[ph].name)} · Sem. ${wk + 1}</span></div>
    <div><p class="small" style="opacity:.9;font-weight:800">SÉANCE ${idx + 1}</p><h1>${esc(s.name)}</h1></div>
    <div class="chips"><span class="pill">⏱ ${s.duration} min</span><span class="pill">${plural(exCount(s), 'exercice')}</span></div>
  </div>
  <details class="card"><summary>Description &amp; matériel <span>▾</span></summary>
    <div class="stack"><p>${esc(s.description)}</p>
    ${s.objective ? `<div><h3>Objectif</h3><p>${esc(s.objective)}</p></div>` : ''}
    ${s.muscles.length ? `<div><h3>Muscles sollicités</h3><div class="chips" style="margin-top:6px">${s.muscles.map(m => `<span class="chip alt">${esc(m)}</span>`).join('')}</div></div>` : ''}
    ${s.equipment.length ? `<div><h3>Matériel requis</h3><div class="chips" style="margin-top:6px">${s.equipment.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div></div>` : ''}</div></details>
  <div class="row between"><h2>Ce que tu effectueras</h2><span class="small muted">Repos : <a href="#/settings" style="text-decoration:underline">${S.rest}s</a></span></div>
  ${cards || '<p class="muted center">Aucun exercice. Ajoutes-en depuis l\'éditeur ✏️</p>'}
  <button class="btn ${log.done ? 'done' : ''}" data-act="validate" data-pid="${pid}" data-k="${lkey(ph, wk, sid)}">${log.done ? '✓ Séance validée' : 'Valider ma séance'}</button>
  <a class="btn soft" href="#/edit/${pid}/${ph}/${sid}">✏️ Modifier cette séance</a>`;
};
C.log = el => {
  const l = getLog(el.dataset.pid, el.dataset.k, true);
  (l.ex[el.dataset.ex] ||= { s: [] })[el.dataset.f] = el.value.trim(); save();
};
A.set = el => {
  const p = prog(el.dataset.pid), [ph, , sid] = el.dataset.k.split('.');
  const e = p.phases[+ph].sessions.find(s => s.id === sid).exercises.find(x => x.id === el.dataset.ex);
  const l = getLog(p.id, el.dataset.k, true), x = (l.ex[e.id] ||= {});
  x.s = x.s || []; const i = +el.dataset.i; x.s[i] = !x.s[i];
  el.classList.toggle('on', x.s[i]); save();
  if (x.s[i] && !isWarm(e) && S.rest > 0 && x.s.filter(Boolean).length < e.sets) startRest(S.rest);
  else if (x.s[i]) beep(1, 660, .08);
};
A.validate = el => {
  const l = getLog(el.dataset.pid, el.dataset.k, true);
  l.done = !l.done; l.doneAt = l.done ? Date.now() : null; save(); render();
  if (l.done) { confetti(); beep(2, 988); toast('Séance validée, bravo ! 🔥'); R.end = 0; paintRest(); }
};

/* ───────── minuteur de repos (séance) ───────── */
const R = { end: 0, dur: 0 };
function startRest(sec) { R.end = Date.now() + sec * 1000; R.dur = sec; R.last = 0; paintRest(true); keepAwake(true); }
function paintRest(init) {
  const box = $('#rest'), left = Math.ceil((R.end - Date.now()) / 1000);
  if (!R.end || left <= 0) { if (R.end) { beep(2, 988); toast('Repos terminé, c\'est reparti ! 💥'); keepAwake(T.run); } R.end = 0; box.hidden = true; return; }
  if (init || box.hidden) {
    box.hidden = false;
    box.innerHTML = `<span style="font-size:22px">😮‍💨</span><div class="grow"><div class="small" style="opacity:.9;font-weight:800">REPOS</div><b id="restT"></b></div>
      <button data-act="restAdj" data-v="-15">−15s</button><button data-act="restAdj" data-v="15">+15s</button><button data-act="restAdj" data-v="skip">Passer</button>`;
  }
  $('#restT').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  if (left <= 3 && R.last !== left) { R.last = left; beep(1, 660, .07); }
}
A.restAdj = el => { if (el.dataset.v === 'skip') R.end = 0; else R.end += num(el.dataset.v) * 1000; paintRest(); };

/* ───────── ÉDITEUR ───────── */
routes.edit = (pid, ph, sid) => {
  const p = prog(pid); if (!p) return routes.programs();
  if (sid) return editSession(p, +ph, sid);
  return `
  <div class="top">${back(`#/program/${pid}`)}<h2>Éditer le programme</h2><span style="width:42px"></span></div>
  <div class="card stack">
    <div class="inputs" style="grid-template-columns:80px 1fr"><label>Emoji<input type="text" value="${esc(p.emoji)}" data-ch="progF" data-pid="${pid}" data-f="emoji" maxlength="4"></label>
    <label>Nom<input type="text" value="${esc(p.name)}" data-ch="progF" data-pid="${pid}" data-f="name"></label></div>
    <label class="field">Description<input type="text" value="${esc(p.description || '')}" data-ch="progF" data-pid="${pid}" data-f="description"></label>
    <div><h3>Couleur</h3><div class="row" style="margin-top:8px">${[0, 1, 2, 3].map(i => `<button class="g${i}" style="width:44px;height:44px;border-radius:14px;${p.color % 4 === i ? 'outline:3px solid var(--ink);outline-offset:2px' : ''}" data-act="color" data-pid="${pid}" data-i="${i}"></button>`).join('')}</div></div>
  </div>
  ${p.phases.map((phase, i) => `
    <div class="card stack"><div class="row"><input type="text" value="${esc(phase.name)}" data-ch="phaseF" data-pid="${pid}" data-ph="${i}" data-f="name" style="font-weight:800">
      <input type="number" min="1" max="52" value="${phase.weeks}" data-ch="phaseF" data-pid="${pid}" data-ph="${i}" data-f="weeks" style="width:70px"><span class="small muted">sem.</span>
      ${p.phases.length > 1 ? `<button class="tiny-btn" data-act="delPhase" data-pid="${pid}" data-ph="${i}">🗑</button>` : ''}</div>
      ${phase.sessions.map((s, j) => `<div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${s.duration} min · ${plural(s.exercises.length, 'exercice')}</div></div>
        <button class="tiny-btn" data-act="mvSess" data-pid="${pid}" data-ph="${i}" data-i="${j}" data-d="-1">↑</button>
        <button class="tiny-btn" data-act="mvSess" data-pid="${pid}" data-ph="${i}" data-i="${j}" data-d="1">↓</button>
        <a class="tiny-btn" href="#/edit/${pid}/${i}/${s.id}">✏️</a>
        <button class="tiny-btn" data-act="delSess" data-pid="${pid}" data-ph="${i}" data-i="${j}">🗑</button></div>`).join('')}
      <button class="btn soft sm" data-act="addSess" data-pid="${pid}" data-ph="${i}">＋ Séance</button>
      ${!phase.sessions.length && i > 0 && p.phases[i - 1].sessions.length ? `<button class="btn ghost sm" data-act="copyPhase" data-pid="${pid}" data-ph="${i}">Copier les séances de « ${esc(p.phases[i - 1].name)} »</button>` : ''}
    </div>`).join('')}
  <button class="btn ghost" data-act="addPhase" data-pid="${pid}">＋ Ajouter une phase</button>
  <button class="btn danger" data-act="delProg" data-pid="${pid}">Supprimer ce programme</button>`;
};
C.progF = el => { prog(el.dataset.pid)[el.dataset.f] = el.value.trim(); save(); };
C.phaseF = el => {
  const ph = prog(el.dataset.pid).phases[+el.dataset.ph];
  ph[el.dataset.f] = el.dataset.f === 'weeks' ? clamp(Math.round(num(el.value)) || 1, 1, 52) : el.value.trim() || ph.name; save();
};
A.color = el => { prog(el.dataset.pid).color = +el.dataset.i; save(); render(); };
A.addPhase = el => { const p = prog(el.dataset.pid); p.phases.push({ name: `Phase ${p.phases.length + 1}`, weeks: 4, sessions: [] }); save(); render(); };
A.delPhase = el => { if (confirm('Supprimer cette phase et ses séances ?')) { prog(el.dataset.pid).phases.splice(+el.dataset.ph, 1); delete S.cur[el.dataset.pid]; save(); render(); } };
A.delProg = el => { if (confirm('Supprimer ce programme et tout son historique ?')) { S.programs = S.programs.filter(p => p.id !== el.dataset.pid); delete S.logs[el.dataset.pid]; delete S.cur[el.dataset.pid]; save(); go('#/programs'); } };
A.addSess = el => {
  const s = { id: uid(), name: 'Nouvelle séance', duration: 40, description: '', objective: '', muscles: [], equipment: [], exercises: [] };
  prog(el.dataset.pid).phases[+el.dataset.ph].sessions.push(s); save(); go(`#/edit/${el.dataset.pid}/${el.dataset.ph}/${s.id}`);
};
A.delSess = el => { const a = prog(el.dataset.pid).phases[+el.dataset.ph].sessions; if (confirm(`Supprimer « ${a[+el.dataset.i].name} » ?`)) { a.splice(+el.dataset.i, 1); save(); render(); } };
const move = (a, i, d) => { const j = i + d; if (j < 0 || j >= a.length) return false;[a[i], a[j]] = [a[j], a[i]]; return true; };
A.mvSess = el => { if (move(prog(el.dataset.pid).phases[+el.dataset.ph].sessions, +el.dataset.i, +el.dataset.d)) { save(); render(); } };
A.copyPhase = el => {
  const p = prog(el.dataset.pid), i = +el.dataset.ph;
  p.phases[i].sessions = p.phases[i - 1].sessions.map(s => ({ ...structuredClone(s), id: uid(), exercises: s.exercises.map(e => ({ ...e, id: uid() })) }));
  save(); render(); toast('Séances copiées ✨');
};

function editSession(p, ph, sid) {
  const s = p.phases[ph]?.sessions.find(x => x.id === sid); if (!s) return routes.edit(p.id);
  const groups = [...new Set(s.exercises.map(e => e.group))];
  const at = `data-pid="${p.id}" data-ph="${ph}" data-sid="${sid}"`;
  return `
  <div class="top">${back(`#/edit/${p.id}`)}<h2>Éditer la séance</h2><span style="width:42px"></span></div>
  <div class="card stack">
    <label class="field">Nom<input type="text" value="${esc(s.name)}" data-ch="sessF" ${at} data-f="name"></label>
    <label class="field">Durée (min)<input type="number" inputmode="numeric" value="${s.duration}" data-ch="sessF" ${at} data-f="duration"></label>
    <label class="field">Description<textarea data-ch="sessF" ${at} data-f="description">${esc(s.description)}</textarea></label>
    <label class="field">Objectif<input type="text" value="${esc(s.objective)}" data-ch="sessF" ${at} data-f="objective"></label>
    <label class="field">Muscles (séparés par des virgules)<input type="text" value="${esc(s.muscles.join(', '))}" data-ch="sessF" ${at} data-f="muscles"></label>
    <label class="field">Matériel (séparé par des virgules)<input type="text" value="${esc(s.equipment.join(', '))}" data-ch="sessF" ${at} data-f="equipment"></label>
  </div>
  <h3>Exercices</h3>
  <datalist id="grps">${['Échauffement', 'Exercice 1', 'Exercice 2', 'Exercice 2 - Superset', 'Exercice 3', 'Exercice 4', 'Exercice 5', ...groups].map(g => `<option value="${esc(g)}">`).join('')}</datalist>
  ${s.exercises.map((e, i) => `<div class="ed-ex">
    <div class="row"><input type="text" list="grps" value="${esc(e.group)}" data-ch="exF" ${at} data-ex="${e.id}" data-f="group" placeholder="Bloc (ex : Exercice 1)" style="font-size:14px">
      <button class="tiny-btn" data-act="mvEx" ${at} data-i="${i}" data-d="-1">↑</button><button class="tiny-btn" data-act="mvEx" ${at} data-i="${i}" data-d="1">↓</button>
      <button class="tiny-btn" data-act="delEx" ${at} data-i="${i}">🗑</button></div>
    <input type="text" value="${esc(e.name)}" data-ch="exF" ${at} data-ex="${e.id}" data-f="name" placeholder="Nom de l'exercice" style="font-weight:800">
    <div class="g"><label class="field">Séries<input type="number" inputmode="numeric" min="1" value="${e.sets}" data-ch="exF" ${at} data-ex="${e.id}" data-f="sets"></label>
      <label class="field">Reps / durée<input type="text" value="${esc(e.reps)}" data-ch="exF" ${at} data-ex="${e.id}" data-f="reps" placeholder="12, 8-10, 30 sec…"></label>
      <label class="check-l" style="align-self:end;padding-bottom:12px"><input type="checkbox" ${e.perSide ? 'checked' : ''} data-ch="exF" ${at} data-ex="${e.id}" data-f="perSide">/ côté</label></div></div>`).join('')}
  <button class="btn soft" data-act="addEx" ${at}>＋ Exercice</button>`;
}
const sessOf = el => prog(el.dataset.pid).phases[+el.dataset.ph].sessions.find(s => s.id === el.dataset.sid);
C.sessF = el => {
  const s = sessOf(el), f = el.dataset.f;
  s[f] = f === 'duration' ? Math.max(1, Math.round(num(el.value)) || s.duration) : (f === 'muscles' || f === 'equipment') ? list(el.value) : el.value.trim();
  save();
};
C.exF = el => {
  const e = sessOf(el).exercises.find(x => x.id === el.dataset.ex), f = el.dataset.f;
  e[f] = f === 'sets' ? Math.max(1, Math.round(num(el.value)) || 1) : f === 'perSide' ? el.checked : el.value.trim();
  save();
};
A.addEx = el => {
  const s = sessOf(el), last = s.exercises[s.exercises.length - 1];
  s.exercises.push({ id: uid(), group: last ? last.group : 'Exercice 1', name: 'Nouvel exercice', sets: 3, reps: '12', perSide: false }); save(); render();
  window.scrollTo(0, document.body.scrollHeight);
};
A.delEx = el => { sessOf(el).exercises.splice(+el.dataset.i, 1); save(); render(); };
A.mvEx = el => { if (move(sessOf(el).exercises, +el.dataset.i, +el.dataset.d)) { save(); render(); } };

/* ───────── TIMER ───────── */
const T = { mode: 'down', dur: 60, run: false, acc: 0, t0: 0, over: false, lastSec: -1, iv: { work: 40, rest: 20, rounds: 8, round: 1, ph: 'work' } };
const tEl = () => T.acc + (T.run ? Date.now() - T.t0 : 0);
const tTotal = () => (T.mode === 'iv' ? (T.iv.ph === 'work' ? T.iv.work : T.iv.rest) : T.dur) * 1000;
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function timerStep() {
  if (!T.run || T.mode === 'up') return;
  const left = tTotal() - tEl(), sec = Math.ceil(left / 1000);
  if (sec <= 3 && sec > 0 && sec !== T.lastSec) { T.lastSec = sec; beep(1, 660, .07); }
  if (left > 0) return;
  T.lastSec = -1;
  if (T.mode === 'down') { T.run = false; T.acc = 0; T.over = true; beep(3, 988); keepAwake(false); return; }
  const iv = T.iv; T.acc = 0; T.t0 = Date.now();
  if (iv.ph === 'work' && iv.rest > 0) iv.ph = 'rest'; else { iv.round++; iv.ph = 'work'; }
  if (iv.round > iv.rounds) { T.run = false; T.over = true; iv.round = iv.rounds; beep(3, 988); keepAwake(false); toast('Intervalles terminés 🎉'); return; }
  beep(iv.ph === 'work' ? 2 : 1, iv.ph === 'work' ? 988 : 660);
}
function paintTimer() {
  const big = $('#tBig'); if (!big) return;
  const up = T.mode === 'up', tot = tTotal(), el = tEl();
  const secs = up ? Math.floor(el / 1000) : T.over ? 0 : Math.max(0, Math.ceil((tot - el) / 1000));
  big.textContent = mmss(secs);
  const pct = up ? (el % 60000) / 60000 : T.over ? 0 : 1 - el / tot;
  const r = $('#tRing'); r.style.strokeDashoffset = (2 * Math.PI * 120) * (1 - clamp(pct, 0, 1));
  $('#tLbl').textContent = T.mode === 'iv' ? (T.over ? 'Terminé' : T.iv.ph === 'work' ? `Effort · ${T.iv.round}/${T.iv.rounds}` : `Repos · ${T.iv.round}/${T.iv.rounds}`) : up ? 'Chrono' : T.over ? 'Terminé 🎉' : T.run ? 'Go !' : 'Prêt';
  $('#dial').className = 'dial ' + (T.mode === 'iv' && !T.over ? T.iv.ph : '');
  const b = $('#tGo'); b.textContent = T.run ? '⏸ Pause' : (T.acc || T.over ? '▶ Reprendre' : '▶ Démarrer');
  if (T.over) b.textContent = '↻ Relancer';
}
routes.timer = () => {
  const presets = [30, 60, 90, 120, 180, 300];
  const st = (label, key, step, min) => `<div class="stepper"><span class="small muted">${label}</span><b>${key === 'work' || key === 'rest' ? T.iv[key] + 's' : T.iv[key]}</b>
    <div><button data-act="iv" data-k="${key}" data-d="${-step}" data-min="${min}">−</button><button data-act="iv" data-k="${key}" data-d="${step}">+</button></div></div>`;
  return `
  <div class="top"><h1>Timer ⏱️</h1></div>
  <div class="seg">${[['down', 'Minuteur'], ['up', 'Chrono'], ['iv', 'Intervalles']].map(([m, l]) => `<button class="${T.mode === m ? 'on' : ''}" data-act="tMode" data-m="${m}">${l}</button>`).join('')}</div>
  <div class="dial" id="dial"><svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="120" fill="none" stroke="var(--line)" stroke-width="14"/>
    <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5c8a"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs>
    <circle id="tRing" cx="130" cy="130" r="120" fill="none" stroke="url(#tg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 120}" stroke-dashoffset="0"/></svg>
    <div class="t"><div class="big" id="tBig">0:00</div><div class="lbl" id="tLbl"></div></div></div>
  ${T.mode === 'down' ? `<div class="presets">${presets.map(s => `<button data-act="tSet" data-s="${s}">${s >= 60 ? s / 60 + ' min' : s + ' s'}</button>`).join('')}
    <button data-act="tSet" data-s="-1">✏️ Autre</button></div>` : ''}
  ${T.mode === 'iv' ? `<div class="steppers">${st('Effort', 'work', 5, 5)}${st('Repos', 'rest', 5, 0)}${st('Tours', 'rounds', 1, 1)}</div>` : ''}
  <div class="ctrl"><button class="btn" id="tGo" data-act="tGo"></button><button class="btn soft" data-act="tReset" style="min-width:90px">↺</button></div>`;
};
A.tMode = el => { T.mode = el.dataset.m; tReset(); render(); };
function tReset() { T.run = false; T.acc = 0; T.over = false; T.lastSec = -1; T.iv.round = 1; T.iv.ph = 'work'; keepAwake(R.end > 0); }
A.tReset = () => { tReset(); paintTimer(); };
A.tGo = () => {
  if (T.over) tReset();
  if (T.run) { T.acc = tEl(); T.run = false; keepAwake(R.end > 0); }
  else { T.t0 = Date.now(); T.run = true; keepAwake(true); }
  paintTimer();
};
A.tSet = el => {
  let s = +el.dataset.s;
  if (s < 0) { const v = prompt('Durée en secondes (ex : 45) ou minutes:secondes (ex : 1:30)', '60'); if (!v) return; s = v.includes(':') ? v.split(':').reduce((a, x) => a * 60 + num(x), 0) : num(v); }
  if (s > 0) { T.dur = Math.round(s); tReset(); paintTimer(); }
};
A.iv = el => { const k = el.dataset.k, min = el.dataset.min !== undefined ? +el.dataset.min : (k === 'rounds' ? 1 : 5); T.iv[k] = Math.max(min, T.iv[k] + +el.dataset.d); tReset(); render(); };

/* ───────── SANTÉ (eau + sommeil) ───────── */
const last7 = () => [...Array(7)].map((_, i) => addDays(new Date(), i - 6));
routes.health = () => {
  const k = dkey(), w = water(k), wp = w / S.waterGoal;
  const day = addDays(new Date(), ui.sleepOff), dk = dkey(day), sl = S.sleep[dk] || {}, sd = sleepDur(sl);
  const lastS = Object.keys(S.sleep).sort().pop(), tpl = S.sleep[lastS] || {};
  const bed = sl.bed || tpl.bed || '23:00', wk = sl.wake || tpl.wake || '07:00';
  const smaxSteps = Math.max(S.stepGoal, ...last7().map(d => steps(dkey(d))));
  const wmax = Math.max(S.waterGoal, ...last7().map(d => water(dkey(d))));
  const smax = Math.max(S.sleepGoal + 1, ...last7().map(d => sleepDur(S.sleep[dkey(d)])));
  const avg = (() => { const v = last7().map(d => sleepDur(S.sleep[dkey(d)])).filter(Boolean); return v.length ? v.reduce((a, b) => a + b) / v.length : 0; })();
  return `
  <div class="top"><h1>Santé 💧</h1></div>
  <div class="card g1 stack"><div class="row"><div class="ring">${ring(wp, '<stop offset="0" stop-color="#20c9a6"/><stop offset="1" stop-color="#3fa9ff"/>')}
    <div class="t"><b>${w} ml</b><span class="small" style="opacity:.85">/ ${S.waterGoal} ml</span></div></div>
    <div class="grow stack"><h2>Hydratation</h2><p style="opacity:.9">${wp >= 1 ? '🎉 Objectif atteint !' : `Il reste ${S.waterGoal - w} ml`}</p>
    <div class="row"><button class="pill" data-act="waterUndo">↶ Annuler</button><button class="pill" data-act="waterGoal">🎯 Objectif</button></div></div></div>
    <div class="quick">${[150, 250, 330, 500].map(v => `<button data-act="water" data-v="${v}">+${v}</button>`).join('')}</div>
    <button class="btn soft sm" data-act="waterCustom">Autre quantité…</button></div>
  <div class="card"><h3>Eau · 7 jours</h3><div class="chart" style="margin-top:10px">${last7().map(d => { const v = water(dkey(d)); return `<div class="c ${v >= S.waterGoal ? 'hit' : ''} ${dkey(d) === k ? 'today' : ''}"><span>${v ? (v / 1000).toFixed(1) : ''}</span><i style="height:${v / wmax * 100}%"></i>${fr(d, { weekday: 'narrow' }).toUpperCase()}</div>`; }).join('')}</div></div>

  ${stepsCard()}
  <div class="card"><h3>Pas · 7 jours</h3><div class="chart" style="margin-top:10px">${last7().map(d => { const v = steps(dkey(d)); return `<div class="c ${v >= S.stepGoal ? 'hit' : ''} ${dkey(d) === k ? 'today' : ''}"><span>${v ? (v / 1000).toFixed(1) + 'k' : ''}</span><i style="height:${v / smaxSteps * 100}%"></i>${fr(d, { weekday: 'narrow' }).toUpperCase()}</div>`; }).join('')}</div></div>

  <div class="card g3 stack"><div class="row between"><button class="icon-btn" data-act="sleepNav" data-d="-1">←</button>
    <div class="center"><h2>😴 Sommeil</h2><p class="small" style="opacity:.9">Nuit se terminant le ${fr(day, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
    <button class="icon-btn" data-act="sleepNav" data-d="1" ${ui.sleepOff >= 0 ? 'disabled style="opacity:.3"' : ''}>→</button></div>
    <div class="inputs"><label >Coucher<input type="time" value="${bed}" data-ch="sleepT" data-f="bed"></label>
      <label >Réveil<input type="time" value="${wk}" data-ch="sleepT" data-f="wake"></label></div>
    <div class="center"><div style="font-size:38px;font-weight:900">${sd ? fmtH(sd) : '–'}</div><p class="small" style="opacity:.9">${!sd ? 'Renseigne tes horaires puis choisis ton humeur' : sd >= S.sleepGoal ? 'Objectif atteint ✅' : `Il manquait ${fmtH(S.sleepGoal - sd)} pour ton objectif de ${S.sleepGoal} h`}</p></div></div>
  <div class="card"><h3>Comment tu te sens ?</h3><div class="moods" style="margin-top:8px">${MOODS.map((m, i) => `<button class="${sl.q === i + 1 ? 'on' : ''}" data-act="mood" data-q="${i + 1}">${m}</button>`).join('')}</div></div>
  <div class="card"><div class="row between"><h3>Sommeil · 7 jours</h3><span class="chip">moy. ${avg ? fmtH(avg) : '–'}</span></div><div class="chart" style="margin-top:10px">${last7().map(d => { const v = sleepDur(S.sleep[dkey(d)]); return `<div class="c ${v >= S.sleepGoal ? 'hit' : ''} ${dkey(d) === dk ? 'today' : ''}"><span>${v ? fmtH(v) : ''}</span><i style="height:${v / smax * 100}%"></i>${fr(d, { weekday: 'narrow' }).toUpperCase()}</div>`; }).join('')}</div></div>`;
};
A.waterUndo = () => { const k = dkey(); S.water[k] = 0; save(); render(); toast('Eau du jour remise à zéro'); };
A.waterGoal = () => { const v = prompt('Objectif d\'eau par jour (en ml)', S.waterGoal); if (v && num(v) >= 500) { S.waterGoal = Math.round(num(v)); save(); render(); } };
A.waterCustom = () => { const v = prompt('Quantité à ajouter (en ml)', '200'); if (v && num(v) > 0) { S.water[dkey()] = water() + Math.round(num(v)); save(); render(); } };
A.sleepNav = el => { ui.sleepOff = Math.min(0, ui.sleepOff + +el.dataset.d); render(); };
C.sleepT = el => {
  const dk = dkey(addDays(new Date(), ui.sleepOff)), cur = S.sleep[dk] || {};
  const bed = $('[data-f=bed]').value, wake = $('[data-f=wake]').value;
  S.sleep[dk] = { ...cur, bed, wake }; save(); render();
};
A.mood = el => { const dk = dkey(addDays(new Date(), ui.sleepOff)); const cur = S.sleep[dk] || {}; S.sleep[dk] = { ...cur, q: +el.dataset.q }; save(); render(); };

/* ───────── RÉGLAGES ───────── */
routes.settings = () => `
  <div class="top">${back('#/home')}<h2>Réglages</h2><span style="width:42px"></span></div>
  <div class="card stack">
    <label class="field">Temps de repos entre les séries (secondes, 0 = désactivé)<input type="number" inputmode="numeric" value="${S.rest}" data-ch="setF" data-f="rest"></label>
    <label class="field">Objectif d'eau (ml / jour)<input type="number" inputmode="numeric" value="${S.waterGoal}" data-ch="setF" data-f="waterGoal"></label>
    <label class="field">Objectif de pas (par jour)<input type="number" inputmode="numeric" value="${S.stepGoal}" data-ch="setF" data-f="stepGoal"></label>
    <label class="field">Objectif de sommeil (heures)<input type="number" inputmode="decimal" step="0.5" value="${S.sleepGoal}" data-ch="setF" data-f="sleepGoal"></label>
  </div>
  <div class="card stack"><h3>Synchro des pas (Santé iPhone)</h3>
    <p class="small muted">Une web-app n'a pas le droit de lire l'app Santé directement. Un Raccourci iOS lit tes pas et les envoie ici. Les étapes sont dans le README du projet.</p>
    <label class="field">URL de synchro (JSON {"steps": 1234})<input type="text" inputmode="url" value="${esc(S.stepsUrl)}" placeholder="https://…/steps.json" data-ch="stepsUrl"></label>
    <button class="btn soft" data-act="stepsPull">↻ Synchroniser maintenant</button></div>
  <div class="card stack"><h3>Mes données</h3><p class="small muted">Tout reste sur cet appareil. Fais une sauvegarde de temps en temps (ou pour changer de téléphone).</p>
    <button class="btn soft" data-act="export">⬇️ Exporter une sauvegarde</button>
    <label class="btn soft" style="cursor:pointer">⬆️ Importer une sauvegarde<input type="file" accept="application/json" data-ch="import" hidden></label>
    <button class="btn danger" data-act="reset">Tout réinitialiser</button></div>`;
C.stepsUrl = el => { S.stepsUrl = el.value.trim(); save(); pullSteps(); toast('Enregistré ✓'); };
A.stepsPull = async () => { await pullSteps(); toast(S.stepsUrl ? 'Synchro lancée' : 'Renseigne d\'abord l\'URL'); };
C.setF = el => { const f = el.dataset.f; S[f] = Math.max(f === 'rest' ? 0 : 1, num(el.value)); save(); toast('Enregistré ✓'); };
A.export = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
  a.download = `elevatee-${dkey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
C.import = async el => {
  try {
    const d = JSON.parse(await el.files[0].text()); if (!Array.isArray(d.programs)) throw 0;
    if (!confirm('Remplacer toutes tes données actuelles par cette sauvegarde ?')) return;
    S = { ...fresh(), ...d, seedV: d.seedV || 1 }; save(); toast('Sauvegarde importée ✓'); go('#/home');
  } catch { toast('Fichier invalide'); }
};
A.reset = () => { if (confirm('Effacer toutes tes données et revenir au programme de départ ?')) { S = fresh(); save(); go('#/home'); } };


/* ───────── migration des données de départ ───────── */
(function migrate() {
  if ((S.seedV || 1) >= window.SEED_VERSION) return;
  const seed = window.SEED_PROGRAMS[0], bg = S.programs.find(p => p.id === 'busygirl');
  const renew = s => ({ ...structuredClone(s), id: uid(), exercises: s.exercises.map(e => ({ ...e, id: uid() })) });
  if (bg) {
    if (bg.phases[1] && !bg.phases[1].sessions.length) bg.phases[1].sessions = seed.phases[1].sessions.map(renew);
    const s2 = bg.phases[0].sessions.find(s => s.name === 'Upper Pilates & Abs');
    if (s2 && s2.exercises.filter(isWarm).length <= 1)
      s2.exercises = [...seed.phases[0].sessions[1].exercises.filter(isWarm).map(e => ({ ...e, id: uid() })), ...s2.exercises.filter(e => !isWarm(e))];
  }
  if ((S.seedV || 1) < 3 && !S.programs.some(p => p.id === 'buildathome')) {
    const b = structuredClone(window.SEED_PROGRAMS.find(p => p.id === 'buildathome'));
    b.phases.forEach(ph => { ph.sessions = ph.sessions.map(renew); });
    S.programs.push(b);
  }
  if ((S.seedV || 1) < 9) for (const pid of ['buildathome', 'buildyourbooty']) {   // complète les programmes (séances ajoutées / enrichies depuis les captures)
    const sb = window.SEED_PROGRAMS.find(p => p.id === pid), cb = S.programs.find(p => p.id === pid);
    if (sb && cb) sb.phases.forEach((sp, i) => {
      const cp = cb.phases[i]; if (!cp) return;
      sp.sessions.forEach(ss => {
        const cs = cp.sessions.find(x => x.name === ss.name);
        if (!cs) { cp.sessions.push(renew(ss)); return; }
        if (cs.exercises.length < ss.exercises.length) cs.exercises = ss.exercises.map(e => ({ ...e, id: uid() }));
        ['description', 'objective'].forEach(f => { if (!cs[f]) cs[f] = ss[f]; });
        ['muscles', 'equipment'].forEach(f => { if (!cs[f].length) cs[f] = [...ss[f]]; });
      });
    });
  }
  if (!S.programs.some(p => p.id === 'buildyourbooty')) {
    const b = structuredClone(window.SEED_PROGRAMS.find(p => p.id === 'buildyourbooty'));
    b.phases.forEach(ph => { ph.sessions = ph.sessions.map(renew); });
    S.programs.push(b);
  }
  S.seedV = window.SEED_VERSION; save();
})();
pullSteps();

/* ───────── boucle principale ───────── */
function tick() { timerStep(); paintTimer(); if (R.end) paintRest(); }
setInterval(tick, 250);
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
