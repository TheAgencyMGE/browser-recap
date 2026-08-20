import assert from 'node:assert/strict';
import { summarizeSessions, buildStory } from '../lib/analytics.js';
import { categorizeDomain } from '../lib/categories.js';

const base = new Date(2026, 7, 19, 10, 0).getTime();
const sessions = [
  { domain: 'youtube.com', category: 'Entertainment', startTime: base, endTime: base + 30 * 60000, durationMs: 30 * 60000 },
  { domain: 'github.com', category: 'Development', startTime: base + 40 * 60000, endTime: base + 100 * 60000, durationMs: 60 * 60000 },
  { domain: 'github.com', category: 'Development', startTime: base + 110 * 60000, endTime: base + 140 * 60000, durationMs: 30 * 60000 }
];
const meta = [
  { domain: 'youtube.com', firstSeen: base - 86400000 },
  { domain: 'github.com', firstSeen: base + 1000 }
];
const summary = summarizeSessions(sessions, meta, base);
assert.equal(summary.totalMs, 120 * 60000);
assert.equal(summary.uniqueDomains, 2);
assert.equal(summary.topDomains[0].domain, 'github.com');
assert.equal(summary.categories[0].category, 'Development');
assert.equal(summary.newDomains, 1);
assert.equal(buildStory(summary, '2026').length, 9);
assert.equal(categorizeDomain('github.com'), 'Development');
assert.equal(categorizeDomain('www.youtube.com'), 'Entertainment');
console.log('analytics tests passed');
