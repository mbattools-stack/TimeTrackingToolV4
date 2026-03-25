/* ============================================
   TIMETRACK – APP v2 (localStorage only)
   ============================================ */

;(function(){
'use strict';

// ---- Storage Keys ----
const K = {
  USER:     'tt_user',
  PROJECTS: 'tt_projects',
  ENTRIES:  'tt_entries',
  TIMER:    'tt_active_timer',
};

// ---- Palette ----
const COLORS = [
  '#E8A020','#EF4444','#3B82F6','#10B981',
  '#8B5CF6','#EC4899','#06B6D4','#F97316',
];

// ---- Helpers ----
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const todayStr = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function load(key, fallback) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function fmtDur(ms) {
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function fmtHM(ms) {
  const min = Math.round(ms/60000);
  const h = Math.floor(min/60); const m = min%60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}
function fmtShortDate(dateStr) {
  const [,m,d] = dateStr.split('-');
  return `${d}.${m}.`;
}
function weekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const off = day === 0 ? -6 : 1 - day;
  return Array.from({length:7},(_,i)=>{
    const d = new Date(now);
    d.setDate(now.getDate() + off + i + offset * 7);
    return d.toISOString().slice(0,10);
  });
}
const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];

function toast(msg, err) {
  const c = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(()=>t.remove(), 2800);
}

// ---- State ----
let user        = load(K.USER, null);
let projects    = load(K.PROJECTS, []);
let entries     = load(K.ENTRIES, []);
let timer       = load(K.TIMER, null);
let tick        = null;
let weekOffset  = 0;
let editEntryId = null;
let editPid     = null;
let selColor    = COLORS[0];

// ---- Persist helpers ----
function saveProjects() { save(K.PROJECTS, projects); }
function saveEntries()  { save(K.ENTRIES, entries); }
function saveTimer()    { save(K.TIMER, timer); }
function saveUser()     { save(K.USER, user); }

// ============================================
// INIT
// ============================================
function init() {
  if (!user) {
    $('#welcome-screen').classList.remove('hidden');
    $('#app').classList.add('hidden');
  } else {
    showApp();
  }
  bindEvents();
}

function showApp() {
  $('#welcome-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#header-user').textContent = user.name;
  renderAll();
  startTick();
}

// ============================================
// WELCOME
// ============================================
function handleWelcome() {
  const name = $('#welcome-name').value.trim() || 'User';
  user = { name };
  saveUser();
  showApp();
}

// ============================================
// RENDER ALL
// ============================================
function renderAll() {
  renderChips();
  renderTimer();
  renderEntries();
  renderProjectList();
}

// ============================================
// CHIPS
// ============================================
function renderChips() {
  const c = $('#chips');
  const active = projects.filter(p => !p.archived);
  if (!active.length) {
    c.innerHTML = '<span class="chips-empty">Erstelle dein erstes Projekt im Tab „Projekte".</span>';
    return;
  }
  const todayEntries = entries.filter(e => e.date === todayStr());
  const byP = {};
  todayEntries.forEach(e => { byP[e.projectId] = (byP[e.projectId]||0) + e.duration; });

  c.innerHTML = active.map(p => {
    const running = timer && timer.projectId === p.id;
    const t = byP[p.id] || 0;
    return `<button class="chip${running?' running':''}" data-pid="${p.id}">
      <span class="dot" style="background:${p.color}"></span>
      ${esc(p.name)}
      ${t > 0 ? `<span class="chip-t">${fmtHM(t)}</span>` : ''}
    </button>`;
  }).join('');

  c.querySelectorAll('.chip').forEach(el => {
    el.addEventListener('click', () => toggleTimer(el.dataset.pid));
  });
}

// ============================================
// TIMER
// ============================================
function renderTimer() {
  const sec = $('#timer-section');
  const no = $('#no-timer');
  if (timer) {
    const p = projects.find(x => x.id === timer.projectId);
    if (!p) { stopTimerAction(); return; }
    sec.classList.remove('hidden');
    no.classList.add('hidden');
    $('#timer-dot').style.background = p.color;
    $('#timer-name').textContent = p.name;
    updateClock();
  } else {
    sec.classList.add('hidden');
    no.classList.remove('hidden');
    document.title = 'TimeTrack';
  }
}

function updateClock() {
  if (!timer) return;
  const elapsed = Date.now() - new Date(timer.startTime).getTime();
  const formatted = fmtDur(elapsed);
  $('#timer-clock').textContent = formatted;
  document.title = `⏱ ${formatted} – TimeTrack`;
}

function startTick() {
  stopTick();
  tick = setInterval(() => { if (timer) updateClock(); }, 1000);
}
function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

function toggleTimer(pid) {
  if (timer && timer.projectId === pid) {
    stopTimerAction();
  } else {
    if (timer) stopTimerAction();
    startTimerAction(pid);
  }
}

function startTimerAction(pid) {
  timer = { projectId: pid, startTime: new Date().toISOString() };
  saveTimer();
  renderTimer();
  renderChips();
  toast('Timer gestartet');
}

function stopTimerAction() {
  if (!timer) return;
  const start = new Date(timer.startTime);
  const end = new Date();
  const duration = end.getTime() - start.getTime();
  if (duration > 5000) {
    entries.push({
      id: uid(),
      projectId: timer.projectId,
      start: start.toISOString(),
      end: end.toISOString(),
      duration,
      date: start.toISOString().slice(0,10),
    });
    saveEntries();
  }
  timer = null;
  saveTimer();
  document.title = 'TimeTrack';
  renderAll();
  toast('Timer gestoppt');
}

// ============================================
// ENTRIES (today)
// ============================================
function renderEntries() {
  const list = $('#entries');
  const today = entries
    .filter(e => e.date === todayStr())
    .sort((a,b) => b.start.localeCompare(a.start));

  if (!today.length) {
    list.innerHTML = '<p class="empty">Noch keine Einträge heute.</p>';
    $('#day-total').textContent = '0:00';
    return;
  }

  let total = 0;
  list.innerHTML = today.map(e => {
    const p = projects.find(x => x.id === e.projectId);
    total += e.duration;
    return `<div class="entry">
      <span class="dot" style="background:${p?.color||'#666'}"></span>
      <span class="entry-name">${esc(p?.name||'–')}</span>
      <span class="entry-span">${fmtTime(e.start)} – ${fmtTime(e.end)}</span>
      <span class="entry-dur">${fmtHM(e.duration)}</span>
      <button class="entry-act" data-action="edit" data-eid="${e.id}" title="Bearbeiten">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="entry-act entry-del" data-action="del" data-eid="${e.id}" title="Löschen">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');

  $('#day-total').textContent = fmtHM(total);

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const eid = btn.dataset.eid;
      if (btn.dataset.action === 'edit') {
        openEditEntry(eid);
      } else {
        confirmAction('Eintrag löschen', 'Diesen Zeiteintrag wirklich löschen?', () => {
          entries = entries.filter(x => x.id !== eid);
          saveEntries();
          renderAll();
          toast('Eintrag gelöscht');
        }, 'Löschen', 'btn-danger');
      }
    });
  });
}

// ============================================
// WEEK VIEW
// ============================================
function renderWeek() {
  const dates = weekDates(weekOffset);
  const today = todayStr();
  const weekE = entries.filter(e => dates.includes(e.date));

  // Aggregate by day + by day+project
  const byDay = {};
  const byDayProject = {};
  dates.forEach(d => { byDay[d] = 0; byDayProject[d] = {}; });
  weekE.forEach(e => {
    if (byDay[e.date] !== undefined) {
      byDay[e.date] += e.duration;
      byDayProject[e.date][e.projectId] = (byDayProject[e.date][e.projectId]||0) + e.duration;
    }
  });
  const max = Math.max(...Object.values(byDay), 1);

  // Week label & nav state
  const isCurrentWeek = weekOffset === 0;
  $('#week-nav-label').textContent = isCurrentWeek
    ? 'Diese Woche'
    : `${fmtShortDate(dates[0])} – ${fmtShortDate(dates[6])}`;
  $('#btn-week-next').disabled = weekOffset >= 0;
  $('#btn-week-today').classList.toggle('hidden', isCurrentWeek);

  // Stacked bar chart
  $('#week-chart').innerHTML = dates.map((d, i) => {
    const ms = byDay[d];
    const isToday = d === today && isCurrentWeek;
    const totalPct = Math.max((ms / max) * 100, ms > 0 ? 4 : 2);
    const hasData = ms > 0;

    let segments = '';
    if (hasData) {
      const sorted = Object.entries(byDayProject[d]).sort((a,b) => b[1]-a[1]);
      segments = sorted.map(([pid, pms]) => {
        const p = projects.find(x => x.id === pid);
        const pct = (pms / ms) * 100;
        return `<div class="bar-seg" style="height:${pct}%;background:${p?.color||'#888'}"></div>`;
      }).join('');
    }

    return `<div class="bar-col">
      <div class="bar-box">
        <span class="bar-val">${ms > 0 ? fmtHM(ms) : ''}</span>
        <div class="bar${isToday ? ' is-today' : ''}${hasData ? ' has-data' : ''}" style="height:${totalPct}%">
          ${segments}
        </div>
      </div>
      <span class="bar-day${isToday ? ' is-today' : ''}">${DAYS[i]}</span>
    </div>`;
  }).join('');

  // Project breakdown with mini progress bars
  const byP = {};
  weekE.forEach(e => { byP[e.projectId] = (byP[e.projectId]||0) + e.duration; });
  const sorted = Object.entries(byP).sort((a,b) => b[1]-a[1]);
  const total = sorted.reduce((s,[,ms])=>s+ms, 0);

  $('#week-detail').innerHTML = `
    <h3>Gesamt: ${fmtHM(total)}</h3>
    ${sorted.length ? sorted.map(([pid,ms])=>{
      const p = projects.find(x=>x.id===pid);
      const pct = total > 0 ? Math.round((ms/total)*100) : 0;
      return `<div class="wd-row">
        <span class="dot" style="background:${p?.color||'#666'}"></span>
        <span class="wd-name">${esc(p?.name||'–')}</span>
        <div class="wd-bar-wrap">
          <div class="wd-bar" style="width:${pct}%;background:${p?.color||'#666'}"></div>
        </div>
        <span class="wd-time">${fmtHM(ms)}</span>
      </div>`;
    }).join('') : '<p class="empty">Keine Einträge diese Woche.</p>'}
  `;
}

// ============================================
// PROJECTS LIST
// ============================================
function projectTotalMs(pid) {
  return entries.filter(e => e.projectId === pid).reduce((s,e)=>s+e.duration, 0);
}

function renderProjectList() {
  const list = $('#project-list');
  if (!projects.length) {
    list.innerHTML = '<p class="empty">Noch keine Projekte.</p>';
    return;
  }

  // Active first, then archived
  const sorted = [...projects].sort((a,b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return 0;
  });

  list.innerHTML = sorted.map(p => {
    const total = projectTotalMs(p.id);
    return `<div class="pcard${p.archived?' archived':''}">
      <span class="pcard-dot" style="background:${p.color}"></span>
      <div class="pcard-info">
        <div class="pcard-name">${esc(p.name)}</div>
        <div class="pcard-meta">${p.archived?'Archiviert':'Aktiv'}${total>0?` · ${fmtHM(total)} gesamt`:''}</div>
      </div>
      <div class="pcard-acts">
        <button class="btn-icon" data-action="edit" data-pid="${p.id}" title="Bearbeiten">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" data-action="archive" data-pid="${p.id}" title="${p.archived?'Wiederherstellen':'Archivieren'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p.archived
            ?'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'
            :'<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'
          }</svg>
        </button>
        <button class="btn-icon" data-action="delete" data-pid="${p.id}" title="Löschen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.pid;
      const action = btn.dataset.action;
      if (action === 'edit') openEditProject(pid);
      else if (action === 'archive') archiveProject(pid);
      else if (action === 'delete') deleteProject(pid);
    });
  });
}

