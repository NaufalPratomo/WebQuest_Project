/**
 * Transport Data Hook
 * Manages transport data fetching and state
 */

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import type { AngkutRow, Company } from "@/lib/api";
import type { DerivedRow, TransportFilters, Estate } from "../types";

export function useTransportData() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [estates, setEstates] = useState<Estate[]>([]);
  const [rows, setRows] = useState<AngkutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<TransportFilters>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    return {
      searchTerm: "",
      selectedCompanyId: "ALL",
      selectedEstateId: "ALL",
      selectedDivisionId: "ALL",
      startDate: today,
      endDate: today,
    };
  });

  // Fetch initial data
  useEffect(() => {
    Promise.all([api.companies(), api.estates(), api.angkutList()])
      .then(([c, e, r]) => {
        setCompanies(c);
        setEstates(e);
        setRows(r);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Create derived data with company and estate names
  const derivedData = useMemo<DerivedRow[]>(() => {
    return rows.map((row) => {
      const company = companies.find((c) => c._id === row.companyId);
      const estate = estates.find((e) => e._id === row.estateId);

      return {
        ...row,
        id: (row as any)._id || Math.random().toString(36),
        companyName: company?.company_name || row.companyId || "-",
        estateName: estate?.estate_name || row.estateId || "-",
      };
    });
  }, [rows, companies, estates]);

  // Apply filters
  const filteredData = useMemo(() => {
    let filtered = derivedData;

    // Company filter
    if (filters.selectedCompanyId && filters.selectedCompanyId !== "ALL") {
      filtered = filtered.filter(
        (r) => r.companyId === filters.selectedCompanyId,
      );
    }

    // Estate filter
    if (filters.selectedEstateId && filters.selectedEstateId !== "ALL") {
      filtered = filtered.filter(
        (r) => r.estateId === filters.selectedEstateId,
      );
    }

    // Division filter
    if (filters.selectedDivisionId && filters.selectedDivisionId !== "ALL") {
      filtered = filtered.filter(
        (r) => String(r.division_id) === filters.selectedDivisionId,
      );
    }

    // Date range filter
    if (filters.startDate) {
      const startMs = filters.startDate.getTime();
      filtered = filtered.filter((r) => {
        const d1 = r.date_panen ? new Date(r.date_panen).getTime() : 0;
        const d2 = r.date_angkut ? new Date(r.date_angkut).getTime() : 0;
        return d1 >= startMs || d2 >= startMs;
      });
    }

    if (filters.endDate) {
      const endMs = filters.endDate.getTime() + 86400000; // +1 day
      filtered = filtered.filter((r) => {
        const d1 = r.date_panen ? new Date(r.date_panen).getTime() : 0;
        const d2 = r.date_angkut ? new Date(r.date_angkut).getTime() : 0;
        return d1 < endMs || d2 < endMs;
      });
    }

    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.companyName.toLowerCase().includes(term) ||
          r.estateName.toLowerCase().includes(term) ||
          r.block_no?.toLowerCase().includes(term) ||
          r.division_id?.toString().toLowerCase().includes(term) ||
          r.notes?.toLowerCase().includes(term),
      );
    }

    // Sort by date ascending (oldest first)
    filtered.sort((a, b) => {
      const dateA = a.date_angkut ? new Date(a.date_angkut).getTime() : 0;
      const dateB = b.date_angkut ? new Date(b.date_angkut).getTime() : 0;
      return dateA - dateB;
    });

    return filtered;
  }, [derivedData, filters]);

  // Get unique divisions based on selected company
  const divisions = useMemo(() => {
    let data = derivedData;

    // Filter by selected company if any
    if (filters.selectedCompanyId && filters.selectedCompanyId !== "ALL") {
      data = data.filter((r) => r.companyId === filters.selectedCompanyId);
    }

    // Extract unique division IDs
    const uniqueDivisions = Array.from(
      new Set(
        data
          .map((r) => r.division_id)
          .filter((d) => d !== null && d !== undefined && d !== "")
          .map((d) => String(d)),
      ),
    ).sort();

    return uniqueDivisions;
  }, [derivedData, filters.selectedCompanyId]);

  const updateFilters = (newFilters: Partial<TransportFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      const [c, e, r] = await Promise.all([
        api.companies(),
        api.estates(),
        api.angkutList(),
      ]);
      setCompanies(c);
      setEstates(e);
      setRows(r);
    } catch (err) {
      console.error("Error refreshing data:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addRows = (newRows: AngkutRow[]) => {
    setRows((prev) => [...prev, ...newRows]);
  };

  const updateRow = async (rowId: string, updates: Partial<AngkutRow>) => {
    try {
      await api.angkutUpdate(rowId, updates);
      setRows((prev) =>
        prev.map((r) => ((r as any)._id === rowId ? { ...r, ...updates } : r)),
      );
    } catch (err) {
      console.error("Error updating row:", err);
      throw err;
    }
  };

  const deleteRow = async (rowId: string) => {
    try {
      // TODO: Implement API endpoint for angkutDelete
      console.warn("angkutDelete not implemented in API yet");
      // await api.angkutDelete(rowId);
      setRows((prev) => prev.filter((r) => (r as any)._id !== rowId));
    } catch (err) {
      console.error("Error deleting row:", err);
      throw err;
    }
  };

  return {
    companies,
    estates,
    divisions,
    derivedData,
    filteredData,
    filters,
    loading,
    updateFilters,
    refreshData,
    addRows,
    updateRow,
    deleteRow,
  };
}
