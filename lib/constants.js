export const DEFAULT_SETTINGS = Object.freeze({
  trackingEnabled: false,
  consentedAt: null,
  idleThresholdSeconds: 60,
  storePageTitles: false,
  excludedDomains: [],
  firstRunComplete: false,
  theme: 'light'
});

export const STORAGE_KEYS = Object.freeze({
  settings: 'browserRecapSettings',
  pendingSession: 'browserRecapPendingSession',
  installDate: 'browserRecapInstallDate'
});

export const DB_NAME = 'browser-recap-db';
export const DB_VERSION = 1;
export const MIN_SESSION_MS = 1500;