// ============================================
// PROJECT CRUD
// ============================================
function openNewProject() {
  editPid = null;
  selColor = COLORS[0];
  $('#mp-title').textContent = 'Neues Projekt';
  $('#mp-name').value = '';
  renderSwatches();
  openModal('modal-project');
  setTimeout(()=>$('#mp-name').focus(), 100);
}

function openEditProject(pid) {
  const p = projects.find(x=>x.id===pid);
  if (!p) return;
  editPid = pid;
  selColor = p.color;
  $('#mp-title').textContent = 'Projekt bearbeiten';
  $('#mp-name').value = p.name;
  renderSwatches();
  openModal('modal-project');
  setTimeout(()=>$('#mp-name').focus(), 100);
}

function renderSwatches() {
  $('#mp-colors').innerHTML = COLORS.map(c =>
    `<button class="sw${c===selColor?' on':''}" data-c="${c}" style="background:${c}"></button>`
  ).join('');
  $('#mp-colors').querySelectorAll('.sw').forEach(s => {
    s.addEventListener('click', () => {
      selColor = s.dataset.c;
      renderSwatches();
    });
  });
}

function saveProject() {
  const name = $('#mp-name').value.trim();
  if (!name) { toast('Bitte Name eingeben.',true); return; }
  if (editPid) {
    const p = projects.find(x=>x.id===editPid);
    if (p) { p.name = name; p.color = selColor; }
  } else {
    projects.push({ id:uid(), name, color:selColor, archived:false, created:Date.now() });
  }
  saveProjects();
  closeAllModals();
  renderAll();
  toast(editPid ? 'Projekt aktualisiert' : 'Projekt erstellt');
}

