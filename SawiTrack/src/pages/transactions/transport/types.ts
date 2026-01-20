/**
 * Transport Module Types
 * Contains all TypeScript interfaces and types for the Transport module
 */

import type { AngkutRow, Company } from "@/lib/api";

export type Estate = {
  _id: string;
  estate_name: string;
  companyId?: string;
  divisions?: unknown[];
};

// ============================================================================
// Filter Types
// ============================================================================

export interface TransportFilters {
  searchTerm: string;
  selectedCompanyId: string;
  selectedEstateId: string;
  selectedDivisionId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

// ============================================================================
// Excel Import Types
// ============================================================================

export interface ExcelRowData {
  // Core fields
  date_panen?: string | Date;
  date_angkut?: string | Date;
  pt?: string;
  estate?: string;
  division_id?: string;
  block_no?: string;
  no_spb?: string;
  tahun?: string | number;

  // Transport details
  no_mobil?: string;
  nama_supir?: string;

  // Weight measurements
  jumlah?: string | number;
  brondolan?: string | number;
  beratDiKirim?: string | number;
  bruto?: string | number;
  tarra?: string | number;
  netto?: string | number;
  potongan?: string | number;
  berat?: string | number;
  tonase?: string | number;
  jjg?: string | number;

  // Ticket info
  no_tiket?: string;
  code?: string;
}

export interface ParsedExcelData {
  rows: ExcelRowData[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  stage: "validating" | "creating-companies" | "creating-estates" | "uploading";
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompanyEstateMap {
  companyMap: Map<string, Company>;
  estateMap: Map<string, Estate>;
  newCompanies: Set<string>;
  newEstates: Map<string, string>; // estateName -> companyId
}

// ============================================================================
// Company Alias Types
// ============================================================================

export interface CompanyAlias {
  _id: string;
  alias_name: string;
  company_id: string;
  company_name?: string; // populated from company_id
  created_by?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyResolution {
  excelName: string;
  companyId?: string;
  companyName?: string;
  source?: "exact" | "alias" | "fuzzy";
}

export interface UnresolvedCompany {
  excelName: string;
  suggestedCompanyId?: string; // from fuzzy matching
  suggestedCompanyName?: string;
}

export interface CompanyMappingInput {
  aliasName: string;
  companyId: string;
  companyName: string; // Database company name to use for updating preview data
}

export interface CompanyMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mappings: CompanyMappingInput[]) => Promise<void>;
  unresolvedCompanies: UnresolvedCompany[];
  resolvedCompanies: CompanyResolution[];
  availableCompanies: Company[];
  isLoading?: boolean;
}

// ============================================================================
// Table Types
// ============================================================================

export interface DerivedRow extends AngkutRow {
  companyName: string;
  estateName: string;
  id: string;
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

// ============================================================================
// Dialog Types
// ============================================================================

export interface DialogState {
  isOpen: boolean;
  row?: DerivedRow;
}

export interface ImportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: ExcelRowData[];
  isLoading: boolean;
}

// ============================================================================
// Component Props
// ============================================================================

export interface TransportFiltersProps {
  filters: TransportFilters;
  onFiltersChange: (filters: Partial<TransportFilters>) => void;
  companies: Company[];
  estates: Estate[];
  divisions: string[];
}

export interface TransportTableProps {
  data: DerivedRow[];
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onRowEdit: (row: DerivedRow) => void;
  onRowDelete: (id: string) => void;
}
