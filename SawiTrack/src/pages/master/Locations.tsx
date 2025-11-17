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
import { Download, Plus, Search, Upload, ChevronLeft, ChevronRight } from "lucide-react";
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
  "Tahun"?: number | string;
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

  // Helper function to format numbers: 0 stays as "0", whole numbers without decimals, decimals with 3 digits
  const formatNumber = (value: number | null | undefined): string => {
    if (value == null) return "-";
    if (value === 0) return "0";
    // Check if it's a whole number
    if (Number.isInteger(value)) return value.toString();
    // Has decimals, show with 3 decimal places
    return value.toFixed(3);
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
        "Luas Lain-Lain": numOr0(block.luas_lain___lain ?? block.luas_lain__lain),
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
          const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet) as ExcelRow[];

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
            const existingEstate = await api.estate(estateId) as { divisions?: Array<{ division_id: number; blocks?: Block[] }> };
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
                const existingBlocks: Block[] = (updatedDivisions[divisionIndex].blocks || []) as Block[];
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
                    setCurrentPages(prev => ({ ...prev, [es._id]: currentPage - 1 }));
                  }
                };
                
                const handleNextPage = () => {
                  if (currentPage < totalPages) {
                    setCurrentPages(prev => ({ ...prev, [es._id]: currentPage + 1 }));
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedBlocks.map(({ division_id, block }, idx) => (
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
                                      block.jumlah_pokok ?? block.jumlak_pokok;
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
                                    ? formatNumber(block.luas_area_non_efektif)
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
                              </TableRow>
                            ))}
                            {blocksFlat.length === 0 && (
                              <TableRow>
                                <TableCell
                                  colSpan={18}
                                  className="text-center text-sm text-muted-foreground"
                                >
                                  Tidak ada data blok
                                </TableCell>
                              </TableRow>
                            )}
                            {blocksFlat.length > 0 && (
                              <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={1}>TOTAL:</TableCell>
                                <TableCell className="text-right">
                                  {
                                    new Set(
                                      blocksFlat.map(
                                        ({ division_id }) => division_id
                                      )
                                    ).size
                                  }{" "}
                                  Divisi,{" "}
                                  {
                                    new Set(
                                      blocksFlat.map(
                                        ({ block }) => block.id_blok
                                      )
                                    ).size
                                  }{" "}
                                  Blok
                                </TableCell>
                                <TableCell colSpan={16}></TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {blocksFlat.length > itemsPerPage && (
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-muted-foreground">
                            Menampilkan {startIndex + 1} - {Math.min(endIndex, blocksFlat.length)} dari {blocksFlat.length} blok
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
        <Toaster />
      </div>
    </>
  );
};

export default Locations;
