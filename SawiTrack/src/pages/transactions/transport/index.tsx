/**
 * Transport Management Page
 * Main component with refactored modular structure
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Download, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";

// Import modular components
import { TransportFilters } from "./components/TransportFilters";
import { TransportTable } from "./components/TransportTable";
import { ImportPreviewDialog } from "./components/ImportPreviewDialog";
import { CompanyMappingDialog } from "./components/CompanyMappingDialog";

// Import hooks
import { useTransportData } from "./hooks/useTransportData";
import { useExcelImport } from "./hooks/useExcelImport";

// Import types
import type { DerivedRow, PaginationState } from "./types";

export default function TransportPage() {
  const { toast } = useToast();

  // Data management
  const {
    companies,
    estates,
    divisions,
    filteredData,
    filters,
    loading,
    updateFilters,
    refreshData,
    addRows,
    updateRow,
  } = useTransportData();

  // Excel import with chunking
  const {
    previewData,
    isPreviewOpen,
    isImporting,
    handleExcelUpload,
    handleConfirmImport,
    downloadTemplate,
    closePreview,
    // Company mapping
    isMappingDialogOpen,
    unresolvedCompanies,
    resolvedCompanies,
    handleMappingConfirm,
    closeMappingDialog,
  } = useExcelImport((rows) => {
    addRows(rows);
    refreshData();
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const pagination = useMemo<PaginationState>(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredData.length / itemsPerPage),
    );
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);

    return {
      currentPage,
      itemsPerPage,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [currentPage, filteredData.length]);

  const paginatedData = useMemo(() => {
    return filteredData.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredData, pagination]);

  // Reset to page 1 when filters change
  // (No effect needed - user manually changes page)

  // Manual entry dialog
  const [manualDialog, setManualDialog] = useState<{
    isOpen: boolean;
    row?: DerivedRow;
    // Main fields
    companyId: string;
    date_angkut: string;
    division_id: string;
    block_no: string;
    jumlah: string;
    no_spb: string;
    // Notes fields
    no_mobil: string;
    nama_supir: string;
    tahun: string;
    brondolan: string;
    beratDiKirim: string;
    no_tiket: string;
    code: string;
    bruto: string;
    tarra: string;
    netto: string;
    potongan: string;
    berat: string;
    tonase: string;
    jjg: string;
  }>({
    isOpen: false,
    companyId: "",
    date_angkut: "",
    division_id: "",
    block_no: "",
    jumlah: "",
    no_spb: "",
    no_mobil: "",
    nama_supir: "",
    tahun: "",
    brondolan: "",
    beratDiKirim: "",
    no_tiket: "",
    code: "",
    bruto: "",
    tarra: "",
    netto: "",
    potongan: "",
    berat: "",
    tonase: "",
    jjg: "",
  });

  const openManualDialog = (row?: DerivedRow) => {
    if (row) {
      // Parse existing notes
      const noteVal = (key: string) => {
        if (!row.notes) return "";
        const pairs = row.notes.split(";").map((s) => s.trim());
        for (const p of pairs) {
          const [k, v] = p.split("=");
          if (k?.trim().toLowerCase() === key.toLowerCase()) {
            return v?.trim() || "";
          }
        }
        return "";
      };

      setManualDialog({
        isOpen: true,
        row,
        // Main fields
        companyId: row.companyId || "",
        date_angkut: row.date_angkut
          ? String(row.date_angkut).slice(0, 10)
          : "",
        division_id: String(row.division_id || ""),
        block_no: row.block_no || "",
        jumlah: String(row.jumlah || ""),
        no_spb: row.no_spb || "",
        // Notes fields
        no_mobil: noteVal("no_mobil"),
        nama_supir: noteVal("nama_supir") || noteVal("supir"),
        tahun: noteVal("tahun"),
        brondolan: noteVal("brondolan"),
        beratDiKirim: noteVal("beratdikirim") || noteVal("berat_di"),
        no_tiket: noteVal("no_tiket"),
        code: noteVal("code"),
        bruto: noteVal("bruto"),
        tarra: noteVal("tarra"),
        netto: noteVal("netto"),
        potongan: noteVal("potongan") || noteVal("poto"),
        berat: noteVal("berat"),
        tonase: noteVal("tonase"),
        jjg: noteVal("jjg"),
      });
    } else {
      setManualDialog({
        isOpen: true,
        companyId: "",
        date_angkut: "",
        division_id: "",
        block_no: "",
        jumlah: "",
        no_spb: "",
        no_mobil: "",
        nama_supir: "",
        tahun: "",
        brondolan: "",
        beratDiKirim: "",
        no_tiket: "",
        code: "",
        bruto: "",
        tarra: "",
        netto: "",
        potongan: "",
        berat: "",
        tonase: "",
        jjg: "",
      });
    }
  };

  const handleManualSubmit = async () => {
    if (!manualDialog.row) return;

    try {
      // Parse existing notes
      const existingNotes = manualDialog.row.notes || "";
      const notePairs = existingNotes
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Remove old values for all editable fields
      const filtered = notePairs.filter((p) => {
        const key = p.split("=")[0]?.trim().toLowerCase();
        return ![
          "no_mobil",
          "nama_supir",
          "supir",
          "tahun",
          "brondolan",
          "beratdikirim",
          "berat_di",
          "no_tiket",
          "code",
          "bruto",
          "tarra",
          "netto",
          "potongan",
          "poto",
          "berat",
          "tonase",
          "jjg",
        ].includes(key);
      });

      // Add new values
      if (manualDialog.no_mobil)
        filtered.push(`no_mobil=${manualDialog.no_mobil}`);
      if (manualDialog.nama_supir)
        filtered.push(`supir=${manualDialog.nama_supir}`);
      if (manualDialog.tahun) filtered.push(`tahun=${manualDialog.tahun}`);
      if (manualDialog.brondolan)
        filtered.push(`brondolan=${manualDialog.brondolan}`);
      if (manualDialog.beratDiKirim)
        filtered.push(`beratdikirim=${manualDialog.beratDiKirim}`);
      if (manualDialog.no_tiket)
        filtered.push(`no_tiket=${manualDialog.no_tiket}`);
      if (manualDialog.code) filtered.push(`code=${manualDialog.code}`);
      if (manualDialog.bruto) filtered.push(`bruto=${manualDialog.bruto}`);
      if (manualDialog.tarra) filtered.push(`tarra=${manualDialog.tarra}`);
      if (manualDialog.netto) filtered.push(`netto=${manualDialog.netto}`);
      if (manualDialog.potongan)
        filtered.push(`potongan=${manualDialog.potongan}`);
      if (manualDialog.berat) filtered.push(`berat=${manualDialog.berat}`);
      if (manualDialog.tonase) filtered.push(`tonase=${manualDialog.tonase}`);
      if (manualDialog.jjg) filtered.push(`jjg=${manualDialog.jjg}`);

      const newNotes = filtered.join("; ");

      // Update both main fields and notes
      await updateRow(manualDialog.row.id, {
        companyId: manualDialog.companyId,
        date_angkut: manualDialog.date_angkut,
        division_id: manualDialog.division_id,
        block_no: manualDialog.block_no,
        jumlah: Number(manualDialog.jumlah) || 0,
        no_spb: manualDialog.no_spb,
        notes: newNotes,
      });

      toast({
        title: "Data berhasil diupdate",
      });

      setManualDialog({
        isOpen: false,
        companyId: "",
        date_angkut: "",
        division_id: "",
        block_no: "",
        jumlah: "",
        no_spb: "",
        no_mobil: "",
        nama_supir: "",
        tahun: "",
        brondolan: "",
        beratDiKirim: "",
        no_tiket: "",
        code: "",
        bruto: "",
        tarra: "",
        netto: "",
        potongan: "",
        berat: "",
        tonase: "",
        jjg: "",
      });
    } catch (error) {
      console.error("Error updating row:", error);
      toast({
        title: "Gagal mengupdate data",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Data Angkutan");

      // Define columns
      worksheet.columns = [
        { header: "PT", key: "pt", width: 20 },
        { header: "Tanggal", key: "tanggal", width: 12 },
        { header: "Divisi", key: "divisi", width: 10 },
        { header: "Driver", key: "driver", width: 20 },
        { header: "No. Kendaraan", key: "no_kendaraan", width: 15 },
        { header: "No SPB", key: "no_spb", width: 20 },
        { header: "Block", key: "block", width: 10 },
        { header: "Tahun", key: "tahun", width: 10 },
        { header: "Jumlah", key: "jumlah", width: 10 },
        { header: "Brondolan (kg)", key: "brondolan", width: 15 },
        { header: "Berat Di Kirim (kg)", key: "berat_di_kirim", width: 18 },
        { header: "No. Tiket", key: "no_tiket", width: 20 },
        { header: "Code", key: "code", width: 25 },
        { header: "BRUTO (kg)", key: "bruto", width: 12 },
        { header: "TARRA (kg)", key: "tarra", width: 12 },
        { header: "NETTO (kg)", key: "netto", width: 12 },
        { header: "POTONGAN", key: "potongan", width: 12 },
        { header: "Berat", key: "berat", width: 12 },
        { header: "TONASE", key: "tonase", width: 12 },
        { header: "Janjang", key: "janjang", width: 12 },
      ];

      // Helper function to extract values from notes
      const noteVal = (notes: string | undefined, key: string): string => {
        if (!notes) return "";
        const pairs = notes.split(";").map((s) => s.trim());
        for (const p of pairs) {
          const [k, v] = p.split("=");
          if (k?.trim().toLowerCase() === key.toLowerCase()) {
            return v?.trim() || "";
          }
        }
        return "";
      };

      // Add data rows
      filteredData.forEach((row) => {
        worksheet.addRow({
          pt: row.companyName,
          tanggal: row.date_angkut
            ? String(row.date_angkut)
                .slice(0, 10)
                .split("-")
                .reverse()
                .join("-")
            : "",
          divisi: row.division_id || "",
          driver:
            noteVal(row.notes, "nama_supir") || noteVal(row.notes, "supir"),
          no_kendaraan: noteVal(row.notes, "no_mobil"),
          no_spb: row.no_spb || "",
          block: row.block_no || "",
          tahun: noteVal(row.notes, "tahun"),
          jumlah: row.jumlah || "",
          brondolan: noteVal(row.notes, "brondolan"),
          berat_di_kirim:
            noteVal(row.notes, "beratdikirim") ||
            noteVal(row.notes, "berat_di"),
          no_tiket: noteVal(row.notes, "no_tiket"),
          code: noteVal(row.notes, "code"),
          bruto: noteVal(row.notes, "bruto"),
          tarra: noteVal(row.notes, "tarra"),
          netto: noteVal(row.notes, "netto"),
          potongan:
            noteVal(row.notes, "potongan") || noteVal(row.notes, "poto"),
          berat: noteVal(row.notes, "berat"),
          tonase: noteVal(row.notes, "tonase"),
          janjang: noteVal(row.notes, "jjg"),
        });
      });

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF16A34A" }, // Green background
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Data_Angkutan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export berhasil",
        description: `${filteredData.length} data berhasil diekspor`,
      });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast({
        title: "Gagal export",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Angkutan</h1>
          <p className="text-sm text-muted-foreground">
            Kelola data transportasi hasil panen
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-800"
          >
            <Download className="mr-2 h-4 w-4" />
            Template Excel
          </Button>
          <Button
            variant="outline"
            asChild
            className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-800"
          >
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button
            onClick={handleExportExcel}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button onClick={() => openManualDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Manual
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Data</CardTitle>
        </CardHeader>
        <CardContent>
          <TransportFilters
            filters={filters}
            onFiltersChange={updateFilters}
            companies={companies}
            estates={estates}
            divisions={divisions}
          />
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Angkutan ({filteredData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <TransportTable
            data={paginatedData}
            pagination={pagination}
            onPageChange={setCurrentPage}
            onRowEdit={openManualDialog}
            onRowDelete={async (id) => {
              // TODO: Implement delete
              console.log("Delete row:", id);
            }}
          />
        </CardContent>
      </Card>

      {/* Import Preview Dialog */}
      <ImportPreviewDialog
        isOpen={isPreviewOpen}
        onClose={closePreview}
        onConfirm={handleConfirmImport}
        data={previewData}
        isLoading={isImporting}
      />

      {/* Company Mapping Dialog */}
      <CompanyMappingDialog
        isOpen={isMappingDialogOpen}
        onClose={closeMappingDialog}
        onConfirm={handleMappingConfirm}
        unresolvedCompanies={unresolvedCompanies}
        resolvedCompanies={resolvedCompanies}
        availableCompanies={companies}
      />

      {/* Manual Entry Dialog */}
      <Dialog
        open={manualDialog.isOpen}
        onOpenChange={(open) =>
          !open &&
          setManualDialog({
            isOpen: false,
            companyId: "",
            date_angkut: "",
            division_id: "",
            block_no: "",
            jumlah: "",
            no_spb: "",
            no_mobil: "",
            nama_supir: "",
            tahun: "",
            brondolan: "",
            beratDiKirim: "",
            no_tiket: "",
            code: "",
            bruto: "",
            tarra: "",
            netto: "",
            potongan: "",
            berat: "",
            tonase: "",
            jjg: "",
          })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {manualDialog.row
                ? "Edit Data Transport"
                : "Tambah Data Transport"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1">
            {/* Main Fields Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Data Utama:</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="companyId">PT *</Label>
                  <Select
                    value={manualDialog.companyId}
                    onValueChange={(value) =>
                      setManualDialog((prev) => ({
                        ...prev,
                        companyId: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih PT" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company._id} value={company._id}>
                          {company.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_angkut">Tanggal Angkut *</Label>
                  <Input
                    id="date_angkut"
                    type="date"
                    value={manualDialog.date_angkut}
                    onChange={(e) =>
                      setManualDialog((prev) => ({
                        ...prev,
                        date_angkut: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="division_id">Divisi</Label>
                  <Input
                    id="division_id"
                    value={manualDialog.division_id}
                    onChange={(e) =>
                      setManualDialog((prev) => ({
                        ...prev,
                        division_id: e.target.value,
                      }))
                    }
                    placeholder="Divisi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block_no">Block</Label>
                  <Input
                    id="block_no"
                    value={manualDialog.block_no}
                    onChange={(e) =>
                      setManualDialog((prev) => ({
                        ...prev,
                        block_no: e.target.value,
                      }))
                    }
                    placeholder="Block"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jumlah">Jumlah (Janjang)</Label>
                  <Input
                    id="jumlah"
                    type="number"
                    value={manualDialog.jumlah}
                    onChange={(e) =>
                      setManualDialog((prev) => ({
                        ...prev,
                        jumlah: e.target.value,
                      }))
                    }
                    placeholder="Jumlah"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="no_spb">No SPB</Label>
                  <Input
                    id="no_spb"
                    value={manualDialog.no_spb}
                    onChange={(e) =>
                      setManualDialog((prev) => ({
                        ...prev,
                        no_spb: e.target.value,
                      }))
                    }
                    placeholder="No SPB"
                  />
                </div>
              </div>
            </div>

            {/* Notes Fields Section */}
            <h4 className="font-semibold text-sm">Data Tambahan:</h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="no_mobil">No. Mobil</Label>
                <Input
                  id="no_mobil"
                  value={manualDialog.no_mobil}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      no_mobil: e.target.value,
                    }))
                  }
                  placeholder="Masukkan nomor mobil"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama_supir">Nama Supir</Label>
                <Input
                  id="nama_supir"
                  value={manualDialog.nama_supir}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      nama_supir: e.target.value,
                    }))
                  }
                  placeholder="Masukkan nama supir"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tahun">Tahun</Label>
                <Input
                  id="tahun"
                  value={manualDialog.tahun}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      tahun: e.target.value,
                    }))
                  }
                  placeholder="Tahun"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brondolan">Brondolan (kg)</Label>
                <Input
                  id="brondolan"
                  type="number"
                  value={manualDialog.brondolan}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      brondolan: e.target.value,
                    }))
                  }
                  placeholder="Brondolan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="beratDiKirim">Berat Di Kirim (kg)</Label>
                <Input
                  id="beratDiKirim"
                  type="number"
                  value={manualDialog.beratDiKirim}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      beratDiKirim: e.target.value,
                    }))
                  }
                  placeholder="Berat di kirim"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no_tiket">No. Tiket</Label>
                <Input
                  id="no_tiket"
                  value={manualDialog.no_tiket}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      no_tiket: e.target.value,
                    }))
                  }
                  placeholder="No. tiket"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={manualDialog.code}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      code: e.target.value,
                    }))
                  }
                  placeholder="Code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bruto">Bruto (kg)</Label>
                <Input
                  id="bruto"
                  type="number"
                  step="0.01"
                  value={manualDialog.bruto}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      bruto: e.target.value,
                    }))
                  }
                  placeholder="Bruto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarra">Tarra (kg)</Label>
                <Input
                  id="tarra"
                  type="number"
                  step="0.01"
                  value={manualDialog.tarra}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      tarra: e.target.value,
                    }))
                  }
                  placeholder="Tarra"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="netto">Netto (kg)</Label>
                <Input
                  id="netto"
                  type="number"
                  step="0.01"
                  value={manualDialog.netto}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      netto: e.target.value,
                    }))
                  }
                  placeholder="Netto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="potongan">Potongan</Label>
                <Input
                  id="potongan"
                  type="number"
                  step="0.01"
                  value={manualDialog.potongan}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      potongan: e.target.value,
                    }))
                  }
                  placeholder="Potongan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="berat">Berat</Label>
                <Input
                  id="berat"
                  type="number"
                  step="0.01"
                  value={manualDialog.berat}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      berat: e.target.value,
                    }))
                  }
                  placeholder="Berat"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tonase">Tonase</Label>
                <Input
                  id="tonase"
                  value={manualDialog.tonase}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      tonase: e.target.value,
                    }))
                  }
                  placeholder="Tonase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jjg">Janjang</Label>
                <Input
                  id="jjg"
                  type="number"
                  value={manualDialog.jjg}
                  onChange={(e) =>
                    setManualDialog((prev) => ({
                      ...prev,
                      jjg: e.target.value,
                    }))
                  }
                  placeholder="Janjang"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setManualDialog({
                  isOpen: false,
                  companyId: "",
                  date_angkut: "",
                  division_id: "",
                  block_no: "",
                  jumlah: "",
                  no_spb: "",
                  no_mobil: "",
                  nama_supir: "",
                  tahun: "",
                  brondolan: "",
                  beratDiKirim: "",
                  no_tiket: "",
                  code: "",
                  bruto: "",
                  tarra: "",
                  netto: "",
                  potongan: "",
                  berat: "",
                  tonase: "",
                  jjg: "",
                })
              }
            >
              Batal
            </Button>
            <Button onClick={handleManualSubmit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
