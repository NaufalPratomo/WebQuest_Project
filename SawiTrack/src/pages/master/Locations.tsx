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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { api, Company } from "@/lib/api";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Define row structure expected from Excel import to avoid 'any'
type ExcelRow = {
  Divisi?: string;
  divisi?: string;
  DIVISI?: string;
  PT?: string;
  Wilayah?: string;
  [key: string]: unknown;
  "No Blok"?: string | number;
  "ID Blok"?: string | number;
  Baru?: string | number;
  Lama?: string | number;
  TT?: number | string;
  LUAS?: number | string;
  TOTAL?: number | string;
  PRODUKTIF?: number | string;
  "BELUM PRODUKTIF"?: number | string;
  Mati?: number | string;
  "ASAL BIBIT"?: string;
  TOPOGRAFI?: string | number;
  "SOIL TYPE"?: string;
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

type Division = { division_id: number | string };
type Block = {
  id_blok?: string;
  no_blok?: string;
  no_tph?: string;
  status?: string;
  luas_blok?: number;
  jumlak_pokok?: number;
  jumlah_pokok?: number;
  SPH?: number;
  jenis_tanah?: string;
  topografi?: string;
  tahun_?: number;
  luas_tanam_?: number;
  luas_tanaman_?: number;
  jenis_bibit?: string;
  pokok_total?: number;
  pokok_produktif?: number;
  pokok_belum_produktif?: number;
  pokok_mati?: number;
  id_pt?: string;
  luas_land_preparation?: number;
  luas_nursery?: number;
  luas_lain___lain?: number;
  luas_lain__lain?: number;
  luas_lebungan?: number;
  luas_garapan?: number;
  luas_rawa?: number;
  luas_tanggul?: number;
  luas_area_non_efektif?: number;
  luas_konservasi?: number;
  luas_pks?: number;
  luas_jalan?: number;
  luas_drainase?: number;
  luas_perumahan?: number;
  luas_sarana_prasanara?: number;
  jumlah_pokok_sensus?: number;
  location?: { type?: string; coordinates?: unknown };
  [key: string]: unknown;
};
type EstateLite = { _id: string; estate_name: string; status?: string };

const Locations = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddEstateOpen, setIsAddEstateOpen] = useState(false);
  const [newEstateName, setNewEstateName] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [estates, setEstates] = useState<EstateLite[]>([]);
  const [meta, setMeta] = useState<
    Record<
      string,
      { divisions: Division[]; blocksByDivision: Record<string | number, Block[]> }
    >
  >({});
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<{
    estateId: string;
    divisionId: number | string;
    block: Block;
  } | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Block>>({});

  // Import preview state
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    estateId: string;
    estateName: string;
    newBlocks: Array<{ division: string; block: Partial<Block> }>;
    updatedBlocks: Array<{
      division: string;
      block: Partial<Block>;
      oldBlock: Block;
    }>;
    existingBlocks: Array<{ division: string; block: Partial<Block> }>;
    groupedData: Record<string, Partial<Block>[]>;
  } | null>(null);

  // Import Estate Preview State
  const [isImportEstatePreviewOpen, setIsImportEstatePreviewOpen] =
    useState(false);
  const [importEstatePreviewData, setImportEstatePreviewData] = useState<{
    companyId: string;
    newEstates: string[];
    existingEstates: string[];
  } | null>(null);

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
    divisionId: number | string,
    block: Block
  ) => {
    setEditingBlock({ estateId, divisionId, block });
    setEditFormData({
      id_blok: block.id_blok,
      no_blok: block.no_blok,
      no_tph: block.no_tph,
      luas_blok: block.luas_blok,
      jumlah_pokok: block.jumlah_pokok ?? block.jumlak_pokok,
      SPH: block.SPH,
      jenis_tanah: block.jenis_tanah,
      topografi: block.topografi,
      tahun_: block.tahun_,
      jenis_bibit: block.jenis_bibit,
      pokok_total: block.pokok_total,
      pokok_produktif: block.pokok_produktif,
      pokok_belum_produktif: block.pokok_belum_produktif,
      pokok_mati: block.pokok_mati,
      id_pt: block.id_pt,
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
      // Get current estate divisions with blocks
      const estateMeta = meta[editingBlock.estateId];
      if (!estateMeta) {
        throw new Error("Estate data not found");
      }

      // Build updated divisions array with all blocks
      const updatedDivisions = estateMeta.divisions.map((div) => {
        const blocks = estateMeta.blocksByDivision[div.division_id] || [];

        if (div.division_id === editingBlock.divisionId) {
          // Update the specific block in this division
          const updatedBlocks = blocks.map((b) => {
            if (
              (b.id_blok && b.id_blok === editingBlock.block.id_blok) ||
              (b.no_blok && b.no_blok === editingBlock.block.no_blok)
            ) {
              return { ...b, ...editFormData };
            }
            return b;
          });
          return { division_id: div.division_id, blocks: updatedBlocks };
        }

        return { division_id: div.division_id, blocks };
      });

      // Save to database
      await api.updateEstate(editingBlock.estateId, {
        divisions: updatedDivisions,
      });

      // Update local state
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
    Promise.all([api.companies(), api.estates()])
      .then(([companiesData, estatesData]) => {
        if (!mounted) return;
        setCompanies(companiesData || []);
        setEstates(estatesData || []);
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
        {
          divisions: Division[];
          blocksByDivision: Record<string | number, Block[]>;
        }
      > = { ...meta }; // Start with existing meta
      
      for (const es of estates) {
        // Skip if already loaded and has divisions
        if (next[es._id] && next[es._id].divisions.length > 0) continue;

        try {
          const divs: Division[] = await api.divisions(es._id);
          const blocksByDivision: Record<string | number, Block[]> = {};
          
          if (divs && divs.length > 0) {
            for (const d of divs) {
              try {
                const blocks = await api.blocks(es._id, d.division_id);
                blocksByDivision[d.division_id] = Array.isArray(blocks)
                  ? (blocks as Block[])
                  : [];
              } catch (err) {
                console.error(`Error loading blocks for ${es._id} ${d.division_id}:`, err);
                blocksByDivision[d.division_id] = [];
              }
            }
          }
          
          next[es._id] = { divisions: divs || [], blocksByDivision };
          
          // Yield to UI after each estate to show progress
          if (!cancelled) {
            setMeta({ ...next });
          }
        } catch (err) {
          console.error(`Error loading meta for ${es._id}:`, err);
          next[es._id] = { divisions: [], blocksByDivision: {} };
        }
      }
    }
    
    if (estates.length > 0) {
      loadMeta();
    }
    
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

    if (!selectedCompanyId) {
      toast({
        title: "Gagal menambahkan estate",
        description: "Silakan pilih perusahaan terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Generate ID dari nama estate (lowercase, remove spaces, add timestamp untuk uniqueness)
      const estateId =
        newEstateName.toLowerCase().replace(/\s+/g, "") + "" + Date.now();

      // Call API to create new estate in MongoDB
      await api.createEstate({
        _id: estateId,
        estate_name: newEstateName.trim(),
        divisions: [],
      });

      // Update company untuk menambahkan estate ID ke array estates
      const company = companies.find((c) => c._id === selectedCompanyId);
      if (company) {
        const currentEstateIds =
          company.estates?.map((e) => (typeof e === "string" ? e : e._id)) ||
          [];

        await api.updateCompany(selectedCompanyId, {
          estates: [...currentEstateIds, estateId],
        });
      }

      toast({
        title: "Berhasil!",
        description: `Estate "${newEstateName}" berhasil ditambahkan`,
      });
      setNewEstateName("");
      setIsAddEstateOpen(false);
      setSelectedCompanyId("");

      // Refresh companies dan estates list
      const [updatedCompanies, updatedEstates] = await Promise.all([
        api.companies(),
        api.estates(),
      ]);
      setCompanies(updatedCompanies || []);
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

  const handleImportEstates = (companyId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData =
            XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

          const newEstates: string[] = [];
          const existingEstates: string[] = [];

          // Get current estates for this company
          const company = companies.find((c) => c._id === companyId);
          // Get ALL estates to prevent duplicates across the system if needed,
          // or just for this company. Usually estate names should be unique globally or per company.
          // Let's check against ALL estates to be safe, or at least all estates linked to this company.

          // Strategy: Check against ALL existing estates in the system to avoid ID conflicts or naming confusion
          const allEstateNames = estates.map((e) =>
            e.estate_name.toLowerCase().trim()
          );

          jsonData.forEach((row) => {
            // Try to find the estate name column
            const estateNameVal =
              row["Nama Estate"] ||
              row["nama estate"] ||
              row["Estate Name"] ||
              row["estate name"] ||
              row["Name"] ||
              row["name"] ||
              row["Estate"] ||
              row["estate"] ||
              Object.values(row)[0]; // Fallback to first column

            const estateName = String(estateNameVal || "").trim();

            if (!estateName) return;

            if (allEstateNames.includes(estateName.toLowerCase())) {
              if (!existingEstates.includes(estateName)) {
                existingEstates.push(estateName);
              }
            } else {
              if (!newEstates.includes(estateName)) {
                newEstates.push(estateName);
              }
            }
          });

          setImportEstatePreviewData({
            companyId,
            newEstates,
            existingEstates,
          });
          setIsImportEstatePreviewOpen(true);
        } catch (error) {
          console.error("Error importing estates:", error);
          toast({
            title: "Gagal import",
            description: "Gagal membaca file Excel",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const handleConfirmImportEstates = async () => {
    if (!importEstatePreviewData) return;

    try {
      setLoading(true);
      const { companyId, newEstates } = importEstatePreviewData;
      const createdEstateIds: string[] = [];

      for (const estateName of newEstates) {
        const estateId =
          estateName.toLowerCase().replace(/\s+/g, "") + "" + Date.now();
        await api.createEstate({
          _id: estateId,
          estate_name: estateName,
          divisions: [],
        });
        createdEstateIds.push(estateId);
      }

      // Update company
      const company = companies.find((c) => c._id === companyId);
      if (company) {
        const currentEstateIds =
          company.estates?.map((e) => (typeof e === "string" ? e : e._id)) ||
          [];
        await api.updateCompany(companyId, {
          estates: [...currentEstateIds, ...createdEstateIds],
        });
      }

      // Refresh data
      const [updatedCompanies, updatedEstates] = await Promise.all([
        api.companies(),
        api.estates(),
      ]);
      setCompanies(updatedCompanies || []);
      setEstates(updatedEstates || []);

      toast({
        title: "Import Berhasil",
        description: `${newEstates.length} estate berhasil ditambahkan.`,
      });

      setIsImportEstatePreviewOpen(false);
      setImportEstatePreviewData(null);
    } catch (error) {
      console.error("Error confirming import estates:", error);
      toast({
        title: "Gagal Import",
        description: "Terjadi kesalahan saat menyimpan data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportEstates = (companyId: string) => {
    const company = companies.find((c) => c._id === companyId);
    if (!company) return;

    const currentEstateIds =
      company.estates?.map((e) => (typeof e === "string" ? e : e._id)) || [];
    const companyEstates = estates.filter((e) =>
      currentEstateIds.includes(e._id)
    );

    const exportData = companyEstates.map((e) => ({
      "Nama Estate": e.estate_name,
      "ID Estate": e._id,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estates");
    XLSX.writeFile(
      wb,
      `Estates_${company.company_name}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );
  };

  const handleExportExcel = (estateId: string) => {
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

    // Create workbook with headers
    const workbook = XLSX.utils.book_new();

    // Create worksheet data with parent and child headers
    const wsData: any[][] = [
      // Parent Header Row
      [
        "Data Base Aresta",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Hasil Mapping Survey",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Hasil Sensus",
        "Hasil Perhitungan",
        "",
        "",
        "",
      ],
      // Child Header Row
      [
        "Divisi",
        "No Blok",
        "Wilayah",
        "Jenis Tanah",
        "Topografi",
        "Luas Tanam Awal",
        "Tahun Tanam",
        "Jenis Bibit",
        "Jumlah Pokok Awal",
        "SPH Awal",
        "Luas Land Preparation",
        "Luas Nursery",
        "Luas Lebungan",
        "Luas Garapan",
        "Luas Rawa",
        "Luas Tanggul",
        "Luas Area Non Efektif",
        "Luas Konservasi",
        "Luas PKS",
        "Luas Jalan",
        "Luas Drainase",
        "Luas Perumahan",
        "Luas Sarana Prasanara",
        "Luas Lain-Lain",
        "Jumlah Pokok Sensus",
        "Total Luas Non Tanaman",
        "Total Luas Tanam Awal",
        "Luas Blok",
        "SPH Akhir",
      ],
    ];

    // Add data rows
    blocksFlat.forEach(({ division_id, block }) => {
      // Calculate Total Luas Non Tanaman
      const totalLuasNonTanaman =
        numOr0(block.luas_land_preparation) +
        numOr0(block.luas_nursery) +
        numOr0(block.luas_lebungan) +
        numOr0(block.luas_garapan) +
        numOr0(block.luas_rawa) +
        numOr0(block.luas_tanggul) +
        numOr0(block.luas_area_non_efektif) +
        numOr0(block.luas_konservasi) +
        numOr0(block.luas_pks) +
        numOr0(block.luas_jalan) +
        numOr0(block.luas_drainase) +
        numOr0(block.luas_perumahan) +
        numOr0(block.luas_sarana_prasanara) +
        numOr0(block.luas_lain___lain ?? block.luas_lain__lain);

      // Calculate Luas Blok and SPH Akhir
      const luasTanamAwal = numOr0(block.luas_tanam_);
      const luasBlokCalculated = luasTanamAwal + totalLuasNonTanaman;
      const jumlahPokokSensus = numOr0(block.jumlah_pokok_sensus);
      const sphAkhirCalculated =
        luasTanamAwal > 0 ? jumlahPokokSensus / luasTanamAwal : 0;

      wsData.push([
        // Data Base Aresta
        `Divisi ${division_id}`,
        strOrEmpty(block.no_blok),
        strOrEmpty(block.no_tph),
        strOrEmpty(block.jenis_tanah),
        strOrEmpty(block.topografi),
        luasTanamAwal,
        numOr0(block.tahun_),
        strOrEmpty(block.jenis_bibit),
        numOr0(block.jumlak_pokok ?? block.jumlah_pokok),
        numOr0(block.SPH),
        // Hasil Mapping Survey
        numOr0(block.luas_land_preparation),
        numOr0(block.luas_nursery),
        numOr0(block.luas_lebungan),
        numOr0(block.luas_garapan),
        numOr0(block.luas_rawa),
        numOr0(block.luas_tanggul),
        numOr0(block.luas_area_non_efektif),
        numOr0(block.luas_konservasi),
        numOr0(block.luas_pks),
        numOr0(block.luas_jalan),
        numOr0(block.luas_drainase),
        numOr0(block.luas_perumahan),
        numOr0(block.luas_sarana_prasanara),
        numOr0(block.luas_lain___lain ?? block.luas_lain__lain),
        // Hasil Sensus
        jumlahPokokSensus,
        // Hasil Perhitungan
        totalLuasNonTanaman,
        luasTanamAwal,
        luasBlokCalculated,
        sphAkhirCalculated,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Merge cells for parent headers
    worksheet["!merges"] = [
      // Data Base Aresta: A1:J1
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      // Hasil Mapping Survey: K1:X1
      { s: { r: 0, c: 10 }, e: { r: 0, c: 23 } },
      // Hasil Sensus: Y1 (no merge needed, single cell)
      // Hasil Perhitungan: Z1:AC1
      { s: { r: 0, c: 25 }, e: { r: 0, c: 28 } },
    ];

    // Set column widths
    worksheet["!cols"] = Array(29).fill({ wch: 14 });

    // Function to get cell address
    const getCellAddr = (row: number, col: number) => {
      return XLSX.utils.encode_cell({ r: row, c: col });
    };

    // Apply styles to parent headers (row 0)
    const parentHeaderStyles = [
      { start: 0, end: 9, bg: "3B82F6" }, // Blue - Data Base Aresta
      { start: 10, end: 23, bg: "10B981" }, // Green - Hasil Mapping Survey
      { start: 24, end: 24, bg: "8B5CF6" }, // Purple - Hasil Sensus
      { start: 25, end: 28, bg: "F97316" }, // Orange - Hasil Perhitungan
    ];

    parentHeaderStyles.forEach(({ start, end, bg }) => {
      for (let col = start; col <= end; col++) {
        const addr = getCellAddr(0, col);
        if (!worksheet[addr]) continue;
        worksheet[addr].s = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          fill: { fgColor: { rgb: bg } },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    });

    // Apply styles to child headers (row 1)
    const childHeaderStyles = [
      { start: 0, end: 9, bg: "DBEAFE" }, // Light Blue
      { start: 10, end: 23, bg: "D1FAE5" }, // Light Green
      { start: 24, end: 24, bg: "EDE9FE" }, // Light Purple
      { start: 25, end: 28, bg: "FFEDD5" }, // Light Orange
    ];

    childHeaderStyles.forEach(({ start, end, bg }) => {
      for (let col = start; col <= end; col++) {
        const addr = getCellAddr(1, col);
        if (!worksheet[addr]) continue;
        worksheet[addr].s = {
          font: { bold: true, sz: 11 },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          fill: { fgColor: { rgb: bg } },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    });

    // Apply borders to data rows
    const maxRow = wsData.length - 1;
    for (let row = 2; row <= maxRow; row++) {
      for (let col = 0; col <= 28; col++) {
        const addr = getCellAddr(row, col);
        if (!worksheet[addr]) continue;
        worksheet[addr].s = {
          border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } },
          },
        };
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Aresta");

    // Write file with cellStyles enabled
    XLSX.writeFile(
      workbook,
      `Aresta_${estate.estate_name}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`,
      {
        cellStyles: true,
        bookType: "xlsx",
      }
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

    // Prepare table data with parent and child headers
    const headers = [
      // Parent Header Row
      [
        {
          content: "Data Base Aresta",
          colSpan: 10,
          styles: {
            fillColor: [191, 219, 254] as [number, number, number],
            halign: "center" as const,
            fontStyle: "bold" as const,
          },
        },
        {
          content: "Hasil Mapping Survey",
          colSpan: 14,
          styles: {
            fillColor: [187, 247, 208] as [number, number, number],
            halign: "center" as const,
            fontStyle: "bold" as const,
          },
        },
        {
          content: "Hasil Sensus",
          colSpan: 1,
          styles: {
            fillColor: [233, 213, 255] as [number, number, number],
            halign: "center" as const,
            fontStyle: "bold" as const,
          },
        },
        {
          content: "Hasil Perhitungan",
          colSpan: 4,
          styles: {
            fillColor: [254, 215, 170] as [number, number, number],
            halign: "center" as const,
            fontStyle: "bold" as const,
          },
        },
      ],
      // Child Header Row
      [
        // Data Base Aresta
        "Divisi",
        "No Blok",
        "Wilayah",
        "Jenis Tanah",
        "Topografi",
        "Luas Tanam Awal",
        "Tahun Tanam",
        "Jenis Bibit",
        "Jumlah Pokok Awal",
        "SPH Awal",
        // Hasil Mapping Survey
        "Luas Land Prep",
        "Luas Nursery",
        "Luas Lebungan",
        "Luas Garapan",
        "Luas Rawa",
        "Luas Tanggul",
        "Non Efektif",
        "Konservasi",
        "Luas PKS",
        "Luas Jalan",
        "Drainase",
        "Perumahan",
        "Sarana",
        "Lain-Lain",
        // Hasil Sensus
        "Pokok Sensus",
        // Hasil Perhitungan
        "Total Non Tanaman",
        "Total Tanam Awal",
        "Luas Blok",
        "SPH Akhir",
      ],
    ];

    const rows = blocksFlat.map(({ division_id, block }) => {
      const totalLuasNonTanaman =
        (typeof block.luas_land_preparation === "number"
          ? block.luas_land_preparation
          : 0) +
        (typeof block.luas_nursery === "number" ? block.luas_nursery : 0) +
        (typeof block.luas_lebungan === "number" ? block.luas_lebungan : 0) +
        (typeof block.luas_garapan === "number" ? block.luas_garapan : 0) +
        (typeof block.luas_rawa === "number" ? block.luas_rawa : 0) +
        (typeof block.luas_tanggul === "number" ? block.luas_tanggul : 0) +
        (typeof block.luas_area_non_efektif === "number"
          ? block.luas_area_non_efektif
          : 0) +
        (typeof block.luas_konservasi === "number"
          ? block.luas_konservasi
          : 0) +
        (typeof block.luas_pks === "number" ? block.luas_pks : 0) +
        (typeof block.luas_jalan === "number" ? block.luas_jalan : 0) +
        (typeof block.luas_drainase === "number" ? block.luas_drainase : 0) +
        (typeof block.luas_perumahan === "number" ? block.luas_perumahan : 0) +
        (typeof block.luas_sarana_prasanara === "number"
          ? block.luas_sarana_prasanara
          : 0) +
        (typeof (block.luas_lain___lain ?? block.luas_lain__lain) === "number"
          ? block.luas_lain___lain ?? block.luas_lain__lain
          : 0);

      // Calculate Luas Blok and SPH Akhir
      const luasTanamAwal =
        typeof block.luas_tanam_ === "number" ? block.luas_tanam_ : 0;
      const luasBlokCalculated = luasTanamAwal + totalLuasNonTanaman;
      const jumlahPokokSensus =
        typeof block.jumlah_pokok_sensus === "number"
          ? block.jumlah_pokok_sensus
          : 0;
      const sphAkhirCalculated =
        luasTanamAwal > 0 ? jumlahPokokSensus / luasTanamAwal : 0;

      return [
        // Data Base Aresta
        `Divisi ${division_id}`,
        String(block.no_blok ?? ""),
        String(block.no_tph ?? ""),
        String(block.jenis_tanah ?? ""),
        String(block.topografi ?? ""),
        formatNumber(block.luas_tanam_),
        String(block.tahun_ ?? block.tahun ?? "-"),
        String(block.jenis_bibit ?? "-"),
        formatNumber(block.jumlah_pokok ?? block.jumlak_pokok),
        formatNumber(block.SPH),
        // Hasil Mapping Survey
        formatNumber(block.luas_land_preparation),
        formatNumber(block.luas_nursery),
        formatNumber(block.luas_lebungan),
        formatNumber(block.luas_garapan),
        formatNumber(block.luas_rawa),
        formatNumber(block.luas_tanggul),
        formatNumber(block.luas_area_non_efektif),
        formatNumber(block.luas_konservasi),
        formatNumber(block.luas_pks),
        formatNumber(block.luas_jalan),
        formatNumber(block.luas_drainase),
        formatNumber(block.luas_perumahan),
        formatNumber(block.luas_sarana_prasanara),
        formatNumber(block.luas_lain___lain ?? block.luas_lain__lain),
        // Hasil Sensus
        formatNumber(block.jumlah_pokok_sensus),
        // Hasil Perhitungan
        formatNumber(totalLuasNonTanaman),
        formatNumber(luasTanamAwal),
        formatNumber(luasBlokCalculated),
        formatNumber(sphAkhirCalculated),
      ];
    });

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
      "", // No TPH (empty)
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
      styles: { fontSize: 6, cellPadding: 1 },
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: 0,
        fontStyle: "bold",
        fontSize: 6,
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center" }, // Divisi
        1: { halign: "center" }, // No Blok
        2: { halign: "center" }, // Wilayah
        3: { halign: "center" }, // Jenis Tanah
        4: { halign: "center" }, // Topografi
        5: { halign: "right" }, // Luas Tanam Awal
        6: { halign: "center" }, // Tahun Tanam
        7: { halign: "center" }, // Jenis Bibit
        8: { halign: "right" }, // Jumlah Pokok Awal
        9: { halign: "right" }, // SPH Awal
        10: { halign: "right" }, // Luas Land Prep
        11: { halign: "right" }, // Luas Nursery
        12: { halign: "right" }, // Luas Lebungan
        13: { halign: "right" }, // Luas Garapan
        14: { halign: "right" }, // Luas Rawa
        15: { halign: "right" }, // Luas Tanggul
        16: { halign: "right" }, // Non Efektif
        17: { halign: "right" }, // Konservasi
        18: { halign: "right" }, // Luas PKS
        19: { halign: "right" }, // Luas Jalan
        20: { halign: "right" }, // Drainase
        21: { halign: "right" }, // Perumahan
        22: { halign: "right" }, // Sarana
        23: { halign: "right" }, // Lain-Lain
        24: { halign: "right" }, // Pokok Sensus
        25: { halign: "right" }, // Total Non Tanaman
        26: { halign: "right" }, // Total Tanam Awal
        27: { halign: "right" }, // Luas Blok
        28: { halign: "right" }, // SPH Akhir
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 10, right: 10 },
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

          const toStr = (v: unknown): string => {
            if (v == null) return "";
            return String(v).trim();
          };
          const toNum = (v: unknown): number => {
            if (v == null || v === "") return 0;
            if (typeof v === "string") {
              // Handle Indonesian format: dots for thousands, comma for decimal
              let clean = v.trim().replace(/\./g, "").replace(",", ".");
              // Handle potential negative in parenthesis: (224) -> -224
              if (clean.startsWith("(") && clean.endsWith(")")) {
                clean = "-" + clean.substring(1, clean.length - 1);
              }
              const n = parseFloat(clean);
              return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
            }
            if (typeof v === "number") return v;
            return 0;
          };

          const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
            header: 1,
          });
          const headerRow2 = rawRows[1] || [];
          const isNewFormat =
            headerRow2.includes("PT") && headerRow2.includes("Wilayah");

          let jsonData: ExcelRow[] = [];
          if (isNewFormat) {
            // New format data starts from row index 2
            for (let i = 2; i < rawRows.length; i++) {
              const r = rawRows[i];
              if (!r || r.length < 5) continue;
              jsonData.push({
                PT: toStr(r[1]),
                Wilayah: toStr(r[2]),
                DIVISI: toStr(r[3]),
                Baru: toStr(r[4]),
                Lama: toStr(r[5]),
                TT: toStr(r[6]),
                LUAS: toStr(r[7]),
                TOTAL: toStr(r[8]),
                PRODUKTIF: toStr(r[9]),
                "BELUM PRODUKTIF": toStr(r[10]),
                Mati: toStr(r[11]),
                "ASAL BIBIT": toStr(r[12]),
                TOPOGRAFI: toStr(r[13]),
                "SOIL TYPE": toStr(r[14]),
                SPH: toStr(r[15]),
              });
            }
          } else {
            jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
              range: 1, // Start from row 2 (index 1), skip parent header row
            }) as ExcelRow[];
          }

          // Group data by Division only (Estate already selected)
          const groupedData: Record<string, Partial<Block>[]> = {};

          jsonData.forEach((row: ExcelRow) => {
            const divisi = (
              (isNewFormat
                ? row.DIVISI
                : row.DIVISI || row.Divisi || row.divisi) || ""
            ).toString();

            if (!divisi) {
              console.warn("Skipping row with missing Divisi:", row);
              return;
            }

            if (!groupedData[divisi]) {
              groupedData[divisi] = [];
            }

            // Transform row to Block format (sesuai dengan struktur database)
            const blockData: Partial<Block> = {
              id_pt: isNewFormat ? toStr(row.PT) : undefined,
              no_blok: isNewFormat
                ? `${toStr(row.Baru)}${row.Lama ? " / " + toStr(row.Lama) : ""}`
                : toStr(row["No Blok"]),
              no_tph: isNewFormat
                ? toStr(row.Lama)
                : toStr(row["Wilayah"] ?? row["No TPH"]),
              jenis_tanah: isNewFormat
                ? toStr(row["SOIL TYPE"])
                : toStr(row["Jenis Tanah"]),
              topografi: toStr(row["TOPOGRAFI"] ?? row["Topografi"]),
              luas_tanam_: toNum(
                row[isNewFormat ? "LUAS" : "Luas Tanam Awal"] ??
                  row["Luas Tanam"]
              ),
              tahun_: toNum(
                row[isNewFormat ? "TT" : "Tahun Tanam"] ?? row["Tahun"]
              ),
              jumlak_pokok: toNum(
                row[isNewFormat ? "TOTAL" : "Jumlah Pokok Awal"] ??
                  row["Jumlah Pokok"]
              ),
              jenis_bibit: toStr(
                row[isNewFormat ? "ASAL BIBIT" : "Jenis Bibit"]
              ),
              SPH: toNum(row[isNewFormat ? "SPH" : "SPH Awal"] ?? row["SPH"]),

              // New Aresta fields (optional for model)
              pokok_total: isNewFormat ? toNum(row.TOTAL) : undefined,
              pokok_produktif: isNewFormat ? toNum(row.PRODUKTIF) : undefined,
              pokok_belum_produktif: isNewFormat
                ? toNum(row["BELUM PRODUKTIF"])
                : undefined,
              pokok_mati: isNewFormat ? toNum(row.Mati) : undefined,

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
              jumlah_pokok_sensus: toNum(row["Jumlah Pokok Sensus"]),
              // luas_blok & sph_akhir are calculated fields, don't import from Excel
            };

            groupedData[divisi].push(blockData);
          });

          // Get existing estate data untuk compare
          const estate = estates.find((e) => e._id === estateId);
          if (!estate) {
            toast({
              title: "Gagal import",
              description: "Estate tidak ditemukan!",
              variant: "destructive",
            });
            return;
          }

          // Fetch existing divisions WITH blocks to compare
          // Note: api.estate() excludes divisions, so we use api.divisions() which returns the full division array including blocks
          const existingDivisions = (await api.divisions(estateId)) as Array<{
            division_id: number | string;
            blocks?: Block[];
          }>;

          // Helper function to compare blocks deeply
          const areBlocksEqual = (
            block1: Partial<Block>,
            block2: Block
          ): boolean => {
            // Compare key fields (exclude: id_blok [auto-generated], luas_blok [calculated], sph_akhir [calculated], status [system field])
            const fields = [
              "no_blok",
              // "id_blok", // Excluded - auto-generated field
              "no_tph",
              "jumlak_pokok",
              "SPH",
              "jenis_tanah",
              "topografi",
              "tahun_",
              "jenis_bibit",
              "luas_tanam_",
              "luas_land_preparation",
              "luas_nursery",
              "luas_lain___lain",
              "luas_garapan",
              "luas_rawa",
              "luas_area_non_efektif",
              "luas_konservasi",
              "luas_tanggul",
              "luas_lebungan",
              "luas_pks",
              "luas_jalan",
              "luas_drainase",
              "luas_perumahan",
              "luas_sarana_prasanara",
              "jumlah_pokok_sensus",
              "pokok_total",
              "pokok_produktif",
              "pokok_belum_produktif",
              "pokok_mati",
              "id_pt",
            ];

            for (const field of fields) {
              const val1 = (block1 as Record<string, unknown>)[field];
              const val2 = (block2 as Record<string, unknown>)[field];

              // Normalize based on type
              let norm1: string | number;
              let norm2: string | number;

              if (typeof val1 === "string" || typeof val2 === "string") {
                // String comparison - normalize to lowercase and trim
                norm1 = String(val1 ?? "")
                  .trim()
                  .toLowerCase();
                norm2 = String(val2 ?? "")
                  .trim()
                  .toLowerCase();

                if (norm1 !== norm2) {
                  return false;
                }
              } else {
                // Number comparison - treat null/undefined/"" as 0
                norm1 = val1 == null || val1 === "" ? 0 : Number(val1);
                norm2 = val2 == null || val2 === "" ? 0 : Number(val2);

                if (Math.abs(norm1 - norm2) > 0.001) {
                  return false;
                }
              }
            }

            return true;
          };

          // Compare new vs existing data
          const newBlocks: Array<{ division: string; block: Partial<Block> }> =
            [];
          const existingBlocks: Array<{
            division: string;
            block: Partial<Block>;
          }> = [];
          const updatedBlocks: Array<{
            division: string;
            block: Partial<Block>;
            oldBlock: Block;
          }> = [];

          for (const [divisionName, blocks] of Object.entries(groupedData)) {
            const parsedId = parseInt(
              divisionName.replace("Divisi ", "").trim()
            );
            const divisionId = isNaN(parsedId) ? divisionName : parsedId;

            const existingDivision = existingDivisions.find(
              (d) => d.division_id === divisionId
            );
            const existingDivBlocks: Block[] = (existingDivision?.blocks ||
              []) as Block[];

            blocks.forEach((newBlock) => {
              // Find matching block by ID or No Blok
              const matchingBlock = existingDivBlocks.find(
                (b) =>
                  (b.id_blok && b.id_blok === newBlock.id_blok) ||
                  (b.no_blok && b.no_blok === newBlock.no_blok)
              );

              if (matchingBlock) {
                // Block exists, check if data is different
                const isEqual = areBlocksEqual(newBlock, matchingBlock);

                if (isEqual) {
                  // Data sama persis, skip
                  existingBlocks.push({
                    division: divisionName,
                    block: newBlock,
                  });
                } else {
                  // Data berbeda, akan di-update
                  updatedBlocks.push({
                    division: divisionName,
                    block: newBlock,
                    oldBlock: matchingBlock,
                  });
                }
              } else {
                // Block baru
                newBlocks.push({ division: divisionName, block: newBlock });
              }
            });
          }

          // Show preview dialog
          setImportPreviewData({
            estateId,
            estateName: estate.estate_name,
            newBlocks,
            updatedBlocks,
            existingBlocks,
            groupedData,
          });
          setIsImportPreviewOpen(true);
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

  const handleConfirmImport = async () => {
    if (!importPreviewData) return;

    const { estateId, estateName, groupedData, newBlocks, updatedBlocks } =
      importPreviewData;

    try {
      setLoading(true);

      // Get existing estate data
      const existingEstate = (await api.estate(estateId)) as {
        divisions?: Array<{ division_id: number | string; blocks?: Block[] }>;
      };
      const existingDivisions = existingEstate.divisions || [];

      // Build divisions array with blocks
      const updatedDivisions = [...existingDivisions];

      for (const [divisionName, blocks] of Object.entries(groupedData)) {
        const parsedId = parseInt(divisionName.replace(/Divisi/i, "").trim());
        const divisionId = isNaN(parsedId) ? divisionName : parsedId;

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
          // Merge blocks: add new blocks and update existing blocks
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
              // Add new block
              mergedBlocks.push(newBlock as Block);
            } else {
              // Update existing block with new data
              mergedBlocks[existingIndex] = {
                ...mergedBlocks[existingIndex],
                ...newBlock,
              } as Block;
            }
          });
          updatedDivisions[divisionIndex].blocks = mergedBlocks;
        }
      }

      // Update estate with new divisions data
      await api.updateEstate(estateId, { divisions: updatedDivisions });

      const totalNew = newBlocks.length;
      const totalUpdated = updatedBlocks.length;
      const totalProcessed = totalNew + totalUpdated;

      let description = "";
      if (totalNew > 0 && totalUpdated > 0) {
        description = `${totalNew} blok baru ditambahkan dan ${totalUpdated} blok diperbarui di Estate "${estateName}"`;
      } else if (totalNew > 0) {
        description = `${totalNew} blok baru berhasil ditambahkan ke Estate "${estateName}"`;
      } else if (totalUpdated > 0) {
        description = `${totalUpdated} blok berhasil diperbarui di Estate "${estateName}"`;
      } else {
        description = "Tidak ada data baru yang ditambahkan.";
      }

      toast({
        title: "Berhasil import!",
        description,
      });

      // Refresh data - reload meta untuk estate yang diupdate
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

      // Close preview dialog
      setIsImportPreviewOpen(false);
      setImportPreviewData(null);
    } catch (error) {
      console.error("Error importing:", error);
      toast({
        title: "Gagal import data",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Global Template Download
  const handleDownloadGlobalTemplate = () => {
    const headers = [
      "PT",
      "Divisi",
      "No Blok",
      "Wilayah",
      "Jenis Tanah",
      "Topografi",
      "Luas Tanam",
      "Tahun",
      "Jumlah Pokok",
      "SPH",
      "Jenis Bibit",
      "Luas Land Preparation",
      "Luas Nursery",
      "Luas Lain-Lain",
      "Luas Lebungan",
      "Luas Garapan",
      "Luas Rawa",
      "Luas Tanggul",
      "Luas Area Non Efektif",
      "Konservasi",
      "Luas Konservasi",
      "Luas PKS",
      "Luas Jalan",
      "Luas Drainase",
      "Luas Perumahan",
      "Luas Sarana Prasanara",
      "Luas Blok",
    ];
    const csv = headers.join(",");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_global.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Global Export (PT + Divisi + Block Data)
  const handleExportGlobal = () => {
    const numOr0 = (v: unknown): number => (typeof v === "number" ? v : 0);
    const strOrEmpty = (v: unknown): string => (v != null ? String(v) : "");
    
    const exportData: any[] = [];
    let totalBlocks = 0;

    companies.forEach((company) => {
      const companyEstateIds =
        company.estates?.map((e) => (typeof e === "string" ? e : e._id)) || [];
      const companyEstates = estates.filter((e) =>
        companyEstateIds.includes(e._id)
      );

      companyEstates.forEach((estate) => {
        const metaEs = meta[estate._id];
        if (!metaEs) return;

        const blocksFlat: Array<{ division_id: number; block: Block }> =
          Object.entries(metaEs.blocksByDivision).flatMap(([divId, blks]) =>
            (blks || []).map((b) => ({
              division_id: Number(divId),
              block: b,
            }))
          );

        blocksFlat.forEach(({ division_id, block }) => {
          exportData.push({
            PT: company.company_name,
            Divisi: estate.estate_name,
            "No Blok": strOrEmpty(block.no_blok),
            Wilayah: strOrEmpty(block.no_tph),
            "Jenis Tanah": strOrEmpty(block.jenis_tanah),
            Topografi: strOrEmpty(block.topografi),
            "Luas Tanam": numOr0(block.luas_tanam_ ?? block.luas_tanaman_),
            Tahun: numOr0(block.tahun_),
            "Jumlah Pokok": numOr0(block.jumlah_pokok ?? block.jumlak_pokok),
            SPH: numOr0(block.SPH),
            "Jenis Bibit": strOrEmpty(block.jenis_bibit),
            "Luas Land Preparation": numOr0(block.luas_land_preparation),
            "Luas Nursery": numOr0(block.luas_nursery),
            "Luas Lain-Lain": numOr0(block.luas_lain___lain ?? block.luas_lain__lain),
            "Luas Lebungan": numOr0(block.luas_lebungan),
            "Luas Garapan": numOr0(block.luas_garapan),
            "Luas Rawa": numOr0(block.luas_rawa),
            "Luas Tanggul": numOr0(block.luas_tanggul),
            "Luas Area Non Efektif": numOr0(block.luas_area_non_efektif),
            Konservasi: numOr0(block.luas_konservasi),
            "Luas Konservasi": numOr0(block.luas_konservasi),
            "Luas PKS": numOr0(block.luas_pks),
            "Luas Jalan": numOr0(block.luas_jalan),
            "Luas Drainase": numOr0(block.luas_drainase),
            "Luas Perumahan": numOr0(block.luas_perumahan),
            "Luas Sarana Prasanara": numOr0(block.luas_sarana_prasanara),
            "Luas Blok": numOr0(block.luas_blok),
          });
          totalBlocks++;
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Global");
    XLSX.writeFile(
      wb,
      `Aresta_Global_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    toast({
      title: "Export Berhasil",
      description: `${totalBlocks} blok dari ${companies.length} PT berhasil diekspor.`,
    });
  };

  // Global Import (PT + Divisi + Block Data)
  const handleImportGlobal = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setLoading(true);
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

          // Group data by PT and Divisi
          const dataMap = new Map<string, Map<string, any[]>>();

          jsonData.forEach((row) => {
            const ptName = String(row["PT"] || row["pt"] || "").trim();
            const divisiName = String(row["Divisi"] || row["divisi"] || "").trim();

            if (ptName && divisiName) {
              if (!dataMap.has(ptName)) {
                dataMap.set(ptName, new Map());
              }
              if (!dataMap.get(ptName)!.has(divisiName)) {
                dataMap.get(ptName)!.set(divisiName, []);
              }
              dataMap.get(ptName)!.get(divisiName)!.push(row);
            }
          });

          let companiesCreated = 0;
          let divisionsCreated = 0;
          let blocksCreated = 0;
          let blocksUpdated = 0;

          // Process each company and its divisions
          for (const [ptName, divisionMap] of dataMap.entries()) {
            // Check if company exists
            let company = companies.find(
              (c) => c.company_name.toLowerCase() === ptName.toLowerCase()
            );

            if (!company) {
              // Create new company
              company = await api.createCompany({
                company_name: ptName,
                address: "",
                phone: "",
                email: "",
                estates: [],
              });
              companies.push(company);
              companiesCreated++;
            }

            // Process divisions for this company
            for (const [divisionName, blockRows] of divisionMap.entries()) {
              // Check if division/estate already exists
              let estate = estates.find(
                (e) => e.estate_name.toLowerCase() === divisionName.toLowerCase()
              );

              if (!estate) {
                // Create new estate/division
                const estateId =
                  divisionName.toLowerCase().replace(/\s+/g, "") +
                  "" +
                  Date.now() +
                  Math.random();
                const newEstate = await api.createEstate({
                  _id: estateId,
                  estate_name: divisionName,
                  divisions: [],
                });
                estate = { _id: estateId, estate_name: divisionName };
                estates.push(estate);
                divisionsCreated++;
              }

              // Link estate to company if not already linked
              const companyEstateIds =
                company.estates?.map((e) => (typeof e === "string" ? e : e._id)) || [];
              if (!companyEstateIds.includes(estate._id)) {
                await api.updateCompany(company._id, {
                  estates: [...companyEstateIds, estate._id],
                });
              }

              // Process blocks for this division
              const blocksToAdd: Block[] = [];
              
              for (const row of blockRows) {
                const numOr0 = (key: string): number => {
                  const val = row[key];
                  if (val == null || val === "") return 0;
                  return typeof val === "number" ? val : Number(val) || 0;
                };

                const strOrEmpty = (key: string): string => {
                  const val = row[key];
                  return val != null ? String(val).trim() : "";
                };

                const noBlok = strOrEmpty("No Blok");
                if (!noBlok) continue; // Skip if no block number

                const blockData: any = {
                  no_blok: noBlok,
                  no_tph: strOrEmpty("Wilayah"),
                  jenis_tanah: strOrEmpty("Jenis Tanah"),
                  topografi: strOrEmpty("Topografi"),
                  luas_tanam_: numOr0("Luas Tanam"),
                  tahun_: numOr0("Tahun"),
                  jumlah_pokok: numOr0("Jumlah Pokok"),
                  SPH: numOr0("SPH"),
                  jenis_bibit: strOrEmpty("Jenis Bibit"),
                  luas_land_preparation: numOr0("Luas Land Preparation"),
                  luas_nursery: numOr0("Luas Nursery"),
                  luas_lain___lain: numOr0("Luas Lain-Lain"),
                  luas_lebungan: numOr0("Luas Lebungan"),
                  luas_garapan: numOr0("Luas Garapan"),
                  luas_rawa: numOr0("Luas Rawa"),
                  luas_tanggul: numOr0("Luas Tanggul"),
                  luas_area_non_efektif: numOr0("Luas Area Non Efektif"),
                  luas_konservasi: numOr0("Konservasi") || numOr0("Luas Konservasi"),
                  luas_pks: numOr0("Luas PKS"),
                  luas_jalan: numOr0("Luas Jalan"),
                  luas_drainase: numOr0("Luas Drainase"),
                  luas_perumahan: numOr0("Luas Perumahan"),
                  luas_sarana_prasanara: numOr0("Luas Sarana Prasanara"),
                  luas_blok: numOr0("Luas Blok"),
                };

                blocksToAdd.push(blockData);
              }

              // Update estate with new blocks
              if (blocksToAdd.length > 0) {
                try {
                  // Get existing divisions
                  const existingDivisions = (await api.divisions(estate._id)) as Array<{
                    division_id: number;
                    blocks?: Block[];
                  }>;

                  // Find or create division 0 for imported blocks
                  let divisionIndex = existingDivisions.findIndex(
                    (d) => d.division_id === 0
                  );
                  
                  if (divisionIndex === -1) {
                    // Create new division
                    existingDivisions.push({
                      division_id: 0,
                      blocks: blocksToAdd,
                    });
                  } else {
                    // Append to existing division
                    const existingBlocks = existingDivisions[divisionIndex].blocks || [];
                    existingDivisions[divisionIndex].blocks = [
                      ...existingBlocks,
                      ...blocksToAdd,
                    ];
                  }

                  await api.updateEstate(estate._id, {
                    divisions: existingDivisions,
                  });

                  blocksCreated += blocksToAdd.length;
                } catch (error) {
                  console.warn(
                    `Failed to update estate ${estate.estate_name}:`,
                    error
                  );
                  blocksUpdated += blocksToAdd.length;
                }
              }
            }
          }

          // Refresh data
          const [updatedCompanies, updatedEstates] = await Promise.all([
            api.companies(),
            api.estates(),
          ]);
          setCompanies(updatedCompanies || []);
          setEstates(updatedEstates || []);

          // Refresh meta data
          for (const estate of updatedEstates || []) {
            try {
              const divisions = (await api.divisions(estate._id)) as Array<{
                division_id: number;
                blocks?: Block[];
              }>;
              const blocksByDivision: Record<number, Block[]> = {};
              
              for (const d of divisions || []) {
                try {
                  const blocks = await api.blocks(estate._id, d.division_id);
                  blocksByDivision[d.division_id] = Array.isArray(blocks)
                    ? (blocks as Block[])
                    : [];
                } catch {
                  blocksByDivision[d.division_id] = [];
                }
              }
              
              setMeta((prev) => ({
                ...prev,
                [estate._id]: {
                  divisions: divisions || [],
                  blocksByDivision,
                },
              }));
            } catch (err) {
              console.error(`Error loading data for estate ${estate._id}:`, err);
            }
          }

          toast({
            title: "Import Global Berhasil",
            description: `PT: ${companiesCreated} baru. Divisi: ${divisionsCreated} baru. Blok: ${blocksCreated} ditambahkan, ${blocksUpdated} gagal/dilewati.`,
          });
        } catch (error) {
          console.error("Error importing global:", error);
          toast({
            title: "Gagal Import Global",
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
          });
        } finally {
          setLoading(false);
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadGlobalTemplate}
              className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportGlobal}
              className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Aresta
            </Button>
            <Button
              size="sm"
              onClick={handleExportGlobal}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              Export aresta
            </Button>
          </div>
        </div>

        {companies.map((company) => {
          // Filter estate yang termasuk dalam company ini
          const companyEstateIds =
            company.estates?.map((e) => (typeof e === "string" ? e : e._id)) ||
            [];
          const companyEstates = filteredEstates.filter((estate) =>
            companyEstateIds.includes(estate._id)
          );

          return (
            <Accordion
              key={company._id}
              type="single"
              collapsible
              className="w-full mb-6"
              defaultValue={`company-${company._id}`}
            >
              <AccordionItem
                value={`company-${company._id}`}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-col items-start text-left">
                    <h2 className="text-xl font-bold">
                      {company.company_name}
                    </h2>
                    <p className="text-sm text-muted-foreground font-normal">
                      {company.address} •{" "}
                      {companyEstates.reduce((total, estate) => {
                        const estateMeta = meta[estate._id];
                        return total + (estateMeta?.divisions?.length || 0);
                      }, 0)}{" "}
                      divisi
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-end justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <Label htmlFor="search-estate">Cari Divisi</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="search-estate"
                              placeholder="Ketik nama divisi..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const csv = "Nama Estate,ID Estate";
                              const blob = new Blob([csv], {
                                type: "text/csv",
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "template_divisi.csv";
                              document.body.appendChild(a);
                              a.click();
                              setTimeout(() => {
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }, 100);
                            }}
                            className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Template
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImportEstates(company._id)}
                            className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Import Divisi
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleExportEstates(company._id)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Export Wilayah
                          </Button>
                          <Dialog
                            open={isAddEstateOpen}
                            onOpenChange={setIsAddEstateOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600"
                                onClick={() =>
                                  setSelectedCompanyId(company._id)
                                }
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Wilayah
                              </Button>
                            </DialogTrigger>
                            <DialogContent
                              className="bg-white border-gray-200"
                              style={{
                                backgroundColor: "#ffffff",
                                color: "#000000",
                              }}
                            >
                              <DialogHeader>
                                <DialogTitle>Tambah Wilayah Baru</DialogTitle>
                                <DialogDescription>
                                  Masukkan nama wilayah untuk perusahaan yang
                                  dipilih
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Perusahaan</Label>
                                  <div className="px-3 py-2 bg-muted rounded-md text-sm">
                                    {companies.find(
                                      (c) => c._id === selectedCompanyId
                                    )?.company_name ||
                                      "Tidak ada perusahaan dipilih"}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="estate-name">
                                    Nama Wilayah
                                  </Label>
                                  <Input
                                    id="estate-name"
                                    placeholder="Contoh: Sukamaju"
                                    value={newEstateName}
                                    onChange={(e) =>
                                      setNewEstateName(e.target.value)
                                    }
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
                                <Button onClick={handleAddEstate}>
                                  Simpan
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {companyEstates.map((es) => {
                          const metaEs = meta[es._id];
                          const blocksFlat: Array<{
                            division_id: number | string;
                            block: Block;
                          }> = metaEs
                            ? Object.entries(metaEs.blocksByDivision).flatMap(
                                ([divId, blks]) =>
                                  (blks || []).map((b) => ({
                                    division_id: isNaN(parseInt(divId))
                                      ? divId
                                      : Number(divId),
                                    block: b,
                                  }))
                              )
                            : [];

                          const currentPage = currentPages[es._id] || 1;
                          const itemsPerPage = 10;
                          const totalPages = Math.ceil(
                            blocksFlat.length / itemsPerPage
                          );
                          const startIndex = (currentPage - 1) * itemsPerPage;
                          const endIndex = startIndex + itemsPerPage;
                          const paginatedBlocks = blocksFlat.slice(
                            startIndex,
                            endIndex
                          );

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
                                  <span className="font-medium">
                                    {es.estate_name}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {
                                      Object.keys(
                                        metaEs?.blocksByDivision || {}
                                      ).length
                                    }{" "}
                                    divisi — {blocksFlat.length} blok
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
                                    <TableHeader>
                                      {/* Row 1: Title & Status/Aksi */}
                                      <TableRow>
                                        <TableHead
                                          colSpan={13}
                                          className="text-center bg-blue-100 border border-gray-300 font-bold"
                                        >
                                          Data Master Blok Aresta 2026
                                        </TableHead>
                                        <TableHead
                                          rowSpan={3}
                                          className="text-center bg-gray-100 border border-gray-300"
                                        >
                                          Status
                                        </TableHead>
                                        <TableHead
                                          rowSpan={3}
                                          className="text-center bg-gray-100 border border-gray-300"
                                        >
                                          Aksi
                                        </TableHead>
                                      </TableRow>
                                      {/* Row 2: Main Headers */}
                                      <TableRow>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          PT
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          Divisi
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          No Blok
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          TT
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          Luas
                                        </TableHead>
                                        <TableHead
                                          colSpan={4}
                                          className="text-center bg-blue-50 border border-gray-300 font-bold"
                                        >
                                          POKOK
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          Asal Bibit
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          Topografi
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          Soil Type
                                        </TableHead>
                                        <TableHead
                                          rowSpan={2}
                                          className="text-center bg-blue-50 border border-gray-300"
                                        >
                                          SPH
                                        </TableHead>
                                      </TableRow>
                                      {/* Row 3: Pokok Subheaders */}
                                      <TableRow>
                                        <TableHead className="text-center bg-blue-50 border border-gray-300 text-xs font-bold">
                                          TOTAL
                                        </TableHead>
                                        <TableHead className="text-center bg-blue-50 border border-gray-300 text-xs font-bold">
                                          PRODUKTIF
                                        </TableHead>
                                        <TableHead className="text-center bg-blue-50 border border-gray-300 text-xs font-bold">
                                          BELUM PRODUKTIF
                                        </TableHead>
                                        <TableHead className="text-center bg-blue-50 border border-gray-300 text-xs font-bold">
                                          Mati
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {paginatedBlocks.map(
                                        ({ division_id, block }, idx) => (
                                          <TableRow
                                            key={`${division_id}-${
                                              block.no_blok ??
                                              block.id_blok ??
                                              idx
                                            }`}
                                          >
                                            <TableCell className="text-center border border-gray-300">
                                              {String(block.pt_ownership ?? block.id_pt ?? block.pt ?? "-")}
                                            </TableCell>
                                            <TableCell className="text-center border border-gray-300">
                                              {division_id
                                                ? typeof division_id ===
                                                  "number"
                                                  ? `Divisi ${division_id}`
                                                  : division_id
                                                : "-"}
                                            </TableCell>
                                            <TableCell className="text-center border border-gray-300 min-w-[120px]">
                                              {block.no_blok_display || block.no_blok || "-"}
                                            </TableCell>
                                            <TableCell className="text-center border border-gray-300">
                                              {String(
                                                block.tahun_ ??
                                                  block.tahun ??
                                                  "-"
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right border border-gray-300">
                                              {formatNumber(block.luas_blok ?? block.luas_tanam_)}
                                            </TableCell>
                                            <TableCell className="text-right border border-gray-300">
                                              {formatNumber(
                                                block.pokok_total ?? 
                                                block.jumlah_pokok ?? 
                                                block.jumlak_pokok
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right border border-gray-300">
                                              {formatNumber(block.pokok_produktif)}
                                            </TableCell>
                                            <TableCell className="text-right border border-gray-300">
                                              {formatNumber(block.pokok_belum_produktif)}
                                            </TableCell>
                                            <TableCell className="text-right border border-gray-300">
                                              {formatNumber(block.pokok_mati)}
                                            </TableCell>
                                            <TableCell className="text-center border border-gray-300">
                                              {String(block.jenis_bibit ?? "-")}
                                            </TableCell>
                                            <TableCell className="text-center border border-gray-300">
                                              {String(block.topografi ?? "-")}
                                            </TableCell>
                                            <TableCell className="text-center border border-gray-300">
                                              {String(block.jenis_tanah ?? block.soil_type ?? "-")}
                                            </TableCell>
                                            <TableCell className="text-right border border-gray-300">
                                              {formatNumber(block.SPH)}
                                            </TableCell>

                                            <TableCell className="text-center border border-gray-300">
                                              <Select
                                                value={block.status || "active"}
                                                onValueChange={async (
                                                  newStatus
                                                ) => {
                                                  try {
                                                    const updatedBlocks =
                                                      metaEs.blocksByDivision[
                                                        division_id
                                                      ].map((b) =>
                                                        b.no_blok ===
                                                        block.no_blok
                                                          ? {
                                                              ...b,
                                                              status: newStatus,
                                                            }
                                                          : b
                                                      );
                                                    await api.updateEstate(
                                                      es._id,
                                                      {
                                                        divisions:
                                                          metaEs.divisions.map(
                                                            (d) => ({
                                                              division_id:
                                                                d.division_id,
                                                              blocks:
                                                                d.division_id ===
                                                                division_id
                                                                  ? updatedBlocks
                                                                  : metaEs
                                                                      .blocksByDivision[
                                                                      d
                                                                        .division_id
                                                                    ],
                                                            })
                                                          ),
                                                      }
                                                    );
                                                    setMeta((prev) => ({
                                                      ...prev,
                                                      [es._id]: {
                                                        ...prev[es._id],
                                                        blocksByDivision: {
                                                          ...prev[es._id]
                                                            .blocksByDivision,
                                                          [division_id]:
                                                            updatedBlocks,
                                                        },
                                                      },
                                                    }));
                                                    toast({
                                                      title:
                                                        "Status blok berhasil diubah",
                                                    });
                                                  } catch (e) {
                                                    toast({
                                                      title: "Gagal",
                                                      description:
                                                        e instanceof Error
                                                          ? e.message
                                                          : "Gagal mengubah status",
                                                      variant: "destructive",
                                                    });
                                                  }
                                                }}
                                              >
                                                <SelectTrigger className="w-28 h-8">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="active">
                                                    Aktif
                                                  </SelectItem>
                                                  <SelectItem value="inactive">
                                                    Nonaktif
                                                  </SelectItem>
                                                </SelectContent>
                                              </Select>
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
                                            colSpan={29}
                                            className="text-center text-sm text-muted-foreground border border-gray-300"
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
                                            blocksFlat.map(
                                              ({ block }) => block.id_blok
                                            )
                                          ).size;
                                          const totalLuasBlok =
                                            blocksFlat.reduce(
                                              (sum, { block }) =>
                                                sum +
                                                (typeof block.luas_blok ===
                                                "number"
                                                  ? block.luas_blok
                                                  : 0),
                                              0
                                            );
                                          const totalJumlahPokok =
                                            blocksFlat.reduce(
                                              (sum, { block }) => {
                                                const val =
                                                  block.jumlah_pokok ??
                                                  block.jumlak_pokok;
                                                return (
                                                  sum +
                                                  (typeof val === "number"
                                                    ? val
                                                    : 0)
                                                );
                                              },
                                              0
                                            );
                                          const totalLuasNursery =
                                            blocksFlat.reduce(
                                              (sum, { block }) =>
                                                sum +
                                                (typeof block.luas_nursery ===
                                                "number"
                                                  ? block.luas_nursery
                                                  : 0),
                                              0
                                            );
                                          const totalLuasLain =
                                            blocksFlat.reduce(
                                              (sum, { block }) => {
                                                const val =
                                                  block.luas_lain___lain ??
                                                  block.luas_lain__lain;
                                                return (
                                                  sum +
                                                  (typeof val === "number"
                                                    ? val
                                                    : 0)
                                                );
                                              },
                                              0
                                            );
                                          const totalLuasGarapan =
                                            blocksFlat.reduce(
                                              (sum, { block }) =>
                                                sum +
                                                (typeof block.luas_garapan ===
                                                "number"
                                                  ? block.luas_garapan
                                                  : 0),
                                              0
                                            );
                                          const totalLuasRawa =
                                            blocksFlat.reduce(
                                              (sum, { block }) =>
                                                sum +
                                                (typeof block.luas_rawa ===
                                                "number"
                                                  ? block.luas_rawa
                                                  : 0),
                                              0
                                            );
                                          const totalNonEfektif =
                                            blocksFlat.reduce(
                                              (sum, { block }) =>
                                                sum +
                                                (typeof block.luas_area_non_efektif ===
                                                "number"
                                                  ? block.luas_area_non_efektif
                                                  : 0),
                                              0
                                            );
                                          const totalKonservasi =
                                            blocksFlat.reduce(
                                              (sum, { block }) =>
                                                sum +
                                                (typeof block.luas_konservasi ===
                                                "number"
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
                                              <TableCell></TableCell>
                                              <TableCell className="text-right">
                                                {formatNumber(totalLuasBlok)}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatNumber(totalJumlahPokok)}
                                              </TableCell>
                                              <TableCell
                                                colSpan={5}
                                              ></TableCell>
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
                                              <TableCell
                                                colSpan={3}
                                              ></TableCell>
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
                                      {Math.min(endIndex, blocksFlat.length)}{" "}
                                      dari {blocksFlat.length} blok
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

                      {companyEstates.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground">
                          Belum ada estate di perusahaan ini. Klik &quot;Tambah
                          Estate&quot; untuk menambahkan.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })}

        {companies.length === 0 && !loading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Belum ada data perusahaan. Klik tombol &quot;Tambah
              Perusahaan&quot; untuk menambahkan.
            </CardContent>
          </Card>
        )}

        {/* Dialog Edit Blok */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Blok</DialogTitle>
              <DialogDescription>
                Edit data blok{" "}
                {editingBlock?.block.id_blok || editingBlock?.block.no_blok}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Data Base Aresta */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white bg-blue-600 px-3 py-2 rounded">
                  Data Base Aresta
                </h3>
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
                  <div className="space-y-2 col-span-2">
                    <Label>Wilayah (No TPH)</Label>
                    <div className="flex flex-wrap gap-3 p-3 border rounded-md bg-white">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                        const selected =
                          editFormData.no_tph
                            ?.split(",")
                            .map((s) => s.trim())
                            .includes(String(num)) || false;
                        return (
                          <label
                            key={num}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const currentTphs =
                                  editFormData.no_tph
                                    ?.split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean) || [];
                                const newTphs = e.target.checked
                                  ? [...currentTphs, String(num)]
                                  : currentTphs.filter(
                                      (t) => t !== String(num)
                                    );
                                setEditFormData({
                                  ...editFormData,
                                  no_tph: newTphs
                                    .sort((a, b) => Number(a) - Number(b))
                                    .join(", "),
                                });
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">TPH {num}</span>
                          </label>
                        );
                      })}
                    </div>
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
                    <Label htmlFor="edit-luas-tanam">Luas Tanam Awal</Label>
                    <Input
                      id="edit-luas-tanam"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_tanam_ || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_tanam_: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-tahun">Tahun Tanam</Label>
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
                    <Label htmlFor="edit-jumlah-pokok">Jumlah Pokok Awal</Label>
                    <Input
                      id="edit-jumlah-pokok"
                      type="number"
                      step="0.001"
                      value={editFormData.jumlak_pokok || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          jumlak_pokok: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sph">SPH Awal</Label>
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
                </div>
              </div>

              {/* Hasil Mapping Survey */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white bg-green-600 px-3 py-2 rounded">
                  Hasil Mapping Survey
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-land-prep">
                      Luas Land Preparation
                    </Label>
                    <Input
                      id="edit-luas-land-prep"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_land_preparation || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_land_preparation:
                            parseFloat(e.target.value) || 0,
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
                    <Label htmlFor="edit-luas-lebungan">Luas Lebungan</Label>
                    <Input
                      id="edit-luas-lebungan"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_lebungan || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_lebungan: parseFloat(e.target.value) || 0,
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
                    <Label htmlFor="edit-luas-tanggul">Luas Tanggul</Label>
                    <Input
                      id="edit-luas-tanggul"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_tanggul || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_tanggul: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-non-efektif">
                      Luas Area Non Efektif
                    </Label>
                    <Input
                      id="edit-luas-non-efektif"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_area_non_efektif || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_area_non_efektif:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-konservasi">
                      Luas Konservasi
                    </Label>
                    <Input
                      id="edit-luas-konservasi"
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
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-pks">Luas PKS</Label>
                    <Input
                      id="edit-luas-pks"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_pks || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_pks: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-jalan">Luas Jalan</Label>
                    <Input
                      id="edit-luas-jalan"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_jalan || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_jalan: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-drainase">Luas Drainase</Label>
                    <Input
                      id="edit-luas-drainase"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_drainase || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_drainase: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-perumahan">Luas Perumahan</Label>
                    <Input
                      id="edit-luas-perumahan"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_perumahan || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_perumahan: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-luas-sarana">
                      Luas Sarana Prasanara
                    </Label>
                    <Input
                      id="edit-luas-sarana"
                      type="number"
                      step="0.001"
                      value={editFormData.luas_sarana_prasanara || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          luas_sarana_prasanara:
                            parseFloat(e.target.value) || 0,
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
                </div>
              </div>

              {/* Data Pokok (Aresta 2026) */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-bold text-white bg-emerald-600 px-3 py-2 rounded">
                  Data Pokok (Aresta 2026)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-pokok-total">Total Pokok</Label>
                    <Input
                      id="edit-pokok-total"
                      type="number"
                      value={editFormData.pokok_total || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          pokok_total: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-pokok-produktif">Pokok Produktif</Label>
                    <Input
                      id="edit-pokok-produktif"
                      type="number"
                      value={editFormData.pokok_produktif || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          pokok_produktif: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-pokok-bprod">Belum Produktif</Label>
                    <Input
                      id="edit-pokok-bprod"
                      type="number"
                      value={editFormData.pokok_belum_produktif || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          pokok_belum_produktif: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-pokok-mati">Pokok Mati</Label>
                    <Input
                      id="edit-pokok-mati"
                      type="number"
                      value={editFormData.pokok_mati || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          pokok_mati: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Hasil Sensus */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white bg-purple-600 px-3 py-2 rounded">
                  Hasil Sensus
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-jumlah-pokok-sensus">
                      Jumlah Pokok Sensus
                    </Label>
                    <Input
                      id="edit-jumlah-pokok-sensus"
                      type="number"
                      step="0.001"
                      value={editFormData.jumlah_pokok_sensus || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          jumlah_pokok_sensus: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Hasil Perhitungan (Read-only) */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white bg-orange-600 px-3 py-2 rounded">
                  Hasil Perhitungan (Otomatis)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Luas Non Tanaman</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={(() => {
                        const landPrep =
                          editFormData.luas_land_preparation || 0;
                        const nursery = editFormData.luas_nursery || 0;
                        const lebungan = editFormData.luas_lebungan || 0;
                        const garapan = editFormData.luas_garapan || 0;
                        const rawa = editFormData.luas_rawa || 0;
                        const tanggul = editFormData.luas_tanggul || 0;
                        const nonEfektif =
                          editFormData.luas_area_non_efektif || 0;
                        const konservasi = editFormData.luas_konservasi || 0;
                        const pks = editFormData.luas_pks || 0;
                        const jalan = editFormData.luas_jalan || 0;
                        const drainase = editFormData.luas_drainase || 0;
                        const perumahan = editFormData.luas_perumahan || 0;
                        const sarana = editFormData.luas_sarana_prasanara || 0;
                        const lain = editFormData.luas_lain___lain || 0;
                        return (
                          landPrep +
                          nursery +
                          lebungan +
                          garapan +
                          rawa +
                          tanggul +
                          nonEfektif +
                          konservasi +
                          pks +
                          jalan +
                          drainase +
                          perumahan +
                          sarana +
                          lain
                        ).toFixed(3);
                      })()}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Luas Tanam Awal</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={(editFormData.luas_tanam_ || 0).toFixed(3)}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Luas Blok</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={(() => {
                        const luasTanam = editFormData.luas_tanam_ || 0;
                        const landPrep =
                          editFormData.luas_land_preparation || 0;
                        const nursery = editFormData.luas_nursery || 0;
                        const lebungan = editFormData.luas_lebungan || 0;
                        const garapan = editFormData.luas_garapan || 0;
                        const rawa = editFormData.luas_rawa || 0;
                        const tanggul = editFormData.luas_tanggul || 0;
                        const nonEfektif =
                          editFormData.luas_area_non_efektif || 0;
                        const konservasi = editFormData.luas_konservasi || 0;
                        const pks = editFormData.luas_pks || 0;
                        const jalan = editFormData.luas_jalan || 0;
                        const drainase = editFormData.luas_drainase || 0;
                        const perumahan = editFormData.luas_perumahan || 0;
                        const sarana = editFormData.luas_sarana_prasanara || 0;
                        const lain = editFormData.luas_lain___lain || 0;
                        const totalNonTanaman =
                          landPrep +
                          nursery +
                          lebungan +
                          garapan +
                          rawa +
                          tanggul +
                          nonEfektif +
                          konservasi +
                          pks +
                          jalan +
                          drainase +
                          perumahan +
                          sarana +
                          lain;
                        return (luasTanam + totalNonTanaman).toFixed(3);
                      })()}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SPH Akhir</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={(() => {
                        const jumlahPokokSensus =
                          editFormData.jumlah_pokok_sensus || 0;
                        const luasTanam = editFormData.luas_tanam_ || 0;
                        if (luasTanam === 0) return "0";
                        return (jumlahPokokSensus / luasTanam).toFixed(3);
                      })()}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                </div>
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

        {/* Dialog Import Preview */}
        <Dialog
          open={isImportPreviewOpen}
          onOpenChange={setIsImportPreviewOpen}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview Import Data</DialogTitle>
              <DialogDescription>
                Estate: {importPreviewData?.estateName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <p className="text-sm text-muted-foreground">
                      Data Baru (Akan Ditambahkan)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      {importPreviewData?.newBlocks.length || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <p className="text-sm text-muted-foreground">
                      Data Update (Akan Diperbarui)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-600">
                      {importPreviewData?.updatedBlocks.length || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <p className="text-sm text-muted-foreground">
                      Duplikat (Akan Diabaikan)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-gray-600">
                      {importPreviewData?.existingBlocks.length || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* New Blocks Table */}
              {importPreviewData && importPreviewData.newBlocks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Data Baru</h3>
                  <div className="border rounded-lg overflow-auto max-h-60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Divisi</TableHead>
                          <TableHead>No Blok</TableHead>
                          <TableHead>ID Blok</TableHead>
                          <TableHead>Luas Blok</TableHead>
                          <TableHead>Jumlah Pokok</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewData.newBlocks
                          .slice(0, 20)
                          .map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.division}</TableCell>
                              <TableCell>{item.block.no_blok || "-"}</TableCell>
                              <TableCell>{item.block.id_blok || "-"}</TableCell>
                              <TableCell>
                                {formatNumber(item.block.luas_blok)}
                              </TableCell>
                              <TableCell>
                                {formatNumber(item.block.jumlak_pokok)}
                              </TableCell>
                            </TableRow>
                          ))}
                        {importPreviewData.newBlocks.length > 20 && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center text-muted-foreground"
                            >
                              ... dan {importPreviewData.newBlocks.length - 20}{" "}
                              data lainnya
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Updated Blocks Table */}
              {importPreviewData &&
                importPreviewData.updatedBlocks.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">
                      Data yang Akan Diperbarui
                    </h3>
                    <div className="border rounded-lg overflow-auto max-h-60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Divisi</TableHead>
                            <TableHead>No Blok</TableHead>
                            <TableHead>ID Blok</TableHead>
                            <TableHead>Luas Blok</TableHead>
                            <TableHead>Jumlah Pokok</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreviewData.updatedBlocks
                            .slice(0, 20)
                            .map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{item.division}</TableCell>
                                <TableCell>
                                  {item.block.no_blok || "-"}
                                </TableCell>
                                <TableCell>
                                  {item.block.id_blok || "-"}
                                </TableCell>
                                <TableCell>
                                  {formatNumber(item.block.luas_blok)}
                                </TableCell>
                                <TableCell>
                                  {formatNumber(item.block.jumlak_pokok)}
                                </TableCell>
                              </TableRow>
                            ))}
                          {importPreviewData.updatedBlocks.length > 20 && (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center text-muted-foreground"
                              >
                                ... dan{" "}
                                {importPreviewData.updatedBlocks.length - 20}{" "}
                                data lainnya
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

              {/* Existing Blocks Info */}
              {importPreviewData &&
                importPreviewData.existingBlocks.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">
                      Data Duplikat (ID/No Blok sudah ada)
                    </h3>
                    <div className="border rounded-lg overflow-auto max-h-40 bg-muted/50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Divisi</TableHead>
                            <TableHead>No Blok</TableHead>
                            <TableHead>ID Blok</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreviewData.existingBlocks
                            .slice(0, 10)
                            .map((item, idx) => (
                              <TableRow key={idx} className="opacity-50">
                                <TableCell>{item.division}</TableCell>
                                <TableCell>
                                  {item.block.no_blok || "-"}
                                </TableCell>
                                <TableCell>
                                  {item.block.id_blok || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          {importPreviewData.existingBlocks.length > 10 && (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="text-center text-muted-foreground"
                              >
                                ... dan{" "}
                                {importPreviewData.existingBlocks.length - 10}{" "}
                                data lainnya
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

              {importPreviewData &&
                importPreviewData.newBlocks.length === 0 &&
                importPreviewData.updatedBlocks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Tidak ada data baru atau update untuk diproses.
                  </div>
                )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsImportPreviewOpen(false)}
              >
                Batal
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={
                  !importPreviewData ||
                  (importPreviewData.newBlocks.length === 0 &&
                    importPreviewData.updatedBlocks.length === 0)
                }
                className="bg-green-600 hover:bg-green-700"
              >
                Import{" "}
                {(importPreviewData?.newBlocks.length || 0) +
                  (importPreviewData?.updatedBlocks.length || 0)}{" "}
                Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Import Wilayah Preview */}
        <Dialog
          open={isImportEstatePreviewOpen}
          onOpenChange={setIsImportEstatePreviewOpen}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Preview Import Wilayah</DialogTitle>
              <DialogDescription>
                Review data wilayah yang akan diimport
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <p className="text-sm text-muted-foreground">
                      Data Baru (Akan Ditambahkan)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      {importEstatePreviewData?.newEstates.length || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <p className="text-sm text-muted-foreground">
                      Duplikat (Akan Diabaikan)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-gray-600">
                      {importEstatePreviewData?.existingEstates.length || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {importEstatePreviewData?.newEstates.length ? (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Data Baru</h3>
                  <div className="border rounded-lg overflow-auto max-h-60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No</TableHead>
                          <TableHead>Nama Wilayah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importEstatePreviewData.newEstates.map((name, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}

              {importEstatePreviewData?.existingEstates.length ? (
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Data Duplikat (Akan Diabaikan)
                  </h3>
                  <div className="border rounded-lg overflow-auto max-h-40 bg-muted/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No</TableHead>
                          <TableHead>Nama Estate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importEstatePreviewData.existingEstates.map(
                          (name, idx) => (
                            <TableRow key={idx} className="opacity-50">
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{name}</TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}

              {!importEstatePreviewData?.newEstates.length &&
                !importEstatePreviewData?.existingEstates.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    Tidak ada data untuk ditambahkan.
                  </div>
                )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportEstatePreviewOpen(false);
                  setImportEstatePreviewData(null);
                }}
              >
                Batal
              </Button>
              <Button
                onClick={handleConfirmImportEstates}
                disabled={!importEstatePreviewData?.newEstates.length}
                className="bg-green-600 hover:bg-green-700"
              >
                Import {importEstatePreviewData?.newEstates.length || 0} Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    </>
  );
};

export default Locations;
