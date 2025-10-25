// src/lib/api.ts
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export type Role = 'manager' | 'foreman' | 'employee';
export type EmpStatus = 'active' | 'inactive';
export type TargetStatus = 'active' | 'done';
export type ReportStatus = 'pending' | 'approved' | 'rejected';

export interface Employee {
  _id: string;
  name: string;
  email: string;
  role: Role;
  division?: string;
  status: EmpStatus;
}

export interface Target {
  _id: string;
  division: string;
  period: string; // YYYY-MM
  target: number;
  achieved: number;
  status: TargetStatus;
}

export interface ReportDoc {
  _id: string;
  employeeId?: string;
  employeeName: string;
  date: string; // ISO
  division: string;
  jobType: string;
  hk: number;
  notes?: string;
  status: ReportStatus;
  rejectedReason?: string;
}

export interface RecapHKRow {
  employee: string;
  division: string;
  totalHK: number;
  approved: number;
  pending: number;
  rejected: number;
}

function toQS(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)] as [string, string]);
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries).toString();
}

function getToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (body: { email: string; password: string }) => http<{ token: string; user: Employee }>(`/auth/login`, { method: 'POST', body: JSON.stringify(body) }),
  me: () => http<Employee>(`/auth/me`),
  health: () => http<{ ok: boolean; uptime: number }>(`/health`),
  estates: () => http<Array<{ _id: string; estate_name: string }>>(`/estates`),
  estate: (id: string) => http(`/estates/${id}`),
  createEstate: (body: { _id: string; estate_name: string; divisions?: unknown[] }) =>
    http(`/estates`, { method: 'POST', body: JSON.stringify(body) }),
  updateEstate: (id: string, body: Partial<{ estate_name: string; divisions: unknown[] }>) =>
    http(`/estates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEstate: (id: string) => http(`/estates/${id}`, { method: 'DELETE' }),
  divisions: (estateId: string) => http<Array<{ division_id: number }>>(`/estates/${estateId}/divisions`),
  blocks: (estateId: string, divisionId: number | string) => http(`/estates/${estateId}/divisions/${divisionId}/blocks`),
  employees: () => http<Employee[]>(`/employees`),
  employee: (id: string) => http<Employee>(`/employees/${id}`),
  createEmployee: (body: { name: string; email: string; role: Role; division?: string | null; status?: EmpStatus; password?: string }) =>
    http<Employee>(`/employees`, { method: 'POST', body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Partial<{ name: string; email: string; role: Role; division: string | null; status: EmpStatus; password: string }>) =>
    http<Employee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEmployee: (id: string) => http<{ ok: boolean }>(`/employees/${id}`, { method: 'DELETE' }),
  targets: () => http<Target[]>(`/targets`),
  target: (id: string) => http<Target>(`/targets/${id}`),
  createTarget: (body: { division: string; period: string; target: number; achieved?: number; status?: TargetStatus }) =>
    http<Target>(`/targets`, { method: 'POST', body: JSON.stringify(body) }),
  updateTarget: (id: string, body: Partial<{ division: string; period: string; target: number; achieved: number; status: TargetStatus }>) =>
    http<Target>(`/targets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTarget: (id: string) => http<{ ok: boolean }>(`/targets/${id}`, { method: 'DELETE' }),
  reports: (params?: Record<string, string | number | undefined>) => {
    const search = toQS(params);
    return http<ReportDoc[]>(`/reports${search}`);
  },
  report: (id: string) => http<ReportDoc>(`/reports/${id}`),
  createReport: (body: Omit<ReportDoc, '_id' | 'status'> & { status?: ReportStatus }) =>
    http<ReportDoc>(`/reports`, { method: 'POST', body: JSON.stringify(body) }),
  updateReport: (id: string, body: Partial<Omit<ReportDoc, '_id'>>) =>
    http<ReportDoc>(`/reports/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteReport: (id: string) => http<{ ok: boolean }>(`/reports/${id}`, { method: 'DELETE' }),
  approveReport: (id: string) => http(`/reports/${id}/approve`, { method: 'PATCH' }),
  rejectReport: (id: string, reason?: string) =>
    http<ReportDoc>(`/reports/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  recapHK: (params?: { startDate?: string; endDate?: string }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<RecapHKRow[]>(`/recap/hk${search}`);
  },
  stats: () => http<{ totalEmployees: number; todayReports: number; pendingCount: number; targetsPercent: number }>(`/stats`),
};
