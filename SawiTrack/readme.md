# SawiTrack

## Activity Logging Implementation
A centralized activity logging system has been added to record user actions and API interactions across the application.

### Components
- `src/lib/activityLogger.ts`: Queue-based logger with periodic + unload flush.
- `src/lib/api.ts`: HTTP wrapper now auto logs each API request (success & error) except the logging endpoint itself.
- `src/components/RouteLogger.tsx`: Logs every route transition with user context.
- Manual examples added in `transactions/Attendance.tsx` for create/update actions.

### How It Works
1. Each API call triggers `logActivity` with timing, status, and a small response shape.
2. Manual domain events can call `logActivity({ action: 'attendance_create', category: 'attendance', details: {...} })`.
3. Logs are batched (max 20) and flushed every 5 seconds or on page hide/unload using `sendBeacon` fallback.
4. Endpoint resolved by `VITE_ACTIVITY_LOG_URL` or defaults to `${API_BASE}/activity-logs`.
5. Supports sending a single object or an array (batch) depending on queue size.

### Data Schema (Frontend Payload)
```ts
interface ActivityLogEntry {
  action: string;            // e.g. 'HTTP POST /attendance'
  category?: string;         // api | navigation | attendance | panen | transport | closing | auth | system
  level?: 'info' | 'error';  // outcome severity
  details?: unknown;         // contextual data (body, ids, diff, error message)
  userId?: string;           // derived from auth_user localStorage
  role?: string;             // user role
  ts: string;                // ISO timestamp
  durationMs?: number;       // for timed operations
}
```

### Adding Custom Logs
```ts
import { logActivity } from '@/lib/activityLogger';
logActivity({
  action: 'panen_create',
  category: 'panen',
  level: 'info',
  details: { date: '2025-11-22', employeeId: 'EMP123', janjangTBS: 34 }
});
```

### Timing Helper
Wrap an async operation to auto log duration:
```ts
import { withTiming } from '@/lib/activityLogger';
await withTiming('bulk_upload', 'system', async () => {
  // long-running action
});
```

### Recommended Action Naming Conventions
| Category    | Pattern                           | Example |
|-------------|-----------------------------------|---------|
| api         | `HTTP <METHOD> <PATH>`            | HTTP GET /panen?date_panen=2025-11-22 |
| navigation  | `route_change`                    | route_change (details.path=/dashboard) |
| attendance  | `attendance_create`/`attendance_update` | attendance_create |
| panen       | `panen_create` / `panen_update`   | panen_create |
| transport   | `angkut_sync` / `angkut_update`   | angkut_update |
| closing     | `closing_period_create`           | closing_period_create |
| auth        | `login_success` / `login_failure` | login_success |
| system      | Flexible                          | bulk_upload |

### Avoiding Log Flood
- Automatic API logging already captures every request.
- Use manual logs only for meaningful domain events or multi-step operations.
- Batch size and interval can be tuned in `activityLogger.ts` (`MAX_BATCH`, `FLUSH_INTERVAL_MS`).

### Disabling Logging on Specific Requests
Pass `disableLog: true` in the second argument of calls that use the internal http wrapper if necessary.
```ts
http<MyType>('/quiet-endpoint', { method: 'POST', body: JSON.stringify(data), disableLog: true });
```

### Backend Expectations
Backend should accept either an object (single log) or an array of objects at `POST /activity-logs`.
Each log stored under collection `activitylogs` including all fields above plus server-derived IP & user agent.

### Next Extensions
- Diff helper for update actions (`before` vs `after`).
- Severity escalation & alerting for repeated errors.
- Dashboard summary (counts per category per day).

---
For further instrumentation needs, add manual `logActivity` calls at the end of domain mutations.
