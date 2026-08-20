import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../lib/constants.js';
import { getAllSessions, getDomainMeta, getHistoryClues, putHistoryClues, replaceAllData, clearAllData } from '../lib/db.js';
import { summarizeSessions, buildStory } from '../lib/analytics.js';
import { formatDuration, formatClock, periodBounds, startOfDay, escapeHtml, safeDomain, localDayKey } from '../lib/utils.js';

const app = document.querySelector('#app');
const storyRoot = document.querySelector('#story-root');
const importFile = document.querySelector('#import-file');
let settings = await loadSettings();
let allSessions = await getAllSessions();
let domainMeta = await getDomainMeta();
let storyState = null;

function routeName() {
  return (location.hash.replace('#', '').split('?')[0] || 'overview');
}

async function loadSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.settings] || {}) };
}

async function saveSettings(next) {
  settings = { ...DEFAULT_SETTINGS, ...next };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  await chrome.runtime.sendMessage({ type: 'settings:changed' });
  updateTrackingPill();
}

function updateTrackingPill() {
  const pill = document.querySelector('#tracking-pill');
  if (!pill) return;
  pill.textContent = settings.trackingEnabled ? 'Tracking on' : 'Tracking off';
  pill.classList.toggle('on', settings.trackingEnabled);
}

function activateNav() {
  const route = routeName();
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
}

async function refreshData() {
  allSessions = await getAllSessions();
  const pendingResult = await chrome.storage.local.get(STORAGE_KEYS.pendingSession);
  const pending = pendingResult[STORAGE_KEYS.pendingSession];
  if (pending?.domain && settings.trackingEnabled) {
    const now = Date.now();
    allSessions.push({ ...pending, endTime: now, durationMs: Math.max(0, now - pending.startTime), dateKey: localDayKey(pending.startTime) });
  }
  domainMeta = await getDomainMeta();
}

function summaryFor(period) {
  const bounds = periodBounds(period);
  return { bounds, summary: summarizeSessions(allSessions.filter((s) => s.startTime >= bounds.start && s.startTime < bounds.end), domainMeta, bounds.start) };
}

function emptyState() {
  return `<div class="empty"><h2>Your recap starts with real browsing.</h2><p>Browser Recap never invents activity. ${settings.trackingEnabled ? 'Keep browsing normally and your first cards will appear here.' : 'Turn tracking on to start building your archive.'}</p>${settings.trackingEnabled ? '' : '<button class="primary" id="empty-start">Start tracking</button>'}</div>`;
}

function header(eyebrow, title, subhead = '') {
  return `<div class="page-head"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1 class="display">${escapeHtml(title)}</h1></div>${subhead ? `<p class="subhead">${escapeHtml(subhead)}</p>` : ''}</div>`;
}

function domainRows(summary, limit = 6) {
  const max = summary.topDomains[0]?.durationMs || 1;
  return summary.topDomains.slice(0, limit).map((d, i) => `<div class="domain-row"><div class="rank">${i + 1}</div><div><div class="domain-name">${escapeHtml(d.domain)}</div><div class="bar"><i style="width:${Math.max(4, d.durationMs / max * 100)}%"></i></div></div><div class="domain-time">${formatDuration(d.durationMs, true)}</div></div>`).join('');
}

function categoryCards(summary) {
  const palette = ['var(--cobalt)', 'var(--pink)', 'var(--acid)'];
  return summary.categories.slice(0, 3).map((c, i) => `<div class="card" style="background:${palette[i]};${i === 0 ? 'color:white' : ''}"><div class="stat-label">#${i + 1} category</div><div class="stat-value" style="font-size:30px">${escapeHtml(c.category)}</div><div>${formatDuration(c.durationMs, true)}</div></div>`).join('');
}

async function renderOverview() {
  const { summary } = summaryFor('today');
  app.innerHTML = `${header('Your browser, remembered', 'Browser Recap', 'A visual history of where your attention went. Active-tab time only, kept locally on this device.')}
    <div class="period-tabs"><button class="period-tab active" data-overview-period="today">Today</button><button class="period-tab" data-overview-period="week">Week</button><button class="period-tab" data-overview-period="month">Month</button><button class="period-tab" data-overview-period="year">Year</button><button class="period-tab" data-overview-period="all">All Time</button></div>
    <div id="overview-content">${overviewContent(summary, 'today')}</div>`;
  document.querySelectorAll('[data-overview-period]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-overview-period]').forEach((x) => x.classList.toggle('active', x === b));
    const period = b.dataset.overviewPeriod;
    document.querySelector('#overview-content').innerHTML = overviewContent(summaryFor(period).summary, period);
    bindOverviewActions(period);
  }));
  bindOverviewActions('today');
}

