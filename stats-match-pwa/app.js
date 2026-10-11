// Stats Match — saisie de stats basket en direct + rapport, calqué sur la feuille Excel du coach.
// Tout est stocké en local (localStorage), aucun réseau, aucun lien avec le carnet d'entraînement.

const STORAGE_KEY = 'statsMatch.v1';

const STAT_KEYS = [
  { key: 'a', short: '2PM', label: '2 pts réussi' },
  { key: 'b', short: '2PR', label: '2 pts manqué' },
  { key: 'c', short: '3PM', label: '3 pts réussi' },
  { key: 'd', short: '3PR', label: '3 pts manqué' },
  { key: 'e', short: 'RO', label: 'Rebond off.' },
  { key: 'f', short: 'BP', label: 'Perte de balle' },
  { key: 'g', short: 'F OUT', label: 'Faute commise' },
  { key: 'h', short: 'F LF', label: 'Faute subie' },
  { key: 'i', short: 'LF M', label: 'LF réussi' },
  { key: 'j', short: 'LF R', label: 'LF manqué' },
  { key: 'k', short: 'AND1', label: 'And-1' },
  { key: 'l', short: 'TOUCHE', label: 'Sortie en touche (ballon out)' },
];

function emptySide() {
  const s = {};
  STAT_KEYS.forEach(({ key }) => (s[key] = 0));
  return s;
}

function emptyMatch() {
  return {
    id: null,
    opponent: '',
    date: new Date().toISOString().slice(0, 10),
    off: emptySide(),
    def: emptySide(),
    shots: [],
    fouls: [],
    onCourt: [],
    quarter: 1,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { current: emptyMatch(), history: [], actionLog: [], roster: [] };
    const parsed = JSON.parse(raw);
    const cur = parsed.current || emptyMatch();
    if (!cur.shots) cur.shots = [];
    if (!cur.fouls) cur.fouls = [];
    if (!cur.onCourt) cur.onCourt = [];
    if (!cur.quarter) cur.quarter = 1;
    return {
      current: cur,
      history: parsed.history || [],
      actionLog: parsed.actionLog || [],
      roster: parsed.roster || [],
    };
  } catch (e) {
    return { current: emptyMatch(), history: [], actionLog: [], roster: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let activeTab = 'saisie';

// ---------- Calculs (identiques aux formules de la feuille Excel) ----------

function computeSide(s) {
  const { a, b, c, d, e, f, g, h, i, j, k, l } = s;
  const attempts = a + b + c + d; // SUM(A:D)
  const joues = a + b + c + d + f + h + l;
  const poss = a + b + c + d + f + h - e - k;
  const pts = a * 2 + c * 3 + i;
  const div = (num, den) => (den === 0 ? null : num / den);

  return {
    joues,
    poss,
    pts,
    ppp: div(pts, poss),
    fg2: div(a, a + b),
    fg3: div(c, c + d),
    orb: div(e, b + d),
    tov: div(f, poss),
    fd: div(h + g, poss),
    ft: div(i, i + j),
    ftRate: div(i + j, attempts),
    efg: div(a + c + 0.5 * c, attempts),
    freq2: div(a + b, attempts),
    freq3: div(c + d, attempts),
    ptsFrom2: a * 2,
    ptsFrom3: c * 3,
    ptsFromLF: i,
    effFrom2: div(a * 2, a + b),
    effFrom3: div(c * 3, c + d),
    fautesNormales: g,
    fautesLF: h,
  };
}

function pct(x, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return '-';
  return (x * 100).toFixed(digits) + '%';
}

function num(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return '-';
  return x.toFixed(digits);
}

// ---------- Actions ----------

function increment(side, key, delta) {
  const s = state.current[side];
  const next = s[key] + delta;
  if (next < 0) return;
  s[key] = next;
  if (delta > 0) {
    state.actionLog.push({ side, key });
  } else {
    const idx = state.actionLog.map((a) => a.side + a.key).lastIndexOf(side + key);
    if (idx >= 0) state.actionLog.splice(idx, 1);
    if (key === 'g' || key === 'h') removeLastFoul(side, key === 'g' ? 'out' : 'lf');
  }
  saveState();
  render();
}

function undoLast() {
  const last = state.actionLog.pop();
  if (!last) return;
  const s = state.current[last.side];
  if (s[last.key] > 0) s[last.key] -= 1;
  if (last.shot) state.current.shots.pop();
  if (last.foul) state.current.fouls.pop();
  saveState();
  render();
}

function newMatch() {
  if (!confirm('Démarrer un nouveau match ? Le match en cours (non enregistré) sera perdu.')) return;
  state.current = emptyMatch();
  state.actionLog = [];
  saveState();
  render();
}

function saveMatchToHistory() {
  const off = computeSide(state.current.off);
  const def = computeSide(state.current.def);
  const entry = {
    ...state.current,
    id: Date.now().toString(36),
    savedAt: new Date().toISOString(),
    finalOffPts: off.pts,
    finalDefPts: def.pts,
    roster: state.roster.map((pl) => ({ ...pl })),
  };
  state.history.unshift(entry);
  state.current = emptyMatch();
  state.actionLog = [];
  saveState();
  showToast('Match enregistré dans l\'historique');
  switchTab('historique');
}

function deleteHistoryMatch(id) {
  if (!confirm('Supprimer ce match de l\'historique ?')) return;
  state.history = state.history.filter((m) => m.id !== id);
  saveState();
  render();
}

function loadHistoryMatchReadonly(id) {
  const m = state.history.find((x) => x.id === id);
  if (!m) return;
  viewingHistoryId = id;
  switchTab('rapport');
}

let viewingHistoryId = null;

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (el.hidden = true), 2200);
}

function switchTab(tab) {
  activeTab = tab;
  pendingShot = null;
  pendingFoul = null;
  if (tab !== 'rapport') viewingHistoryId = null;
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  render();
}

// ---------- Fautes par joueur, terrain / banc, quart-temps ----------
// Convention de la feuille : F OUT / F LF d'un bloc = fautes provoquées par ce camp.
// Nos fautes sont donc celles saisies dans le bloc "Adversaire" (side === 'def').

const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'P'];
const FOUL_LIMIT = 5;
let pendingFoul = null;

