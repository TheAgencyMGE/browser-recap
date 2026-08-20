export function safeDomain(urlString) {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function sanitizeTitle(title) {
  if (typeof title !== 'string') return null;
  return title.replace(/\s+/g, ' ').trim().slice(0, 180) || null;
}

export function localDayKey(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDuration(ms, compact = false) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (compact) return h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (h === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  if (m === 0) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h}h ${m}m`;
}

export function formatClock(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  return d.getTime();
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1).getTime();
}

export function periodBounds(period, now = new Date()) {
  const end = now.getTime() + 1;
  switch (period) {
    case 'today': return { start: startOfDay(now), end, label: 'Today' };
    case 'week': return { start: startOfWeek(now), end, label: 'This Week' };
    case 'month': return { start: startOfMonth(now), end, label: 'This Month' };
    case 'year': return { start: startOfYear(now), end, label: `${now.getFullYear()}` };
    default: return { start: 0, end, label: 'All Time' };
  }
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}