function overviewContent(summary, period) {
  if (!summary.totalMs) return emptyState();
  const top = summary.topDomains[0];
  return `<div class="hero-grid"><section class="hero-card"><div class="stat-label">Active browsing · ${escapeHtml(periodLabel(period))}</div><div class="huge">${formatDuration(summary.totalMs, true)}</div><div><h3>${escapeHtml(top?.domain || 'Your web')}</h3><div>Your #1 site · ${formatDuration(top?.durationMs || 0, true)}</div></div></section><div class="hero-side"><section class="card stat-card"><div class="stat-label">Sites visited</div><div class="stat-value">${summary.uniqueDomains}</div><div>${summary.sessions} focused sessions</div></section><section class="card stat-card"><div class="stat-label">Longest streak</div><div class="stat-value">${summary.longestStreak}d</div><div>${summary.newDomains} new site${summary.newDomains === 1 ? '' : 's'} this period</div></section></div></div>
  <section class="section"><div class="section-title"><h2>Your top sites</h2><button class="secondary" data-open-story="${period}">Play recap</button></div><div class="card domain-list">${domainRows(summary)}</div></section>
  <section class="section"><div class="section-title"><h2>Your internet had a mood</h2></div><div class="grid-3">${categoryCards(summary)}</div></section>
  <section class="section"><div class="grid-2"><div class="card"><div class="stat-label">Peak hour</div><div class="stat-value">${hourLabel(summary.peakHour.hour)}</div><p>${formatDuration(summary.peakHour.durationMs, true)} tracked during this hour across the period.</p></div><div class="card"><div class="stat-label">Deepest dive</div><div class="stat-value" style="font-size:28px">${escapeHtml(summary.longestSession?.domain || '—')}</div><p>${formatDuration(summary.longestSession?.durationMs || 0, true)} uninterrupted.</p></div></div></section>`;
}

function bindOverviewActions(period) {
  document.querySelector('[data-open-story]')?.addEventListener('click', () => openStory(period));
  document.querySelector('#empty-start')?.addEventListener('click', async () => {
    if (!settings.consentedAt) { location.href = chrome.runtime.getURL('onboarding/index.html'); return; }
    await chrome.runtime.sendMessage({ type: 'tracking:set', enabled: true });
    settings = await loadSettings();
    await renderOverview(); updateTrackingPill();
  });
}

