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

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export const api = {
  health: () => http<{ ok: boolean; uptime: number }>(`/health`),
  estates: () => http<Array<{ _id: string; estate_name: string }>>(`/estates`),
  estate: (id: string) => http(`/estates/${id}`),
  divisions: (estateId: string) => http<Array<{ division_id: number }>>(`/estates/${estateId}/divisions`),
  blocks: (estateId: string, divisionId: number | string) => http(`/estates/${estateId}/divisions/${divisionId}/blocks`),
  employees: () => http<Employee[]>(`/employees`),
  targets: () => http<Target[]>(`/targets`),
  reports: (params?: Record<string, string | number | undefined>) => {
    const search = toQS(params);
    return http<ReportDoc[]>(`/reports${search}`);
  },
  createReport: (body: Omit<ReportDoc, '_id' | 'status'> & { status?: ReportStatus }) =>
    http<ReportDoc>(`/reports`, { method: 'POST', body: JSON.stringify(body) }),
  approveReport: (id: string) => http(`/reports/${id}/approve`, { method: 'PATCH' }),
  rejectReport: (id: string, reason?: string) =>
    http<ReportDoc>(`/reports/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  recapHK: (params?: { startDate?: string; endDate?: string }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<RecapHKRow[]>(`/recap/hk${search}`);
  },
  stats: () => http<{ totalEmployees: number; todayReports: number; pendingCount: number; targetsPercent: number }>(`/stats`),
};