function periodGroup(q) {
  return q === 5 ? 4 : q;
}

function teamFouls(fouls, side, q) {
  return fouls.filter((f) => f.side === side && periodGroup(f.q) === periodGroup(q)).length;
}

function playerFouls(fouls, playerId) {
  const mine = fouls.filter((f) => f.side === 'def' && f.playerId === playerId);
  const out = mine.filter((f) => f.type === 'out').length;
  return { out, lf: mine.length - out, total: mine.length };
}

function foulLevel(n) {
  if (n >= 5) return 'out';
  if (n === 4) return 'warn';
  if (n === 3) return 'watch';
  return '';
}

function addFoul(side, key, playerId) {
  state.current[side][key] += 1;
  state.current.fouls.push({
    side,
    type: key === 'g' ? 'out' : 'lf',
    q: state.current.quarter,
    playerId: playerId || null,
  });
  state.actionLog.push({ side, key, foul: true });
  pendingFoul = null;
  saveState();
  render();
}

function removeLastFoul(side, type) {
  const f = state.current.fouls;
  for (let i = f.length - 1; i >= 0; i--) {
    if (f[i].side === side && f[i].type === type) {
      f.splice(i, 1);
      return;
    }
  }
}

function removePlayerFoul(playerId) {
  const f = state.current.fouls;
  for (let i = f.length - 1; i >= 0; i--) {
    if (f[i].side === 'def' && f[i].playerId === playerId) {
      const key = f[i].type === 'out' ? 'g' : 'h';
      f.splice(i, 1);
      if (state.current.def[key] > 0) state.current.def[key] -= 1;
      const idx = state.actionLog.map((a) => a.side + a.key).lastIndexOf('def' + key);
      if (idx >= 0) state.actionLog.splice(idx, 1);
      break;
    }
  }
  saveState();
  render();
}

