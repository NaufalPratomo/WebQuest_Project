import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { api, type Role } from "@/lib/api";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role | "";
  division?: string | null;
  status: string;
};

const Users = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "" as Role | "",
    division: "",
    status: "active",
    password: "",
  });

  useEffect(() => {
    setLoading(true);
    api.users()
      .then((list) => setRows(list.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, division: u.division, status: u.status }))))
      .catch(() => toast({
        title: "Gagal",
        description: "Gagal memuat user",
        variant: "destructive"
      }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => rows.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role as typeof form.role,
      division: user.division || "",
      status: user.status || "active",
      password: "",
    });
    setOpenEdit(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      if (!form.name || !form.email || !form.role) {
        toast({
          title: "Gagal",
          description: "Lengkapi form",
          variant: "destructive"
        });
        return;
      }

      const updateData: {
        name: string;
        email: string;
        role: Role;
        division: string | null;
        status: string;
        password?: string;
      } = {
        name: form.name,
        email: form.email,
        role: form.role as Role,
        division: form.division || null,
        status: form.status,
      };

      if (form.password) {
        updateData.password = form.password;
      }

      await api.updateUser(editingUser.id, updateData);

      setRows(prev => prev.map(u =>
        u.id === editingUser.id
          ? { ...u, name: form.name, email: form.email, role: form.role, division: form.division, status: form.status }
          : u
      ));

      setOpenEdit(false);
      setEditingUser(null);
      setForm({ name: "", email: "", role: "", division: "", status: "active", password: "" });

      toast({
        title: "Berhasil",
        description: "Pengguna berhasil diperbarui"
      });
    } catch (e) {
      toast({
        title: "Gagal",
        description: e instanceof Error ? e.message : "Gagal memperbarui",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pengguna Sistem</h1>
          <p className="text-muted-foreground">Kelola akun pengguna web (login)</p>
        </div>
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Pengguna
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as typeof form.role }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="foreman">Foreman</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <Button type="button" className="w-full" onClick={async () => {
                try {
                  if (!form.name || !form.email || !form.role || !form.password) {
                    toast({
                      title: "Gagal",
                      description: "Lengkapi form",
                      variant: "destructive"
                    });
                    return;
                  }
                  const created = await api.createUser({ name: form.name, email: form.email, role: form.role, password: form.password, division: form.division || null });
                  setRows((prev) => [{ id: created._id, name: created.name, email: created.email, role: created.role, division: created.division, status: created.status }, ...prev]);
                  setOpenAdd(false);
                  setForm({ name: "", email: "", role: "", division: "", status: "active", password: "" });
                  toast({
                    title: "Berhasil",
                    description: "Pengguna berhasil ditambahkan"
                  });
                } catch (e) {
                  toast({
                    title: "Gagal",
                    description: e instanceof Error ? e.message : "Gagal menyimpan",
                    variant: "destructive"
                  });
                }
              }}>Simpan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari pengguna..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center">Memuat...</TableCell></TableRow>}
              {!loading && filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{user.role}</Badge></TableCell>
                  <TableCell><Badge variant={user.status === "active" ? "default" : "secondary"}>{user.status === "active" ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Edit Pengguna */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as typeof form.role }))}>
                <SelectTrigger><SelectValue placeholder="Pilih role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="foreman">Foreman</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Password Baru (kosongkan jika tidak ingin mengubah)</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenEdit(false);
                  setEditingUser(null);
                  setForm({ name: "", email: "", role: "", division: "", status: "active", password: "" });
                }}
              >
                Batal
              </Button>
              <Button type="button" onClick={handleUpdateUser}>
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

export default Users;
