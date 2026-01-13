import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, AngkutRow } from "@/lib/api";
import { toast } from "sonner";

export default function Transport() {
  type BlockOption = { no_blok?: string; id_blok?: string };
  const [datePanen, setDatePanen] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [dateAngkut, setDateAngkut] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [companies, setCompanies] = useState<
    Array<{ _id: string; company_name: string }>
  >([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [estates, setEstates] = useState<
    Array<{ _id: string; estate_name: string }>
  >([]);
  const [estateId, setEstateId] = useState<string>("");
  const [divisions, setDivisions] = useState<
    Array<{ division_id: number | string }>
  >([]);
  const [divisionId, setDivisionId] = useState<number | string | "">("");
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [blockNo, setBlockNo] = useState("");
  const [noTPH, setNoTPH] = useState("");
  const [jjgAngkut, setJjgAngkut] = useState<number | "">("");
  const [noMobil, setNoMobil] = useState("");
  const [namaSupir, setNamaSupir] = useState("");
  const [rows, setRows] = useState<AngkutRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const harvestStorageKey = useMemo(
    () => `realharvest_rows_${datePanen}`,
    [datePanen]
  );
  // Dialog lengkapi no mobil & supir
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<AngkutRow | null>(null);
  const [editNoMobil, setEditNoMobil] = useState("");
  const [editSupir, setEditSupir] = useState("");

  const exportCsv = () => {
    const header = [
      "PT",
      "TANGGAL",
      "DIVISI",
      "DRIVER",
      "No. Kendaraan",
      "No. SPB",
      "BLOCK",
      "TAHUN",
      "JUMLAH",
      "BRONDOLAN",
      "BERAT DI",
      "No. Tiket",
      "Code",
      "BRUTO",
      "TARRA",
      "NETTO",
      "POTO",
      "Berat",
      "TONASE/",
      "JJG/",
    ];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? "" : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(",")].concat(
      filtered.map((r) =>
        [
          r.companyName || "",
          String(r.date_angkut).slice(0, 10),
          r.division_id,
          noteVal(r.notes, "supir") || noteVal(r.notes, "driver") || "",
          noteVal(r.notes, "no_mobil") ||
            noteVal(r.notes, "no_kendaraan") ||
            "",
          noteVal(r.notes, "no_spb") || "",
          r.block_no,
          noteVal(r.notes, "tahun") || new Date(r.date_panen).getFullYear(),
          r.jjgAngkut || 0,
          noteVal(r.notes, "brondolan") || 0,
          noteVal(r.notes, "berat_di") || r.weightKg || 0,
          noteVal(r.notes, "no_tiket") || "",
          noteVal(r.notes, "code") || "",
          noteVal(r.notes, "bruto") || 0,
          noteVal(r.notes, "tarra") || 0,
          noteVal(r.notes, "netto") || 0,
          noteVal(r.notes, "poto") || 0,
          noteVal(r.notes, "berat") || r.weightKg || 0,
          noteVal(r.notes, "tonase") || r.weightKg / 1000 || 0,
          r.jjgRealisasi || 0,
        ]
          .map(escape)
          .join(",")
      )
    );
    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angkut_${datePanen}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    api
      .companies()
      .then(setCompanies)
      .catch(() => toast.error("Gagal memuat perusahaan"));
    api
      .estates()
      .then(setEstates)
      .catch(() => toast.error("Gagal memuat estate"));
  }, []);

  useEffect(() => {
    if (!estateId) {
      setDivisions([]);
      setDivisionId("");
      return;
    }
    api
      .divisions(estateId)
      .then(setDivisions)
      .catch(() => toast.error("Gagal memuat divisi"));
    api
      .blocks(estateId, divisionId)
      .then((b) => setBlocks(Array.isArray(b) ? (b as BlockOption[]) : []))
      .catch(() => setBlocks([]));
  }, [estateId, divisionId]);

  useEffect(() => {
    // Load angkut rows - RealHarvest already auto-syncs jjgRealisasi
    (async () => {
      try {
        const existing = await api.angkutList({ date_panen: datePanen });
        setRows(existing);
      } catch {
        setRows([]);
      }
    })();
  }, [datePanen]);

  const filtered = useMemo(
    () => rows.filter((r) => String(r.date_panen).startsWith(datePanen)),
    [rows, datePanen]
  );

  // Build derived data including JJG Realisasi and Restan per row
  const derived = useMemo(() => {
    return filtered.map((r) => {
      const jjgRealisasi = Number(r.jjgRealisasi || 0); // Auto from RealHarvest
      const jjgAngkut = Number(r.jjgAngkut || 0); // Manual input by mandor
      const restan = jjgRealisasi - jjgAngkut;
      return { row: r, jjgRealisasi, jjgAngkut, restan };
    });
  }, [filtered]);

  const addRow = async () => {
    try {
      if (!datePanen || !dateAngkut || !estateId || !divisionId || !blockNo) {
        toast.error("Lengkapi input estate/divisi/blok");
        return;
      }
      const selectedCompany = companies.find((c) => c._id === companyId);
      const body: AngkutRow = {
        date_panen: datePanen,
        date_angkut: dateAngkut,
        companyId: companyId || undefined,
        companyName: selectedCompany?.company_name || undefined,
        estateId,
        division_id: divisionId,
        block_no: blockNo,
        noTPH: noTPH || undefined,
        jjgAngkut: Number(jjgAngkut || 0), // Manual input
        weightKg: 0,
      };
      const created = await api.angkutCreate(body);
      toast.success("Tersimpan");
      setRows((prev) =>
        Array.isArray(created)
          ? [...prev, ...created]
          : [...prev, created as AngkutRow]
      );
      setBlockNo("");
      setNoTPH("");
      setJjgAngkut("");
      setNoMobil("");
      setNamaSupir("");
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : "Gagal menyimpan";
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch {
        /* ignore */
      }
      toast.error(msg);
    }
  };

  // Inline update jjgAngkut for a given row, persist to backend
  type AngkutRowWithId = AngkutRow & { _id?: string };
  const updateJjgAngkut = async (r: AngkutRow, value: number) => {
    try {
      const body: Partial<AngkutRow> = {
        jjgAngkut: Math.max(0, Math.floor(value || 0)),
      };
      const rowId = (r as AngkutRowWithId)._id;
      if (rowId) {
        await api.angkutUpdate(rowId, body);
      }
      const latest = await api.angkutList({ date_panen: datePanen });
      setRows(latest);
      toast.success("JJG angkut diperbarui");
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : "Gagal memperbarui JJG angkut";
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch {
        /* ignore */
      }
      toast.error(msg);
    }
  };

  const openComplete = (r: AngkutRow) => {
    setCompleteTarget(r);
    setEditNoMobil(noteVal(r.notes, "no_mobil") || "");
    setEditSupir(noteVal(r.notes, "supir") || "");
    setCompleteOpen(true);
  };

  const saveComplete = async () => {
    if (!completeTarget) return;
    try {
      const notes = [
        editNoMobil ? `no_mobil=${editNoMobil}` : "",
        editSupir ? `supir=${editSupir}` : "",
      ]
        .filter(Boolean)
        .join("; ");

      const rowId = (completeTarget as AngkutRowWithId)._id;
      if (!rowId) {
        toast.error("ID record tidak ditemukan");
        return;
      }

      const body: Partial<AngkutRow> = {
        notes,
      };
      await api.angkutUpdate(rowId, body);
      const latest = await api.angkutList({ date_panen: datePanen });
      setRows(latest);
      toast.success("Data angkut diperbarui");
      setCompleteOpen(false);
      setCompleteTarget(null);
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : "Gagal menyimpan";
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch {
        /* ignore */
      }
      toast.error(msg);
    }
  };

  const handleExcelUpload = async (file: File) => {
    setUploading(true);
    try {
      const ExcelJS = await import("exceljs");
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("Worksheet tidak ditemukan");

      // Read header
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || "")
          .trim()
          .toLowerCase();
      });

      const idx = (k: string) => {
        const normalized = k.toLowerCase().replace(/[.\s_]/g, "");
        return headers.findIndex(
          (h, i) => h && i > 0 && h.replace(/[.\s_]/g, "") === normalized
        );
      };

      // Required columns from image: PT, TANGGAL, DIVISI, BLOCK
      const requireIdx = (...keys: string[]) => {
        for (const k of keys) {
          if (idx(k) === -1) throw new Error(`Kolom '${k}' tidak ditemukan`);
        }
      };
      requireIdx("pt", "tanggal", "divisi", "block");

      // Load existing companies and estates
      const [existingCompanies, existingEstates] = await Promise.all([
        api.companies(),
        api.estates(),
      ]);

      // Collect rows to process
      const rowsData: Array<{
        pt: string;
        tglAngkut: string;
        estate: string;
        div: string;
        blok: string;
        noTPH: string;
        jjgAngkut: string;
        noMobil: string;
        namaSupir: string;
      }> = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const getCell = (colIdx: number) => {
          const cell = row.getCell(colIdx);
          return cell.value ? String(cell.value).trim() : "";
        };

        const ptVal = idx("pt") >= 0 ? getCell(idx("pt")) : "";
        const tglAngkutVal = idx("tanggal") >= 0 ? getCell(idx("tanggal")) : "";
        const estateVal = idx("estate") >= 0 ? getCell(idx("estate")) : "";
        const divVal = idx("divisi") >= 0 ? getCell(idx("divisi")) : "";
        const blokVal = idx("block") >= 0 ? getCell(idx("block")) : "";
        const noTPHVal = idx("notph") >= 0 ? getCell(idx("notph")) : "";
        const jjgAngkutVal =
          idx("jumlah") >= 0
            ? getCell(idx("jumlah"))
            : idx("jjg") >= 0
            ? getCell(idx("jjg"))
            : "";
        const noMobilVal =
          idx("nokenderaan") >= 0
            ? getCell(idx("nokenderaan"))
            : idx("nomobil") >= 0
            ? getCell(idx("nomobil"))
            : "";
        const namaSupirVal =
          idx("driver") >= 0
            ? getCell(idx("driver"))
            : idx("namasupir") >= 0
            ? getCell(idx("namasupir"))
            : "";

        if (!ptVal || !tglAngkutVal || !divVal || !blokVal) return; // Skip invalid rows

        rowsData.push({
          pt: ptVal,
          tglAngkut: tglAngkutVal,
          estate: estateVal,
          div: divVal,
          blok: blokVal,
          noTPH: noTPHVal,
          jjgAngkut: jjgAngkutVal,
          noMobil: noMobilVal,
          namaSupir: namaSupirVal,
        });
      });

      const parsed: AngkutRow[] = [];

      // Process rows with async operations
      for (const rowData of rowsData) {
        // Division ID can be string or number
        let divisionIdVal: string | number = rowData.div;
        const divNum = Number(rowData.div);
        if (!isNaN(divNum)) {
          divisionIdVal = divNum;
        }

        // Parse date - support multiple formats
        let dateAngkut = rowData.tglAngkut;
        if (rowData.tglAngkut.includes("-")) {
          // Format: 01-Dec-25
          const parts = rowData.tglAngkut.split("-");
          if (parts.length === 3) {
            const months: { [key: string]: string } = {
              jan: "01",
              feb: "02",
              mar: "03",
              apr: "04",
              may: "05",
              jun: "06",
              jul: "07",
              aug: "08",
              sep: "09",
              oct: "10",
              nov: "11",
              dec: "12",
            };
            const day = parts[0].padStart(2, "0");
            const month = months[parts[1].toLowerCase()] || parts[1];
            const year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
            dateAngkut = `${year}-${month}-${day}`;
          }
        } else if (rowData.tglAngkut.includes("/")) {
          const parts = rowData.tglAngkut.split("/");
          if (parts.length === 3) {
            dateAngkut = `${parts[2]}-${parts[1].padStart(
              2,
              "0"
            )}-${parts[0].padStart(2, "0")}`;
          }
        }

        // Validate and auto-create company if needed
        let finalCompanyId = "";
        let finalCompanyName = rowData.pt;

        const existingCompany = existingCompanies.find(
          (c) => c.company_name === rowData.pt
        );
        if (!existingCompany) {
          try {
            const newCompany = await api.createCompany({
              company_name: rowData.pt,
              address: "",
              phone: "",
              email: "",
            });
            existingCompanies.push(newCompany);
            finalCompanyId = newCompany._id;
            toast.success(`PT "${rowData.pt}" berhasil ditambahkan`);
          } catch (e) {
            console.warn("Failed to create company:", e);
          }
        } else {
          finalCompanyId = existingCompany._id;
        }

        // Create estate ID - use divisi name directly if it's a string
        let estateIdVal: string;
        let estateName: string;

        if (rowData.estate) {
          estateIdVal = rowData.estate;
          estateName = rowData.estate;
        } else if (typeof divisionIdVal === "string") {
          // If division is string (like "Asparaga"), use it directly
          estateIdVal = divisionIdVal;
          estateName = divisionIdVal;
        } else {
          // If division is number, create estateId like "divisi1"
          estateIdVal = `divisi${divisionIdVal}`;
          estateName = `Divisi ${divisionIdVal}`;
        }

        // Validate and auto-create estate/division if needed
        if (
          !existingEstates.find(
            (e) => e._id === estateIdVal || e.estate_name === estateName
          )
        ) {
          try {
            await api.createEstate({
              _id: estateIdVal,
              estate_name: estateName,
              divisions: [],
            });
            existingEstates.push({ _id: estateIdVal, estate_name: estateName });
            toast.success(`Estate/Divisi "${estateName}" berhasil ditambahkan`);
          } catch (e) {
            console.warn("Failed to create estate:", e);
          }
        }

        // Build notes string for driver and vehicle
        const additionalNotes: string[] = [];
        if (rowData.namaSupir)
          additionalNotes.push(`supir=${rowData.namaSupir}`);
        if (rowData.noMobil)
          additionalNotes.push(`no_mobil=${rowData.noMobil}`);
        const notesStr = additionalNotes.join("; ");

        parsed.push({
          date_panen: dateAngkut, // Same as date_angkut
          date_angkut: dateAngkut,
          companyId: finalCompanyId || undefined,
          companyName: finalCompanyName || undefined,
          estateId: estateIdVal,
          division_id: divisionIdVal,
          block_no: rowData.blok,
          noTPH: rowData.noTPH || undefined,
          weightKg: 0, // Not in the image columns
          jjgAngkut: Number(rowData.jjgAngkut || 0),
          notes: notesStr || undefined,
        } as AngkutRow);
      }

      const filtered = parsed.filter(
        (r) =>
          r.date_panen &&
          r.date_angkut &&
          r.estateId &&
          r.division_id &&
          r.block_no
      );

      if (filtered.length === 0) {
        toast.error(
          "Tidak ada data valid yang ditemukan di Excel. Pastikan kolom PT, TANGGAL, DIVISI, dan BLOCK terisi."
        );
        setUploading(false);
        return;
      }

      console.log("Parsed rows:", filtered.length);
      console.log("Sample parsed:", filtered[0]);

      const key = (r: AngkutRow) =>
        `${String(r.date_panen).slice(0, 10)}|${String(r.date_angkut).slice(
          0,
          10
        )}|${r.estateId}|${r.division_id}|${r.block_no}`;
      const dates = Array.from(
        new Set(filtered.map((r) => String(r.date_panen).slice(0, 10)))
      );
      let existing: AngkutRow[] = [];
      for (const d of dates) {
        try {
          const list = await api.angkutList({ date_panen: d });
          existing = existing.concat(list);
        } catch {
          /* ignore per-date error */
        }
      }

      console.log("Existing rows:", existing.length);

      const existingKeys = new Set(existing.map(key));
      const seen = new Set<string>();
      const bulk = filtered.filter((r) => {
        const k = key(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return !existingKeys.has(k);
      });
      if (bulk.length === 0) {
        toast.info("Semua baris sudah ada, tidak ada data baru");
      } else {
        await api.angkutCreate(bulk);
        toast.success(`Import ${bulk.length} baris berhasil`);
      }

      // Refresh companies and estates
      setCompanies(await api.companies());
      setEstates(await api.estates());

      const latest = await api.angkutList({ date_panen: datePanen });
      setRows(latest);
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : "Gagal import Excel";
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch {
        /* ignore */
      }
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Transaksi Angkutan</h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                onClick={async () => {
                  const ExcelJS = await import("exceljs");
                  const workbook = new ExcelJS.Workbook();
                  const worksheet = workbook.addWorksheet("Template Angkutan");

                  // Add header based on image columns
                  worksheet.columns = [
                    { header: "PT", key: "pt", width: 20 },
                    { header: "TANGGAL", key: "tanggal", width: 15 },
                    { header: "DIVISI", key: "divisi", width: 10 },
                    { header: "DRIVER", key: "driver", width: 20 },
                    { header: "No. Kenderaan", key: "no_kenderaan", width: 15 },
                    { header: "No. SPB", key: "no_spb", width: 15 },
                    { header: "BLOCK", key: "block", width: 15 },
                    { header: "TAHUN", key: "tahun", width: 10 },
                    { header: "JUMLAH", key: "jumlah", width: 10 },
                    { header: "BRONDOLAN", key: "brondolan", width: 12 },
                    { header: "BERAT DI", key: "berat_di", width: 12 },
                    { header: "No. Tiket", key: "no_tiket", width: 15 },
                    { header: "Code", key: "code", width: 10 },
                    { header: "BRUTO", key: "bruto", width: 12 },
                    { header: "TARRA", key: "tarra", width: 12 },
                    { header: "NETTO", key: "netto", width: 12 },
                    { header: "POTO", key: "poto", width: 12 },
                    { header: "Berat", key: "berat", width: 12 },
                    { header: "TONASE/", key: "tonase", width: 12 },
                    { header: "JJG/", key: "jjg", width: 10 },
                  ];

                  // Add sample row
                  worksheet.addRow({
                    pt: "PT EXAMPLE",
                    tanggal: "01-Dec-25",
                    divisi: "MA1EO",
                    driver: "DRIVER NAME",
                    no_kenderaan: "DM 8205 BP",
                    no_spb: "50",
                    block: "01A9K",
                    tahun: "2017",
                    jumlah: "330",
                    brondolan: "",
                    berat_di: "",
                    no_tiket: "",
                    code: "",
                    bruto: "",
                    tarra: "",
                    netto: "",
                    poto: "",
                    berat: "",
                    tonase: "",
                    jjg: "",
                  });

                  const buffer = await workbook.xlsx.writeBuffer();
                  const blob = new Blob([buffer], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "template_angkutan.xlsx";
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, 100);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                disabled={uploading}
                onClick={() => {
                  if (!uploading) fileInputRef.current?.click();
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={exportCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) =>
                  e.target.files && handleExcelUpload(e.target.files[0])
                }
                disabled={uploading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Tanggal Panen (Kunci)</Label>
            <Input
              type="date"
              value={datePanen}
              onChange={(e) => setDatePanen(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Angkutan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Data Angkutan</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>PT (Perusahaan)</Label>
                    <select
                      className="w-full h-10 border rounded px-2"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                    >
                      <option value="">Pilih PT</option>
                      {companies.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Tanggal Angkut</Label>
                    <Input
                      type="date"
                      value={dateAngkut}
                      onChange={(e) => setDateAngkut(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Estate</Label>
                    <select
                      className="w-full h-10 border rounded px-2"
                      value={estateId}
                      onChange={(e) => setEstateId(e.target.value)}
                    >
                      <option value="">Pilih</option>
                      {estates.map((es) => (
                        <option key={es._id} value={es._id}>
                          {es.estate_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Divisi</Label>
                    <select
                      className="w-full h-10 border rounded px-2"
                      value={divisionId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = Number(val);
                        setDivisionId(
                          !Number.isNaN(num) && val.trim() !== "" ? num : val
                        );
                      }}
                    >
                      <option value="">Pilih</option>
                      {divisions.map((d) => (
                        <option key={d.division_id} value={d.division_id}>
                          {typeof d.division_id === "number"
                            ? `Divisi ${d.division_id}`
                            : d.division_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Blok</Label>
                    <select
                      className="w-full h-10 border rounded px-2"
                      value={blockNo}
                      onChange={(e) => setBlockNo(e.target.value)}
                    >
                      <option value="">Pilih</option>
                      {blocks.map((b, i: number) => {
                        const label = String(b.no_blok || b.id_blok || "");
                        return (
                          <option key={i} value={label}>
                            {label || `Blok ${i + 1}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <Label>NoTPH</Label>
                    <Input
                      type="text"
                      value={noTPH}
                      onChange={(e) => setNoTPH(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>jjg_angkut</Label>
                    <Input
                      type="number"
                      value={jjgAngkut}
                      onChange={(e) =>
                        setJjgAngkut(
                          e.target.value ? Number(e.target.value) : ""
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>No. Mobil</Label>
                    <Input
                      type="text"
                      value={noMobil}
                      onChange={(e) => setNoMobil(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nama Supir</Label>
                    <Input
                      type="text"
                      value={namaSupir}
                      onChange={(e) => setNamaSupir(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button onClick={addRow} className="flex-1">
                    Simpan
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">
            Data Angkut (Tanggal Panen {datePanen})
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">PT</TableHead>
                  <TableHead className="text-center">Tgl_angkut</TableHead>
                  <TableHead className="text-center">Estate</TableHead>
                  <TableHead className="text-center">Div</TableHead>
                  <TableHead className="text-center">Blok</TableHead>
                  <TableHead className="text-center">NoTPH</TableHead>
                  <TableHead className="text-center">JJG Realisasi</TableHead>
                  <TableHead className="text-center">JJG Angkut</TableHead>
                  <TableHead className="text-center">Restan</TableHead>
                  <TableHead className="text-center">No. Mobil</TableHead>
                  <TableHead className="text-center">Nama Supir</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derived.map(
                  ({ row: r, jjgRealisasi, jjgAngkut, restan }, idx) => (
                    <TableRow key={(r as AngkutRowWithId)._id || idx}>
                      <TableCell className="text-center">
                        {r.companyName || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {String(r.date_angkut).slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.estateId}
                      </TableCell>
                      <TableCell className="text-center">
                        {typeof r.division_id === "number"
                          ? `Divisi ${r.division_id}`
                          : r.division_id}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.block_no}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.noTPH || "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {jjgRealisasi}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={jjgAngkut}
                          min={0}
                          onChange={(e) => {
                            const v =
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value);
                            updateJjgAngkut(r, v);
                          }}
                        />
                      </TableCell>
                      <TableCell
                        className={
                          "text-center font-semibold " +
                          (restan > 0 ? "text-red-600" : "text-green-600")
                        }
                      >
                        {restan}
                      </TableCell>
                      <TableCell className="text-center">
                        {noteVal(r.notes, "no_mobil") || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {noteVal(r.notes, "supir") || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openComplete(r)}
                        >
                          {noteVal(r.notes, "no_mobil") &&
                          noteVal(r.notes, "supir")
                            ? "Edit"
                            : "Lengkapi"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                )}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {/* Dialog Lengkapi */}
            <Dialog
              open={completeOpen}
              onOpenChange={(o) => {
                if (!o) {
                  setCompleteOpen(false);
                  setCompleteTarget(null);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {noteVal(completeTarget?.notes, "no_mobil") &&
                    noteVal(completeTarget?.notes, "supir")
                      ? "Edit Data Angkut"
                      : "Lengkapi Data Angkut"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>No. Mobil</Label>
                    <Input
                      value={editNoMobil}
                      onChange={(e) => setEditNoMobil(e.target.value)}
                      placeholder="Isi nomor mobil"
                    />
                  </div>
                  <div>
                    <Label>Nama Supir</Label>
                    <Input
                      value={editSupir}
                      onChange={(e) => setEditSupir(e.target.value)}
                      placeholder="Isi nama supir"
                    />
                  </div>
                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    TPH: {completeTarget?.noTPH || "-"}
                  </div>
                  <div className="md:col-span-2 text-sm">
                    JJG Realisasi: {Number(completeTarget?.jjgRealisasi || 0)}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={saveComplete} className="flex-1">
                    Simpan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCompleteOpen(false);
                      setCompleteTarget(null);
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
const noteVal = (notes: string | undefined, key: string): string => {
  if (!notes) return "";
  try {
    const parts = notes.split(/;\s*/);
    for (const p of parts) {
      const [k, v] = p.split("=");
      if (k && k.trim() === key) return v ?? "";
    }
    return "";
  } catch {
    return "";
  }
};
