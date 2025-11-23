import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Upload, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api, type Employee, type Company } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { TooltipButton } from "@/components/ui/TooltipButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";

const Workers = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    nik: "",
    name: "",
    companyId: "",
    position: "",
    salary: 0,
    address: "",
    phone: "",
    birthDate: "",
    status: "active",
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([api.employees(), api.companies()])
      .then(([emps, comps]) => {
        setRows(emps);
        setCompanies(comps);
      })
      .catch(() =>
        toast({
          title: "Gagal",
          description: "Gagal memuat data",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredWorkers = useMemo(
    () =>
      rows.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.nik.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );

  const handleEdit = (worker: Employee) => {
    setEditingWorker(worker);
    setForm({
      nik: worker.nik,
      name: worker.name,
      companyId: worker.companyId || "",
      position: worker.position || "",
      salary: worker.salary || 0,
      address: worker.address || "",
      phone: worker.phone || "",
      birthDate: worker.birthDate ? new Date(worker.birthDate).toISOString().split('T')[0] : "",
      status: worker.status || "active",
    });
    setOpenEdit(true);
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker) return;

    try {
      if (!form.nik || !form.name) {
        toast({
          title: "Gagal",
          description: "NIK dan Nama harus diisi",
          variant: "destructive",
        });
        return;
      }

      await api.updateEmployee(editingWorker._id, {
        nik: form.nik,
        name: form.name,
        companyId: form.companyId || null,
        position: form.position || null,
        salary: form.salary || null,
        address: form.address || null,
        phone: form.phone || null,
        birthDate: form.birthDate || null,
        status: form.status,
      });

      setRows((prev) =>
        prev.map((w) =>
          w._id === editingWorker._id
            ? { ...w, ...form, companyId: form.companyId || undefined, status: form.status }
            : w
        )
      );

      setOpenEdit(false);
      setEditingWorker(null);
      setForm({
        nik: "",
        name: "",
        companyId: "",
        position: "",
        salary: 0,
        address: "",
        phone: "",
        birthDate: "",
        status: "active",
      });

      toast({
        title: "Berhasil",
        description: "Data karyawan berhasil diperbarui",
      });
    } catch (e) {
      toast({
        title: "Gagal",
        description: e instanceof Error ? e.message : "Gagal memperbarui",
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
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const imported: Employee[] = [];
        for (const row of json) {
          const companyName = row["Perusahaan"] || "";
          const company = companies.find((c) => c.company_name === companyName);

          const created = await api.createEmployee({
            nik: String(row["NIK"] || ""),
            name: String(row["Nama"] || ""),
            companyId: company?._id,
            position: row["Posisi"] ? String(row["Posisi"]) : undefined,
            salary: row["Gaji"] ? Number(row["Gaji"]) : undefined,
            address: row["Alamat"] ? String(row["Alamat"]) : undefined,
            phone: row["Telepon"] ? String(row["Telepon"]) : undefined,
            birthDate: row["Tanggal Lahir"]
              ? String(row["Tanggal Lahir"])
              : undefined,
          });
          imported.push(created);
        }
        setRows((prev) => [...imported, ...prev]);
        toast({
          title: "Berhasil",
          description: `${imported.length} karyawan berhasil diimpor`,
        });
      } catch (e) {
        toast({
          title: "Gagal",
          description: e instanceof Error ? e.message : "Gagal mengimpor",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const handleExportExcel = () => {
    try {
      const exportData = filteredWorkers.map((w) => {
        const company = companies.find((c) => c._id === w.companyId);
        return {
          NIK: w.nik,
          Nama: w.name,
          Perusahaan: company?.company_name || "-",
          Posisi: w.position || "-",
          Gaji: w.salary || 0,
          Alamat: w.address || "-",
          Telepon: w.phone || "-",
          "Tanggal Lahir": w.birthDate || "-",
          Status: w.status === "active" ? "Aktif" : "Nonaktif",
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Karyawan");
      XLSX.writeFile(
        wb,
        `Karyawan_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      toast({
        title: "Berhasil",
        description: "Data berhasil diekspor",
      });
    } catch (e) {
      toast({
        title: "Gagal",
        description: "Gagal mengekspor data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Karyawan</h1>
          <p className="text-muted-foreground">
            Kelola data karyawan (bukan akun login)
          </p>
        </div>
        <div className="flex gap-2">
          <TooltipButton tooltip="Import data karyawan dari Excel">
            <Button variant="outline" onClick={handleImportExcel}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </TooltipButton>
          <TooltipButton tooltip="Export data karyawan ke Excel">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </TooltipButton>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Karyawan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Karyawan Baru</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>NIK</Label>
                    <Input
                      placeholder="Masukkan NIK karyawan"
                      value={form.nik}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nik: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nama Lengkap</Label>
                    <Input
                      placeholder="Masukkan nama lengkap"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Perusahaan</Label>
                    <Select
                      value={form.companyId}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, companyId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih perusahaan" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Posisi/Jabatan</Label>
                    <Input
                      placeholder="Contoh: Pemanen, Mandor"
                      value={form.position}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, position: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gaji</Label>
                    <Input
                      type="number"
                      placeholder="Masukkan gaji"
                      min="0"
                      value={form.salary}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setForm((f) => ({
                          ...f,
                          salary: value < 0 ? 0 : value,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Lahir</Label>
                    <Input
                      type="date"
                      value={form.birthDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, birthDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telepon</Label>
                    <Input
                      placeholder="Contoh: 081234567890"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Alamat</Label>
                    <Input
                      placeholder="Masukkan alamat lengkap"
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={async () => {
                    try {
                      if (!form.nik || !form.name) {
                        toast({
                          title: "Gagal",
                          description: "NIK dan Nama harus diisi",
                          variant: "destructive",
                        });
                        return;
                      }
                      const created = await api.createEmployee({
                        nik: form.nik,
                        name: form.name,
                        companyId: form.companyId || undefined,
                        position: form.position || undefined,
                        salary: form.salary || undefined,
                        address: form.address || undefined,
                        phone: form.phone || undefined,
                        birthDate: form.birthDate || undefined,
                      });
                      setRows((prev) => [created, ...prev]);
                      setOpenAdd(false);
                      setForm({
                        nik: "",
                        name: "",
                        companyId: "",
                        position: "",
                        salary: 0,
                        address: "",
                        phone: "",
                        birthDate: "",
                        status: "active",
                      });
                      toast({
                        title: "Berhasil",
                        description: "Karyawan berhasil ditambahkan",
                      });
                    } catch (e) {
                      toast({
                        title: "Gagal",
                        description:
                          e instanceof Error ? e.message : "Gagal menyimpan",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Simpan
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari karyawan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIK</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Posisi</TableHead>
                <TableHead>Gaji</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Memuat...
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredWorkers.map((worker) => {
                  const company = companies.find(
                    (c) => c._id === worker.companyId
                  );
                  return (
                    <TableRow key={worker._id}>
                      <TableCell className="font-mono">{worker.nik}</TableCell>
                      <TableCell className="font-medium">
                        {worker.name}
                      </TableCell>
                      <TableCell>{company?.company_name || "-"}</TableCell>
                      <TableCell>{worker.position || "-"}</TableCell>
                      <TableCell>
                        {worker.salary
                          ? `Rp ${worker.salary.toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            worker.status === "active" ? "default" : "secondary"
                          }
                        >
                          {worker.status === "active" ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(worker)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Edit Pekerja */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data Karyawan</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>NIK</Label>
                <Input
                  placeholder="Masukkan NIK karyawan"
                  value={form.nik}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nik: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input
                  placeholder="Masukkan nama lengkap"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Perusahaan</Label>
                <Select
                  value={form.companyId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, companyId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih perusahaan" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Posisi/Jabatan</Label>
                <Input
                  placeholder="Contoh: Pemanen, Mandor"
                  value={form.position}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, position: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Gaji</Label>
                <Input
                  type="number"
                  placeholder="Masukkan gaji"
                  min="0"
                  value={form.salary}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setForm((f) => ({ ...f, salary: value < 0 ? 0 : value }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Lahir</Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, birthDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Telepon</Label>
                <Input
                  placeholder="Contoh: 081234567890"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Alamat</Label>
                <Input
                  placeholder="Masukkan alamat lengkap"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenEdit(false);
                  setEditingWorker(null);
                  setForm({
                    nik: "",
                    name: "",
                    companyId: "",
                    position: "",
                    salary: 0,
                    address: "",
                    phone: "",
                    birthDate: "",
                    status: "active",
                  });
                }}
              >
                Batal
              </Button>
              <Button type="button" onClick={handleUpdateWorker}>
                Simpan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
};

export default Workers;
