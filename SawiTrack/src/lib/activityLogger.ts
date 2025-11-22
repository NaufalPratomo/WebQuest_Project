// Simplified activity logger - fire and forget approach
// Logs are queued and sent in background without blocking UI

import { API_BASE } from './api';

interface LogEntry {
  action: string;
  category?: string;
  level?: 'info' | 'error';
  details?: unknown;
  durationMs?: number;
}

const queue: Array<LogEntry & { ts: string; userId?: string; user_name?: string; role?: string }> = [];
const ENDPOINT = `${API_BASE}/activity-logs`;
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 3000; // 3 seconds

function getUserMeta() {
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return {};
    const user = JSON.parse(raw);
    return {
      userId: user._id || user.id,
      user_name: user.name || 'Unknown',
      role: user.role || 'user'
    };
  } catch {
    return {};
  }
}

export function logActivity(entry: LogEntry) {
  // Silently ignore if action contains activity-logs to prevent recursion
  if (entry.action?.includes('activity-log')) return;
  
  const meta = getUserMeta();
  queue.push({
    ...entry,
    ts: new Date().toISOString(),
    ...meta
  });

  // Auto-flush if queue is full
  if (queue.length >= BATCH_SIZE) {
    void flush();
  }
}

async function flush() {
  if (queue.length === 0) return;
  
  const batch = queue.splice(0, BATCH_SIZE);
  const token = localStorage.getItem('token');
  
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: JSON.stringify(batch),
      keepalive: true
    });
  } catch {
    // Silent fail - don't break the app if logging fails
  }
}

// Periodic flush
setInterval(flush, FLUSH_INTERVAL);

// Flush on page hide
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flush();
});

window.addEventListener('beforeunload', () => void flush());