function sortedRoster() {
  const on = state.current.onCourt;
  return [...state.roster].sort((a, b) => {
    const da = on.includes(a.id) ? 0 : 1;
    const db = on.includes(b.id) ? 0 : 1;
    return da - db || (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0);
  });
}

function pips(n, max = FOUL_LIMIT) {
  let out = '';
  for (let i = 0; i < max; i++) out += `<span class="pip ${i < n ? 'on' : ''}"></span>`;
  return out;
}

function playerLabel(p) {
  return `<b>#${escapeHtml(p.num || '?')}</b> ${escapeHtml(p.name || '')}`;
}

function renderFoulPicker() {
  const m = state.current;
  const type = pendingFoul.key === 'g' ? 'F OUT' : 'F LF';
  return `
    <div class="foul-backdrop" id="foulCancel"></div>
    <div class="foul-sheet">
      <div class="foul-title">Faute de qui ? <span>${type} · ${PERIODS[m.quarter - 1]}</span></div>
      <div class="foul-grid">
        ${sortedRoster()
          .map((p) => {
            const n = playerFouls(m.fouls, p.id).total;
            return `<button class="foul-player ${m.onCourt.includes(p.id) ? 'on' : ''} lvl-${foulLevel(n)}" data-pickplayer="${p.id}">
              <span>${playerLabel(p)}</span><span class="pips lvl-${foulLevel(n)}">${pips(n)}</span>
            </button>`;
          })
          .join('')}
      </div>
      <div class="foul-footer">
        <button class="foul-player" data-pickplayer="">Sans joueur</button>
        <button class="foul-player" id="foulCancelBtn">Annuler</button>
      </div>
    </div>`;
}

function renderEquipe() {
  const m = state.current;
  const q = m.quarter;
  const ours = teamFouls(m.fouls, 'def', q);
  const theirs = teamFouls(m.fouls, 'off', q);
  const on = m.onCourt.length;
  const plural = (n) => `${n} faute${n > 1 ? 's' : ''}`;
  return `
    <div class="period-row">
      ${PERIODS.map((p, i) => `<button class="period-btn ${q === i + 1 ? 'active' : ''}" data-period="${i + 1}">${p}</button>`).join('')}
    </div>
    <div class="team-fouls">
      <div class="tf-card">
        <div class="tf-title"><span>Nous</span><span>${plural(ours)}</span></div>
        <div class="pips lvl-${foulLevel(ours)}">${pips(ours)}</div>
        ${ours >= 4 ? '<div class="badge bad">Adversaire en bonus</div>' : '<div class="badge none">&nbsp;</div>'}
      </div>
      <div class="tf-card">
        <div class="tf-title"><span>Adversaire</span><span>${plural(theirs)}</span></div>
        <div class="pips lvl-${foulLevel(theirs)}">${pips(theirs)}</div>
        ${theirs >= 4 ? '<div class="badge good">Nous en bonus</div>' : '<div class="badge none">&nbsp;</div>'}
      </div>
    </div>
    <h3 class="sec-title">Joueurs <span class="${on === 5 ? '' : 'warn-text'}">${on}/5 sur le terrain</span></h3>
    ${
      state.roster.length === 0
        ? '<div class="empty-state" style="padding:16px 0">Ajoute ton effectif ci-dessous pour suivre les fautes par joueur.</div>'
        : sortedRoster()
            .map((p) => {
              const f = playerFouls(m.fouls, p.id);
              const isOn = m.onCourt.includes(p.id);
              return `<div class="player-row ${isOn ? 'on' : ''}">
                <button class="court-toggle ${isOn ? 'on' : ''}" data-toggle="${p.id}">${isOn ? 'Terrain' : 'Banc'}</button>
                <div class="p-name">${playerLabel(p)}${f.total >= FOUL_LIMIT ? ' <span class="badge bad">Éliminé</span>' : ''}</div>
                <div class="p-fouls">
                  <div class="pips lvl-${foulLevel(f.total)}">${pips(f.total)}</div>
                  <div class="p-detail">${f.out} simple${f.out > 1 ? 's' : ''} · ${f.lf} LF</div>
                </div>
                <button class="p-minus" data-undofoul="${p.id}" ${f.total ? '' : 'disabled'} title="Retirer sa dernière faute">−</button>
              </div>`;
            })
            .join('')
    }
    <h3 class="sec-title">Effectif</h3>
    <div class="roster-form">
      <input id="newNum" type="text" inputmode="numeric" maxlength="3" placeholder="N°" />
      <input id="newName" type="text" maxlength="20" placeholder="Prénom / nom" />
      <button id="addPlayerBtn" class="icon-btn" style="width:auto;padding:0 14px;font-size:14px">Ajouter</button>
    </div>
    <div class="roster-chips">
      ${state.roster
        .map((p) => `<span class="chip">${playerLabel(p)} <button data-delplayer="${p.id}" aria-label="Retirer">✕</button></span>`)
        .join('')}
    </div>`;
}

