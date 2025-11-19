import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Plus,
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  Edit,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { api } from "@/lib/api";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Define row structure expected from Excel import to avoid 'any'
type ExcelRow = {
  Divisi?: string;
  divisi?: string;
  [key: string]: unknown;
  "No Blok"?: string | number;
  "ID Blok"?: string | number;
  "Jenis Tanah"?: string;
  Topografi?: string | number;
  "Luas Tanam"?: number | string;
  Tahun?: number | string;
  "Jumlah Pokok"?: number | string;
  "Jenis Bibit"?: string;
  "Luas Land Preparation"?: number | string;
  "Luas Nursery"?: number | string;
  "Luas Lain-Lain"?: number | string;
  "Luas Lebungan"?: number | string;
  "Luas Garapan"?: number | string;
  "Luas Rawa"?: number | string;
  "Luas Tanggul"?: number | string;
  "Luas Area Non Efektif"?: number | string;
  Konservasi?: number | string;
  "Luas Konservasi"?: number | string;
  "Luas PKS"?: number | string;
  "Luas Jalan"?: number | string;
  "Luas Drainase"?: number | string;
  "Luas Perumahan"?: number | string;
  "Luas Sarana Prasanara"?: number | string;
  "Luas Blok"?: number | string;
  SPH?: number | string;
};

type Division = { division_id: number };
type Block = {
  id_blok?: string;
  no_blok?: string;
  luas_blok?: number;
  jumlak_pokok?: number;
  jumlah_pokok?: number;
  SPH?: number;
  jenis_tanah?: string;
  topografi?: string;
  tahun_?: number;
  luas_tanaman_?: number;
  jenis_bibit?: string;
  luas_nursery?: number;
  luas_lain___lain?: number;
  luas_lain__lain?: number;
  luas_garapan?: number;
  luas_rawa?: number;
  luas_area_non_efektif?: number;
  luas_konservasi?: number;
  location?: { type?: string; coordinates?: unknown };
  [key: string]: unknown;
};
type EstateLite = { _id: string; estate_name: string };

