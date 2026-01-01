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
import { Plus, Search, Edit, Trash2 } from "lucide-react";
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
    no_akun: "",
    jenis_pekerjaan: "",
    aktivitas: "",
    satuan: "",
    tipe: "",
  });

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
    const list = Array.from(new Set(rows.map((r) => r.no_akun))).filter(
      Boolean
    );
    return list.sort();
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((item) => {
        const matchSearch =
          item.no_akun.toLowerCase().includes(search.toLowerCase()) ||
          item.jenis_pekerjaan.toLowerCase().includes(search.toLowerCase()) ||
          item.aktivitas.toLowerCase().includes(search.toLowerCase());

        const matchFilter =
          filterNoAkun === "all" || item.no_akun === filterNoAkun;

        return matchSearch && matchFilter;
      }),
    [rows, search, filterNoAkun]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pekerjaan</h1>
          <p className="text-muted-foreground">Kelola daftar pekerjaan</p>
        </div>
        <Dialog
          open={openAdd}
          onOpenChange={(open) => !open && handleCloseAdd()}
        >
          <DialogTrigger asChild>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleOpenAdd}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Data
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
              <Button variant="outline" onClick={handleCloseAdd}>
                Batal
              </Button>
              <Button onClick={() => handleSubmit(false)}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari No Akun, Pekerjaan, atau Aktivitas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Filter:</span>
              <div className="w-full md:w-[200px]">
                <Select value={filterNoAkun} onValueChange={setFilterNoAkun}>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={7} className="text-center">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item._id}>
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
    </div>
  );
};

export default PekerjaanPage;