function renderFoulReport(match) {
  const fouls = match.fouls || [];
  const roster = match === state.current ? state.roster : match.roster || [];
  const total = match.def.g + match.def.h;
  if (!fouls.length && !total) return '';
  let html = '';
  if (fouls.length) {
    const row = (label, side) =>
      `<tr><td>${label}</td>${[1, 2, 3, 4, 5].map((q) => `<td>${fouls.filter((f) => f.side === side && f.q === q).length}</td>`).join('')}</tr>`;
    html += `<div class="report-section">
      <h3>Fautes d'équipe par période</h3>
      <table class="table">
        <tr><th></th>${PERIODS.map((p) => `<th>${p}</th>`).join('')}</tr>
        ${row('Nous', 'def')}${row('Adversaire', 'off')}
      </table>
      <p class="hint">Bonus à partir de 4 fautes d'équipe dans le quart-temps (la prolongation compte avec le Q4).</p>
    </div>`;
  }
  let attributed = 0;
  const rows = roster
    .map((p) => {
      const f = playerFouls(fouls, p.id);
      attributed += f.total;
      return { p, f };
    })
    .filter((r) => r.f.total > 0)
    .sort((a, b) => b.f.total - a.f.total)
    .map(({ p, f }) => `<tr><td>${playerLabel(p)}</td><td>${f.out}</td><td>${f.lf}</td><td><b>${f.total}</b></td></tr>`)
    .join('');
  const rest = total - attributed;
  html += `<div class="report-section">
    <h3>Nos fautes par joueur</h3>
    <table class="table">
      <tr><th>Joueur</th><th>Simples</th><th>LF</th><th>Total</th></tr>
      ${rows}
      ${rest > 0 ? `<tr><td>Sans joueur</td><td colspan="2"></td><td><b>${rest}</b></td></tr>` : ''}
    </table>
  </div>`;
  return html;
}

// ---------- Carte des tirs (demi-terrain FIBA, 30 px = 1 m) ----------

const COURT = { w: 450, h: 420, bx: 225, by: 47, r3: 202.5, cornerDx: 198, cornerEndY: 89.4 };

function isThree(x, y) {
  const dx = Math.abs(x - COURT.bx);
  if (y <= COURT.cornerEndY) return dx >= COURT.cornerDx;
  return Math.hypot(x - COURT.bx, y - COURT.by) >= COURT.r3;
}

function shotZone(x, y) {
  if (isThree(x, y)) return y <= COURT.cornerEndY ? 'corner' : 'three';
  const inPaint = x >= 151.5 && x <= 298.5 && y <= 174;
  return inPaint ? 'paint' : 'mid';
}

const ZONES = [
  { key: 'paint', label: 'Raquette' },
  { key: 'mid', label: 'Mi-distance' },
  { key: 'corner', label: '3 pts corner' },
  { key: 'three', label: '3 pts hors corner' },
];

let shotSide = 'off';
let pendingShot = null;

function addShot(side, x, y, made) {
  const three = isThree(x, y);
  const key = made ? (three ? 'c' : 'a') : (three ? 'd' : 'b');
  state.current[side][key] += 1;
  state.current.shots.push({ side, x: Math.round(x), y: Math.round(y), made, three });
  state.actionLog.push({ side, key, shot: true });
  pendingShot = null;
  saveState();
  render();
}