function periodLabel(period) {
  return ({ today:'Today', week:'This week', month:'This month', year:`${new Date().getFullYear()}`, all:'All time' })[period] || period;
}
function hourLabel(hour) { const suffix = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12} ${suffix}`; }

async function renderRecaps() {
  const periods = ['today','week','month','year','all'];
  const cards = periods.map((p) => {
    const { summary } = summaryFor(p);
    return `<article class="recap-tile" data-recap="${p}"><div class="recap-meta">${periodLabel(p)} recap</div><h3>${summary.totalMs ? formatDuration(summary.totalMs, true) : 'Waiting for data'}</h3><div>${summary.totalMs ? `${summary.uniqueDomains} sites · ${summary.sessions} sessions` : 'No fake stats. Your archive begins when you browse.'}</div></article>`;
  }).join('');
  app.innerHTML = `${header('Story mode', 'Recaps', 'Turn your browsing into bold, full-screen stories for today, this week, this month, this year, or everything you have tracked.')}<div class="recap-grid">${cards}</div>`;
  document.querySelectorAll('[data-recap]').forEach((card) => card.addEventListener('click', () => openStory(card.dataset.recap)));
}

async function renderReplay() {
  const today = new Date();
  const inputValue = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  app.innerHTML = `${header('Follow the day', 'Day Replay', 'A chronological timeline of the sites that actually held your active tab. Page titles are only shown if you enable them in Settings.')}
  <div class="section-title"><h2>Select a day</h2><input id="replay-date" type="date" value="${inputValue}" style="border:1px solid var(--ink);border-radius:9px;padding:9px 12px;background:white"></div><div id="replay-body"></div>`;
  const input = document.querySelector('#replay-date');
  input.addEventListener('change', () => renderReplayDay(input.value));
  renderReplayDay(input.value);
}

function renderReplayDay(dayKey) {
  const sessions = allSessions.filter((s) => s.dateKey === dayKey).sort((a,b) => a.startTime-b.startTime);
  const body = document.querySelector('#replay-body');
  if (!sessions.length) { body.innerHTML = `<div class="empty"><h2>No tracked sessions.</h2><p>There is no recorded active browsing for ${escapeHtml(dayKey)}.</p></div>`; return; }
  body.innerHTML = `<div class="timeline">${sessions.map((s) => `<div class="timeline-item"><div class="timeline-time">${formatClock(s.startTime)} → ${formatClock(s.endTime)} · ${formatDuration(s.durationMs,true)}</div><div class="timeline-domain">${escapeHtml(s.domain)}</div>${s.title ? `<div class="timeline-title">${escapeHtml(s.title)}</div>` : ''}<div class="timeline-title">${escapeHtml(s.category || 'Other')}</div></div>`).join('')}</div>`;
}

async function renderArchive() {
  const byMonth = new Map();
  for (const s of allSessions) {
    const d = new Date(s.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    byMonth.set(key, (byMonth.get(key)||0) + s.durationMs);
  }
  const cards = [...byMonth.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([month,ms]) => `<div class="card"><div class="stat-label">${escapeHtml(month)}</div><div class="stat-value">${formatDuration(ms,true)}</div></div>`).join('');
  const clues = await getHistoryClues();
  app.innerHTML = `${header('Long-term memory', 'Archive', 'Tracked time is exact to Browser Recap sessions. Imported pre-install history is kept separate as visit clues and never converted into made-up duration.')}
  ${cards ? `<div class="grid-3">${cards}</div>` : emptyState()}
  <section class="section"><div class="section-title"><h2>Historical recovery</h2></div>${clues.length ? `<div class="card"><p><strong>${clues.reduce((n,c)=>n+(c.visitCount||0),0).toLocaleString()}</strong> browser-history visits recovered across <strong>${clues.length}</strong> domains. These are clues only, not active-time estimates.</p><div class="domain-list">${clues.sort((a,b)=>b.visitCount-a.visitCount).slice(0,8).map((c,i)=>`<div class="domain-row"><div class="rank">${i+1}</div><div class="domain-name">${escapeHtml(c.domain)}</div><div class="domain-time">${c.visitCount} visits</div></div>`).join('')}</div></div>` : `<div class="empty"><h2>No history imported.</h2><p>You can optionally recover domain visit counts from Chrome history in Settings. The permission is removed again immediately after import.</p></div>`}</section>`;
}

async function renderSettings() {
  const exclusions = settings.excludedDomains.map((d) => `<span class="domain-tag">${escapeHtml(d)} <button data-remove-domain="${escapeHtml(d)}" aria-label="Remove ${escapeHtml(d)}" style="border:0;background:none;cursor:pointer">×</button></span>`).join('');
  app.innerHTML = `${header('You stay in control', 'Settings', 'Browser Recap is local-first. Tracking can be paused instantly, titles are off by default, and you can export or erase everything.')}
  <div class="settings-grid">
    <section class="setting-card"><div class="setting-row"><div class="setting-copy"><h3>Track active browsing</h3><p>Counts time only while Chrome is focused and your computer is active.</p></div><input class="toggle" id="tracking-toggle" type="checkbox" ${settings.trackingEnabled?'checked':''}></div><div class="setting-row"><div class="setting-copy"><h3>Store page titles</h3><p>Off by default. When enabled, page titles are saved locally for richer Day Replay context. Full URLs are never stored.</p></div><input class="toggle" id="titles-toggle" type="checkbox" ${settings.storePageTitles?'checked':''}></div><div class="setting-row"><div class="setting-copy"><h3>Idle threshold</h3><p>Stop counting after this much inactivity.</p></div><select id="idle-select"><option value="30" ${settings.idleThresholdSeconds===30?'selected':''}>30 sec</option><option value="60" ${settings.idleThresholdSeconds===60?'selected':''}>1 min</option><option value="120" ${settings.idleThresholdSeconds===120?'selected':''}>2 min</option><option value="300" ${settings.idleThresholdSeconds===300?'selected':''}>5 min</option></select></div></section>
    <section class="setting-card"><div class="setting-copy"><h3>Excluded domains</h3><p>Never count time on these sites. Browser Recap stores only domains for tracked sessions, not full URLs.</p></div><div class="inline-form"><input id="exclude-input" placeholder="example.com"><button class="secondary" id="exclude-add">Exclude</button></div><div class="domain-tags">${exclusions || '<span class="privacy-note">No excluded domains.</span>'}</div></section>
    <section class="setting-card"><div class="setting-row"><div class="setting-copy"><h3>Import Chrome history clues</h3><p>Optional. Temporarily asks for Chrome History access, aggregates domain visit counts locally, then removes the permission. It never invents time spent.</p></div><button class="secondary" id="history-import">Import history</button></div></section>
    <section class="setting-card"><div class="setting-row"><div class="setting-copy"><h3>Backup</h3><p>Export your local Browser Recap archive or restore it on another Chrome profile.</p></div><div><button class="secondary" id="export-btn">Export</button> <button class="secondary" id="import-btn">Import</button></div></div></section>
    <section class="setting-card"><div class="setting-row"><div class="setting-copy"><h3>Erase Browser Recap data</h3><p>Permanently deletes tracked sessions, domain metadata, historical clues, and resets tracking.</p></div><button class="danger" id="clear-btn">Erase everything</button></div></section>
  </div>`;
  bindSettings();
}

function bindSettings() {
  document.querySelector('#tracking-toggle').addEventListener('change', async (e) => {
    if (e.target.checked && !settings.consentedAt) { e.target.checked = false; location.href = chrome.runtime.getURL('onboarding/index.html'); return; }
    await chrome.runtime.sendMessage({ type:'tracking:set', enabled:e.target.checked });
    settings = await loadSettings(); updateTrackingPill(); toast(e.target.checked?'Tracking started':'Tracking paused');
  });
  document.querySelector('#titles-toggle').addEventListener('change', async (e) => { await saveSettings({ ...settings, storePageTitles:e.target.checked }); toast('Title setting saved'); });
  document.querySelector('#idle-select').addEventListener('change', async (e) => { await saveSettings({ ...settings, idleThresholdSeconds:Number(e.target.value) }); toast('Idle threshold saved'); });
  document.querySelector('#exclude-add').addEventListener('click', async () => {
    const raw = document.querySelector('#exclude-input').value.trim();
    const domain = safeDomain(raw.includes('://') ? raw : `https://${raw}`);
    if (!domain) return toast('Enter a valid domain');
    await saveSettings({ ...settings, excludedDomains:[...new Set([...settings.excludedDomains, domain])] });
    await renderSettings();
  });
  document.querySelectorAll('[data-remove-domain]').forEach((b)=>b.addEventListener('click',async()=>{ await saveSettings({ ...settings, excludedDomains:settings.excludedDomains.filter(d=>d!==b.dataset.removeDomain) }); await renderSettings(); }));
  document.querySelector('#history-import').addEventListener('click', importHistoryClues);
  document.querySelector('#export-btn').addEventListener('click', exportArchive);
  document.querySelector('#import-btn').addEventListener('click', () => importFile.click());
  document.querySelector('#clear-btn').addEventListener('click', async () => {
    if (!confirm('Erase all Browser Recap data on this device? This cannot be undone.')) return;
    await chrome.runtime.sendMessage({ type:'tracking:set', enabled:false });
    await clearAllData();
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: { ...DEFAULT_SETTINGS, firstRunComplete:true } });
    settings = await loadSettings(); await refreshData(); updateTrackingPill(); await renderSettings(); toast('Browser Recap data erased');
  });
}

