// src/lib/api.ts
import { getToken } from './authStore';
// Resolve API base; allow relative '/api' to be expanded to current origin
const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
export const API_BASE = RAW_API_BASE.startsWith('/') && typeof window !== 'undefined'
  ? `${window.location.origin}${RAW_API_BASE}`
  : RAW_API_BASE;

export type Role = "manager" | "foreman" | "employee";
export type EmpStatus = "active" | "inactive";
export type TargetStatus = "active" | "done";
export type ReportStatus = "pending" | "approved" | "rejected";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  division?: string;
  status: string;
}

export interface Employee {
  _id: string;
  nik: string;
  name: string;
  companyId?: string;
  position?: string;
  salary?: number;
  address?: string;
  phone?: string;
  birthDate?: string;
  status: string;
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

export interface Company {
  _id: string;
  company_name: string;
  address: string;
  phone?: string;
  email?: string;
  estates?: Array<{ _id: string; estate_name: string }>;
  createdAt?: string;
  updatedAt?: string;
}

// New data contracts
export type TaksasiRow = {
  _id?: string;
  date: string; // ISO
  estateId: string;
  division_id: number;
  block_no: string;
  block_id?: string;
  weightKg: number;
  notes?: string;
  // Extended analytical fields (optional)
  totalPokok?: number;
  samplePokok?: number;
  bm?: number;
  ptb?: number;
  bmbb?: number;
  bmm?: number;
  avgWeightKg?: number;
  basisJanjangPerPemanen?: number;
  akpPercent?: number;
  taksasiJanjang?: number;
  taksasiTon?: number;
  kebutuhanPemanen?: number;
};

export type PanenRow = {
  _id?: string;
  date_panen: string; // ISO
  estateId: string;
  division_id: number;
  block_no: string;
  block_id?: string;
  weightKg: number;
  employeeId?: string;
  employeeName?: string;
  mandorId?: string;
  mandorName?: string;
  jobCode?: string;
  notes?: string;
  // extended real harvest fields
  janjangTBS?: number;
  janjangKosong?: number;
  upahBasis?: number;
  premi?: number;
  totalUpah?: number;
};

export type AngkutRow = {
  _id?: string;
  date_panen: string; // ISO (lock key)
  date_angkut: string; // ISO (transport date)
  estateId: string;
  division_id: number;
  block_no: string;
  block_id?: string;
  weightKg: number;
  notes?: string;
};

function toQS(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)] as [string, string]);
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}