function zoneStats(shots) {
  return ZONES.map(({ key, label }) => {
    const inZone = shots.filter((s) => shotZone(s.x, s.y) === key);
    const made = inZone.filter((s) => s.made).length;
    return { label, made, att: inZone.length, pct: inZone.length ? made / inZone.length : null };
  });
}

function courtSvg(shots, pending) {
  const line = 'fill="none" stroke="var(--court-line)" stroke-width="2"';
  const dots = shots
    .map((s) =>
      s.made
        ? `<circle cx="${s.x}" cy="${s.y}" r="7" fill="var(--good)" fill-opacity="0.85" stroke="#fff" stroke-width="1"/>`
        : `<g stroke="var(--bad)" stroke-width="3" stroke-linecap="round"><line x1="${s.x - 5}" y1="${s.y - 5}" x2="${s.x + 5}" y2="${s.y + 5}"/><line x1="${s.x - 5}" y1="${s.y + 5}" x2="${s.x + 5}" y2="${s.y - 5}"/></g>`
    )
    .join('');
  const pend = pending
    ? `<circle cx="${pending.x}" cy="${pending.y}" r="9" fill="none" stroke="var(--off)" stroke-width="3" stroke-dasharray="4 3"/>`
    : '';
  return `
    <svg id="court" viewBox="0 0 ${COURT.w} ${COURT.h}" class="court">
      <rect x="1" y="1" width="448" height="418" fill="var(--court-bg)" ${line}/>
      <rect x="151.5" y="1" width="147" height="173" ${line}/>
      <path d="M171 174 A54 54 0 0 0 279 174" ${line} stroke-dasharray="6 5"/>
      <path d="M171 174 A54 54 0 0 1 279 174" ${line}/>
      <path d="M187.5 47 A37.5 37.5 0 0 0 262.5 47" ${line}/>
      <line x1="198" y1="36" x2="252" y2="36" ${line}/>
      <circle cx="225" cy="47" r="7" ${line}/>
      <path d="M27 1 V89.4 A202.5 202.5 0 0 0 423 89.4 V1" ${line}/>
      ${dots}${pend}
    </svg>`;
}

function zoneTable(shots, counters) {
  let extra = '';
  if (counters) {
    const att = counters.a + counters.b + counters.c + counters.d;
    const made = counters.a + counters.c;
    const mappedMade = shots.filter((x) => x.made).length;
    const unAtt = att - shots.length;
    const unMade = made - mappedMade;
    if (unAtt > 0) {
      extra = `<tr><td>Non localisés</td><td>${unMade}</td><td>${unAtt}</td><td>${pct(unAtt ? unMade / unAtt : null)}</td></tr>`;
    }
  }
  return `
    <table class="table">
      <tr><th>Zone</th><th>Réussis</th><th>Tentés</th><th>%</th></tr>
      ${zoneStats(shots)
        .map((z) => `<tr><td>${z.label}</td><td>${z.made}</td><td>${z.att}</td><td>${pct(z.pct)}</td></tr>`)
        .join('')}
      ${extra}
    </table>`;
}

const SHOT_KEYS = ['a', 'b', 'c', 'd'];

function renderStatGrid(side) {
  const data = state.current[side];
  return `
    <div class="stat-grid">
      ${STAT_KEYS.filter(({ key }) => !SHOT_KEYS.includes(key))
        .map(
          ({ key, short }) => `
        <button class="stat-btn" data-side="${side}" data-key="${key}" data-action="inc">
          <span class="minus" data-side="${side}" data-key="${key}" data-action="dec">−</span>
          <span class="short">${short}</span>
          <span class="count">${data[key]}</span>
        </button>`
        )
        .join('')}
    </div>`;
}

