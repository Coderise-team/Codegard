// Human-friendly "time ago" label for an ISO timestamp.
export function timeAgo(iso) {
  const then = new Date(iso);
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Short absolute date label, e.g. "May 28".
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// Full date label with the year, e.g. "Jun 6, 2026".
export function formatFullDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Clock time of an ISO timestamp, e.g. "17:00".
export function formatTimeOfDay(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

// Seconds remaining until an ISO timestamp (never negative).
export function secondsUntil(iso) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

// Formats a number of seconds as a countdown, e.g. "1d 02:05:09" or "00:04:41".
export function fmtCountdown(total) {
  if (total < 0) total = 0;
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return (d > 0 ? `${d}d ` : '') + `${p(h)}:${p(m)}:${p(s)}`;
}

// Compact duration between two ISO timestamps, e.g. "2h", "1h 30m", "45m".
export function formatDuration(startIso, endIso) {
  const minutes = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
