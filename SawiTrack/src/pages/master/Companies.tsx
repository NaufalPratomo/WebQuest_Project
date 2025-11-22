import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api, type Company } from "@/lib/api";
import { TooltipButton } from "@/components/ui/TooltipButton";

const Companies = () => {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Company[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    setLoading(true);
    api.companies()
      .then((list) => setRows(list))
      .catch(() => toast.error("Gagal memuat perusahaan"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => rows.filter((c) => c.company_name.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Perusahaan</h1>
          <p className="text-muted-foreground">Kelola daftar perusahaan</p>
        </div>
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <TooltipButton tooltip="Tambahkan perusahaan baru">
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Perusahaan
              </Button>
            </TooltipButton>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Perusahaan</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label>Nama Perusahaan</Label>
                <Input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Alamat</Label>
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telepon</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={async () => {
                  try {
                    if (!form.company_name || !form.address) return toast.error("Nama dan Alamat wajib diisi");
                    const created = await api.createCompany({
                      company_name: form.company_name,
                      address: form.address,
                      phone: form.phone || undefined,
                      email: form.email || undefined,
                    });
                    setRows((prev) => [created, ...prev]);
                    setOpenAdd(false);
                    setForm({ company_name: "", address: "", phone: "", email: "" });
                    toast.success("Perusahaan berhasil ditambahkan");
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari perusahaan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Perusahaan</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center">Memuat...</TableCell></TableRow>}
              {!loading && filtered.map((company) => (
                <TableRow key={company._id}>
                  <TableCell className="font-medium">{company.company_name}</TableCell>
                  <TableCell>{company.address}</TableCell>
                  <TableCell>{company.phone || "-"}</TableCell>
                  <TableCell>{company.email || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <TooltipButton tooltip="Edit perusahaan">
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      </TooltipButton>
                      <TooltipButton tooltip="Hapus perusahaan">
                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                      </TooltipButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Companies;