const Locations = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddEstateOpen, setIsAddEstateOpen] = useState(false);
  const [newEstateName, setNewEstateName] = useState("");
  const [estates, setEstates] = useState<EstateLite[]>([]);
  const [meta, setMeta] = useState<
    Record<
      string,
      { divisions: Division[]; blocksByDivision: Record<number, Block[]> }
    >
  >({});
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<{
    estateId: string;
    divisionId: number;
    block: Block;
  } | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Block>>({});

  // Helper function to format numbers: 0 stays as "0", whole numbers without decimals, decimals with 3 digits
  const formatNumber = (value: number | null | undefined): string => {
    if (value == null) return "-";
    if (value === 0) return "0";
    // Check if it's a whole number
    if (Number.isInteger(value)) return value.toString();
    // Has decimals, show with 3 decimal places
    return value.toFixed(3);
  };

  const handleOpenEditDialog = (
    estateId: string,
    divisionId: number,
    block: Block
  ) => {
    setEditingBlock({ estateId, divisionId, block });
    setEditFormData({
      id_blok: block.id_blok,
      no_blok: block.no_blok,
      luas_blok: block.luas_blok,
      jumlah_pokok: block.jumlah_pokok ?? block.jumlak_pokok,
      SPH: block.SPH,
      jenis_tanah: block.jenis_tanah,
      topografi: block.topografi,
      tahun_: block.tahun_,
      jenis_bibit: block.jenis_bibit,
      luas_nursery: block.luas_nursery,
      luas_lain___lain: block.luas_lain___lain ?? block.luas_lain__lain,
      luas_garapan: block.luas_garapan,
      luas_rawa: block.luas_rawa,
      luas_area_non_efektif: block.luas_area_non_efektif,
      luas_konservasi: block.luas_konservasi,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBlock) return;

    try {
      // Update local state (karena API belum support update)
      setMeta((prev) => {
        const estateMeta = prev[editingBlock.estateId];
        if (!estateMeta) return prev;

        const updatedBlocks = { ...estateMeta.blocksByDivision };
        const divBlocks = updatedBlocks[editingBlock.divisionId] || [];

        const blockIndex = divBlocks.findIndex(
          (b) =>
            (b.id_blok && b.id_blok === editingBlock.block.id_blok) ||
            (b.no_blok && b.no_blok === editingBlock.block.no_blok)
        );

        if (blockIndex !== -1) {
          divBlocks[blockIndex] = {
            ...divBlocks[blockIndex],
            ...editFormData,
          };
          updatedBlocks[editingBlock.divisionId] = [...divBlocks];
        }

        return {
          ...prev,
          [editingBlock.estateId]: {
            ...estateMeta,
            blocksByDivision: updatedBlocks,
          },
        };
      });

      toast({
        title: "Berhasil",
        description: "Blok berhasil diperbarui",
      });

      setIsEditDialogOpen(false);
      setEditingBlock(null);
      setEditFormData({});
    } catch (error) {
      toast({
        title: "Gagal",
        description:
          "Gagal memperbarui blok: " +
          (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .estates()
      .then((data) => {
        if (!mounted) return;
        setEstates(data || []);
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      const next: Record<
        string,
        { divisions: Division[]; blocksByDivision: Record<number, Block[]> }
      > = {};
      for (const es of estates) {
        try {
          const divs: Division[] = await api.divisions(es._id);
          const blocksByDivision: Record<number, Block[]> = {};
          for (const d of divs || []) {
            try {
              const blocks = await api.blocks(es._id, d.division_id);
              blocksByDivision[d.division_id] = Array.isArray(blocks)
                ? (blocks as Block[])
                : [];
            } catch {
              blocksByDivision[d.division_id] = [];
            }
          }
          next[es._id] = { divisions: divs || [], blocksByDivision };
        } catch {
          next[es._id] = { divisions: [], blocksByDivision: {} };
        }
      }
      if (!cancelled) setMeta(next);
    }
    if (estates.length > 0) loadMeta();
    return () => {
      cancelled = true;
    };
  }, [estates]);

  const filteredEstates = useMemo(
    () =>
      estates.filter((es) =>
        es.estate_name.toLowerCase().includes(search.toLowerCase())
      ),
    [estates, search]
  );

  const handleAddEstate = async () => {
    if (!newEstateName.trim()) {
      toast({
        title: "Gagal menambahkan estate",
        description: "Nama estate tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Generate ID dari nama estate (lowercase, remove spaces, add timestamp untuk uniqueness)
      const estateId =
        newEstateName.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();

      // Call API to create new estate in MongoDB
      await api.createEstate({
        _id: estateId,
        estate_name: newEstateName.trim(),
        divisions: [],
      });

      toast({
        title: "Berhasil!",
        description: `Estate "${newEstateName}" berhasil ditambahkan`,
      });
      setNewEstateName("");
      setIsAddEstateOpen(false);

      // Refresh estates list
      const updatedEstates = await api.estates();
      setEstates(updatedEstates || []);
    } catch (error) {
      console.error("Error adding estate:", error);
      toast({
        title: "Gagal menambahkan estate",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = (estateId: string) => {
    const exportData: Array<Record<string, string | number>> = [];

    const estate = estates.find((e) => e._id === estateId);
    if (!estate) return;

    const metaEs = meta[estateId];
    const blocksFlat: Array<{ division_id: number; block: Block }> = metaEs
      ? Object.entries(metaEs.blocksByDivision).flatMap(([divId, blks]) =>
          (blks || []).map((b) => ({
            division_id: Number(divId),
            block: b,
          }))
        )
      : [];

    const numOr0 = (v: unknown): number => (typeof v === "number" ? v : 0);
    const strOrEmpty = (v: unknown): string => (v != null ? String(v) : "");

    blocksFlat.forEach(({ division_id, block }) => {
      exportData.push({
        Divisi: `Divisi ${division_id}`,
        "No Blok": strOrEmpty(block.no_blok),
        "ID Blok": strOrEmpty(block.id_blok),
        "Location Type": strOrEmpty(block.location?.type),
        "Jenis Tanah": strOrEmpty(block.jenis_tanah),
        Topografi: strOrEmpty(block.topografi),
        "Luas Tanam": numOr0(block.luas_tanam_),
        Tahun: numOr0(block.tahun_),
        "Jumlah Pokok": numOr0(block.jumlak_pokok ?? block.jumlah_pokok),
        "Jenis Bibit": strOrEmpty(block.jenis_bibit),
        "Luas Land Preparation": numOr0(block.luas_land_preparation),
        "Luas Nursery": numOr0(block.luas_nursery),
        "Luas Lain-Lain": numOr0(
          block.luas_lain___lain ?? block.luas_lain__lain
        ),
        "Luas Lebungan": numOr0(block.luas_lebungan),
        "Luas Garapan": numOr0(block.luas_garapan),
        "Luas Rawa": numOr0(block.luas_rawa),
        "Luas Tanggul": numOr0(block.luas_tanggul),
        "Luas Area Non Efektif": numOr0(block.luas_area_non_efektif),
        "Luas Konservasi": numOr0(block.luas_konservasi),
        "Luas PKS": numOr0(block.luas_pks),
        "Luas Jalan": numOr0(block.luas_jalan),
        "Luas Drainase": numOr0(block.luas_drainase),
        "Luas Perumahan": numOr0(block.luas_perumahan),
        "Luas Sarana Prasanara": numOr0(block.luas_sarana_prasanara),
        "Luas Blok": numOr0(block.luas_blok),
        SPH: numOr0(block.SPH),
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Aresta");

    XLSX.writeFile(
      workbook,
      `Aresta_${estate.estate_name}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );
  };

  const handleExportPDF = (estateId: string) => {
    const estate = estates.find((e) => e._id === estateId);
    if (!estate) return;

    const metaEs = meta[estateId];
    const blocksFlat: Array<{ division_id: number; block: Block }> = metaEs
      ? Object.entries(metaEs.blocksByDivision).flatMap(([divId, blks]) =>
          (blks || []).map((b) => ({
            division_id: Number(divId),
            block: b,
          }))
        )
      : [];

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Title
    doc.setFontSize(16);
    doc.text(`Data Aresta - ${estate.estate_name}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal: ${new Date().toLocaleDateString("id-ID")}`, 14, 22);

    // Prepare table data
    const headers = [
      [
        "Divisi",
        "No Blok",
        "ID Blok",
        "Luas Blok",
        "Jumlah Pokok",
        "SPH",
        "Jenis Tanah",
        "Topografi",
        "Tahun",
        "Jenis Bibit",
        "Luas Nursery",
        "Luas Lain-Lain",
        "Luas Garapan",
        "Luas Rawa",
        "Non Efektif",
        "Konservasi",
        "Tipe Lokasi",
      ],
    ];

    const rows = blocksFlat.map(({ division_id, block }) => [
      `Divisi ${division_id}`,
      String(block.no_blok ?? ""),
      String(block.id_blok ?? ""),
      formatNumber(block.luas_blok),
      formatNumber(block.jumlah_pokok ?? block.jumlak_pokok),
      formatNumber(block.SPH),
      String(block.jenis_tanah ?? ""),
      String(block.topografi ?? ""),
      String(block.tahun_ ?? block.tahun ?? "-"),
      String(block.jenis_bibit ?? "-"),
      formatNumber(block.luas_nursery),
      formatNumber(block.luas_lain___lain ?? block.luas_lain__lain),
      formatNumber(block.luas_garapan),
      formatNumber(block.luas_rawa),
      formatNumber(block.luas_area_non_efektif),
      formatNumber(block.luas_konservasi),
      String(block.location?.type ?? "—"),
    ]);

    // Calculate totals for PDF
    const totalDivisi = new Set(
      blocksFlat.map(({ division_id }) => division_id)
    ).size;
    const totalBlok = new Set(blocksFlat.map(({ block }) => block.id_blok))
      .size;
    const totalLuasBlok = blocksFlat.reduce(
      (sum, { block }) =>
        sum + (typeof block.luas_blok === "number" ? block.luas_blok : 0),
      0
    );
    const totalJumlahPokok = blocksFlat.reduce((sum, { block }) => {
      const val = block.jumlah_pokok ?? block.jumlak_pokok;
      return sum + (typeof val === "number" ? val : 0);
    }, 0);
    const totalLuasNursery = blocksFlat.reduce(
      (sum, { block }) =>
        sum + (typeof block.luas_nursery === "number" ? block.luas_nursery : 0),
      0
    );
    const totalLuasLain = blocksFlat.reduce((sum, { block }) => {
      const val = block.luas_lain___lain ?? block.luas_lain__lain;
      return sum + (typeof val === "number" ? val : 0);
    }, 0);
    const totalLuasGarapan = blocksFlat.reduce(
      (sum, { block }) =>
        sum + (typeof block.luas_garapan === "number" ? block.luas_garapan : 0),
      0
    );
    const totalLuasRawa = blocksFlat.reduce(
      (sum, { block }) =>
        sum + (typeof block.luas_rawa === "number" ? block.luas_rawa : 0),
      0
    );
    const totalNonEfektif = blocksFlat.reduce(
      (sum, { block }) =>
        sum +
        (typeof block.luas_area_non_efektif === "number"
          ? block.luas_area_non_efektif
          : 0),
      0
    );
    const totalKonservasi = blocksFlat.reduce(
      (sum, { block }) =>
        sum +
        (typeof block.luas_konservasi === "number" ? block.luas_konservasi : 0),
      0
    );

    // Add TOTAL row
    const totalRow = [
      "TOTAL:",
      `${totalDivisi} Divisi`,
      `${totalBlok} Blok`,
      formatNumber(totalLuasBlok),
      formatNumber(totalJumlahPokok),
      "",
      "",
      "",
      "",
      "",
      formatNumber(totalLuasNursery),
      formatNumber(totalLuasLain),
      formatNumber(totalLuasGarapan),
      formatNumber(totalLuasRawa),
      formatNumber(totalNonEfektif),
      formatNumber(totalKonservasi),
      "",
    ];

    autoTable(doc, {
      head: headers,
      body: [...rows, totalRow],
      startY: 28,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
      didParseCell: function (data) {
        // Make TOTAL row bold
        if (data.row.index === rows.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });

    doc.save(
      `Aresta_${estate.estate_name}_${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );
  };

  const handleImportExcel = (estateId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const file = target?.files?.[0] || null;
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(
            worksheet
          ) as ExcelRow[];

          // Group data by Division only (Estate already selected)
          const groupedData: Record<string, Partial<Block>[]> = {};

          jsonData.forEach((row: ExcelRow) => {
            const divisi = (row.Divisi || row.divisi || "").toString();

            if (!divisi) {
              console.warn("Skipping row with missing Divisi:", row);
              return;
            }

            if (!groupedData[divisi]) {
              groupedData[divisi] = [];
            }

            // Log raw row untuk debugging
            console.log("Raw row data:", row);

            // Transform row to Block format (sesuai dengan struktur database)
            const toNum = (v: unknown): number => {
              const n = typeof v === "string" ? parseFloat(v) : (v as number);
              return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
            };
            const blockData: Partial<Block> = {
              no_blok: (row["No Blok"] ?? "").toString(),
              id_blok: (row["ID Blok"] ?? "").toString(),
              jenis_tanah: (row["Jenis Tanah"] ?? "") as string,
              topografi: (row.Topografi ?? "") as string,
              luas_tanam_: toNum(row["Luas Tanam"]),
              tahun_: toNum(row["Tahun"]),
              jumlak_pokok: toNum(row["Jumlah Pokok"]),
              jenis_bibit: (row["Jenis Bibit"] ?? "") as string,
              luas_land_preparation: toNum(row["Luas Land Preparation"]),
              luas_nursery: toNum(row["Luas Nursery"]),
              luas_lain___lain: toNum(row["Luas Lain-Lain"]),
              luas_lebungan: toNum(row["Luas Lebungan"]),
              luas_garapan: toNum(row["Luas Garapan"]),
              luas_rawa: toNum(row["Luas Rawa"]),
              luas_tanggul: toNum(row["Luas Tanggul"]),
              luas_area_non_efektif: toNum(row["Luas Area Non Efektif"]),
              luas_konservasi: toNum(row["Luas Konservasi"] ?? row.Konservasi),
              luas_pks: toNum(row["Luas PKS"]),
              luas_jalan: toNum(row["Luas Jalan"]),
              luas_drainase: toNum(row["Luas Drainase"]),
              luas_perumahan: toNum(row["Luas Perumahan"]),
              luas_sarana_prasanara: toNum(row["Luas Sarana Prasanara"]),
              luas_blok: toNum(row["Luas Blok"]),
              SPH: toNum(row.SPH),
            };

            groupedData[divisi].push(blockData);
          });

          // Import data to selected estate
          try {
            setLoading(true);

            const estate = estates.find((e) => e._id === estateId);
            if (!estate) {
              toast({
                title: "Gagal import",
                description: "Estate tidak ditemukan!",
                variant: "destructive",
              });
              return;
            }

            // Get existing estate data
            const existingEstate = (await api.estate(estateId)) as {
              divisions?: Array<{ division_id: number; blocks?: Block[] }>;
            };
            const existingDivisions = existingEstate.divisions || [];

            // Build divisions array with blocks
            const updatedDivisions = [...existingDivisions];

            for (const [divisionName, blocks] of Object.entries(groupedData)) {
              const divisionId = parseInt(
                divisionName.replace("Divisi ", "").trim()
              );

              // Find existing division or create new
              const divisionIndex = updatedDivisions.findIndex(
                (d) => d.division_id === divisionId
              );

              if (divisionIndex === -1) {
                // Add new division
                updatedDivisions.push({
                  division_id: divisionId,
                  blocks: blocks,
                });
              } else {
                // Add new blocks to existing division (tidak menimpa)
                const existingBlocks: Block[] = (updatedDivisions[divisionIndex]
                  .blocks || []) as Block[];
                const mergedBlocks: Block[] = [...existingBlocks];
                blocks.forEach((newBlock) => {
                  const existingIndex = mergedBlocks.findIndex(
                    (b) =>
                      (b.id_blok && b.id_blok === newBlock.id_blok) ||
                      (b.no_blok && b.no_blok === newBlock.no_blok)
                  );
                  if (existingIndex === -1) {
                    mergedBlocks.push(newBlock as Block);
                  }
                });
                updatedDivisions[divisionIndex].blocks = mergedBlocks;
              }
            }

            // Update estate with new divisions data
            await api.updateEstate(estateId, { divisions: updatedDivisions });

            const totalBlocks = jsonData.length;
            toast({
              title: "Berhasil import!",
              description: `${totalBlocks} blok berhasil diimport ke Estate "${estate.estate_name}"`,
            });

            // Refresh data - reload meta untuk estate yang diupdate
            setLoading(true);
            const updatedEstates = await api.estates();
            setEstates(updatedEstates || []);

            // Force reload meta for this specific estate
            try {
              const divs: Division[] = await api.divisions(estateId);
              const blocksByDivision: Record<number, Block[]> = {};
              for (const d of divs || []) {
                try {
                  const blocks = await api.blocks(estateId, d.division_id);
                  blocksByDivision[d.division_id] = Array.isArray(blocks)
                    ? (blocks as Block[])
                    : [];
                } catch {
                  blocksByDivision[d.division_id] = [];
                }
              }
              setMeta((prev) => ({
                ...prev,
                [estateId]: { divisions: divs || [], blocksByDivision },
              }));
            } catch (e) {
              console.error("Error refreshing meta:", e);
            }
          } catch (error) {
            console.error("Error importing:", error);
            toast({
              title: "Gagal import data",
              description:
                error instanceof Error ? error.message : String(error),
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        } catch (error) {
          console.error("Error importing Excel:", error);
          toast({
            title: "Gagal mengimpor file Excel",
            description: "Pastikan format file sudah benar",
            variant: "destructive",
          });
        }
      };

      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Aresta</h1>
            <p className="text-muted-foreground">Kelola data Aresta</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && (
              <p className="text-sm text-muted-foreground">Memuat data...</p>
            )}
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddEstateOpen} onOpenChange={setIsAddEstateOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Estate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Estate Baru</DialogTitle>
                  <DialogDescription>
                    Masukkan nama estate yang ingin ditambahkan
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="estate-name">Nama Estate</Label>
                    <Input
                      id="estate-name"
                      placeholder="Contoh: Estate ABC"
                      value={newEstateName}
                      onChange={(e) => setNewEstateName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddEstateOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button onClick={handleAddEstate}>Simpan</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="space-y-2">
              <Label htmlFor="search-estate">Cari Estate</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-estate"
                  placeholder="Ketik nama estate..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {filteredEstates.map((es) => {
                const metaEs = meta[es._id];
                const blocksFlat: Array<{ division_id: number; block: Block }> =
                  metaEs
                    ? Object.entries(metaEs.blocksByDivision).flatMap(
                        ([divId, blks]) =>
                          (blks || []).map((b) => ({
                            division_id: Number(divId),
                            block: b,
                          }))
                      )
                    : [];

                const currentPage = currentPages[es._id] || 1;
                const itemsPerPage = 10;
                const totalPages = Math.ceil(blocksFlat.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedBlocks = blocksFlat.slice(startIndex, endIndex);

                const handlePrevPage = () => {
                  if (currentPage > 1) {
                    setCurrentPages((prev) => ({
                      ...prev,
                      [es._id]: currentPage - 1,
                    }));
                  }
                };

                const handleNextPage = () => {
                  if (currentPage < totalPages) {
                    setCurrentPages((prev) => ({
                      ...prev,
                      [es._id]: currentPage + 1,
                    }));
                  }
                };

                return (
                  <AccordionItem key={es._id} value={es._id}>
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{es.estate_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {metaEs?.divisions?.length ?? 0} divisi —{" "}
                          {blocksFlat.length} blok
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="mb-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImportExcel(es._id)}
                          className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Import Excel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleExportExcel(es._id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export Excel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleExportPDF(es._id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export PDF
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <Table className="min-w-max">
                          <TableHeader className="bg-muted">
                            <TableRow>
                              <TableHead>Divisi</TableHead>
                              <TableHead>No Blok</TableHead>
                              <TableHead>ID Blok</TableHead>
                              <TableHead className="text-right">
                                Luas Blok
                              </TableHead>
                              <TableHead className="text-right">
                                Jumlah Pokok
                              </TableHead>
                              <TableHead className="text-right">SPH</TableHead>
                              <TableHead>Jenis Tanah</TableHead>
                              <TableHead>Topografi</TableHead>
                              <TableHead>Tahun</TableHead>
                              <TableHead>Jenis Bibit</TableHead>
                              <TableHead className="text-right">
                                Luas Nursery
                              </TableHead>
                              <TableHead className="text-right">
                                Luas Lain-Lain
                              </TableHead>
                              <TableHead className="text-right">
                                Luas Garapan
                              </TableHead>
                              <TableHead className="text-right">
                                Luas Rawa
                              </TableHead>
                              <TableHead className="text-right">
                                Non Efektif
                              </TableHead>
                              <TableHead className="text-right">
                                Konservasi
                              </TableHead>
                              <TableHead>Tipe Lokasi</TableHead>
                              <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedBlocks.map(
                              ({ division_id, block }, idx) => (
                                <TableRow
                                  key={`${division_id}-${
                                    block.no_blok ?? block.id_blok ?? idx
                                  }`}
                                >
                                  <TableCell>Divisi {division_id}</TableCell>
                                  <TableCell>
                                    {String(block.no_blok ?? "")}
                                  </TableCell>
                                  <TableCell>
                                    {String(block.id_blok ?? "")}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {typeof block.luas_blok === "number"
                                      ? formatNumber(block.luas_blok)
                                      : block.luas_blok ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {(() => {
                                      const val =
                                        block.jumlah_pokok ??
                                        block.jumlak_pokok;
                                      return typeof val === "number"
                                        ? formatNumber(val)
                                        : "-";
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {typeof block.SPH === "number"
                                      ? formatNumber(block.SPH)
                                      : block.SPH ?? "-"}
                                  </TableCell>
                                  <TableCell>
                                    {String(block.jenis_tanah ?? "")}
                                  </TableCell>
                                  <TableCell>
                                    {String(block.topografi ?? "")}
                                  </TableCell>
                                  <TableCell>
                                    {String(block.tahun_ ?? block.tahun ?? "-")}
                                  </TableCell>
                                  <TableCell>
                                    {String(block.jenis_bibit ?? "-")}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {typeof block.luas_nursery === "number"
                                      ? formatNumber(block.luas_nursery)
                                      : block.luas_nursery ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {(() => {
                                      const val =
                                        block.luas_lain___lain ??
                                        block.luas_lain__lain;
                                      return typeof val === "number"
                                        ? formatNumber(val)
                                        : "-";
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {typeof block.luas_garapan === "number"
                                      ? formatNumber(block.luas_garapan)
                                      : block.luas_garapan ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {typeof block.luas_rawa === "number"
                                      ? formatNumber(block.luas_rawa)
                                      : block.luas_rawa ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {typeof block.luas_area_non_efektif ===
                                    "number"
                                      ? formatNumber(
                                          block.luas_area_non_efektif
                                        )
                                      : block.luas_area_non_efektif ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {typeof block.luas_konservasi === "number"
                                      ? formatNumber(block.luas_konservasi)
                                      : block.luas_konservasi ?? "-"}
                                  </TableCell>
                                  <TableCell>
                                    {block.location?.type ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        handleOpenEditDialog(
                                          es._id,
                                          division_id,
                                          block
                                        )
                                      }
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                            {blocksFlat.length === 0 && (
                              <TableRow>
                                <TableCell
                                  colSpan={19}
                                  className="text-center text-sm text-muted-foreground"
                                >
                                  Tidak ada data blok
                                </TableCell>
                              </TableRow>
                            )}
                            {blocksFlat.length > 0 &&
                              (() => {
                                const totalDivisi = new Set(
                                  blocksFlat.map(
                                    ({ division_id }) => division_id
                                  )
                                ).size;
                                const totalBlok = new Set(
                                  blocksFlat.map(({ block }) => block.id_blok)
                                ).size;
                                const totalLuasBlok = blocksFlat.reduce(
                                  (sum, { block }) =>
                                    sum +
                                    (typeof block.luas_blok === "number"
                                      ? block.luas_blok
                                      : 0),
                                  0
                                );
                                const totalJumlahPokok = blocksFlat.reduce(
                                  (sum, { block }) => {
                                    const val =
                                      block.jumlah_pokok ?? block.jumlak_pokok;
                                    return (
                                      sum + (typeof val === "number" ? val : 0)
                                    );
                                  },
                                  0
                                );
                                const totalLuasNursery = blocksFlat.reduce(
                                  (sum, { block }) =>
                                    sum +
                                    (typeof block.luas_nursery === "number"
                                      ? block.luas_nursery
                                      : 0),
                                  0
                                );
                                const totalLuasLain = blocksFlat.reduce(
                                  (sum, { block }) => {
                                    const val =
                                      block.luas_lain___lain ??
                                      block.luas_lain__lain;
                                    return (
                                      sum + (typeof val === "number" ? val : 0)
                                    );
                                  },
                                  0
                                );
                                const totalLuasGarapan = blocksFlat.reduce(
                                  (sum, { block }) =>
                                    sum +
                                    (typeof block.luas_garapan === "number"
                                      ? block.luas_garapan
                                      : 0),
                                  0
                                );
                                const totalLuasRawa = blocksFlat.reduce(
                                  (sum, { block }) =>
                                    sum +
                                    (typeof block.luas_rawa === "number"
                                      ? block.luas_rawa
                                      : 0),
                                  0
                                );
                                const totalNonEfektif = blocksFlat.reduce(
                                  (sum, { block }) =>
                                    sum +
                                    (typeof block.luas_area_non_efektif ===
                                    "number"
                                      ? block.luas_area_non_efektif
                                      : 0),
                                  0
                                );
                                const totalKonservasi = blocksFlat.reduce(
                                  (sum, { block }) =>
                                    sum +
                                    (typeof block.luas_konservasi === "number"
                                      ? block.luas_konservasi
                                      : 0),
                                  0
                                );

                                return (
                                  <TableRow className="bg-muted/50 font-bold">
                                    <TableCell>TOTAL:</TableCell>
                                    <TableCell className="text-right">
                                      {totalDivisi} Divisi
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {totalBlok} Blok
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalLuasBlok)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalJumlahPokok)}
                                    </TableCell>
                                    <TableCell colSpan={5}></TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalLuasNursery)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalLuasLain)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalLuasGarapan)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalLuasRawa)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalNonEfektif)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatNumber(totalKonservasi)}
                                    </TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                  </TableRow>
                                );
                              })()}
                          </TableBody>
                        </Table>
                      </div>
                      {blocksFlat.length > itemsPerPage && (
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-muted-foreground">
                            Menampilkan {startIndex + 1} -{" "}
                            {Math.min(endIndex, blocksFlat.length)} dari{" "}
                            {blocksFlat.length} blok
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handlePrevPage}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <span className="text-sm">
                              Halaman {currentPage} dari {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleNextPage}
                              disabled={currentPage >= totalPages}
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Dialog Edit Blok */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Blok</DialogTitle>
              <DialogDescription>
                Edit data blok{" "}
                {editingBlock?.block.id_blok || editingBlock?.block.no_blok}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-no-blok">No Blok</Label>
                <Input
                  id="edit-no-blok"
                  value={editFormData.no_blok || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      no_blok: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-id-blok">ID Blok</Label>
                <Input
                  id="edit-id-blok"
                  value={editFormData.id_blok || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      id_blok: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-luas-blok">Luas Blok</Label>
                <Input
                  id="edit-luas-blok"
                  type="number"
                  step="0.001"
                  value={editFormData.luas_blok || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      luas_blok: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jumlah-pokok">Jumlah Pokok</Label>
                <Input
                  id="edit-jumlah-pokok"
                  type="number"
                  value={editFormData.jumlah_pokok || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      jumlah_pokok: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sph">SPH</Label>
                <Input
                  id="edit-sph"
                  type="number"
                  value={editFormData.SPH || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      SPH: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jenis-tanah">Jenis Tanah</Label>
                <Input
                  id="edit-jenis-tanah"
                  value={editFormData.jenis_tanah || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      jenis_tanah: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-topografi">Topografi</Label>
                <Input
                  id="edit-topografi"
                  value={editFormData.topografi || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      topografi: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tahun">Tahun</Label>
                <Input
                  id="edit-tahun"
                  type="number"
                  value={editFormData.tahun_ || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      tahun_: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jenis-bibit">Jenis Bibit</Label>
                <Input
                  id="edit-jenis-bibit"
                  value={editFormData.jenis_bibit || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      jenis_bibit: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-luas-nursery">Luas Nursery</Label>
                <Input
                  id="edit-luas-nursery"
                  type="number"
                  step="0.001"
                  value={editFormData.luas_nursery || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      luas_nursery: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-luas-lain">Luas Lain-Lain</Label>
                <Input
                  id="edit-luas-lain"
                  type="number"
                  step="0.001"
                  value={editFormData.luas_lain___lain || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      luas_lain___lain: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-luas-garapan">Luas Garapan</Label>
                <Input
                  id="edit-luas-garapan"
                  type="number"
                  step="0.001"
                  value={editFormData.luas_garapan || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      luas_garapan: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-luas-rawa">Luas Rawa</Label>
                <Input
                  id="edit-luas-rawa"
                  type="number"
                  step="0.001"
                  value={editFormData.luas_rawa || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      luas_rawa: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-non-efektif">Non Efektif</Label>
                <Input
                  id="edit-non-efektif"
                  type="number"
                  step="0.001"
                  value={editFormData.luas_area_non_efektif || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      luas_area_non_efektif: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-konservasi">Konservasi</Label>
                <Input
                  id="edit-konservasi"
                  type="number"
                  step="0.001"
                  value={editFormData.luas_konservasi || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      luas_konservasi: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Batal
              </Button>
              <Button onClick={handleSaveEdit}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    </>
  );
};

export default Locations;