async function importHistoryClues() {
  const granted = await chrome.permissions.request({ permissions:['history'] });
  if (!granted) return toast('History permission was not granted');
  try {
    const startTime = Date.now() - 365 * 86400000;
    const items = await chrome.history.search({ text:'', startTime, maxResults:10000 });
    const map = new Map();
    for (const item of items) {
      const domain = safeDomain(item.url);
      if (!domain) continue;
      const current = map.get(domain) || { domain, visitCount:0, lastVisitTime:0 };
      current.visitCount += item.visitCount || 1;
      current.lastVisitTime = Math.max(current.lastVisitTime, item.lastVisitTime || 0);
      map.set(domain, current);
    }
    await putHistoryClues([...map.values()]);
    toast(`Recovered ${map.size} domains as visit clues`);
  } finally {
    await chrome.permissions.remove({ permissions:['history'] });
  }
}

async function exportArchive() {
  const payload = { format:'browser-recap', version:1, exportedAt:Date.now(), settings, sessions:await getAllSessions(), domainMeta:await getDomainMeta(), historyClues:await getHistoryClues() };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`browser-recap-${new Date().toISOString().slice(0,10)}.browserrecap`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]; if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.format !== 'browser-recap' || payload.version !== 1) throw new Error('Unsupported backup');
    await chrome.runtime.sendMessage({ type:'tracking:set', enabled:false });
    await replaceAllData(payload);
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: { ...DEFAULT_SETTINGS, ...(payload.settings || {}), trackingEnabled:false } });
    settings=await loadSettings(); await refreshData(); updateTrackingPill(); toast('Archive imported. Tracking remains paused.'); renderRoute();
  } catch (e) { toast(`Import failed: ${e.message}`); }
  importFile.value='';
});

