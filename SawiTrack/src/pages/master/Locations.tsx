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
import { Download, Plus, Search, Upload } from "lucide-react";
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
    const exportData: any[] = [];

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

    blocksFlat.forEach(({ division_id, block }) => {
      exportData.push({
        Divisi: `Divisi ${division_id}`,
        "No Blok": block.no_blok ?? "",
        "ID Blok": block.id_blok ?? "",
        "Location Type": block.location?.type ?? "",
        "Jenis Tanah": block.jenis_tanah ?? "",
        Topografi: block.topografi ?? "",
        "Luas Tanam": block.luas_tanam_ ?? 0,
        Tahun: block.tahun_ ?? 0,
        "Jumlah Pokok": block.jumlak_pokok ?? 0,
        "Jenis Bibit": block.jenis_bibit ?? "",
        "Luas Land Preparation": block.luas_land_preparation ?? 0,
        "Luas Nursery": block.luas_nursery ?? 0,
        "Luas Lain-Lain": block.luas_lain___lain ?? 0,
        "Luas Lebungan": block.luas_lebungan ?? 0,
        "Luas Garapan": block.luas_garapan ?? 0,
        "Luas Rawa": block.luas_rawa ?? 0,
        "Luas Tanggul": block.luas_tanggul ?? 0,
        "Luas Area Non Efektif": block.luas_area_non_efektif ?? 0,
        "Luas Konservasi": block.luas_konservasi ?? 0,
        "Luas PKS": block.luas_pks ?? 0,
        "Luas Jalan": block.luas_jalan ?? 0,
        "Luas Drainase": block.luas_drainase ?? 0,
        "Luas Perumahan": block.luas_perumahan ?? 0,
        "Luas Sarana Prasanara": block.luas_sarana_prasanara ?? 0,
        "Luas Blok": block.luas_blok ?? 0,
        SPH: block.SPH ?? 0,
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
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

          // Group data by Division only (Estate already selected)
          const groupedData: Record<string, any[]> = {};

          jsonData.forEach((row) => {
            const divisi = row.Divisi || row.divisi || "";

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
            const blockData: any = {
              no_blok: row["No Blok"] || "",
              id_blok: row["ID Blok"] || "",
              jenis_tanah: row["Jenis Tanah"] || "",
              topografi: row["Topografi"] || row.Topografi || "",
              luas_tanam_: Number(row["Luas Tanam"]) || 0,
              tahun_: Number(row["Tahun"]) || Number(row.Tahun) || 0,
              jumlak_pokok: Number(row["Jumlah Pokok"]) || 0,
              jenis_bibit: row["Jenis Bibit"] || "",
              luas_land_preparation: Number(row["Luas Land Preparation"]) || 0,
              luas_nursery: Number(row["Luas Nursery"]) || 0,
              luas_lain___lain: Number(row["Luas Lain-Lain"]) || 0,
              luas_lebungan: Number(row["Luas Lebungan"]) || 0,
              luas_garapan: Number(row["Luas Garapan"]) || 0,
              luas_rawa: Number(row["Luas Rawa"]) || 0,
              luas_tanggul: Number(row["Luas Tanggul"]) || 0,
              luas_area_non_efektif: Number(row["Luas Area Non Efektif"]) || 0,
              luas_konservasi:
                Number(row["Luas Konservasi"]) || Number(row.Konservasi) || 0,
              luas_pks: Number(row["Luas PKS"]) || 0,
              luas_jalan: Number(row["Luas Jalan"]) || 0,
              luas_drainase: Number(row["Luas Drainase"]) || 0,
              luas_perumahan: Number(row["Luas Perumahan"]) || 0,
              luas_sarana_prasanara: Number(row["Luas Sarana Prasanara"]) || 0,
              luas_blok: Number(row["Luas Blok"]) || 0,
              SPH: Number(row["SPH"]) || Number(row.SPH) || 0,
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
            const existingEstate: any = await api.estate(estateId);
            const existingDivisions = existingEstate.divisions || [];

            // Build divisions array with blocks
            const updatedDivisions = [...existingDivisions];

            for (const [divisionName, blocks] of Object.entries(groupedData)) {
              const divisionId = parseInt(
                divisionName.replace("Divisi ", "").trim()
              );

              // Find existing division or create new
              let divisionIndex = updatedDivisions.findIndex(
                (d: any) => d.division_id === divisionId
              );

              if (divisionIndex === -1) {
                // Add new division
                updatedDivisions.push({
                  division_id: divisionId,
                  blocks: blocks,
                });
              } else {
                // Add new blocks to existing division (tidak menimpa)
                const existingBlocks =
                  updatedDivisions[divisionIndex].blocks || [];
                const mergedBlocks = [...existingBlocks];

                let addedCount = 0;
                (blocks as any[]).forEach((newBlock: any) => {
                  // Cek apakah blok sudah ada berdasarkan id_blok ATAU no_blok
                  const existingIndex = mergedBlocks.findIndex(
                    (b: any) =>
                      (b.id_blok && b.id_blok === newBlock.id_blok) ||
                      (b.no_blok && b.no_blok === newBlock.no_blok)
                  );

                  // Hanya tambah jika benar-benar belum ada
                  if (existingIndex === -1) {
                    mergedBlocks.push(newBlock);
                    addedCount++;
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
                            {blocksFlat.map(({ division_id, block }, idx) => (
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