function archiveProject(pid) {
  const p = projects.find(x=>x.id===pid);
  if (!p) return;
  if (!p.archived && timer?.projectId === pid) stopTimerAction();
  p.archived = !p.archived;
  saveProjects();
  renderAll();
  toast(p.archived ? 'Archiviert' : 'Wiederhergestellt');
}

function deleteProject(pid) {
  const p = projects.find(x=>x.id===pid);
  if (!p) return;
  confirmAction(
    'Projekt löschen',
    `„${p.name}" wirklich löschen? Alle zugehörigen Einträge bleiben erhalten.`,
    () => {
      if (timer?.projectId === pid) stopTimerAction();
      projects = projects.filter(x=>x.id!==pid);
      saveProjects();
      renderAll();
      toast('Projekt gelöscht');
    }
  );
}

// ============================================
// MANUAL ENTRY + EDIT ENTRY (shared modal)
// ============================================
function openManual() {
  const active = projects.filter(p=>!p.archived);
  if (!active.length) { toast('Erstelle zuerst ein Projekt.',true); return; }
  editEntryId = null;
  const sel = $('#me-project');
  sel.innerHTML = active.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#me-date').value = todayStr();
  const now = new Date();
  const ago = new Date(now.getTime()-3600000);
  $('#me-start').value = pad2(ago.getHours())+':'+pad2(ago.getMinutes());
  $('#me-end').value = pad2(now.getHours())+':'+pad2(now.getMinutes());
  $('#me-modal-title').textContent = 'Manueller Eintrag';
  openModal('modal-manual');
}

