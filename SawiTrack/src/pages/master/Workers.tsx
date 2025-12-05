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
    gender: "",
    religion: "",
    division: "",
    joinDate: "",
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
      gender: worker.gender || "",
      religion: worker.religion || "",
      division: worker.division || "",
      joinDate: worker.joinDate ? new Date(worker.joinDate).toISOString().split('T')[0] : "",
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
        gender: form.gender || null,
        religion: form.religion || null,
        division: form.division || null,
        joinDate: form.joinDate || null,
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
        gender: "",
        religion: "",
        division: "",
        joinDate: "",
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

          // Check first cell to see if it matches our new format (merged header)
          const firstCell = ws['A1'] ? ws['A1'].v : null;
          let range = 0;
          if (firstCell && String(firstCell).includes("Data Karyawan sesuai Kartu Identitas")) {
            range = 1; // Skip first row, headers are on row 2 (index 1)
          }

          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range });

          const newEmployees: Partial<Employee>[] = [];
          const updatedEmployees: { employee: Partial<Employee>; oldEmployee: Employee }[] = [];
          const existingEmployees: Partial<Employee>[] = [];

          const areEmployeesEqual = (emp1: Partial<Employee>, emp2: Employee): boolean => {
            const fields = ['name', 'companyId', 'position', 'address', 'phone', 'birthDate', 'gender', 'religion', 'division', 'joinDate'] as const;

            const normalize = (val: unknown): unknown => {
              if (val === undefined || val === null) return null;
              if (typeof val === 'string') {
                const trimmed = val.trim();
                return trimmed === "" ? null : trimmed;
              }
              return val;
            };

            const getDatePart = (dateStr: unknown): string | null => {
              if (!dateStr) return null;
              try {
                const d = new Date(dateStr as string);
                if (isNaN(d.getTime())) return null;
                return d.toISOString().split('T')[0];
              } catch {
                return null;
              }
            };

            for (const field of fields) {
              const val1 = emp1[field];
              const val2 = emp2[field];

              const norm1 = normalize(val1);
              const norm2 = normalize(val2);

              if (field === 'birthDate' || field === 'joinDate') {
                const d1 = getDatePart(norm1);
                const d2 = getDatePart(norm2);
                if (d1 !== d2) return false;
              } else {
                if (norm1 !== norm2) return false;
              }
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

          console.log("Raw JSON Data:", jsonData);
          console.log("Normalized JSON Data:", normalizedJsonData);

          const parseDate = (dateStr: unknown): string | undefined => {
            // ... (keep existing parseDate logic)
            if (!dateStr) return undefined;

            if (dateStr instanceof Date) {
              const year = dateStr.getFullYear();
              const month = String(dateStr.getMonth() + 1).padStart(2, '0');
              const day = String(dateStr.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}T00:00:00.000Z`;
            }

            if (typeof dateStr === 'number') {
              const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}T00:00:00.000Z`;
            }

            const str = String(dateStr).trim();

            const dateMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
            if (dateMatch) {
              const day = dateMatch[1].padStart(2, '0');
              const month = dateMatch[2].padStart(2, '0');
              let year = dateMatch[3];

              if (year.length === 2) {
                const y = parseInt(year, 10);
                year = (y > 50 ? '19' : '20') + year;
              }

              return `${year}-${month}-${day}T00:00:00.000Z`;
            }

            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
              return new Date(str).toISOString();
            }

            return undefined;
          };

          normalizedJsonData.forEach((row) => {
            // Debug log for specific fields
            console.log("Processing Row:", row);
            console.log("Kelamin:", row["Kelamin"], "Agama:", row["Agama"], "Divisi:", row["Divisi"], "Tgl Masuk:", row["Tanggal Masuk Kerja"]);
            const nik = String(row["NIK KTP"] || row["NIK"] || "").trim();
            const name = String(row["Nama"] || "").trim();
            const companyName = String(row["Perusahaan"] || "").trim();
            const company = companies.find((c) => c.company_name.trim().toLowerCase() === companyName.toLowerCase());

            if (!nik || !name) return;

            const employeeObj: Partial<Employee> = {
              nik,
              name,
              companyId: company?._id,
              position: row["Posisi"] ? String(row["Posisi"]).trim() : undefined,
              address: row["Alamat"] ? String(row["Alamat"]).trim() : undefined,
              phone: row["Telepon"] ? String(row["Telepon"]).trim() : undefined,
              birthDate: parseDate(row["Tanggal Lahir"]),
              gender: (() => {
                const g = String(row["Kelamin"] || "").trim().toLowerCase();
                if (g === "laki-laki" || g === "l") return "L";
                if (g === "perempuan" || g === "p") return "P";
                return undefined;
              })(),
              religion: row["Agama"] ? String(row["Agama"]).trim() : undefined,
              division: row["Divisi"] ? String(row["Divisi"]).trim() : undefined,
              joinDate: parseDate(row["Tanggal Masuk Kerja"]),
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
            address: emp.address,
            phone: emp.phone,
            birthDate: emp.birthDate,
            gender: emp.gender,
            religion: emp.religion,
            division: emp.division,
            joinDate: emp.joinDate,
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
            address: employee.address || null,
            phone: employee.phone || null,
            birthDate: employee.birthDate || null,
            gender: employee.gender || null,
            religion: employee.religion || null,
            division: employee.division || null,
            joinDate: employee.joinDate || null,
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
      // Define headers
      const mainHeader = [
        "Data Karyawan sesuai Kartu Identitas", "", "", "", "", "", "",
        "Data Karyawan Bekerja di Perusahaan", "", "", "", ""
      ];
      const subHeader = [
        "Nama", "NIK KTP", "Kelamin", "Tanggal Lahir", "Agama", "Alamat", "Telepon",
        "Perusahaan", "Divisi", "Posisi", "Tanggal Masuk Kerja", "Status"
      ];

      const dataRows = filteredWorkers.map((w) => {
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

        let formattedJoinDate = "-";
        if (w.joinDate) {
          const d = new Date(w.joinDate);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            formattedJoinDate = `${day}-${month}-${year}`;
          }
        }

        return [
          w.name,
          w.nik,
          w.gender || "-",
          formattedDate,
          w.religion || "-",
          w.address || "-",
          w.phone || "-",
          company?.company_name || "-",
          w.division || "-",
          w.position || "-",
          formattedJoinDate,
          w.status === "active" ? "Aktif" : "Nonaktif",
        ];
      });

      const wsData = [mainHeader, subHeader, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Add merges
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // First group (Cols 0-6)
        { s: { r: 0, c: 7 }, e: { r: 0, c: 11 } } // Second group (Cols 7-11)
      ];

      // Optional: Set column widths for better visibility
      ws['!cols'] = [
        { wch: 20 }, // Nama
        { wch: 15 }, // NIK
        { wch: 10 }, // Kelamin
        { wch: 15 }, // Tgl Lahir
        { wch: 10 }, // Agama
        { wch: 25 }, // Alamat
        { wch: 15 }, // Telepon
        { wch: 20 }, // Perusahaan
        { wch: 15 }, // Divisi
        { wch: 15 }, // Posisi
        { wch: 15 }, // Tgl Masuk
        { wch: 10 }, // Status
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Karyawan Baru</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>NIK KTP</Label>
                    <Input
                      placeholder="Masukkan NIK KTP"
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
                    <Label>Jenis Kelamin</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, gender: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis kelamin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Agama</Label>
                    <Select
                      value={form.religion}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, religion: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih agama" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Islam">Islam</SelectItem>
                        <SelectItem value="Kristen">Kristen</SelectItem>
                        <SelectItem value="Katolik">Katolik</SelectItem>
                        <SelectItem value="Hindu">Hindu</SelectItem>
                        <SelectItem value="Buddha">Buddha</SelectItem>
                        <SelectItem value="Konghucu">Konghucu</SelectItem>
                        <SelectItem value="Lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
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

                  <div className="col-span-2 border-t pt-4 mt-2">
                    <h3 className="font-semibold mb-4">Data Pekerjaan</h3>
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
                    <Label>Tanggal Masuk Kerja</Label>
                    <Input
                      type="date"
                      value={form.joinDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, joinDate: e.target.value }))
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
                        gender: form.gender || undefined,
                        religion: form.religion || undefined,
                        division: form.division || undefined,
                        joinDate: form.joinDate || undefined,
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
                        gender: "",
                        religion: "",
                        division: "",
                        joinDate: "",
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
                <TableHead colSpan={7} className="text-center border-r bg-muted/50">Data Karyawan sesuai Kartu Identitas</TableHead>
                <TableHead colSpan={5} className="text-center bg-muted/50">Data Karyawan Bekerja di Perusahaan</TableHead>
                <TableHead rowSpan={2} className="text-right bg-muted/50">Aksi</TableHead>
              </TableRow>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>NIK KTP</TableHead>
                <TableHead>Kelamin</TableHead>
                <TableHead>Tanggal Lahir</TableHead>
                <TableHead>Agama</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead className="border-r">Telepon</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Posisi</TableHead>
                <TableHead>Tanggal Masuk Kerja</TableHead>
                <TableHead>Status</TableHead>
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
                      <TableCell className="font-medium">{worker.name}</TableCell>
                      <TableCell className="font-mono">{worker.nik}</TableCell>
                      <TableCell>{worker.gender === 'L' ? 'Laki-laki' : worker.gender === 'P' ? 'Perempuan' : worker.gender || "-"}</TableCell>
                      <TableCell>
                        {worker.birthDate
                          ? new Date(worker.birthDate).toLocaleDateString("id-ID")
                          : "-"}
                      </TableCell>
                      <TableCell>{worker.religion || "-"}</TableCell>
                      <TableCell>{worker.address || "-"}</TableCell>
                      <TableCell className="border-r">{worker.phone || "-"}</TableCell>

                      <TableCell>{company?.company_name || "-"}</TableCell>
                      <TableCell>{worker.division || "-"}</TableCell>
                      <TableCell>{worker.position || "-"}</TableCell>
                      <TableCell>
                        {worker.joinDate
                          ? new Date(worker.joinDate).toLocaleDateString("id-ID")
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
              <div className="col-span-2 border-b pb-2 mb-2">
                <h3 className="font-semibold">Data Identitas</h3>
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
                <Label>NIK KTP</Label>
                <Input
                  placeholder="Masukkan NIK KTP"
                  value={form.nik}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nik: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, gender: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Agama</Label>
                <Select
                  value={form.religion}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, religion: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih agama" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Islam">Islam</SelectItem>
                    <SelectItem value="Kristen">Kristen</SelectItem>
                    <SelectItem value="Katolik">Katolik</SelectItem>
                    <SelectItem value="Hindu">Hindu</SelectItem>
                    <SelectItem value="Buddha">Buddha</SelectItem>
                    <SelectItem value="Konghucu">Konghucu</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="col-span-2 border-t pt-4 mt-2 border-b pb-2 mb-2">
                <h3 className="font-semibold">Data Pekerjaan</h3>
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
                <Label>Tanggal Masuk Kerja</Label>
                <Input
                  type="date"
                  value={form.joinDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, joinDate: e.target.value }))
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
                    companyId: "",
                    position: "",
                    salary: 0,
                    address: "",
                    phone: "",
                    birthDate: "",
                    gender: "",
                    religion: "",
                    division: "",
                    joinDate: "",
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
                        <TableHead>Posisi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.newEmployees.map((emp, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{emp.nik}</TableCell>
                          <TableCell>{emp.name}</TableCell>
                          <TableCell>{emp.position}</TableCell>
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

                        // Helper to format values for display
                        const fmt = (v: any) => {
                          const n = normalize(v);
                          return n === null ? "-" : String(n);
                        };

                        const dateFmt = (v: any) => {
                          if (!v) return "-";
                          try { return new Date(v).toLocaleDateString('id-ID'); } catch { return "-"; }
                        };

                        if (normalize(employee.name) !== normalize(oldEmployee.name)) changes.push(`Nama: ${oldEmployee.name} -> ${employee.name}`);

                        if (normalize(employee.companyId) !== normalize(oldEmployee.companyId)) {
                          const oldComp = companies.find(c => c._id === oldEmployee.companyId)?.company_name || "-";
                          const newComp = companies.find(c => c._id === employee.companyId)?.company_name || "-";
                          if (oldComp !== newComp) changes.push(`Perusahaan: ${oldComp} -> ${newComp}`);
                        }

                        if (normalize(employee.position) !== normalize(oldEmployee.position)) changes.push(`Posisi: ${fmt(oldEmployee.position)} -> ${fmt(employee.position)}`);
                        if (normalize(employee.address) !== normalize(oldEmployee.address)) changes.push(`Alamat: ${fmt(oldEmployee.address)} -> ${fmt(employee.address)}`);
                        if (normalize(employee.phone) !== normalize(oldEmployee.phone)) changes.push(`Telepon: ${fmt(oldEmployee.phone)} -> ${fmt(employee.phone)}`);
                        if (normalize(employee.gender) !== normalize(oldEmployee.gender)) {
                          const n1 = normalize(oldEmployee.gender);
                          const n2 = normalize(employee.gender);
                          const gFmt = (v: any) => v === 'L' ? 'Laki-laki' : v === 'P' ? 'Perempuan' : fmt(v);
                          if (n1 !== n2) changes.push(`Kelamin: ${gFmt(oldEmployee.gender)} -> ${gFmt(employee.gender)}`);
                        }
                        if (normalize(employee.religion) !== normalize(oldEmployee.religion)) {
                          const n1 = normalize(oldEmployee.religion);
                          const n2 = normalize(employee.religion);
                          if (n1 !== n2) changes.push(`Agama: ${fmt(oldEmployee.religion)} -> ${fmt(employee.religion)}`);
                        }
                        if (normalize(employee.division) !== normalize(oldEmployee.division)) {
                          const n1 = normalize(oldEmployee.division);
                          const n2 = normalize(employee.division);
                          if (n1 !== n2) changes.push(`Divisi: ${fmt(oldEmployee.division)} -> ${fmt(employee.division)}`);
                        }

                        // Date comparisons for display
                        const d1 = employee.birthDate ? new Date(employee.birthDate).toISOString().split('T')[0] : null;
                        const d2 = oldEmployee.birthDate ? new Date(oldEmployee.birthDate).toISOString().split('T')[0] : null;
                        if (d1 !== d2) changes.push(`Tgl Lahir: ${dateFmt(oldEmployee.birthDate)} -> ${dateFmt(employee.birthDate)}`);

                        const j1 = employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : null;
                        const j2 = oldEmployee.joinDate ? new Date(oldEmployee.joinDate).toISOString().split('T')[0] : null;
                        if (j1 !== j2) changes.push(`Tgl Masuk: ${dateFmt(oldEmployee.joinDate)} -> ${dateFmt(employee.joinDate)}`);

                        return (
                          <TableRow key={idx}>
                            <TableCell>{employee.nik}</TableCell>
                            <TableCell>{employee.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {changes.length > 0 ? changes.join(", ") : "Perubahan format data (trim/spasi)"}
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
