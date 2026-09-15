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
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { current: emptyMatch(), history: [], actionLog: [] };
    const parsed = JSON.parse(raw);
    return {
      current: parsed.current || emptyMatch(),
      history: parsed.history || [],
      actionLog: parsed.actionLog || [],
    };
  } catch (e) {
    return { current: emptyMatch(), history: [], actionLog: [] };
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
  }
  saveState();
  render();
}

function undoLast() {
  const last = state.actionLog.pop();
  if (!last) return;
  const s = state.current[last.side];
  if (s[last.key] > 0) s[last.key] -= 1;
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
  if (tab !== 'rapport') viewingHistoryId = null;
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  render();
}

// ---------- Rendu ----------

function renderStatGrid(side) {
  const data = state.current[side];
  return `
    <div class="stat-grid">
      ${STAT_KEYS.map(
        ({ key, short }) => `
        <button class="stat-btn" data-side="${side}" data-key="${key}" data-action="inc">
          <span class="minus" data-side="${side}" data-key="${key}" data-action="dec">−</span>
          <span class="short">${short}</span>
          <span class="count">${data[key]}</span>
        </button>`
      ).join('')}
    </div>`;
}

function renderSaisie() {
  const off = computeSide(state.current.off);
  const def = computeSide(state.current.def);
  return `
    <div class="side-block off">
      <div class="side-header">
        <span>ATTAQUE (nous)</span>
        <span class="summary">${off.pts} pts · ${off.poss} poss · PPP ${num(off.ppp)}</span>
      </div>
      ${renderStatGrid('off')}
    </div>
    <div class="side-block def">
      <div class="side-header">
        <span>DÉFENSE (adversaire)</span>
        <span class="summary">${def.pts} pts · ${def.poss} poss · PPP ${num(def.ppp)}</span>
      </div>
      ${renderStatGrid('def')}
    </div>
    <button id="saveMatchBtn" class="icon-btn" style="width:100%;border-radius:12px;padding:12px;font-size:14px;font-weight:700;margin-top:6px;">
      ✓ Terminer &amp; enregistrer le match
    </button>
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
      increment(btn.dataset.side, btn.dataset.key, 1);
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
