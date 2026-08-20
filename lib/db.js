import { DB_NAME, DB_VERSION, MIN_SESSION_MS } from './constants.js';

let dbPromise;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const sessions = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
      sessions.createIndex('startTime', 'startTime');
      sessions.createIndex('dateKey', 'dateKey');
      sessions.createIndex('domain', 'domain');
      db.createObjectStore('domainMeta', { keyPath: 'domain' });
      db.createObjectStore('historyClues', { keyPath: 'domain' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function complete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function saveSession(session) {
  if (!session || session.durationMs < MIN_SESSION_MS || !session.domain) return false;
  const db = await openDb();
  const tx = db.transaction(['sessions', 'domainMeta'], 'readwrite');
  tx.objectStore('sessions').add(session);
  const metaStore = tx.objectStore('domainMeta');
  const existingReq = metaStore.get(session.domain);
  existingReq.onsuccess = () => {
    const current = existingReq.result || {
      domain: session.domain,
      firstSeen: session.startTime,
      lastSeen: session.endTime,
      totalMs: 0,
      sessionCount: 0,
      category: session.category
    };
    current.firstSeen = Math.min(current.firstSeen || session.startTime, session.startTime);
    current.lastSeen = Math.max(current.lastSeen || session.endTime, session.endTime);
    current.totalMs = (current.totalMs || 0) + session.durationMs;
    current.sessionCount = (current.sessionCount || 0) + 1;
    current.category = session.category;
    metaStore.put(current);
  };
  await complete(tx);
  return true;
}

export async function getSessionsBetween(start, end) {
  const db = await openDb();
  const tx = db.transaction('sessions', 'readonly');
  const index = tx.objectStore('sessions').index('startTime');
  const range = IDBKeyRange.bound(start, end, false, true);
  const request = index.getAll(range);
  const result = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  await complete(tx);
  return result;
}

export async function getAllSessions() {
  const db = await openDb();
  const tx = db.transaction('sessions', 'readonly');
  const req = tx.objectStore('sessions').getAll();
  const result = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  await complete(tx);
  return result;
}

export async function getDomainMeta() {
  const db = await openDb();
  const tx = db.transaction('domainMeta', 'readonly');
  const req = tx.objectStore('domainMeta').getAll();
  const result = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  await complete(tx);
  return result;
}

export async function putHistoryClues(clues) {
  const db = await openDb();
  const tx = db.transaction('historyClues', 'readwrite');
  const store = tx.objectStore('historyClues');
  store.clear();
  for (const clue of clues) store.put(clue);
  await complete(tx);
}

export async function getHistoryClues() {
  const db = await openDb();
  const tx = db.transaction('historyClues', 'readonly');
  const req = tx.objectStore('historyClues').getAll();
  const result = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  await complete(tx);
  return result;
}

export async function replaceAllData(payload) {
  const db = await openDb();
  const tx = db.transaction(['sessions', 'domainMeta', 'historyClues'], 'readwrite');
  for (const name of ['sessions', 'domainMeta', 'historyClues']) tx.objectStore(name).clear();
  for (const session of payload.sessions || []) tx.objectStore('sessions').add(session);
  for (const meta of payload.domainMeta || []) tx.objectStore('domainMeta').put(meta);
  for (const clue of payload.historyClues || []) tx.objectStore('historyClues').put(clue);
  await complete(tx);
}

export async function clearAllData() {
  const db = await openDb();
  const tx = db.transaction(['sessions', 'domainMeta', 'historyClues'], 'readwrite');
  tx.objectStore('sessions').clear();
  tx.objectStore('domainMeta').clear();
  tx.objectStore('historyClues').clear();
  await complete(tx);
}
