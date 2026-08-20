import { localDayKey } from './utils.js';

export function summarizeSessions(sessions, domainMeta = [], periodStart = 0) {
  const clean = (sessions || []).filter((s) => s && s.durationMs > 0 && s.domain);
  const totalMs = clean.reduce((sum, s) => sum + s.durationMs, 0);
  const domainMap = new Map();
  const categoryMap = new Map();
  const dayMap = new Map();
  const hourBuckets = Array.from({ length: 24 }, () => 0);

  for (const s of clean) {
    domainMap.set(s.domain, (domainMap.get(s.domain) || 0) + s.durationMs);
    categoryMap.set(s.category || 'Other', (categoryMap.get(s.category || 'Other') || 0) + s.durationMs);
    allocateAcrossDays(s.startTime, s.endTime, dayMap);
    allocateAcrossHours(s.startTime, s.endTime, hourBuckets);
  }

  const topDomains = [...domainMap.entries()]
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs);
  const categories = [...categoryMap.entries()]
    .map(([category, durationMs]) => ({ category, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs);
  const days = [...dayMap.entries()]
    .map(([date, durationMs]) => ({ date, durationMs }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const longestSession = [...clean].sort((a, b) => b.durationMs - a.durationMs)[0] || null;
  const peakHour = hourBuckets.reduce((best, durationMs, hour) => durationMs > best.durationMs ? { hour, durationMs } : best, { hour: 0, durationMs: 0 });
  const peakDay = [...days].sort((a, b) => b.durationMs - a.durationMs)[0] || null;
  const uniqueDomains = domainMap.size;
  const activeDays = new Set(clean.map((s) => localDayKey(s.startTime)));
  const currentStreak = calculateLongestStreak(activeDays);
  const lateNightMs = clean.reduce((sum, s) => sum + overlapWithHours(s.startTime, s.endTime, 0, 5), 0);
  const firstSeenMap = new Map((domainMeta || []).map((m) => [m.domain, m.firstSeen]));
  const newDomains = topDomains.filter((d) => (firstSeenMap.get(d.domain) || 0) >= periodStart).length;
  const transitions = clean.slice(1).reduce((count, s, i) => count + (s.domain !== clean[i].domain ? 1 : 0), 0);

  return {
    totalMs,
    sessions: clean.length,
    uniqueDomains,
    topDomains,
    categories,
    days,
    hourBuckets,
    longestSession,
    peakHour,
    peakDay,
    activeDays: activeDays.size,
    longestStreak: currentStreak,
    lateNightMs,
    newDomains,
    transitions
  };
}

function allocateAcrossDays(start, end, map) {
  let cursor = start;
  while (cursor < end) {
    const d = new Date(cursor);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const sliceEnd = Math.min(end, next);
    const key = localDayKey(cursor);
    map.set(key, (map.get(key) || 0) + (sliceEnd - cursor));
    cursor = sliceEnd;
  }
}

function allocateAcrossHours(start, end, buckets) {
  let cursor = start;
  while (cursor < end) {
    const d = new Date(cursor);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const sliceEnd = Math.min(end, next);
    buckets[d.getHours()] += sliceEnd - cursor;
    cursor = sliceEnd;
  }
}

function overlapWithHours(start, end, fromHour, toHourExclusive) {
  let total = 0;
  let cursor = start;
  while (cursor < end) {
    const d = new Date(cursor);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const sliceEnd = Math.min(end, next);
    if (d.getHours() >= fromHour && d.getHours() < toHourExclusive) total += sliceEnd - cursor;
    cursor = sliceEnd;
  }
  return total;
}

function calculateLongestStreak(daySet) {
  if (!daySet.size) return 0;
  const dates = [...daySet].map((key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }).sort((a, b) => a - b);
  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const diff = Math.round((dates[i] - dates[i - 1]) / 86400000);
    if (diff === 1) current += 1;
    else if (diff > 1) current = 1;
    best = Math.max(best, current);
  }
  return best;
}

export function buildStory(summary, label) {
  if (!summary || summary.totalMs <= 0) return [];
  const top = summary.topDomains[0];
  const topCategory = summary.categories[0];
  const slides = [
    { kind: 'intro', theme: 'yellow', eyebrow: `${label} RECAP`, title: 'Your time on the web,\nturned into a story.', body: `${summary.activeDays} active day${summary.activeDays === 1 ? '' : 's'} · ${summary.uniqueDomains} sites` },
    { kind: 'total', theme: 'red', eyebrow: 'TOTAL ACTIVE BROWSING', metricMs: summary.totalMs, title: 'You were here.', body: `${summary.sessions} focused browsing sessions, counted only while Chrome was active.` },
    { kind: 'favorite', theme: 'lilac', eyebrow: 'YOUR #1 SITE', title: top?.domain || 'No favorite yet', metricMs: top?.durationMs || 0, body: top ? `Your most-used domain in ${label.toLowerCase()}.` : '' },
    { kind: 'category', theme: 'paper', eyebrow: 'YOUR INTERNET HAD A MOOD', title: topCategory?.category || 'Other', metricMs: topCategory?.durationMs || 0, body: topCategory ? `Your biggest browsing category.` : '' },
    { kind: 'rabbit', theme: 'acid', eyebrow: 'DEEPEST DIVE', title: summary.longestSession?.domain || 'Keep browsing', metricMs: summary.longestSession?.durationMs || 0, body: summary.longestSession ? 'Your longest uninterrupted tracked session.' : '' },
    { kind: 'rhythm', theme: 'pink', eyebrow: 'YOUR BROWSING RHYTHM', title: hourLabel(summary.peakHour.hour), body: `That was your busiest hour. ${Math.round((summary.lateNightMs / Math.max(1, summary.totalMs)) * 100)}% of your browsing happened after midnight and before 5 AM.` },
    { kind: 'discovery', theme: 'cobalt', eyebrow: 'NEW CORNERS OF THE WEB', title: `${summary.newDomains}`, body: `Sites first seen during this recap period.`, light: true },
    { kind: 'streak', theme: 'ink', eyebrow: 'BROWSING STREAK', title: `${summary.longestStreak} day${summary.longestStreak === 1 ? '' : 's'}`, body: 'Your longest run of consecutive active browsing days.', light: true },
    { kind: 'finale', theme: 'paper', eyebrow: 'BROWSER RECAP', title: 'That was your web.', body: `${summary.transitions} site switches · ${summary.uniqueDomains} unique domains · all processed locally.` }
  ];
  return slides;
}

function hourLabel(hour) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${suffix}`;
}
