import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
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
import { Plus, Search, Edit, Trash2, Upload, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, type Pekerjaan } from "@/lib/api";
import * as XLSX from "xlsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PekerjaanPage = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterNoAkun, setFilterNoAkun] = useState<string>("all");
  const [filterCOA, setFilterCOA] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Pekerjaan[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingPekerjaan, setEditingPekerjaan] = useState<Pekerjaan | null>(
    null
  );

  // Confirmation Dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    sub_coa: "",
    coa: "",
    no_akun: "",
    jenis_pekerjaan: "",
    aktivitas: "",
    satuan: "",
    tipe: "",
  });

  // Import preview state
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    newItems: Pekerjaan[];
    existingItems: Pekerjaan[];
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const list = await api.pekerjaan();
      setRows(list);
    } catch (e) {
      toast({
        title: "Gagal",
        description: "Gagal memuat data pekerjaan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      sub_coa: "",
      coa: "",
      no_akun: "",
      jenis_pekerjaan: "",
      aktivitas: "",
      satuan: "",
      tipe: "",
    });
  };

  const handleEdit = (item: Pekerjaan) => {
    setEditingPekerjaan(item);
    setForm({
      sub_coa: item.sub_coa || "",
      coa: item.coa || "",
      no_akun: item.no_akun,
      jenis_pekerjaan: item.jenis_pekerjaan,
      aktivitas: item.aktivitas,
      satuan: item.satuan || "",
      tipe: item.tipe || "",
    });
    setOpenEdit(true);
  };

  const handleCloseEdit = () => {
    setOpenEdit(false);
    setEditingPekerjaan(null);
    resetForm();
  };

  const handleCloseAdd = () => {
    setOpenAdd(false);
    resetForm();
  };

  const handleOpenAdd = () => {
    resetForm(); // Ensure form is clean
    setOpenAdd(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deletePekerjaan(deleteId);
      setRows((prev) => prev.filter((item) => item._id !== deleteId));
      toast({
        title: "Berhasil",
        description: "Data pekerjaan berhasil dihapus",
      });
    } catch (e) {
      toast({
        title: "Gagal",
        description: "Gagal menghapus data",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubmit = async (isEdit: boolean) => {
    if (!form.no_akun || !form.jenis_pekerjaan) {
      toast({
        title: "Gagal",
        description: "No Akun dan Jenis Pekerjaan harus diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEdit && editingPekerjaan) {
        const updated = await api.updatePekerjaan(editingPekerjaan._id, form);
        setRows((prev) =>
          prev.map((item) => (item._id === updated._id ? updated : item))
        );
        setOpenEdit(false);
        setEditingPekerjaan(null);
        toast({
          title: "Berhasil",
          description: "Data pekerjaan diperbarui",
        });
      } else {
        const created = await api.createPekerjaan(form);
        setRows((prev) => [created, ...prev]);
        setOpenAdd(false);
        toast({
          title: "Berhasil",
          description: "Data pekerjaan ditambahkan",
        });
      }
      setForm({
        sub_coa: "",
        coa: "",
        no_akun: "",
        jenis_pekerjaan: "",
        aktivitas: "",
        satuan: "",
        tipe: "",
      });
    } catch (e) {
      toast({
        title: "Gagal",
        description: e instanceof Error ? e.message : "Gagal menyimpan",
        variant: "destructive",
      });
    }
  };

  const uniqueAccounts = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.no_akun) set.add(r.no_akun);
    });
    return Array.from(set).sort();
  }, [rows]);

  const uniqueSubCOA = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.sub_coa) set.add(r.sub_coa);
    });
    return Array.from(set).sort();
  }, [rows]);

  const uniqueCOA = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.coa) set.add(r.coa);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filteredAll = useMemo(
    () =>
      rows.filter((item) => {
        const matchSearch =
          item.no_akun.toLowerCase().includes(search.toLowerCase()) ||
          item.jenis_pekerjaan.toLowerCase().includes(search.toLowerCase()) ||
          item.aktivitas.toLowerCase().includes(search.toLowerCase());
        const matchNoAkun =
          filterNoAkun === "all" || item.no_akun === filterNoAkun;
        const matchCOA = filterCOA === "all" || item.coa === filterCOA;
        return matchSearch && matchNoAkun && matchCOA;
      }),
    [rows, search, filterNoAkun, filterCOA]
  );
  const totalPages = Math.max(1, Math.ceil(filteredAll.length / pageSize));
  const filtered = useMemo(
    () => filteredAll.slice((page - 1) * pageSize, page * pageSize),
    [filteredAll, page]
  );

  const handleExportExcel = () => {
    try {
      const exportData = filtered.map((p) => ({
        "Sub COA": p.sub_coa || "-",
        COA: p.coa || "-",
        "No Akun": p.no_akun,
        "Jenis Pekerjaan": p.jenis_pekerjaan,
        Aktivitas: p.aktivitas || "-",
        Satuan: p.satuan || "-",
        "Tipe Upah": p.tipe || "-",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pekerjaan");
      XLSX.writeFile(
        wb,
        `Pekerjaan_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      toast({ title: "Berhasil", description: "Data berhasil diekspor" });
    } catch (e) {
      toast({
        title: "Gagal",
        description: "Gagal mengekspor data",
        variant: "destructive",
      });
    }
  };

  const handleImportExcel = () => {
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
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData =
            XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

          const newItems: Pekerjaan[] = [];
          const existingItems: Pekerjaan[] = [];

          jsonData.forEach((row) => {
            // Ambil nilai sub_coa dan coa langsung dari Excel, normalisasi dengan trim
            let sub_coa =
              row["Sub COA"] !== undefined ? String(row["Sub COA"]).trim() : "";
            let coa = row["COA"] !== undefined ? String(row["COA"]).trim() : "";
            // Jika kosong atau tanda '-', jadikan string kosong
            if (sub_coa === "-" || sub_coa === "") sub_coa = "";
            if (coa === "-" || coa === "") coa = "";

            const no_akun = String(row["No Akun"] || "").trim();
            const jenis_pekerjaan = String(row["Jenis Pekerjaan"] || "").trim();
            let aktivitas =
              row["Aktivitas"] !== undefined
                ? String(row["Aktivitas"]).trim()
                : "";
            if (aktivitas === "-" || aktivitas === "") aktivitas = "";
            let satuan =
              row["Satuan"] !== undefined ? String(row["Satuan"]).trim() : "";
            if (satuan === "-" || satuan === "") satuan = "";
            let tipe =
              row["Tipe Upah"] !== undefined
                ? String(row["Tipe Upah"]).trim()
                : "";
            if (tipe === "-" || tipe === "") tipe = "";

            if (!no_akun || !jenis_pekerjaan) return;

            // Check if pekerjaan already exists
            const exists = rows.find(
              (p) =>
                p.jenis_pekerjaan.toLowerCase() ===
                  jenis_pekerjaan.toLowerCase() &&
                p.aktivitas.toLowerCase() === aktivitas.toLowerCase()
            );

            const pekerjaanObj: Pekerjaan = {
              _id: exists ? exists._id : `temp_${Date.now()}_${Math.random()}`,
              sub_coa,
              coa,
              no_akun,
              jenis_pekerjaan,
              aktivitas,
              satuan,
              tipe,
              status: "active",
            };

            if (exists) {
              existingItems.push(pekerjaanObj);
            } else {
              newItems.push(pekerjaanObj);
            }
          });

          setImportPreviewData({ newItems, existingItems });
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

    try {
      setLoading(true);
      const { newItems } = importPreviewData;
      const createdItems: Pekerjaan[] = [];

      for (const item of newItems) {
        try {
          // Pastikan sub_coa dan coa dikirim persis dari hasil import Excel
          const created = await api.createPekerjaan({
            sub_coa: item.sub_coa ?? "",
            coa: item.coa ?? "",
            no_akun: item.no_akun,
            jenis_pekerjaan: item.jenis_pekerjaan,
            aktivitas: item.aktivitas,
            satuan: item.satuan ?? "",
            tipe: item.tipe ?? "",
          });
          createdItems.push(created);
        } catch (e) {
          console.error(
            `Failed to create pekerjaan ${item.jenis_pekerjaan}:`,
            e
          );
        }
      }

      setRows((prev) => [...createdItems, ...prev]);

      toast({
        title: "Import Berhasil",
        description: `${createdItems.length} pekerjaan baru berhasil ditambahkan. ${importPreviewData.existingItems.length} data duplikat diabaikan.`,
      });

      setIsImportPreviewOpen(false);
      setImportPreviewData(null);
    } catch (error) {
      toast({
        title: "Gagal Import",
        description: "Terjadi kesalahan saat menyimpan data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pekerjaan</h1>
          <p className="text-muted-foreground">Kelola daftar pekerjaan</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportExcel}
            className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Excel
          </Button>
          <Button
            size="sm"
            onClick={handleExportExcel}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Dialog
            open={openAdd}
            onOpenChange={(open) => !open && handleCloseAdd()}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleOpenAdd}
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Pekerjaan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Pekerjaan Baru</DialogTitle>
              </DialogHeader>
              <div
                className="space-y-4 py-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label>Sub COA</Label>
                  <Select
                    value={
                      uniqueSubCOA.includes(form.sub_coa) ? form.sub_coa : ""
                    }
                    onValueChange={(val) => setForm({ ...form, sub_coa: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Sub COA" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueSubCOA.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!uniqueSubCOA.includes(form.sub_coa) && form.sub_coa && (
                    <p className="text-sm text-muted-foreground">
                      Nilai baru: "{form.sub_coa}"
                    </p>
                  )}
                  <Input
                    placeholder="Atau ketik Sub COA baru"
                    value={form.sub_coa}
                    onChange={(e) =>
                      setForm({ ...form, sub_coa: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>COA</Label>
                  <Select
                    value={uniqueCOA.includes(form.coa) ? form.coa : ""}
                    onValueChange={(val) => setForm({ ...form, coa: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih COA" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueCOA.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!uniqueCOA.includes(form.coa) && form.coa && (
                    <p className="text-sm text-muted-foreground">
                      Nilai baru: "{form.coa}"
                    </p>
                  )}
                  <Input
                    placeholder="Atau ketik COA baru"
                    value={form.coa}
                    onChange={(e) => setForm({ ...form, coa: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>No Akun</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        value={form.no_akun}
                        onValueChange={(val) =>
                          setForm({ ...form, no_akun: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih No Akun" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueAccounts.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Create new if not exists logic can be handled by just text input if select is insufficient, but user asked for dropdown. 
                       Lets adding a way to type manual */}
                  </div>
                  <div className="pt-1">
                    <Input
                      placeholder="Atau ketik No Akun baru..."
                      value={form.no_akun}
                      onChange={(e) =>
                        setForm({ ...form, no_akun: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Jenis Pekerjaan</Label>
                  <Input
                    value={form.jenis_pekerjaan}
                    onChange={(e) =>
                      setForm({ ...form, jenis_pekerjaan: e.target.value })
                    }
                    placeholder="Contoh: Panen"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Aktivitas</Label>
                  <Input
                    value={form.aktivitas}
                    onChange={(e) =>
                      setForm({ ...form, aktivitas: e.target.value })
                    }
                    placeholder="Contoh: Potong Buah"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Satuan</Label>
                  <Input
                    value={form.satuan}
                    onChange={(e) =>
                      setForm({ ...form, satuan: e.target.value })
                    }
                    placeholder="Contoh: Kg, Ha, Unit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipe Upah</Label>
                  <Select
                    value={form.tipe}
                    onValueChange={(val) => setForm({ ...form, tipe: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Satuan">Satuan</SelectItem>
                      <SelectItem value="Borongan">Borongan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseAdd}>
                  Batal
                </Button>
                <Button onClick={() => handleSubmit(false)}>Simpan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari No Akun, Pekerjaan, atau Aktivitas..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Filter:</span>
              <div className="w-full md:w-[200px]">
                <Select
                  value={filterNoAkun}
                  onValueChange={(val) => {
                    setFilterNoAkun(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter No Akun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua No Akun</SelectItem>
                    {uniqueAccounts.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-[200px]">
                <Select
                  value={filterCOA}
                  onValueChange={(val) => {
                    setFilterCOA(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter COA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua COA</SelectItem>
                    {uniqueCOA.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sub COA</TableHead>
                <TableHead>COA</TableHead>
                <TableHead>No Akun</TableHead>
                <TableHead>Jenis Pekerjaan</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead>Tipe Upah</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">
                      {item.sub_coa || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.coa || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.no_akun}
                    </TableCell>
                    <TableCell>{item.jenis_pekerjaan}</TableCell>
                    <TableCell>{item.aktivitas || "-"}</TableCell>
                    <TableCell>{item.satuan || "-"}</TableCell>
                    <TableCell>{item.tipe || "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(item._id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm">
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={openEdit}
        onOpenChange={(open) => !open && handleCloseEdit()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pekerjaan</DialogTitle>
          </DialogHeader>
          <div
            className="space-y-4 py-4"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(true);
              }
            }}
          >
            <div className="space-y-2">
              <Label>Sub COA</Label>
              <Select
                value={form.sub_coa}
                onValueChange={(val) => setForm({ ...form, sub_coa: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Sub COA" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueSubCOA.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>COA</Label>
              <Select
                value={form.coa}
                onValueChange={(val) => setForm({ ...form, coa: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih COA" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueCOA.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>No Akun</Label>
              <Select
                value={form.no_akun}
                onValueChange={(val) => setForm({ ...form, no_akun: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih No Akun" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueAccounts.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jenis Pekerjaan</Label>
              <Input
                value={form.jenis_pekerjaan}
                onChange={(e) =>
                  setForm({ ...form, jenis_pekerjaan: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Aktivitas</Label>
              <Input
                value={form.aktivitas}
                onChange={(e) =>
                  setForm({ ...form, aktivitas: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Satuan</Label>
              <Input
                value={form.satuan}
                onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                placeholder="Contoh: Kg, Ha, Unit"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe Upah</Label>
              <Select
                value={form.tipe}
                onValueChange={(val) => setForm({ ...form, tipe: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Satuan">Satuan</SelectItem>
                  <SelectItem value="Borongan">Borongan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEdit}>
              Batal
            </Button>
            <Button onClick={() => handleSubmit(true)}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Data yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Import Preview */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Import Data Pekerjaan</DialogTitle>
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
                    {importPreviewData?.newItems.length || 0}
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
                    {importPreviewData?.existingItems.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {importPreviewData && importPreviewData.newItems.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Data Baru</h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sub COA</TableHead>
                        <TableHead>COA</TableHead>
                        <TableHead>No Akun</TableHead>
                        <TableHead>Jenis Pekerjaan</TableHead>
                        <TableHead>Aktivitas</TableHead>
                        <TableHead>Satuan</TableHead>
                        <TableHead>Tipe Upah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.newItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.sub_coa || "-"}</TableCell>
                          <TableCell>{item.coa || "-"}</TableCell>
                          <TableCell>{item.no_akun}</TableCell>
                          <TableCell>{item.jenis_pekerjaan}</TableCell>
                          <TableCell>{item.aktivitas}</TableCell>
                          <TableCell>{item.satuan || "-"}</TableCell>
                          <TableCell>{item.tipe || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importPreviewData &&
              importPreviewData.existingItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Data Duplikat (Jenis Pekerjaan & Aktivitas sudah ada)
                  </h3>
                  <div className="border rounded-lg overflow-auto max-h-40 bg-muted/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Jenis Pekerjaan</TableHead>
                          <TableHead>Aktivitas</TableHead>
                          <TableHead>No Akun</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewData.existingItems.map((item, idx) => (
                          <TableRow key={idx} className="opacity-50">
                            <TableCell>{item.jenis_pekerjaan}</TableCell>
                            <TableCell>{item.aktivitas}</TableCell>
                            <TableCell>{item.no_akun}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

            {importPreviewData && importPreviewData.newItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada data baru untuk ditambahkan.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsImportPreviewOpen(false)}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={
                !importPreviewData || importPreviewData.newItems.length === 0
              }
              className="bg-green-600 hover:bg-green-700"
            >
              Import {importPreviewData?.newItems.length} Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PekerjaanPage;
