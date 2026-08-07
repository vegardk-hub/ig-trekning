const KEY = 'poengtavle-v1';
const DAY_LABELS = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const EMOJIS = ['⭐', '😴', '🛁', '🛏️', '🍽️', '🗑️', '🧸', '🐕', '👕', '🪴', '🦷', '📚', '🎒', '🧹', '🚲', '🍎', '✏️', '🧦', '🚿', '🧺', '🥣', '🎹'];
const COLORS = { blue: '#e6f1fb', pink: '#fbeaf0', green: '#eaf3de', amber: '#faeeda', purple: '#eeedfe', teal: '#e1f5ee' };

const SMILEY = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.8" cy="10" r="1.3" fill="currentColor"/><circle cx="15.2" cy="10" r="1.3" fill="currentColor"/><path d="M7.6 14.2c1.1 1.7 2.6 2.5 4.4 2.5s3.3-.8 4.4-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5.4l3.4 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let S = null;
let ui = { view: 'home', childId: null, weekOffset: 0, parent: false, tab: 'approve', pin: '', newEmoji: '⭐', popCell: null };

/* ---------- lagring ---------- */

function defaults() {
  const t = (emoji, name, price, kids) => ({ id: uid(), emoji, name, price, kids: kids || null, week: null, archived: false });
  return {
    version: 1,
    pin: '0418',
    lastBackup: null,
    children: [
      { id: 'c1', name: 'Vetle', emoji: '🚀', color: 'blue' },
      { id: 'c2', name: 'Live', emoji: '🌸', color: 'pink' }
    ],
    tasks: [
      t('😴', 'Sove i egen seng', 10),
      t('🛁', 'Vaske badet', 50),
      t('🛏️', 'Rydde rommet', 30),
      t('🍽️', 'Tømme oppvaskmaskinen', 15),
      t('🗑️', 'Gå ut med søpla', 5),
      t('🧸', 'Leke med Live', null, ['c1'])
    ],
    events: [],
    payouts: []
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    S = raw ? JSON.parse(raw) : defaults();
  } catch (e) {
    S = defaults();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    toast('Fikk ikke lagret — er lagringen full?');
  }
}

function uid() { return Math.random().toString(36).slice(2, 10); }

/* ---------- dato ---------- */

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseIso(s) { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function weekDates(offset) {
  const m = mondayOf(new Date());
  m.setDate(m.getDate() + offset * 7);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(m);
    d.setDate(m.getDate() + i);
    out.push(d);
  }
  return out;
}

