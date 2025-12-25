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
import { Plus, Search, Edit, Upload, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api, type Employee, type Company, type User } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
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
  const [foremen, setForemen] = useState<User[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Employee | null>(null);

  // Cleaned form state - matching table columns: No (calc), Nama, NIK, Mandor, Divisi
  const [form, setForm] = useState({
    nik: "",
    name: "",
    mandorId: "",
    division: "",
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
    Promise.all([api.employees(), api.companies(), api.users()])
      .then(([emps, comps, users]) => {
        setRows(emps);
        setCompanies(comps);
        setForemen(users.filter(u => u.role === 'foreman'));
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
      mandorId: worker.mandorId || "",
      division: worker.division || "",
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
        companyId: "", // Legacy, send empty if not used or keep existing? API might require. Sending empty or undefined.
        mandorId: form.mandorId || "",
        position: null,
        salary: null,
        address: null,
        phone: null,
        birthDate: null,
        gender: null,
        religion: null,
        division: form.division || null,
        joinDate: null,
        status: form.status,
      });

      setRows((prev) =>
        prev.map((w) =>
          w._id === editingWorker._id
            ? { ...w, ...form, companyId: undefined, mandorId: form.mandorId || undefined, status: form.status }
            : w
        )
      );

      setOpenEdit(false);
      setEditingWorker(null);
      setForm({
        nik: "",
        name: "",
        mandorId: "",
        division: "",
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

  // CLEANED IMPORT: Only fields visible in table
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
            const fields = ['name', 'mandorId', 'division'] as const;

            const normalize = (val: unknown): unknown => {
              if (val === undefined || val === null) return null;
              if (typeof val === 'string') {
                const trimmed = val.trim();
                return trimmed === "" ? null : trimmed;
              }
              return val;
            };

            for (const field of fields) {
              const val1 = emp1[field];
              const val2 = emp2[field];
              if (normalize(val1) !== normalize(val2)) return false;
            }
            return true;
          };

          // Normalize keys to handle potential whitespace in headers
          const normalizedJsonData = jsonData.map(row => {
            const newRow: Record<string, unknown> = {};
            for (const key in row) {
              newRow[key.trim()] = row[key];
            }
            return newRow;
          });

          normalizedJsonData.forEach((row) => {
            const nik = String(row["NIK"] || "").trim();
            const name = String(row["NAMA"] || "").trim();
            const mandorName = String(row["Mandor"] || "").trim();
            const mandor = foremen.find((f) => f.name.trim().toLowerCase() === mandorName.toLowerCase());

            if (!nik || !name) return;

            const employeeObj: Partial<Employee> = {
              nik,
              name,
              mandorId: mandor?._id,
              division: row["Divisi"] ? String(row["Divisi"]).trim() : undefined,
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
            companyId: undefined,
            mandorId: emp.mandorId,
            position: undefined,
            address: undefined,
            phone: undefined,
            birthDate: undefined,
            gender: undefined,
            religion: undefined,
            division: emp.division,
            joinDate: undefined,
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
            companyId: "",
            mandorId: employee.mandorId || "",
            position: null,
            address: null,
            phone: null,
            birthDate: null,
            gender: null,
            religion: null,
            division: employee.division || null,
            joinDate: null,
            status: oldEmployee.status,
          });
          processedEmployees.push({ ...oldEmployee, ...employee } as Employee);
        } catch (e) {
          console.error(`Failed to update employee ${employee.nik}:`, e);
        }
      }

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

  // CLEANED EXPORT: Only columns in table
  const handleExportExcel = () => {
    try {
      // Simple header matching table
      const header = ["NO", "NAMA", "NIK", "Mandor", "Divisi"];

      const dataRows = filteredWorkers.map((w, index) => {
        const mandor = foremen.find((f) => f._id === w.mandorId);
        return [
          index + 1,
          w.name,
          w.nik,
          mandor?.name || "-",
          w.division || "-",
        ];
      });

      const wsData = [header, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Optional: Set column widths
      ws['!cols'] = [
        { wch: 5 },  // NO
        { wch: 25 }, // NAMA
        { wch: 15 }, // NIK
        { wch: 20 }, // Mandor
        { wch: 15 }, // Divisi
      ];

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
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Karyawan Baru</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>NIK</Label>
                    <Input
                      placeholder="Masukkan NIK"
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
                    <Label>Mandor</Label>
                    <Select
                      value={form.mandorId}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, mandorId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih mandor" />
                      </SelectTrigger>
                      <SelectContent>
                        {foremen.map((f) => (
                          <SelectItem key={f._id} value={f._id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Divisi</Label>
                    <Input
                      placeholder="Masukkan divisi"
                      value={form.division}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, division: e.target.value }))
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
                        companyId: undefined, // removed legacy
                        mandorId: form.mandorId || undefined,
                        position: undefined,
                        salary: undefined,
                        address: undefined,
                        phone: undefined,
                        birthDate: undefined,
                        gender: undefined,
                        religion: undefined,
                        division: form.division || undefined,
                        joinDate: undefined,
                      });
                      setRows((prev) => [created, ...prev]);
                      setOpenAdd(false);
                      setForm({
                        nik: "",
                        name: "",
                        mandorId: "",
                        division: "",
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
        </div >
      </div >

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
                <TableHead className="w-[50px] text-center">NO</TableHead>
                <TableHead>NAMA</TableHead>
                <TableHead>NIK</TableHead>
                <TableHead>Mandor</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Memuat...
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredWorkers.map((worker, index) => {
                  const mandor = foremen.find((f) => f._id === worker.mandorId);
                  return (
                    <TableRow key={worker._id}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell className="font-medium">{worker.name}</TableCell>
                      <TableCell className="font-mono">{worker.nik}</TableCell>
                      <TableCell>{mandor?.name || "-"}</TableCell>
                      <TableCell>{worker.division || "-"}</TableCell>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data Karyawan</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-4">
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
                <Label>NIK</Label>
                <Input
                  placeholder="Masukkan NIK"
                  value={form.nik}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nik: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Mandor</Label>
                <Select
                  value={form.mandorId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, mandorId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih mandor" />
                  </SelectTrigger>
                  <SelectContent>
                    {foremen.map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Divisi</Label>
                <Input
                  placeholder="Masukkan divisi"
                  value={form.division}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, division: e.target.value }))
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
                    mandorId: "",
                    division: "",
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
          </form >
        </DialogContent >
      </Dialog >

      {/* Dialog Import Preview */}
      < Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen} >
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
                        <TableHead>Divisi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.newEmployees.map((emp, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{emp.nik}</TableCell>
                          <TableCell>{emp.name}</TableCell>
                          <TableCell>{emp.division}</TableCell>
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

                        const normalize = (val: unknown): unknown => {
                          if (val === undefined || val === null) return null;
                          if (typeof val === 'string') {
                            const trimmed = val.trim();
                            return trimmed === "" ? null : trimmed;
                          }
                          return val;
                        };

                        if (normalize(employee.name) !== normalize(oldEmployee.name)) changes.push(`Nama: ${oldEmployee.name} -> ${employee.name}`);

                        if (normalize(employee.mandorId) !== normalize(oldEmployee.mandorId)) {
                          const oldMandor = foremen.find(f => f._id === oldEmployee.mandorId)?.name || "-";
                          const newMandor = foremen.find(f => f._id === employee.mandorId)?.name || "-";
                          if (oldMandor !== newMandor) changes.push(`Mandor: ${oldMandor} -> ${newMandor}`);
                        }

                        if (normalize(employee.division) !== normalize(oldEmployee.division)) {
                          const n1 = normalize(oldEmployee.division);
                          const n2 = normalize(employee.division);
                          if (n1 !== n2) changes.push(`Divisi: ${n1} -> ${n2}`);
                        }

                        return (
                          <TableRow key={idx}>
                            <TableCell>{employee.nik}</TableCell>
                            <TableCell>{employee.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {changes.length > 0 ? changes.join(", ") : "Perubahan format data"}
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
      </Dialog >

      <Toaster />
    </div >
  );
};

export default Workers;
