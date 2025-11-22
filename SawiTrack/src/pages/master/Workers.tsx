import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Upload, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api, type Employee, type Company } from "@/lib/api";
import { toast } from "sonner";
import { TooltipButton } from "@/components/ui/TooltipButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Workers = () => {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({
    nik: "",
    name: "",
    companyId: "",
    position: "",
    salary: 0,
    address: "",
    phone: "",
    birthDate: "",
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([api.employees(), api.companies()])
      .then(([emps, comps]) => {
        setRows(emps);
        setCompanies(comps);
      })
      .catch(() => toast.error("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  const filteredWorkers = useMemo(
    () => rows.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.nik.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pekerja (Pemanen)</h1>
          <p className="text-muted-foreground">Kelola data pekerja/pemanen (bukan akun login)</p>
        </div>
        <div className="flex gap-2">
          <TooltipButton tooltip="Import data pekerja dari Excel">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </TooltipButton>
          <TooltipButton tooltip="Export data pekerja ke Excel">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </TooltipButton>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <TooltipButton tooltip="Tambahkan pekerja baru">
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Pekerja
                </Button>
              </TooltipButton>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Pekerja Baru</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>NIK</Label>
                    <Input value={form.nik} onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nama Lengkap</Label>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Perusahaan</Label>
                    <Select value={form.companyId} onValueChange={(v) => setForm((f) => ({ ...f, companyId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Pilih perusahaan" /></SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c._id} value={c._id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Posisi/Jabatan</Label>
                    <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Gaji</Label>
                    <Input type="number" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Lahir</Label>
                    <Input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Alamat</Label>
                    <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telepon</Label>
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={async () => {
                    try {
                      if (!form.nik || !form.name) return toast.error("NIK dan Nama harus diisi");
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
                      setForm({ nik: "", name: "", companyId: "", position: "", salary: 0, address: "", phone: "", birthDate: "" });
                      toast.success("Pekerja berhasil ditambahkan");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
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
              <Input placeholder="Cari pekerja..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
              {loading && <TableRow><TableCell colSpan={7} className="text-center">Memuat...</TableCell></TableRow>}
              {!loading && filteredWorkers.map((worker) => {
                const company = companies.find((c) => c._id === worker.companyId);
                return (
                  <TableRow key={worker._id}>
                    <TableCell className="font-mono">{worker.nik}</TableCell>
                    <TableCell className="font-medium">{worker.name}</TableCell>
                    <TableCell>{company?.company_name || "-"}</TableCell>
                    <TableCell>{worker.position || "-"}</TableCell>
                    <TableCell>{worker.salary ? `Rp ${worker.salary.toLocaleString()}` : "-"}</TableCell>
                    <TableCell><Badge variant={worker.status === "active" ? "default" : "secondary"}>{worker.status === "active" ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <TooltipButton tooltip="Edit data pekerja">
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      </TooltipButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Workers;