function renderSaisie() {
  const side = shotSide;
  const data = state.current[side];
  const sum = computeSide(data);
  const shots = state.current.shots.filter((x) => x.side === side);
  const ctl = (n) => (pendingShot ? '' : 'disabled');
  return `
    <div class="seg">
      <button class="seg-btn ${side === 'off' ? 'active off' : ''}" data-shotside="off">Nous</button>
      <button class="seg-btn ${side === 'def' ? 'active def' : ''}" data-shotside="def">Adversaire</button>
      <button class="seg-btn q-btn lvl-${foulLevel(teamFouls(state.current.fouls, 'def', state.current.quarter))}" id="quarterBtn">${PERIODS[state.current.quarter - 1]} · ${teamFouls(state.current.fouls, 'def', state.current.quarter)}F</button>
    </div>
    <div class="shot-summary">
      <span>${sum.pts} pts · ${sum.poss} poss · PPP ${num(sum.ppp)}</span>
      <span>2pts ${data.a}/${data.a + data.b} · 3pts ${data.c}/${data.c + data.d}</span>
    </div>
    ${courtSvg(shots, pendingShot)}
    <div class="shot-actions">
      <button id="shotMade" class="shot-btn made" ${ctl()}>✓ Réussi</button>
      <button id="shotMiss" class="shot-btn miss" ${ctl()}>✗ Raté</button>
    </div>
    <p class="hint">${pendingShot ? 'Tir placé : choisis le résultat.' : 'Touche le terrain à l\'endroit du tir.'}</p>
    ${renderStatGrid(side)}
    <button id="saveMatchBtn" class="icon-btn" style="width:100%;border-radius:12px;padding:12px;font-size:14px;font-weight:700;margin-top:10px;">
      ✓ Terminer &amp; enregistrer le match
    </button>
    ${pendingFoul ? renderFoulPicker() : ''}
  `;
}

function gaugeRow(side, val, formatter) {
  const v = val === null || val === undefined || Number.isNaN(val) ? 0 : val;
  const width = Math.max(0, Math.min(100, v * 100));
  return `
    <div class="gauge-row">
      <span class="gauge-label ${side}">${side === 'off' ? 'Nous' : 'Adv.'}</span>
      <div class="gauge-track"><div class="gauge-fill ${side}" style="width:${width}%"></div></div>
      <span class="gauge-val ${side}">${formatter(val)}</span>
    </div>`;
}

function compareStat(title, offVal, defVal, formatter) {
  return `
    <div class="compare-stat">
      <h4>${title}</h4>
      ${gaugeRow('off', offVal, formatter)}
      ${gaugeRow('def', defVal, formatter)}
    </div>`;
}