function weekNumber(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const jan4 = new Date(x.getFullYear(), 0, 4);
  return 1 + Math.round(((x - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function longDate(s) {
  const d = parseIso(s);
  return d.getDate() + '. ' + MONTHS[d.getMonth()];
}

function dayName(s) {
  const full = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
  return full[(parseIso(s).getDay() + 6) % 7];
}

function daysSince(s) {
  if (!s) return Infinity;
  return Math.round((new Date() - parseIso(s)) / 86400000);
}

/* ---------- oppslag ---------- */

function child(id) { return S.children.find(c => c.id === id); }
function task(id) { return S.tasks.find(t => t.id === id); }

function tasksFor(childId, weekKey) {
  return S.tasks.filter(t =>
    !t.archived &&
    (!t.kids || t.kids.indexOf(childId) >= 0) &&
    (!t.week || t.week === weekKey)
  );
}

function eventAt(childId, taskId, date) {
  return S.events.find(e => e.childId === childId && e.taskId === taskId && e.date === date);
}

function pending() { return S.events.filter(e => e.status === 'pending'); }

function balance(childId) {
  const earned = S.events.filter(e => e.childId === childId && e.status === 'approved')
    .reduce((s, e) => s + (e.amount || 0), 0);
  const paid = S.payouts.filter(p => p.childId === childId).reduce((s, p) => s + p.amount, 0);
  return earned - paid;
}

function earnedBetween(childId, from, to) {
  return S.events.filter(e => e.childId === childId && e.status === 'approved' && e.date >= from && e.date <= to)
    .reduce((s, e) => s + (e.amount || 0), 0);
}

function kr(n) { return Math.round(n).toLocaleString('nb-NO') + ' kr'; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
/* navn lagres slik de skrives; barnesidene roper dem ut med text-transform i CSS */

/* ---------- visninger ---------- */

function render() {
  const app = document.getElementById('app');
  let html;
  if (ui.view === 'home') html = viewHome();
  else if (ui.view === 'board') html = viewBoard();
  else if (ui.view === 'pin') html = viewPin();
  else html = viewParent();
  app.innerHTML = html;
  if (ui.view === 'parent' && ui.tab === 'tasks') bindDrag();
  ui.popCell = null;
}

function viewHome() {
  const n = pending().length;
  const kids = S.children.map(c => `
    <button class="kid" data-act="child" data-id="${c.id}">
      <div class="kid-avatar" style="background:${COLORS[c.color] || COLORS.blue}">${c.emoji}</div>
      <div class="kid-name">${esc(c.name)}</div>
      <div class="kid-sum">${kr(balance(c.id))}</div>
      <div class="subtle">spart opp</div>
    </button>`).join('');
  return `
    <div class="topbar">
      <h1 class="title">HVEM ER DU?</h1>
      <button class="btn" data-act="parent">🔒 Foreldre${n ? `<span class="badge">${n}</span>` : ''}</button>
    </div>
    <div class="kids">
      ${kids}
      <button class="kid kid-dashed" data-act="parent" data-goto="settings">
        <div class="kid-avatar" style="background:var(--bg)">＋</div>
        <div>Legg til barn</div>
      </button>
    </div>`;
}

function viewBoard() {
  const c = child(ui.childId);
  if (!c) { ui.view = 'home'; return viewHome(); }
  const dates = weekDates(ui.weekOffset);
  const keys = dates.map(iso);
  const wk = iso(dates[0]);
  const today = iso(new Date());
  const list = tasksFor(c.id, wk);
  const nPend = pending().length;

  const head = `<div></div><div class="board-head">KR</div>` +
    dates.map((d, i) => `<div class="board-head${keys[i] === today ? ' today' : ''}">${DAY_LABELS[i]}</div>`).join('') +
    `<div class="board-head">SUM</div>`;

  const rows = list.map(t => {
    const cells = keys.map(k => {
      const e = eventAt(c.id, t.id, k);
      const st = e ? (e.status === 'approved' ? 'ok' : 'wait') : '';
      const mark = e ? (e.status === 'approved' ? SMILEY : CLOCK) : '';
      const pop = ui.popCell === c.id + t.id + k ? ' pop' : '';
      const label = t.name + ' ' + dayName(k) + (e ? (e.status === 'approved' ? ' – godkjent' : ' – venter') : ' – ikke gjort');
      return `<button class="cell ${st}${k === today ? ' today' : ''}${pop}" data-act="cell" data-task="${t.id}" data-date="${k}" aria-label="${esc(label)}">${mark}</button>`;
    }).join('');
    const sum = keys.reduce((s, k) => {
      const e = eventAt(c.id, t.id, k);
      return s + (e && e.status === 'approved' ? (e.amount || 0) : 0);
    }, 0);
    return `<div class="task-name"><span class="task-emoji">${t.emoji}</span>${esc(t.name)}</div>
      <div class="task-kr">${t.price === null ? '?' : t.price}</div>
      ${cells}
      <div class="task-sum${sum ? '' : ' zero'}">${sum}</div>`;
  }).join('');

  const weekSum = earnedBetween(c.id, keys[0], keys[6]);
  const label = ui.weekOffset === 0 ? 'Denne uken' : 'Uke ' + weekNumber(dates[0]);

  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="btn btn-ghost" data-act="home" aria-label="Tilbake">←</button>
        <div class="kid-avatar" style="width:48px;height:48px;font-size:26px;margin:0;background:${COLORS[c.color] || COLORS.blue}">${c.emoji}</div>
        <div>
          <div class="kid-name" style="font-size:19px">${esc(c.name)}</div>
          <div class="subtle">Uke ${weekNumber(dates[0])}</div>
        </div>
      </div>
      <div class="week-nav">
        <button class="btn btn-icon" data-act="week" data-d="-1" aria-label="Forrige uke">◀</button>
        <button class="btn btn-sm" data-act="week" data-d="0">${label}</button>
        <button class="btn btn-icon" data-act="week" data-d="1" aria-label="Neste uke">▶</button>
        <button class="btn btn-sm" data-act="parent">🔒${nPend ? `<span class="badge">${nPend}</span>` : ''}</button>
      </div>
    </div>
    <div class="card">
      <div class="board" style="grid-template-columns:minmax(150px,2fr) 40px repeat(7,minmax(46px,1fr)) 54px">
        ${head}${rows}
      </div>
      ${list.length ? '' : '<div class="empty">Ingen oppgaver ennå. En voksen kan legge dem til.</div>'}
      <div class="legend">
        <span>${SMILEY} Godkjent</span>
        <span>${CLOCK} Venter på mamma eller pappa</span>
        <span style="margin-left:auto;font-size:16px;color:var(--ink)">Denne uken: <strong>${kr(weekSum)}</strong></span>
      </div>
    </div>`;
}

function viewPin() {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'x'];
  return `
    <div class="topbar"><button class="btn btn-ghost" data-act="home">← Tilbake</button></div>
    <div class="pin-wrap${ui.pinBad ? ' shake' : ''}">
      <div class="section-title">Foreldremodus</div>
      <div class="hint">Tast koden</div>
      <div class="pin-dots">${[0, 1, 2, 3].map(i => `<div class="pin-dot${ui.pin.length > i ? ' on' : ''}"></div>`).join('')}</div>
      <div class="pin-pad">
        ${keys.map(k => k === null ? '<div></div>' :
          `<button class="pin-key" data-act="pinkey" data-k="${k}">${k === 'x' ? '⌫' : k}</button>`).join('')}
      </div>
    </div>`;
}

function viewParent() {
  const tabs = [['approve', 'Godkjenning'], ['tasks', 'Oppgaver'], ['payout', 'Utbetalinger'], ['settings', 'Innstillinger']];
  const n = pending().length;
  let body;
  if (ui.tab === 'approve') body = tabApprove();
  else if (ui.tab === 'tasks') body = tabTasks();
  else if (ui.tab === 'payout') body = tabPayout();
  else body = tabSettings();

  const stale = S.events.length > 5 && daysSince(S.lastBackup) > 30;
  return `
    <div class="topbar">
      <div class="topbar-left"><h1 class="title" style="font-size:19px">Foreldremodus</h1></div>
      <button class="btn" data-act="lock">🔓 Lås og gå ut</button>
    </div>
    <div class="tabs">
      ${tabs.map(t => `<button class="tab${ui.tab === t[0] ? ' active' : ''}" data-act="tab" data-t="${t[0]}">${t[1]}${t[0] === 'approve' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('')}
    </div>
    ${stale ? `<div class="banner"><span>Det er ${S.lastBackup ? daysSince(S.lastBackup) + ' dager' : 'lenge'} siden forrige sikkerhetskopi.</span><button class="btn btn-sm" data-act="backup">Last ned kopi</button></div>` : ''}
    ${body}`;
}

function tabApprove() {
  const list = pending().slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (!list.length) return `<div class="card"><div class="empty">Ingenting venter på godkjenning akkurat nå.</div></div>`;
  const rows = list.map(e => {
    const t = task(e.taskId), c = child(e.childId);
    if (!t || !c) return '';
    const variable = t.price === null;
    return `<div class="row${variable ? ' hl' : ''}" >
      <div class="row-left">
        <span class="task-emoji">${t.emoji}</span>
        <div>
          <div class="row-title">${esc(t.name)}</div>
          <div class="row-meta">${esc(c.name)} · ${dayName(e.date)} ${longDate(e.date)}${variable ? ' · sett beløp' : ''}</div>
        </div>
      </div>
      <div class="row-left" style="flex:none;gap:8px">
        ${variable
          ? `<input type="number" inputmode="numeric" value="${e.amount != null ? e.amount : ''}" data-amount="${e.id}" style="width:76px;text-align:right" aria-label="Beløp"> kr`
          : `<span>${kr(e.amount || 0)}</span>`}
        <button class="btn btn-sm" data-act="approve" data-ev="${e.id}">Godkjenn</button>
        <button class="btn btn-sm btn-icon" data-act="reject" data-ev="${e.id}" aria-label="Fjern">✕</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="card">
    <div class="section-title">Til godkjenning</div>
    ${rows}
    <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn-primary" data-act="approveall">Godkjenn alle</button></div>
  </div>`;
}

function tabTasks() {
  const cid = ui.tasksChildId || S.children[0] && S.children[0].id;
  const wk = iso(mondayOf(new Date()));
  const list = S.tasks.filter(t => !t.archived && (!t.kids || t.kids.indexOf(cid) >= 0));
  const rows = list.map(t => `
    <div class="row" data-taskid="${t.id}">
      <div class="row-left">
        <span class="grip" data-grip="${t.id}" aria-hidden="true">⠿</span>
        <span class="task-emoji">${t.emoji}</span>
        <span class="row-title">${esc(t.name)}</span>
        ${t.week ? `<span class="pill">bare uke ${weekNumber(parseIso(t.week))}</span>` : ''}
        ${!t.kids ? `<span class="pill">alle barna</span>` : ''}
      </div>
      <div class="row-left" style="flex:none;gap:8px">
        <input type="text" inputmode="numeric" value="${t.price === null ? '?' : t.price}" data-price="${t.id}" style="width:70px;text-align:right" aria-label="Pris"> kr
        <button class="btn btn-sm btn-icon" data-act="deltask" data-id="${t.id}" aria-label="Fjern oppgave">🗑</button>
      </div>
    </div>`).join('');

  return `<div class="card stack">
    <div>
      <div class="section-title">Oppgaver</div>
      <div class="tabs">${S.children.map(c => `<button class="tab${c.id === cid ? ' active' : ''}" data-act="taskchild" data-id="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}</div>
    </div>
    <div id="tasklist">${rows || '<div class="empty">Ingen oppgaver for dette barnet.</div>'}</div>
    <div class="adder">
      <div class="adder-row">
        <div class="emoji-pick">${EMOJIS.slice(0, 10).map(e => `<button class="emoji-btn${ui.newEmoji === e ? ' sel' : ''}" data-act="emoji" data-e="${e}">${e}</button>`).join('')}
        <button class="emoji-btn" data-act="moreemoji" aria-label="Flere ikoner">…</button></div>
      </div>
      <div class="adder-row" style="margin-top:10px">
        <input type="text" id="newname" placeholder="Ny oppgave" style="flex:1;min-width:150px">
        <input type="text" id="newprice" inputmode="numeric" placeholder="kr" style="width:78px;text-align:right">
        <button class="btn btn-primary" data-act="addtask" data-child="${cid}" data-week="${wk}">Legg til</button>
      </div>
      <div class="checks">
        <label><input type="checkbox" id="newweek"> Bare denne uken</label>
        <label><input type="checkbox" id="newall"> Gjelder alle barna</label>
      </div>
    </div>
  </div>`;
}

function tabPayout() {
  const cid = ui.payChildId || S.children[0] && S.children[0].id;
  const c = child(cid);
  if (!c) return `<div class="card"><div class="empty">Ingen barn lagt til ennå.</div></div>`;
  const dates = weekDates(0).map(iso);
  const year = new Date().getFullYear();
  const bal = balance(cid);
  const hist = S.payouts.filter(p => p.childId === cid).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  return `<div class="card stack">
    <div>
      <div class="section-title">Oppgjør</div>
      <div class="tabs">${S.children.map(k => `<button class="tab${k.id === cid ? ' active' : ''}" data-act="paychild" data-id="${k.id}">${k.emoji} ${esc(k.name)}</button>`).join('')}</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Ikke utbetalt</div><div class="stat-value">${kr(bal)}</div></div>
      <div class="stat"><div class="stat-label">Denne uken</div><div class="stat-value">${kr(earnedBetween(cid, dates[0], dates[6]))}</div></div>
      <div class="stat"><div class="stat-label">Totalt i ${year}</div><div class="stat-value">${kr(earnedBetween(cid, year + '-01-01', year + '-12-31'))}</div></div>
    </div>
    <div>
      ${hist.length ? hist.map(p => `<div class="row"><div>${longDate(p.date)} · ${esc(p.method)}</div><div>${kr(p.amount)}</div></div>`).join('')
        : '<div class="empty">Ingen utbetalinger registrert ennå.</div>'}
    </div>
    <div class="adder-row" style="justify-content:flex-end">
      <select id="paymethod" aria-label="Måte"><option>kontant</option><option>Vipps</option><option>sparekonto</option></select>
      <input type="number" inputmode="numeric" id="payamount" value="${bal}" style="width:96px;text-align:right" aria-label="Beløp">
      <button class="btn btn-primary" data-act="payout" data-child="${cid}">Betal ut</button>
    </div>
  </div>`;
}

function tabSettings() {
  return `<div class="card stack">
    <div>
      <div class="section-title">Barn</div>
      ${S.children.map(c => `<div class="row">
        <div class="row-left">
          <span class="task-emoji">${c.emoji}</span>
          <input type="text" value="${esc(c.name)}" data-cname="${c.id}" style="max-width:190px">
        </div>
        <div class="row-left" style="flex:none;gap:8px">
          <select data-ccolor="${c.id}" aria-label="Farge">${Object.keys(COLORS).map(k => `<option value="${k}"${c.color === k ? ' selected' : ''}>${k}</option>`).join('')}</select>
          <button class="btn btn-sm btn-icon" data-act="delchild" data-id="${c.id}" aria-label="Fjern barn">🗑</button>
        </div>
      </div>`).join('')}
      <div class="adder-row" style="margin-top:14px">
        <input type="text" id="childemoji" value="🐻" style="width:60px;text-align:center" aria-label="Ikon">
        <input type="text" id="childname" placeholder="Nytt barn" style="flex:1;min-width:140px">
        <button class="btn btn-primary" data-act="addchild">Legg til barn</button>
      </div>
    </div>
    <div>
      <div class="section-title">Sikkerhetskopi</div>
      <div class="hint">Alt ligger bare på denne iPaden. Last ned en kopi av og til og legg den i OneDrive — da overlever dataene om nettleseren blir tømt.${S.lastBackup ? ' Forrige kopi: ' + longDate(S.lastBackup) + '.' : ''}</div>
      <div class="adder-row" style="margin-top:12px">
        <button class="btn" data-act="backup">Last ned kopi</button>
        <button class="btn" data-act="restorepick">Gjenopprett fra fil</button>
        <input type="file" id="restorefile" accept="application/json" style="display:none">
      </div>
    </div>
    <div>
      <div class="section-title">PIN-kode</div>
      <div class="adder-row">
        <input type="text" inputmode="numeric" id="newpin" value="${esc(S.pin)}" style="width:100px;text-align:center" aria-label="Ny PIN">
        <button class="btn" data-act="savepin">Lagre PIN</button>
      </div>
    </div>
  </div>`;
}

/* ---------- handlinger ---------- */

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function onCell(taskId, date) {
  const t = task(taskId);
  const e = eventAt(ui.childId, taskId, date);
  if (!e) {
    S.events.push({ id: uid(), childId: ui.childId, taskId: taskId, date: date, status: 'pending', amount: t.price });
    ui.popCell = ui.childId + taskId + date;
  } else if (e.status === 'pending') {
    S.events = S.events.filter(x => x !== e);
  } else if (ui.parent) {
    S.events = S.events.filter(x => x !== e);
    toast('Godkjenningen er fjernet');
  } else {
    toast('Denne er godkjent — spør en voksen 🙂');
    return;
  }
  save();
  render();
}

function approve(evId, amount) {
  const e = S.events.find(x => x.id === evId);
  if (!e) return;
  const t = task(e.taskId);
  let amt = amount != null ? amount : e.amount;
  if (t && t.price === null && (amt == null || isNaN(amt))) {
    toast('Sett et beløp først');
    return false;
  }
  e.amount = Math.round(amt || 0);
  e.status = 'approved';
  e.approvedAt = iso(new Date());
  return true;
}

function download() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'poengtavle-' + iso(new Date()) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  S.lastBackup = iso(new Date());
  save();
  toast('Kopi lastet ned');
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'child') { ui.childId = el.dataset.id; ui.weekOffset = 0; ui.view = 'board'; }
  else if (act === 'home') { ui.view = 'home'; ui.parent = false; ui.pin = ''; }
  else if (act === 'week') {
    const d = +el.dataset.d;
    ui.weekOffset = d === 0 ? 0 : ui.weekOffset + d;
  }
  else if (act === 'cell') { onCell(el.dataset.task, el.dataset.date); return; }
  else if (act === 'parent') {
    if (ui.parent) { ui.view = 'parent'; ui.tab = el.dataset.goto || ui.tab; }
    else { ui.view = 'pin'; ui.pin = ''; ui.pendingTab = el.dataset.goto; }
  }
  else if (act === 'pinkey') {
    const k = el.dataset.k;
    if (k === 'x') ui.pin = ui.pin.slice(0, -1);
    else if (ui.pin.length < 4) ui.pin += k;
    if (ui.pin.length === 4) {
      if (ui.pin === S.pin) {
        ui.parent = true; ui.view = 'parent';
        if (ui.pendingTab) { ui.tab = ui.pendingTab; ui.pendingTab = null; }
        ui.pin = '';
      } else {
        ui.pin = ''; ui.pinBad = true;
        render();
        setTimeout(() => { ui.pinBad = false; }, 400);
        toast('Feil kode');
        return;
      }
    }
  }
  else if (act === 'lock') { ui.parent = false; ui.view = 'home'; }
  else if (act === 'tab') ui.tab = el.dataset.t;
  else if (act === 'taskchild') ui.tasksChildId = el.dataset.id;
  else if (act === 'paychild') ui.payChildId = el.dataset.id;
  else if (act === 'emoji') ui.newEmoji = el.dataset.e;
  else if (act === 'moreemoji') {
    const e = prompt('Lim inn et ikon (emoji):', ui.newEmoji);
    if (e) ui.newEmoji = e.trim().slice(0, 4);
  }
  else if (act === 'approve') {
    const inp = document.querySelector('[data-amount="' + el.dataset.ev + '"]');
    if (!approve(el.dataset.ev, inp ? parseInt(inp.value, 10) : null)) return;
    save();
  }
  else if (act === 'approveall') {
    let skipped = 0;
    pending().slice().forEach(e => {
      const t = task(e.taskId);
      if (t && t.price === null) {
        const inp = document.querySelector('[data-amount="' + e.id + '"]');
        const v = inp ? parseInt(inp.value, 10) : NaN;
        if (isNaN(v)) { skipped++; return; }
        approve(e.id, v);
      } else approve(e.id, null);
    });
    save();
    if (skipped) toast(skipped + ' mangler beløp');
  }
  else if (act === 'reject') {
    S.events = S.events.filter(x => x.id !== el.dataset.ev);
    save();
  }
  else if (act === 'deltask') {
    const t = task(el.dataset.id);
    if (!t) return;
    if (!confirm('Fjerne «' + t.name + '» fra tavla? Det som allerede er tjent blir stående.')) return;
    t.archived = true;
    save();
  }
  else if (act === 'addtask') {
    const name = (document.getElementById('newname').value || '').trim();
    if (!name) { toast('Skriv et navn'); return; }
    const raw = (document.getElementById('newprice').value || '').trim();
    const price = raw === '' || raw === '?' ? null : parseInt(raw, 10) || 0;
    const all = document.getElementById('newall').checked;
    const thisWeek = document.getElementById('newweek').checked;
    S.tasks.push({
      id: uid(), emoji: ui.newEmoji, name: name, price: price,
      kids: all ? null : [el.dataset.child], week: thisWeek ? el.dataset.week : null, archived: false
    });
    save();
    toast('Oppgave lagt til');
  }
  else if (act === 'payout') {
    const amt = parseInt(document.getElementById('payamount').value, 10);
    if (!amt || amt <= 0) { toast('Sett et beløp'); return; }
    S.payouts.push({ id: uid(), childId: el.dataset.child, date: iso(new Date()), amount: amt, method: document.getElementById('paymethod').value });
    save();
    toast('Utbetaling registrert');
  }
  else if (act === 'addchild') {
    const name = (document.getElementById('childname').value || '').trim();
    if (!name) { toast('Skriv et navn'); return; }
    const used = S.children.map(c => c.color);
    const color = Object.keys(COLORS).find(k => used.indexOf(k) < 0) || 'blue';
    S.children.push({ id: uid(), name: name, emoji: (document.getElementById('childemoji').value || '🐻').trim(), color: color });
    save();
  }
  else if (act === 'delchild') {
    const c = child(el.dataset.id);
    if (!c) return;
    if (!confirm('Fjerne ' + c.name + '? Historikk og utbetalinger blir også borte.')) return;
    S.children = S.children.filter(x => x.id !== c.id);
    S.events = S.events.filter(e => e.childId !== c.id);
    S.payouts = S.payouts.filter(p => p.childId !== c.id);
    save();
  }
  else if (act === 'savepin') {
    const v = (document.getElementById('newpin').value || '').trim();
    if (!/^\d{4}$/.test(v)) { toast('PIN må være fire siffer'); return; }
    S.pin = v; save(); toast('PIN lagret');
  }
  else if (act === 'backup') { download(); return; }
  else if (act === 'restorepick') { document.getElementById('restorefile').click(); return; }
  else return;

  render();
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.price) {
    const t = task(el.dataset.price);
    const raw = el.value.trim();
    t.price = raw === '' || raw === '?' ? null : parseInt(raw, 10) || 0;
    save(); render();
  } else if (el.dataset.cname) {
    child(el.dataset.cname).name = el.value.trim() || 'Barn';
    save();
  } else if (el.dataset.ccolor) {
    child(el.dataset.ccolor).color = el.value;
    save(); render();
  } else if (el.id === 'restorefile' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.children || !data.tasks) throw 0;
        if (!confirm('Erstatte alt som ligger i appen nå med innholdet i filen?')) return;
        S = data; save(); render(); toast('Gjenopprettet');
      } catch (e) { toast('Filen kunne ikke leses'); }
    };
    r.readAsText(el.files[0]);
  }
});

/* ---------- dra for å endre rekkefølge ---------- */

function bindDrag() {
  document.querySelectorAll('[data-grip]').forEach(g => g.addEventListener('pointerdown', startDrag));
}

function startDrag(ev) {
  const row = ev.target.closest('.row');
  const list = Array.from(document.querySelectorAll('#tasklist .row'));
  const from = list.indexOf(row);
  const h = row.offsetHeight;
  const y0 = ev.clientY;
  row.classList.add('dragging');
  ev.target.setPointerCapture(ev.pointerId);

  function move(e) { row.style.transform = 'translateY(' + (e.clientY - y0) + 'px)'; }
  function up(e) {
    ev.target.releasePointerCapture(ev.pointerId);
    ev.target.removeEventListener('pointermove', move);
    ev.target.removeEventListener('pointerup', up);
    row.style.transform = '';
    row.classList.remove('dragging');
    const steps = Math.round((e.clientY - y0) / h);
    if (!steps) return;
    const to = Math.max(0, Math.min(list.length - 1, from + steps));
    const ids = list.map(r => r.dataset.taskid);
    const moved = ids.splice(from, 1)[0];
    ids.splice(to, 0, moved);
    const set = new Set(ids);
    const rest = S.tasks.filter(t => !set.has(t.id));
    S.tasks = ids.map(id => task(id)).concat(rest);
    save(); render();
  }
  ev.target.addEventListener('pointermove', move);
  ev.target.addEventListener('pointerup', up);
}

/* ---------- start ---------- */

load();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