function openEditEntry(eid) {
  const e = entries.find(x => x.id === eid);
  if (!e) return;
  editEntryId = eid;

  // Include archived project if it belongs to this entry
  const relevant = projects.filter(p => !p.archived || p.id === e.projectId);
  const sel = $('#me-project');
  sel.innerHTML = relevant.map(p=>
    `<option value="${p.id}"${p.id===e.projectId?' selected':''}>${esc(p.name)}</option>`
  ).join('');

  $('#me-date').value = e.date;
  const startD = new Date(e.start);
  const endD   = new Date(e.end);
  $('#me-start').value = pad2(startD.getHours())+':'+pad2(startD.getMinutes());
  $('#me-end').value   = pad2(endD.getHours())+':'+pad2(endD.getMinutes());
  $('#me-modal-title').textContent = 'Eintrag bearbeiten';
  openModal('modal-manual');
}

function saveManual() {
  const pid  = $('#me-project').value;
  const date = $('#me-date').value;
  const sStr = $('#me-start').value;
  const eStr = $('#me-end').value;
  if (!pid||!date||!sStr||!eStr) { toast('Bitte alles ausfüllen.',true); return; }
  const start = new Date(`${date}T${sStr}:00`);
  const end   = new Date(`${date}T${eStr}:00`);
  if (end <= start) { toast('Ende muss nach Start liegen.',true); return; }
  const duration = end.getTime() - start.getTime();

  if (editEntryId) {
    const idx = entries.findIndex(x => x.id === editEntryId);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], projectId:pid, start:start.toISOString(), end:end.toISOString(), duration, date };
    }
    toast('Eintrag aktualisiert');
  } else {
    entries.push({ id:uid(), projectId:pid, start:start.toISOString(), end:end.toISOString(), duration, date });
    toast('Eintrag gespeichert');
  }

  editEntryId = null;
  saveEntries();
  closeAllModals();
  renderAll();
}

// ============================================
// CSV EXPORT (current week view)
// ============================================
function exportCSV() {
  const dates = weekDates(weekOffset);
  const weekE = entries.filter(e=>dates.includes(e.date)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  if (!weekE.length) { toast('Keine Daten zum Exportieren.',true); return; }
  const rows = [['Datum','Projekt','Start','Ende','Dauer (Min)']];
  weekE.forEach(e => {
    const p = projects.find(x=>x.id===e.projectId);
    rows.push([e.date, p?.name||'–', fmtTime(e.start), fmtTime(e.end), Math.round(e.duration/60000)]);
  });
  const csv = rows.map(r=>r.map(v=>`"${v}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `timetrack_${dates[0]}_${dates[6]}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportiert');
}

// ============================================
// JSON BACKUP / RESTORE
// ============================================
function exportJSON() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    user,
    projects,
    entries,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timetrack_backup_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportiert');
}

function triggerImport() {
  $('#import-file').click();
}

function handleImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!Array.isArray(data.projects) || !Array.isArray(data.entries)) throw new Error();
      confirmAction(
        'Daten importieren',
        `${data.projects.length} Projekte und ${data.entries.length} Einträge werden importiert. Vorhandene Daten werden überschrieben.`,
        () => {
          projects = data.projects;
          entries  = data.entries;
          if (data.user) { user = data.user; saveUser(); $('#header-user').textContent = user.name; }
          saveProjects();
          saveEntries();
          renderAll();
          closeAllModals();
          toast('Daten importiert');
        },
        'Importieren',
        'btn-accent'
      );
    } catch {
      toast('Ungültige Backup-Datei.', true);
    }
  };
  reader.readAsText(file);
  $('#import-file').value = '';
}

