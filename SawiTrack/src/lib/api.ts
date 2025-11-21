// src/lib/api.ts
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export type Role = "manager" | "foreman" | "employee";
export type EmpStatus = "active" | "inactive";
export type TargetStatus = "active" | "done";
export type ReportStatus = "pending" | "approved" | "rejected";

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

function getToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
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
  login: (body: { email: string; password: string }) =>
    http<{ token: string; user: Employee }>(`/auth/login`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => http<Employee>(`/auth/me`),
  health: () => http<{ ok: boolean; uptime: number }>(`/health`),
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
    body: Partial<{ estate_name: string; divisions: unknown[] }>
  ) => http(`/estates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEstate: (id: string) => http(`/estates/${id}`, { method: "DELETE" }),
  divisions: (estateId: string) =>
    http<Array<{ division_id: number }>>(`/estates/${estateId}/divisions`),
  blocks: (estateId: string, divisionId: number | string) =>
    http(`/estates/${estateId}/divisions/${divisionId}/blocks`),
  employees: () => http<Employee[]>(`/employees`),
  employee: (id: string) => http<Employee>(`/employees/${id}`),
  createEmployee: (body: {
    name: string;
    email: string;
    role: Role;
    division?: string | null;
    status?: EmpStatus;
    password?: string;
  }) =>
    http<Employee>(`/employees`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEmployee: (
    id: string,
    body: Partial<{
      name: string;
      email: string;
      role: Role;
      division: string | null;
      status: EmpStatus;
      password: string;
    }>
  ) =>
    http<Employee>(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteEmployee: (id: string) =>
    http<{ ok: boolean }>(`/employees/${id}`, { method: "DELETE" }),
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
  // New endpoints per client request
  taksasiList: (params?: {
    date?: string;
    estateId?: string;
    division_id?: number;
  }) => {
    const search = toQS(params as Record<string, string | number | undefined>);
    return http<Array<TaksasiRow>>(`/taksasi${search}`);
  },
  taksasiCreate: (body: TaksasiRow | Array<TaksasiRow>) =>
    http<TaksasiRow | Array<TaksasiRow>>(`/taksasi`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
};
