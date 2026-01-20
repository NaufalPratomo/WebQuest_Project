/**
 * Excel Import Hook with Chunking and Pre-fetch Optimization
 * Handles large Excel imports efficiently
 */

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { AngkutRow } from "@/lib/api";
import type {
  ExcelRowData,
  ImportProgress,
  UnresolvedCompany,
  CompanyResolution,
  CompanyMappingInput,
} from "../types";
import { parseExcelFile, generateExcelTemplate } from "../utils/excelParser";
import { processInChunks, formatProgressMessage } from "../utils/chunking";
import {
  prefetchMasterData,
  identifyNewMasterData,
  bulkCreateCompanies,
  bulkCreateEstates,
  updateMasterDataMaps,
  validateAndGetIds,
  buildNotesString,
} from "../utils/dataValidation";
import {
  resolveCompanyNames,
  saveBatchAliases,
} from "../utils/companyAliasApi";

const CHUNK_SIZE = 50; // Process 50 rows per batch

export function useExcelImport(onImportComplete: (rows: AngkutRow[]) => void) {
  const { toast } = useToast();
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    stage: "validating",
  });

  // Company mapping states
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [unresolvedCompanies, setUnresolvedCompanies] = useState<
    UnresolvedCompany[]
  >([]);
  const [resolvedCompanies, setResolvedCompanies] = useState<
    CompanyResolution[]
  >([]);

  /**
   * Handle Excel file upload - resolve companies first, then show preview
   */
  const handleExcelUpload = useCallback(
    async (file: File) => {
      try {
        toast({
          title: "Membaca file Excel...",
          description: "Mohon tunggu",
        });

        const result = await parseExcelFile(file);

        console.log("📊 Parse result:", result);

        if (result.totalRows === 0) {
          toast({
            title: "File kosong",
            description: "File Excel tidak memiliki data",
            variant: "destructive",
          });
          return;
        }

        // Store preview data
        setPreviewData(result.rows);

        // Extract unique company names from Excel data
        const companyNames = Array.from(
          new Set(
            result.rows
              .map((row) => row.pt?.trim())
              .filter((name): name is string => !!name),
          ),
        );

        console.log("🏢 Unique companies from Excel:", companyNames);

        if (companyNames.length === 0) {
          toast({
            title: "Tidak ada nama PT",
            description: "File Excel tidak memiliki data PT",
            variant: "destructive",
          });
          return;
        }

        // Resolve company names against database
        toast({
          title: "Memeriksa nama PT...",
          description: "Mencocokkan dengan database",
        });

        const resolution = await resolveCompanyNames(companyNames);

        console.log("✅ Company resolution:", resolution);

        setResolvedCompanies(resolution.resolved);

        // If there are unresolved companies, show mapping dialog first
        if (resolution.unresolved.length > 0) {
          // First, update preview data with already-resolved company names
          const nameMappingLookup = new Map<string, string>();
          resolution.resolved.forEach((res) => {
            nameMappingLookup.set(res.excelName.toLowerCase(), res.companyName);
          });

          // Update previewData to use database PT names for resolved companies
          const updatedPreviewData = result.rows.map((row) => {
            if (row.pt) {
              const ptLower = row.pt.toLowerCase();
              const mappedName = nameMappingLookup.get(ptLower);
              if (mappedName) {
                return { ...row, pt: mappedName };
              }
            }
            return row;
          });

          setPreviewData(updatedPreviewData);

          const unresolved: UnresolvedCompany[] = resolution.unresolved.map(
            (name) => ({
              excelName: name,
              suggestedCompanyId: undefined,
              suggestedCompanyName: undefined,
            }),
          );

          setUnresolvedCompanies(unresolved);
          setIsMappingDialogOpen(true);

          toast({
            title: "Pemetaan PT diperlukan",
            description: `${resolution.unresolved.length} nama PT tidak dikenali`,
          });
        } else {
          // All companies resolved, update preview data with database PT names
          const nameMappingLookup = new Map<string, string>();
          resolution.resolved.forEach((res) => {
            nameMappingLookup.set(res.excelName.toLowerCase(), res.companyName);
          });

          // Update previewData to use database PT names
          const updatedPreviewData = result.rows.map((row) => {
            if (row.pt) {
              const ptLower = row.pt.toLowerCase();
              const mappedName = nameMappingLookup.get(ptLower);
              if (mappedName) {
                return { ...row, pt: mappedName };
              }
            }
            return row;
          });

          setPreviewData(updatedPreviewData);
          setIsPreviewOpen(true);

          toast({
            title: "File berhasil dibaca",
            description: `Ditemukan ${result.totalRows} baris (${result.validRows} valid, ${result.invalidRows} tidak lengkap)`,
          });
        }

        console.log("✅ Preview data set:", result.rows.length, "rows");
        console.log("🔍 First row in preview:", result.rows[0]);
      } catch (error) {
        console.error("Error reading Excel:", error);
        toast({
          title: "Gagal membaca file",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  /**
   * Confirm and process import with chunking and optimization
   */
  const handleConfirmImport = useCallback(async () => {
    if (previewData.length === 0) return;

    setIsImporting(true);
    let toastId: any = null;

    try {
      // Step 1: Pre-fetch all master data (companies & estates)
      setProgress({
        current: 0,
        total: previewData.length,
        percentage: 0,
        stage: "validating",
      });

      toast({
        title: "Memvalidasi data master...",
        description: "Mengambil daftar PT dan Estate",
      });

      let masterData = await prefetchMasterData();

      // Step 2: Identify new estates only (companies must be mapped via dialog)
      masterData = identifyNewMasterData(previewData, masterData);

      const newEstatesCount = masterData.newEstates.size;

      if (newEstatesCount > 0) {
        toast({
          title: "Estate baru terdeteksi",
          description: `${newEstatesCount} Estate baru akan dibuat`,
        });
      }

      // Note: Companies are NOT auto-created anymore
      // All unrecognized company names must be mapped via the company mapping dialog

      // Step 3: Bulk create new estates
      if (newEstatesCount > 0) {
        setProgress({
          current: 0,
          total: newEstatesCount,
          percentage: 0,
          stage: "creating-estates",
        });

        const newEstates = await bulkCreateEstates(
          masterData.newEstates,
          masterData.companyMap,
          (current, total) => {
            setProgress({
              current,
              total,
              percentage: Math.round((current / total) * 100),
              stage: "creating-estates",
            });
          },
        );

        masterData = updateMasterDataMaps(masterData, new Map(), newEstates);

        toast({
          title: `${newEstates.size} Estate baru berhasil dibuat`,
        });
      }

      // Step 4: Process rows in chunks
      setProgress({
        current: 0,
        total: previewData.length,
        percentage: 0,
        stage: "uploading",
      });

      toastId = toast({
        title: "Mengimport data...",
        description: formatProgressMessage(progress),
        duration: Infinity,
      });

      const createdRows = await processInChunks(
        previewData,
        CHUNK_SIZE,
        async (chunk) => {
          // Process chunk concurrently
          const results = await Promise.all(
            chunk.map(async (row) => {
              try {
                // Validate and get IDs from pre-fetched maps
                const ids = validateAndGetIds(row, masterData);
                if (!ids) {
                  console.warn("Invalid row (missing PT/Estate):", row);
                  return null;
                }

                // Parse dates
                const date_panen = row.date_panen
                  ? new Date(row.date_panen).toISOString().split("T")[0]
                  : "";
                const date_angkut = row.date_angkut
                  ? new Date(row.date_angkut).toISOString().split("T")[0]
                  : "";

                // Build notes string with all additional fields
                const notes = buildNotesString(row);

                // Create angkut row
                const angkutRow = await api.angkutCreate({
                  companyId: ids.companyId,
                  estateId: ids.estateId,
                  date_panen: date_panen || date_angkut,
                  date_angkut: date_angkut || date_panen,
                  division_id: row.division_id || "",
                  block_no: row.block_no || "",
                  no_spb: row.no_spb || "",
                  jumlah: Number(row.jumlah) || 0,
                  weightKg: (Number(row.jumlah) || 0) * 15, // Assume 15kg per bunch
                  notes,
                });

                // Create corresponding panen row for RealHarvest sync
                if (date_panen && row.no_spb) {
                  try {
                    await api.panenCreate({
                      date_panen: date_panen,
                      estateId: ids.estateId,
                      division_id: row.division_id || "",
                      block_no: row.block_no || "",
                      weightKg: 0,
                      janjangTBS: Number(row.jumlah) || 0,
                      employeeId: "AUTO_IMPORT",
                      employeeName: "Import Excel",
                      mandorName: "System",
                      notes: `Auto-created from transport import: ${notes}`,
                    });
                  } catch (err) {
                    console.warn("Failed to create panen row:", err);
                  }
                }

                return angkutRow;
              } catch (error) {
                console.error("Error processing row:", row, error);
                return null;
              }
            }),
          );

          return results.filter((r): r is AngkutRow => r !== null);
        },
        (prog) => {
          setProgress(prog);
          if (toastId) {
            toastId.update({
              id: toastId.id,
              title: "Mengimport data...",
              description: formatProgressMessage(prog),
            });
          }
        },
      );

      // Success
      if (toastId) toastId.dismiss();

      toast({
        title: "Import berhasil",
        description: `${createdRows.length} data berhasil diimport dari ${previewData.length} baris`,
      });

      onImportComplete(createdRows);
      setIsPreviewOpen(false);
      setPreviewData([]);
    } catch (error) {
      console.error("Import error:", error);

      if (toastId) toastId.dismiss();

      toast({
        title: "Import gagal",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setProgress({
        current: 0,
        total: 0,
        percentage: 0,
        stage: "uploading",
      });
    }
  }, [previewData, toast, onImportComplete]);

  /**
   * Download Excel template
   */
  const downloadTemplate = useCallback(async () => {
    try {
      const workbook = generateExcelTemplate();
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Template_Transport_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Template berhasil didownload",
      });
    } catch (error) {
      console.error("Error downloading template:", error);
      toast({
        title: "Gagal download template",
        variant: "destructive",
      });
    }
  }, [toast]);

  /**
   * Handle company mapping confirmation
   */
  const handleMappingConfirm = useCallback(
    async (mappings: CompanyMappingInput[]) => {
      try {
        toast({
          title: "Menyimpan pemetaan PT...",
          description: "Mohon tunggu",
        });

        // Save the mappings to database
        await saveBatchAliases(mappings);

        // Create a mapping lookup: excelName -> databaseCompanyName
        const nameMappingLookup = new Map<string, string>();
        mappings.forEach((mapping) => {
          nameMappingLookup.set(
            mapping.aliasName.toLowerCase(),
            mapping.companyName,
          );
        });

        // Update previewData to replace Excel PT names with database PT names
        setPreviewData((currentPreviewData) => {
          const updatedData = currentPreviewData.map((row) => {
            if (row.pt) {
              const ptLower = row.pt.toLowerCase();
              const mappedName = nameMappingLookup.get(ptLower);
              if (mappedName) {
                return { ...row, pt: mappedName };
              }
            }
            return row;
          });
          return updatedData;
        });

        toast({
          title: "Pemetaan berhasil disimpan",
          description: `${mappings.length} pemetaan PT disimpan`,
        });

        // Close mapping dialog and show preview
        setIsMappingDialogOpen(false);
        setIsPreviewOpen(true);

        toast({
          title: "Siap untuk import",
          description: `${previewData.length} baris siap diimport`,
        });
      } catch (error) {
        console.error("Error saving mappings:", error);
        toast({
          title: "Gagal menyimpan pemetaan",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
        throw error;
      }
    },
    [toast, previewData],
  );

  const closeMappingDialog = useCallback(() => {
    setIsMappingDialogOpen(false);
    setUnresolvedCompanies([]);
    setResolvedCompanies([]);
    setPreviewData([]);
  }, []);

  return {
    previewData,
    isPreviewOpen,
    isImporting,
    progress,
    handleExcelUpload,
    handleConfirmImport,
    downloadTemplate,
    closePreview: () => setIsPreviewOpen(false),
    // Company mapping
    isMappingDialogOpen,
    unresolvedCompanies,
    resolvedCompanies,
    handleMappingConfirm,
    closeMappingDialog,
  };
}
