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

  // Import preview state
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    newEmployees: Partial<Employee>[];
    updatedEmployees: { employee: Partial<Employee>; oldEmployee: Employee }[];
    existingEmployees: Partial<Employee>[];
  } | null>(null);

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
    if (!editingWorker || !editingWorker._id) return;

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
        companyId: form.companyId || "",
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
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array", cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

          const newEmployees: Partial<Employee>[] = [];
          const updatedEmployees: { employee: Partial<Employee>; oldEmployee: Employee }[] = [];
          const existingEmployees: Partial<Employee>[] = [];

          const areEmployeesEqual = (emp1: Partial<Employee>, emp2: Employee): boolean => {
            const fields = ['name', 'companyId', 'position', 'salary', 'address', 'phone', 'birthDate'] as const;
            for (const field of fields) {
              const val1 = emp1[field];
              const val2 = emp2[field];
              // Normalize for comparison
              const norm1 = val1 === undefined || val1 === null || val1 === "" ? null : val1;
              const norm2 = val2 === undefined || val2 === null || val2 === "" ? null : val2;

              if (field === 'salary') {
                if (Number(norm1 || 0) !== Number(norm2 || 0)) return false;
              } else if (norm1 !== norm2) {
                return false;
              }
            }
            return true;
          };

          const parseDate = (dateStr: unknown): string | undefined => {
            if (!dateStr) return undefined;

            // If it's already a Date object (from cellDates: true)
            if (dateStr instanceof Date) {
              // Adjust for timezone offset if needed, but usually ISO string is fine
              // However, Excel dates are often local time. 
              // Let's just take the YYYY-MM-DD part to be safe and treat as UTC or local noon to avoid shifting
              const year = dateStr.getFullYear();
              const month = String(dateStr.getMonth() + 1).padStart(2, '0');
              const day = String(dateStr.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}T00:00:00.000Z`;
            }

            // If it's a number (Excel serial date, if cellDates was false or failed)
            if (typeof dateStr === 'number') {
              // Excel base date is usually Dec 30 1899
              const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}T00:00:00.000Z`;
            }

            const str = String(dateStr).trim();

            // Handle DD-MM-YYYY or DD/MM/YYYY
            if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
              const parts = str.split(/[-/]/);
              // parts[0] = day, parts[1] = month, parts[2] = year
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              return `${year}-${month}-${day}T00:00:00.000Z`;
            }

            // Handle YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
              return new Date(str).toISOString();
            }

            return undefined;
          };

          jsonData.forEach((row) => {
            const nik = String(row["NIK"] || "").trim();
            const name = String(row["Nama"] || "").trim();
            const companyName = row["Perusahaan"] || "";
            const company = companies.find((c) => c.company_name === companyName);

            if (!nik || !name) return;

            const employeeObj: Partial<Employee> = {
              nik,
              name,
              companyId: company?._id,
              position: row["Posisi"] ? String(row["Posisi"]) : undefined,
              salary: row["Gaji"] ? Number(row["Gaji"]) : undefined,
              address: row["Alamat"] ? String(row["Alamat"]) : undefined,
              phone: row["Telepon"] ? String(row["Telepon"]) : undefined,
              birthDate: parseDate(row["Tanggal Lahir"]),
              status: "active",
            };

            const existing = rows.find((w) => w.nik === nik);

            if (existing) {
              if (areEmployeesEqual(employeeObj, existing)) {
                existingEmployees.push(employeeObj);
              } else {
                updatedEmployees.push({ employee: employeeObj, oldEmployee: existing });
              }
            } else {
              newEmployees.push(employeeObj);
            }
          });

          setImportPreviewData({ newEmployees, updatedEmployees, existingEmployees });
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
      const { newEmployees, updatedEmployees } = importPreviewData;
      const processedEmployees: Employee[] = [];

      // Create new employees
      for (const emp of newEmployees) {
        try {
          const created = await api.createEmployee({
            nik: emp.nik!,
            name: emp.name!,
            companyId: emp.companyId,
            position: emp.position,
            salary: emp.salary,
            address: emp.address,
            phone: emp.phone,
            birthDate: emp.birthDate,
          });
          processedEmployees.push(created);
        } catch (e) {
          console.error(`Failed to create employee ${emp.nik}:`, e);
        }
      }

      // Update existing employees
      for (const { employee, oldEmployee } of updatedEmployees) {
        try {
          await api.updateEmployee(oldEmployee._id, {
            nik: employee.nik!,
            name: employee.name!,
            companyId: employee.companyId || "",
            position: employee.position || null,
            salary: employee.salary || null,
            address: employee.address || null,
            phone: employee.phone || null,
            birthDate: employee.birthDate || null,
            status: oldEmployee.status,
          });
          // We don't get the updated object back from updateEmployee usually, so we construct it
          processedEmployees.push({ ...oldEmployee, ...employee } as Employee);
        } catch (e) {
          console.error(`Failed to update employee ${employee.nik}:`, e);
        }
      }

      // Refresh data to be sure
      const latestEmployees = await api.employees();
      setRows(latestEmployees);

      toast({
        title: "Import Berhasil",
        description: `${newEmployees.length} data baru, ${updatedEmployees.length} data diperbarui.`,
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

  const handleExportExcel = () => {
    try {
      const exportData = filteredWorkers.map((w) => {
        const company = companies.find((c) => c._id === w.companyId);

        let formattedDate = "-";
        if (w.birthDate) {
          const d = new Date(w.birthDate);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            formattedDate = `${day}-${month}-${year}`;
          }
        }

        return {
          NIK: w.nik,
          Nama: w.name,
          Perusahaan: company?.company_name || "-",
          Posisi: w.position || "-",
          Gaji: w.salary || 0,
          Alamat: w.address || "-",
          Telepon: w.phone || "-",
          "Tanggal Lahir": formattedDate,
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
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
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

      {/* Dialog Import Preview */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Import Data Karyawan</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <p className="text-sm text-muted-foreground">Data Baru</p>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {importPreviewData?.newEmployees.length || 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <p className="text-sm text-muted-foreground">Data Diubah</p>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">
                    {importPreviewData?.updatedEmployees.length || 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <p className="text-sm text-muted-foreground">Sama (Diabaikan)</p>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-600">
                    {importPreviewData?.existingEmployees.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {importPreviewData && importPreviewData.newEmployees.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Data Baru (Akan Ditambahkan)</h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NIK</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Posisi</TableHead>
                        <TableHead>Gaji</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.newEmployees.map((emp, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{emp.nik}</TableCell>
                          <TableCell>{emp.name}</TableCell>
                          <TableCell>{emp.position}</TableCell>
                          <TableCell>{emp.salary}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importPreviewData && importPreviewData.updatedEmployees.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Data Diubah (Akan Diupdate)</h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NIK</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Perubahan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.updatedEmployees.map(({ employee, oldEmployee }, idx) => {
                        const changes: string[] = [];
                        if (employee.name !== oldEmployee.name) changes.push(`Nama: ${oldEmployee.name} -> ${employee.name}`);
                        if (employee.position !== oldEmployee.position) changes.push(`Posisi: ${oldEmployee.position} -> ${employee.position}`);
                        if (Number(employee.salary) !== Number(oldEmployee.salary)) changes.push(`Gaji: ${oldEmployee.salary} -> ${employee.salary}`);
                        // Add other fields as needed

                        return (
                          <TableRow key={idx}>
                            <TableCell>{employee.nik}</TableCell>
                            <TableCell>{employee.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {changes.join(", ") || "Detail lain berubah"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importPreviewData && importPreviewData.newEmployees.length === 0 && importPreviewData.updatedEmployees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada data baru atau perubahan.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsImportPreviewOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={!importPreviewData || (importPreviewData.newEmployees.length === 0 && importPreviewData.updatedEmployees.length === 0)}
              className="bg-green-600 hover:bg-green-700"
            >
              Proses Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
};

export default Workers;