function openStory(period) {
  const { summary, bounds } = summaryFor(period);
  const slides = buildStory(summary, bounds.label);
  if (!slides.length) return toast('Browse a little first — Browser Recap never invents stats.');
  storyState = { slides, index:0, label:bounds.label };
  renderStory();
}

function renderStory() {
  const { slides, index } = storyState;
  const slide = slides[index];
  storyRoot.hidden=false;
  storyRoot.innerHTML = `<section class="story ${slide.theme}"><span class="orb a"></span><span class="orb b"></span><span class="orb c"></span><div class="story-progress">${slides.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div><div class="story-top"><div class="story-eyebrow">${escapeHtml(slide.eyebrow)}</div><div><button class="story-download">Save card</button> <button class="story-close">Close</button></div></div><div class="story-content">${slide.metricMs!==undefined?`<div class="story-metric">${formatDuration(slide.metricMs,true)}</div>`:`<div class="story-title">${escapeHtml(slide.title)}</div>`}${slide.metricMs!==undefined&&slide.title?`<div class="story-title" style="font-size:clamp(38px,5vw,76px);letter-spacing:-3px">${escapeHtml(slide.title)}</div>`:''}<div class="story-body">${escapeHtml(slide.body||'')}</div></div><div class="story-controls"><div class="story-index">${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}</div><div class="story-nav"><button id="story-prev" ${index===0?'disabled':''}>←</button><button id="story-next">${index===slides.length-1?'✓':'→'}</button></div></div></section>`;
  storyRoot.querySelector('.story-close').onclick=closeStory;
  storyRoot.querySelector('#story-prev').onclick=()=>{ if(storyState.index>0){storyState.index--;renderStory();} };
  storyRoot.querySelector('#story-next').onclick=()=>{ if(storyState.index<slides.length-1){storyState.index++;renderStory();} else closeStory(); };
  storyRoot.querySelector('.story-download').onclick=()=>saveStoryCard(slide, storyState.label);
}
function closeStory(){storyRoot.hidden=true;storyRoot.innerHTML='';storyState=null;}

function saveStoryCard(slide,label){
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;const c=canvas.getContext('2d');
  const colors={yellow:'#ffd43b',red:'#ff6038',lilac:'#aa9dff',acid:'#c9f227',pink:'#ff9fc9',cobalt:'#4256f4',ink:'#151515',paper:'#f6f6f1'};
  c.fillStyle=colors[slide.theme]||colors.paper;c.fillRect(0,0,1200,1200);c.fillStyle=['cobalt','ink'].includes(slide.theme)?'#fff':'#151515';
  c.font='900 28px Arial';c.fillText(slide.eyebrow,70,90);c.font='900 118px Arial';
  const main=slide.metricMs!==undefined?formatDuration(slide.metricMs,true):slide.title;wrapCanvas(c,main,70,330,1060,126);
  c.font='700 32px Arial';wrapCanvas(c,slide.body||'',70,890,900,44);c.font='900 24px Arial';c.fillText(`BROWSER RECAP · ${label.toUpperCase()}`,70,1125);
  canvas.toBlob((blob)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`browser-recap-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);},'image/png');
}
function wrapCanvas(c,text,x,y,maxWidth,lineHeight){const words=String(text).split(/\s+/);let line='';let yy=y;for(const word of words){const test=line?`${line} ${word}`:word;if(c.measureText(test).width>maxWidth&&line){c.fillText(line,x,yy);line=word;yy+=lineHeight;}else line=test;}if(line)c.fillText(line,x,yy);}

function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600);}

async function renderRoute(){activateNav();updateTrackingPill();await refreshData();const route=routeName();if(route==='recaps')await renderRecaps();else if(route==='replay')await renderReplay();else if(route==='archive')await renderArchive();else if(route==='settings')await renderSettings();else await renderOverview();}
window.addEventListener('hashchange',renderRoute);
await renderRoute();