function renderRapport() {
  const match = viewingHistoryId
    ? state.history.find((m) => m.id === viewingHistoryId) || state.current
    : state.current;
  const off = computeSide(match.off);
  const def = computeSide(match.def);
  const title = match.opponent ? `vs ${escapeHtml(match.opponent)}` : 'Match sans nom';

  return `
    <div class="print-header">
      <h1>Rapport de match — ${title}</h1>
      <div class="sub">${match.date}</div>
    </div>
    <button id="exportPdfBtn" class="icon-btn no-print" style="width:100%;border-radius:12px;padding:12px;font-size:14px;font-weight:700;margin-bottom:14px;">
      🖨️ Exporter en PDF
    </button>
    ${
      viewingHistoryId
        ? `<div class="empty-state no-print" style="padding:10px 0;text-align:left;">Match du ${match.date}${match.opponent ? ' vs ' + match.opponent : ''} (historique)</div>`
        : ''
    }
    <div class="report-section">
      <h3>Score / possessions</h3>
      <div class="stat-cards">
        <div class="stat-card">
          <div class="title">Nous</div>
          <div class="big" style="color:var(--off)">${off.pts} pts</div>
          <div class="title">${off.poss} poss · PPP ${num(off.ppp)}</div>
        </div>
        <div class="stat-card">
          <div class="title">Adversaire</div>
          <div class="big" style="color:var(--def)">${def.pts} pts</div>
          <div class="title">${def.poss} poss · PPP ${num(def.ppp)}</div>
        </div>
      </div>
    </div>

    <div class="report-section">
      <h3>Comparatif attaque / défense</h3>
      ${compareStat('eFG%', off.efg, def.efg, pct)}
      ${compareStat('FT Rate', off.ftRate, def.ftRate, pct)}
      ${compareStat('Rebond off. %', off.orb, def.orb, pct)}
      ${compareStat('Perte de balle %', off.tov, def.tov, pct)}
    </div>

    ${(match.shots || []).length
      ? [['off', 'nous'], ['def', 'adversaire']]
          .map(([sd, lbl]) => {
            const sh = match.shots.filter((x) => x.side === sd);
            if (!sh.length) return '';
            return `<div class="report-section">
      <h3>Carte des tirs — ${lbl}</h3>
      ${courtSvg(sh, null)}
      ${zoneTable(sh, match[sd])}
    </div>`;
          })
          .join('')
      : ''}

    <div class="report-section">
      <h3>Répartition des tirs</h3>
      <table class="table">
        <tr><th></th><th>Fréq. 2pts</th><th>Fréq. 3pts</th><th>2FG%</th><th>3FG%</th></tr>
        <tr><td>Nous</td><td>${pct(off.freq2)}</td><td>${pct(off.freq3)}</td><td>${pct(off.fg2)}</td><td>${pct(off.fg3)}</td></tr>
        <tr><td>Adversaire</td><td>${pct(def.freq2)}</td><td>${pct(def.freq3)}</td><td>${pct(def.fg2)}</td><td>${pct(def.fg3)}</td></tr>
      </table>
    </div>

    <div class="report-section">
      <h3>Fautes</h3>
      <table class="table">
        <tr><th></th><th>Normales</th><th>Avec LF</th><th>LF%</th></tr>
        <tr><td>Nous</td><td>${off.fautesNormales}</td><td>${off.fautesLF}</td><td>${pct(off.ft)}</td></tr>
        <tr><td>Adversaire</td><td>${def.fautesNormales}</td><td>${def.fautesLF}</td><td>${pct(def.ft)}</td></tr>
      </table>
    </div>

    ${renderFoulReport(match)}

    <div class="report-section">
      <h3>Points marqués par type</h3>
      <table class="table">
        <tr><th></th><th>2 pts</th><th>3 pts</th><th>LF</th></tr>
        <tr><td>Nous</td><td>${off.ptsFrom2}</td><td>${off.ptsFrom3}</td><td>${off.ptsFromLF}</td></tr>
        <tr><td>Adversaire</td><td>${def.ptsFrom2}</td><td>${def.ptsFrom3}</td><td>${def.ptsFromLF}</td></tr>
      </table>
    </div>

    <div class="report-section">
      <h3>Efficacité par tir (points / tentative)</h3>
      <table class="table">
        <tr><th></th><th>2 pts</th><th>3 pts</th></tr>
        <tr><td>Nous</td><td>${num(off.effFrom2)}</td><td>${num(off.effFrom3)}</td></tr>
        <tr><td>Adversaire</td><td>${num(def.effFrom2)}</td><td>${num(def.effFrom3)}</td></tr>
      </table>
    </div>
  `;
}

function renderHistorique() {
  if (state.history.length === 0) {
    return `<div class="empty-state">Aucun match enregistré pour l'instant.<br>Termine une saisie pour le voir apparaître ici.</div>`;
  }
  return state.history
    .map(
      (m) => `
      <div class="history-item">
        <div class="meta">
          <span class="opp">${m.opponent ? 'vs ' + escapeHtml(m.opponent) : 'Match sans nom'}</span>
          <span class="date">${m.date}</span>
        </div>
        <div class="score"><span class="off">${m.finalOffPts}</span> - <span class="def">${m.finalDefPts}</span></div>
        <div class="history-actions">
          <button data-action="view" data-id="${m.id}">Rapport</button>
          <button data-action="delete" data-id="${m.id}">Suppr.</button>
        </div>
      </div>`
    )
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  const app = document.getElementById('app');
  if (activeTab === 'saisie') app.innerHTML = renderSaisie();
  else if (activeTab === 'equipe') app.innerHTML = renderEquipe();
  else if (activeTab === 'rapport') app.innerHTML = renderRapport();
  else app.innerHTML = renderHistorique();

  document.getElementById('opponent').value = state.current.opponent;
  document.getElementById('matchDate').value = state.current.date;
  document.getElementById('undoBtn').disabled = state.actionLog.length === 0;

  attachDynamicListeners();
}