async function http<T>(path: string, init?: (RequestInit & { disableLog?: boolean })): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const fullUrl = `${API_BASE}${path}`;
  const res = await fetch(fullUrl, {
    headers,
    credentials: 'include', // allow cookie-based session fallback
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const json = await res.json();
  return json;
}

export const api = {
  // Auth
  login: (body: { email: string; password: string }) =>
    http<{ token: string; user: User }>(`/auth/login`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => http<User>(`/auth/me`),
  health: () => http<{ ok: boolean; uptime: number }>(`/health`),
  // Users (Web Accounts)
  users: () => http<User[]>(`/users`),
  user: (id: string) => http<User>(`/users/${id}`),
  createUser: (body: {
    name: string;
    email: string;
    role: Role;
    password: string;
    division?: string | null;
    status?: string;
  }) => http<User>(`/users`, { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: Partial<{
    name: string;
    email: string;
    role: Role;
    password: string;
    division: string | null;
    status: string;
  }>) => http<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteUser: (id: string) => http<void>(`/users/${id}`, { method: "DELETE" }),
  // Employees (Workers/Pemanen)
  employees: () => http<Employee[]>(`/employees`),
  employee: (id: string) => http<Employee>(`/employees/${id}`),
  createEmployee: (body: {
    nik: string;
    name: string;
    companyId?: string;
    position?: string;
    salary?: number;
    address?: string;
    phone?: string;
    birthDate?: string;
  }) => http<Employee>(`/employees`, { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Partial<{
    nik: string;
    name: string;
    companyId: string | null;
    position: string | null;
    salary: number | null;
    address: string | null;
    phone: string | null;
    birthDate: string | null;
    status: string;
  }>) => http<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEmployee: (id: string) => http<void>(`/employees/${id}`, { method: "DELETE" }),
  // Companies
  companies: () => http<Company[]>(`/companies`),
  company: (id: string) => http<Company>(`/companies/${id}`),
  createCompany: (body: {
    company_name: string;
    address: string;
    phone?: string;
    email?: string;
    estates?: string[];
  }) =>
    http<Company>(`/companies`, { method: "POST", body: JSON.stringify(body) }),
  updateCompany: (
    id: string,
    body: Partial<{
      company_name: string;
      address: string;
      phone: string;
      email: string;
      estates: string[];
    }>
  ) =>
    http<Company>(`/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteCompany: (id: string) =>
    http<{ ok: boolean }>(`/companies/${id}`, { method: "DELETE" }),
  // Estates
  estates: () => http<Array<{ _id: string; estate_name: string }>>(`/estates`),
  estate: (id: string) => http(`/estates/${id}`),
  createEstate: (body: {
    _id: string;
    estate_name: string;
    divisions?: unknown[];
  }) => http(`/estates`, { method: "POST", body: JSON.stringify(body) }),
  updateEstate: (
    id: string,
    body: Partial<{ estate_name: string; divisions: unknown[]; status: string }>
  ) => http(`/estates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEstate: (id: string) => http(`/estates/${id}`, { method: "DELETE" }),
  divisions: (estateId: string) =>
    http<Array<{ division_id: number }>>(`/estates/${estateId}/divisions`),
  blocks: (estateId: string, divisionId: number | string) =>
    http(`/estates/${estateId}/divisions/${divisionId}/blocks`),
  targets: () => http<Target[]>(`/targets`),
  target: (id: string) => http<Target>(`/targets/${id}`),
  createTarget: (body: {
    division: string;
    period: string;
    target: number;
    achieved?: number;
    status?: TargetStatus;
  }) =>
    http<Target>(`/targets`, { method: "POST", body: JSON.stringify(body) }),
  updateTarget: (
    id: string,
    body: Partial<{
      division: string;
      period: string;
      target: number;
      achieved: number;
      status: TargetStatus;
    }>
  ) =>
    http<Target>(`/targets/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteTarget: (id: string) =>
    http<{ ok: boolean }>(`/targets/${id}`, { method: "DELETE" }),
  reports: (params?: Record<string, string | number | undefined>) => {
    const search = toQS(params);
    return http<ReportDoc[]>(`/reports${search}`);
  },
  report: (id: string) => http<ReportDoc>(`/reports/${id}`),
  createReport: (
    body: Omit<ReportDoc, "_id" | "status"> & { status?: ReportStatus }
  ) =>
    http<ReportDoc>(`/reports`, { method: "POST", body: JSON.stringify(body) }),
  updateReport: (id: string, body: Partial<Omit<ReportDoc, "_id">>) =>
    http<ReportDoc>(`/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteReport: (id: string) =>
    http<{ ok: boolean }>(`/reports/${id}`, { method: "DELETE" }),
  approveReport: (id: string) =>
    http(`/reports/${id}/approve`, { method: "PATCH" }),
  rejectReport: (id: string, reason?: string) =>
    http<ReportDoc>(`/reports/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  recapHK: (params?: { startDate?: string; endDate?: string }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<RecapHKRow[]>(`/recap/hk${search}`);
  },
  stats: () =>
    http<{
      totalEmployees: number;
      todayReports: number;
      pendingCount: number;
      targetsPercent: number;
    }>(`/stats`),
  taksasiList: (params?: { date?: string; estateId?: string; division_id?: number }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<Array<TaksasiRow>>(`/taksasi${search}`);
  },
  taksasiCreate: (body: TaksasiRow | Array<TaksasiRow>) =>
    http<TaksasiRow | Array<TaksasiRow>>(`/taksasi`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  taksasiSelections: (params?: { date?: string; estateId?: string; division_id?: number; block_no?: string }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<Array<{ _id: string; date: string; estateId: string; division_id: number; block_no: string; employeeIds: string[]; notes?: string }>>(`/taksasi-selections${search}`);
  },
  upsertTaksasiSelection: (body: { date: string; estateId: string; division_id: number; block_no: string; employeeIds: string[]; notes?: string }) =>
    http(`/taksasi-selections`, { method: 'POST', body: JSON.stringify(body) }),
  deleteTaksasiSelection: (id: string) => http<{ ok: boolean }>(`/taksasi-selections/${id}`, { method: 'DELETE' }),
  customWorkers: () => http<Array<{ _id: string; name: string; active: boolean }>>(`/custom-workers`),
  createCustomWorker: (name: string) => http<{ _id: string; name: string; active: boolean }>(`/custom-workers`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteCustomWorker: (id: string) => http<{ ok: boolean }>(`/custom-workers/${id}`, { method: 'DELETE' }),
  panenList: (params?: {
    date_panen?: string;
    estateId?: string;
    division_id?: number;
  }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<Array<PanenRow>>(`/panen${search}`);
  },
  panenCreate: (body: PanenRow | Array<PanenRow>) =>
    http<PanenRow | Array<PanenRow>>(`/panen`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  panenBatch: (rows: Array<PanenRow>) => http<Array<PanenRow>>(`/panen`, { method: 'POST', body: JSON.stringify(rows) }),
  angkutList: (params?: {
    date_panen?: string;
    date_angkut?: string;
    estateId?: string;
    division_id?: number;
  }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<Array<AngkutRow>>(`/angkut${search}`);
  },
  angkutCreate: (body: AngkutRow | Array<AngkutRow>) =>
    http<AngkutRow | Array<AngkutRow>>(`/angkut`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  attendanceList: (params?: { date?: string; employeeId?: string }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<
      Array<{
        _id: string;
        date: string;
        employeeId: string;
        division_id?: number;
        status: string;
        hk: number;
      }>
    >(`/attendance${search}`);
  },
  attendanceCreate: (body: {
    date: string;
    employeeId: string;
    division_id?: number;
    status: "present" | "absent" | "leave";
    hk?: number;
    notes?: string;
  }) => http(`/attendance`, { method: "POST", body: JSON.stringify(body) }),
  jobcodes: () =>
    http<
      Array<{
        code: string;
        name: string;
        category: "panen" | "non-panen";
        hkValue: number;
      }>
    >(`/jobcodes`),
  createJobcode: (body: {
    code: string;
    name: string;
    category: "panen" | "non-panen";
    hkValue: number;
    description?: string;
  }) => http(`/jobcodes`, { method: "POST", body: JSON.stringify(body) }),
  updateJobcode: (
    code: string,
    body: Partial<{
      name: string;
      category: "panen" | "non-panen";
      hkValue: number;
      description: string;
    }>
  ) => http(`/jobcodes/${code}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteJobcode: (code: string) =>
    http(`/jobcodes/${code}`, { method: "DELETE" }),
  reportTaksasiPerBlock: (params?: { date?: string }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<
      Array<{
        estateId: string;
        division_id: number;
        block_no: string;
        totalKg: number;
      }>
    >(`/reports/taksasi-per-block${search}`);
  },
  reportTrend: (params?: {
    type?: "panen" | "angkut" | "taksasi";
    limit?: number;
    sort?: "asc" | "desc";
  }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<
      Array<{
        estateId: string;
        division_id: number;
        block_no: string;
        totalKg: number;
      }>
    >(`/reports/trend${search}`);
  },
  reportStatement: (params?: { startDate?: string; endDate?: string }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<
      Array<{
        estateId: string;
        division_id: number;
        totalKg: number;
        blockCount: number;
      }>
    >(`/reports/statement${search}`);
  },
  // Activity Logs
  activityLogs: (params?: { page?: number; limit?: number }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    type ActivityLogsResponse = { data?: unknown; pagination?: { pages?: number }; } | unknown[];
    return http<ActivityLogsResponse>(`/activity-logs${search}`).catch(err => {
      // Fallback logic: if 404 or Not Found message, try alias without dash
      if (err instanceof Error && (/404|not\s*found/i).test(err.message)) {
        return http<ActivityLogsResponse>(`/activitylogs${search}`, { disableLog: true }).catch(inner => {
          // Provide a clearer combined error
          throw new Error(`Activity logs endpoint tidak ditemukan. Coba cek backend routes /activity-logs & /activitylogs. Asli: ${err.message}; Alias: ${inner instanceof Error ? inner.message : String(inner)}`);
        });
      }
      throw err;
    });
  },
  // Closing endpoints
  // Closing endpoints
  closingPeriods: () =>
    http<Array<{ _id: string; startDate: string; endDate: string; notes?: string }>>(`/closing-periods`),
  createClosingPeriod: (body: { startDate: string; endDate: string; notes?: string; month?: number; year?: number }) =>
    http<{ _id: string }>(`/closing-periods`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteClosingPeriod: (id: string) =>
    http<{ ok: boolean }>(`/closing-periods/${id}`, { method: "DELETE" }),
};