// ============================================
// SETTINGS
// ============================================
function openSettings() {
  $('#ms-name').value = user?.name || '';
  openModal('modal-settings');
}

function saveSettings() {
  const name = $('#ms-name').value.trim() || 'User';
  user = { name };
  saveUser();
  $('#header-user').textContent = name;
  closeAllModals();
  toast('Gespeichert');
}

function resetAll() {
  confirmAction(
    'Alles zurücksetzen',
    'Alle Projekte, Einträge und Einstellungen werden unwiderruflich gelöscht.',
    () => {
      localStorage.removeItem(K.USER);
      localStorage.removeItem(K.PROJECTS);
      localStorage.removeItem(K.ENTRIES);
      localStorage.removeItem(K.TIMER);
      location.reload();
    }
  );
}

// ============================================
// MODALS
// ============================================
let confirmCb = null;

function openModal(id) { $('#'+id).classList.remove('hidden'); }
function closeAllModals() {
  $$('.modal').forEach(m=>m.classList.add('hidden'));
  confirmCb = null;
  editEntryId = null;
}

function confirmAction(title, msg, cb, okLabel = 'Löschen', okClass = 'btn-danger') {
  $('#mc-title').textContent = title;
  $('#mc-msg').textContent = msg;
  $('#mc-ok').textContent = okLabel;
  $('#mc-ok').className = `btn ${okClass}`;
  confirmCb = cb;
  openModal('modal-confirm');
}

// ============================================
// ESCAPE HTML
// ============================================
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function pad2(n) { return String(n).padStart(2,'0'); }

// ============================================
// EVENTS
// ============================================
function bindEvents() {
  // Welcome
  $('#btn-welcome-start').addEventListener('click', handleWelcome);
  $('#welcome-name').addEventListener('keydown', e => { if (e.key==='Enter') handleWelcome(); });

  // Tabs
  $$('.tab').forEach(t => {
    t.addEventListener('click', () => {
      $$('.tab').forEach(x=>x.classList.remove('active'));
      $$('.tab-panel').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      const target = t.dataset.tab;
      $(`#tab-${target}`).classList.add('active');
      if (target === 'week') renderWeek();
    });
  });

  // Timer stop
  $('#btn-stop').addEventListener('click', stopTimerAction);

  // Projects
  $('#btn-new-project').addEventListener('click', openNewProject);
  $('#mp-save').addEventListener('click', saveProject);
  $('#mp-name').addEventListener('keydown', e => { if(e.key==='Enter') saveProject(); });

  // Manual / edit entry
  $('#btn-manual').addEventListener('click', openManual);
  $('#me-save').addEventListener('click', saveManual);

  // CSV (uses current weekOffset)
  $('#btn-csv').addEventListener('click', exportCSV);

  // Week navigation
  $('#btn-week-prev').addEventListener('click', () => { weekOffset--; renderWeek(); });
  $('#btn-week-next').addEventListener('click', () => { if (weekOffset < 0) { weekOffset++; renderWeek(); } });
  $('#btn-week-today').addEventListener('click', () => { weekOffset = 0; renderWeek(); });

  // Settings
  $('#btn-settings').addEventListener('click', openSettings);
  $('#ms-save').addEventListener('click', saveSettings);
  $('#btn-reset').addEventListener('click', resetAll);
  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-import-json').addEventListener('click', triggerImport);
  $('#import-file').addEventListener('change', e => handleImport(e.target.files[0]));

  // Confirm modal
  $('#mc-ok').addEventListener('click', () => {
    const cb = confirmCb;
    closeAllModals();
    if (cb) cb();
  });

  // Modal cancel / backdrop
  $$('.modal-cancel').forEach(b => b.addEventListener('click', closeAllModals));
  $$('.modal-bg').forEach(bg => bg.addEventListener('click', closeAllModals));

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAllModals(); return; }
    // Space = stop running timer (when no input is focused)
    if (e.key === ' ' && timer && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      stopTimerAction();
    }
  });

  // Re-render timer on tab visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timer) { updateClock(); renderChips(); }
  });
}

// ---- Go ----
init();

})();
