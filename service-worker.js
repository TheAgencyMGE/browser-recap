import { DEFAULT_SETTINGS, STORAGE_KEYS } from './lib/constants.js';
import { categorizeDomain } from './lib/categories.js';
import { saveSession } from './lib/db.js';
import { localDayKey, safeDomain, sanitizeTitle } from './lib/utils.js';

let queue = Promise.resolve();
const enqueue = (fn) => {
  queue = queue.then(fn).catch((error) => console.error('[Browser Recap]', error));
};

async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.settings] || {}) };
}

async function setSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: { ...DEFAULT_SETTINGS, ...settings } });
}

async function getPending() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.pendingSession);
  return result[STORAGE_KEYS.pendingSession] || null;
}

async function setPending(pending) {
  if (pending) await chrome.storage.local.set({ [STORAGE_KEYS.pendingSession]: pending });
  else await chrome.storage.local.remove(STORAGE_KEYS.pendingSession);
}

async function endPending(endTime = Date.now()) {
  const pending = await getPending();
  if (!pending) return;
  const safeEnd = Math.max(pending.startTime, Math.min(endTime, Date.now()));
  const durationMs = safeEnd - pending.startTime;
  await setPending(null);
  await saveSession({
    startTime: pending.startTime,
    endTime: safeEnd,
    durationMs,
    domain: pending.domain,
    category: pending.category,
    title: pending.title || null,
    dateKey: localDayKey(pending.startTime)
  });
}

async function browserIsActive(settings) {
  const idleState = await chrome.idle.queryState(settings.idleThresholdSeconds);
  if (idleState !== 'active') return false;
  const win = await chrome.windows.getLastFocused({ populate: false });
  return Boolean(win && win.id !== chrome.windows.WINDOW_ID_NONE && win.focused);
}

async function startFromTab(tab) {
  const settings = await getSettings();
  if (!settings.trackingEnabled || !settings.consentedAt) return;
  if (!(await browserIsActive(settings))) return;
  const domain = safeDomain(tab?.url);
  if (!domain || settings.excludedDomains.includes(domain)) return;

  const pending = await getPending();
  if (pending?.domain === domain) {
    const nextTitle = settings.storePageTitles ? sanitizeTitle(tab.title) : null;
    if (nextTitle !== pending.title) {
      pending.title = nextTitle;
      pending.lastCheckpoint = Date.now();
      await setPending(pending);
    }
    return;
  }

  if (pending) await endPending(Date.now());
  const now = Date.now();
  await setPending({
    startTime: now,
    lastCheckpoint: now,
    domain,
    category: categorizeDomain(domain),
    title: settings.storePageTitles ? sanitizeTitle(tab.title) : null,
    tabId: tab.id ?? null
  });
}

async function startFromCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await startFromTab(tabs[0]);
}

async function checkpoint() {
  const settings = await getSettings();
  if (!settings.trackingEnabled || !settings.consentedAt || !(await browserIsActive(settings))) {
    await endPending(Date.now());
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  const domain = safeDomain(tab?.url);
  const pending = await getPending();
  if (!domain || settings.excludedDomains.includes(domain)) {
    if (pending) await endPending(Date.now());
    return;
  }
  if (!pending || pending.domain !== domain) {
    if (pending) await endPending(Date.now());
    await startFromTab(tab);
    return;
  }
  pending.lastCheckpoint = Date.now();
  if (settings.storePageTitles) pending.title = sanitizeTitle(tab.title);
  await setPending(pending);
}

async function recoverStalePending() {
  const pending = await getPending();
  if (!pending) return;
  // A browser crash or shutdown may prevent a clean end event. Never assume time
  // after the most recent one-minute checkpoint was active browsing.
  await endPending(pending.lastCheckpoint || pending.startTime);
}

chrome.runtime.onInstalled.addListener((details) => {
  enqueue(async () => {
    const existing = await chrome.storage.local.get([STORAGE_KEYS.settings, STORAGE_KEYS.installDate]);
    if (!existing[STORAGE_KEYS.settings]) await setSettings(DEFAULT_SETTINGS);
    if (!existing[STORAGE_KEYS.installDate]) {
      await chrome.storage.local.set({ [STORAGE_KEYS.installDate]: Date.now() });
    }
    await chrome.alarms.create('browser-recap-checkpoint', { periodInMinutes: 1 });
    if (details.reason === 'install') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/index.html') });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  enqueue(async () => {
    await recoverStalePending();
    await chrome.alarms.create('browser-recap-checkpoint', { periodInMinutes: 1 });
    await startFromCurrentTab();
  });
});

chrome.tabs.onActivated.addListener(() => enqueue(async () => {
  await endPending(Date.now());
  await startFromCurrentTab();
}));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active || (!changeInfo.url && !changeInfo.title)) return;
  enqueue(async () => {
    if (changeInfo.url) await endPending(Date.now());
    await startFromTab(tab);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => enqueue(async () => {
  const pending = await getPending();
  if (pending?.tabId === tabId) {
    await endPending(Date.now());
    await startFromCurrentTab();
  }
}));

chrome.windows.onFocusChanged.addListener((windowId) => enqueue(async () => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) await endPending(Date.now());
  else {
    await endPending(Date.now());
    await startFromCurrentTab();
  }
}));

chrome.idle.onStateChanged.addListener((state) => enqueue(async () => {
  if (state === 'active') await startFromCurrentTab();
  else await endPending(Date.now());
}));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'browser-recap-checkpoint') enqueue(checkpoint);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  enqueue(async () => {
    if (message?.type === 'tracking:set') {
      const settings = await getSettings();
      if (message.enabled && !settings.consentedAt) { sendResponse({ ok:false, error:'consent_required' }); return; }
      settings.trackingEnabled = Boolean(message.enabled);
      await setSettings(settings);
      if (settings.trackingEnabled) await startFromCurrentTab();
      else await endPending(Date.now());
      sendResponse({ ok: true, settings });
      return;
    }
    if (message?.type === 'settings:changed') {
      const settings = await getSettings();
      chrome.idle.setDetectionInterval(settings.idleThresholdSeconds);
      await endPending(Date.now());
      await startFromCurrentTab();
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === 'tracking:status') {
      sendResponse({ ok: true, settings: await getSettings(), pending: await getPending() });
      return;
    }
    sendResponse({ ok: false });
  });
  return true;
});

chrome.idle.setDetectionInterval(DEFAULT_SETTINGS.idleThresholdSeconds);
