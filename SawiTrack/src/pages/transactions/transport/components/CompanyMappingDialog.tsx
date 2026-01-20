import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { CompanyMappingDialogProps, CompanyMappingInput } from "../types";

export function CompanyMappingDialog({
  isOpen,
  onClose,
  onConfirm,
  unresolvedCompanies = [],
  resolvedCompanies = [],
  availableCompanies = [],
  isLoading = false,
}: CompanyMappingDialogProps) {
  const [mappings, setMappings] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  // Reset mappings when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      const initialMappings = new Map<string, string>();
      unresolvedCompanies.forEach((uc) => {
        if (uc.suggestedCompanyId) {
          initialMappings.set(uc.excelName, uc.suggestedCompanyId);
        }
      });
      setMappings(initialMappings);
    }
  }, [isOpen, unresolvedCompanies]);

  const handleMappingChange = (excelName: string, companyId: string) => {
    setMappings((prev) => {
      const updated = new Map(prev);
      updated.set(excelName, companyId);
      return updated;
    });
  };

  const handleConfirm = async () => {
    // Validate all companies are mapped
    const allMapped = unresolvedCompanies.every((uc) =>
      mappings.has(uc.excelName),
    );

    if (!allMapped) {
      alert("Silakan pilih PT master untuk semua nama PT yang tidak dikenal");
      return;
    }

    // Convert to array format with company names
    const mappingArray: CompanyMappingInput[] = Array.from(
      mappings.entries(),
    ).map(([aliasName, companyId]) => {
      // Find the company name from availableCompanies
      const company = availableCompanies.find((c) => c._id === companyId);
      return {
        aliasName,
        companyId,
        companyName: company?.company_name || aliasName, // Fallback to aliasName if not found
      };
    });

    setIsSaving(true);
    try {
      await onConfirm(mappingArray);
    } catch (error) {
      console.error("Error saving mappings:", error);
      alert("Gagal menyimpan pemetaan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  // All mapped if either: no unresolved, or all unresolved are mapped
  const allMapped =
    unresolvedCompanies.length === 0 ||
    unresolvedCompanies.every((uc) => mappings.has(uc.excelName));

  const hasUnresolved = unresolvedCompanies.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasUnresolved ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {hasUnresolved ? "Pemetaan Nama PT" : "Verifikasi PT"}
          </DialogTitle>
          <DialogDescription>
            {hasUnresolved
              ? "Beberapa nama PT di Excel tidak ditemukan di database. Silakan pilih PT master untuk setiap nama yang tidak dikenal."
              : "Semua PT berhasil dikenali. Klik 'Lanjut Import' untuk melanjutkan proses import."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resolved Companies Section */}
          {resolvedCompanies.length > 0 && (
            <div className="rounded-lg border">
              <button
                className="flex w-full items-center justify-between gap-2 p-4 hover:bg-gray-50 transition-colors"
                onClick={() => setShowResolved(!showResolved)}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-gray-900">
                    Auto-Resolved ({resolvedCompanies.length})
                  </span>
                  <span className="text-sm text-gray-500">
                    - Sudah dikenali otomatis
                  </span>
                </div>
                {showResolved ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {showResolved && (
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[45%]">Nama di Excel</TableHead>
                        <TableHead className="w-[15%] text-center">
                          Metode
                        </TableHead>
                        <TableHead className="w-[40%]">PT Master</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedCompanies.map((resolved) => {
                        const getBadgeColor = (source: string) => {
                          switch (source) {
                            case "exact":
                              return "bg-green-100 text-green-800";
                            case "alias":
                              return "bg-blue-100 text-blue-800";
                            case "fuzzy":
                              return "bg-purple-100 text-purple-800";
                            case "normalized":
                              return "bg-yellow-100 text-yellow-800";
                            default:
                              return "bg-gray-100 text-gray-800";
                          }
                        };

                        const getBadgeLabel = (source: string) => {
                          switch (source) {
                            case "exact":
                              return "Exact Match";
                            case "alias":
                              return "Alias";
                            case "fuzzy":
                              return "Smart Match";
                            case "normalized":
                              return "Normalized";
                            default:
                              return source;
                          }
                        };

                        return (
                          <TableRow key={resolved.excelName}>
                            <TableCell className="font-medium text-gray-700">
                              {resolved.excelName}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getBadgeColor(
                                  resolved.source,
                                )}`}
                              >
                                {getBadgeLabel(resolved.source)}
                              </span>
                            </TableCell>
                            <TableCell className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span>{resolved.companyName}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* Unresolved Companies Section */}
          {unresolvedCompanies.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Nama di Excel</TableHead>
                    <TableHead className="w-[15%] text-center">
                      Status
                    </TableHead>
                    <TableHead className="w-[45%]">Pilih PT Master</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unresolvedCompanies.map((unresolved) => {
                    const selectedId = mappings.get(unresolved.excelName);
                    const hasSuggestion = !!unresolved.suggestedCompanyId;

                    return (
                      <TableRow key={unresolved.excelName}>
                        <TableCell className="font-medium">
                          {unresolved.excelName}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={selectedId || ""}
                              onValueChange={(value) =>
                                handleMappingChange(unresolved.excelName, value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih PT..." />
                              </SelectTrigger>
                              <SelectContent>
                                {/* Option to create new PT */}
                                <SelectItem
                                  key="__CREATE_NEW__"
                                  value={`__CREATE_NEW__:${unresolved.excelName}`}
                                  className="text-green-700 font-medium"
                                >
                                  + Buat PT Baru: "{unresolved.excelName}"
                                </SelectItem>
                                {/* Existing companies */}
                                {availableCompanies.map((company) => (
                                  <SelectItem
                                    key={company._id}
                                    value={company._id}
                                  >
                                    {company.company_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {hasSuggestion &&
                              selectedId === unresolved.suggestedCompanyId && (
                                <span
                                  className="text-xs text-blue-600 whitespace-nowrap"
                                  title="Saran sistem"
                                >
                                  (Saran)
                                </span>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Info Tip */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Tip:</strong> Pemetaan ini akan disimpan untuk upload
              Excel berikutnya. Saat Anda upload file dengan nama PT yang sama,
              sistem akan otomatis mengenali dan menggunakan pemetaan yang sudah
              Anda buat.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving || isLoading}
          >
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allMapped || isSaving || isLoading}
          >
            {isSaving
              ? "Menyimpan..."
              : hasUnresolved
                ? "Simpan & Lanjutkan"
                : "Lanjut Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