function attachDynamicListeners() {
  document.querySelectorAll('[data-action="inc"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'dec') return; // handled separately
      const { side, key } = btn.dataset;
      if (key === 'g' || key === 'h') {
        if (side === 'def' && state.roster.length) {
          pendingFoul = { key };
          render();
        } else {
          addFoul(side, key, null);
        }
        return;
      }
      increment(side, key, 1);
    });
  });
  document.querySelectorAll('[data-action="dec"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      increment(btn.dataset.side, btn.dataset.key, -1);
    });
  });
  const saveBtn = document.getElementById('saveMatchBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveMatchToHistory);

  const court = document.getElementById('court');
  if (court && activeTab === 'saisie') {
    court.addEventListener('click', (e) => {
      const r = court.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * COURT.w;
      const y = ((e.clientY - r.top) / r.height) * COURT.h;
      pendingShot = { x: Math.max(2, Math.min(COURT.w - 2, x)), y: Math.max(2, Math.min(COURT.h - 2, y)) };
      render();
    });
    document.getElementById('shotMade').addEventListener('click', () => pendingShot && addShot(shotSide, pendingShot.x, pendingShot.y, true));
    document.getElementById('shotMiss').addEventListener('click', () => pendingShot && addShot(shotSide, pendingShot.x, pendingShot.y, false));
    document.querySelectorAll('[data-shotside]').forEach((b) =>
      b.addEventListener('click', () => { shotSide = b.dataset.shotside; pendingShot = null; render(); })
    );
  }

  const qBtn = document.getElementById('quarterBtn');
  if (qBtn) {
    qBtn.addEventListener('click', () => {
      state.current.quarter = (state.current.quarter % 5) + 1;
      saveState();
      render();
    });
  }
  document.querySelectorAll('[data-pickplayer]').forEach((b) =>
    b.addEventListener('click', () => pendingFoul && addFoul('def', pendingFoul.key, b.dataset.pickplayer))
  );
  ['foulCancel', 'foulCancelBtn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { pendingFoul = null; render(); });
  });

  document.querySelectorAll('[data-period]').forEach((b) =>
    b.addEventListener('click', () => {
      state.current.quarter = Number(b.dataset.period);
      saveState();
      render();
    })
  );
  document.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const on = state.current.onCourt;
      const i = on.indexOf(b.dataset.toggle);
      if (i >= 0) on.splice(i, 1);
      else on.push(b.dataset.toggle);
      saveState();
      render();
    })
  );
  document.querySelectorAll('[data-undofoul]').forEach((b) =>
    b.addEventListener('click', () => removePlayerFoul(b.dataset.undofoul))
  );
  const addBtn = document.getElementById('addPlayerBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const num = document.getElementById('newNum').value.trim();
      const name = document.getElementById('newName').value.trim();
      if (!num && !name) return;
      state.roster.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), num, name });
      saveState();
      render();
    });
  }
  document.querySelectorAll('[data-delplayer]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = state.roster.find((x) => x.id === b.dataset.delplayer);
      if (!p || !confirm(`Retirer #${p.num} ${p.name} de l'effectif ?`)) return;
      state.roster = state.roster.filter((x) => x.id !== p.id);
      state.current.onCourt = state.current.onCourt.filter((id) => id !== p.id);
      saveState();
      render();
    })
  );

  const exportBtn = document.getElementById('exportPdfBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => window.print());

  document.querySelectorAll('.history-actions [data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', () => loadHistoryMatchReadonly(btn.dataset.id));
  });
  document.querySelectorAll('.history-actions [data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteHistoryMatch(btn.dataset.id));
  });
}

// ---------- Init ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('opponent').addEventListener('input', (e) => {
  state.current.opponent = e.target.value;
  saveState();
});
document.getElementById('matchDate').addEventListener('change', (e) => {
  state.current.date = e.target.value;
  saveState();
});
document.getElementById('newMatchBtn').addEventListener('click', newMatch);
document.getElementById('undoBtn').addEventListener('click', undoLast);

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
