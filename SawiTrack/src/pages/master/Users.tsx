import { useEffect, useMemo, useState } from "react";
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
import { Plus, Search, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { api, type Role } from "@/lib/api";
import { Upload, Download } from "lucide-react";
import { TooltipButton } from "@/components/ui/TooltipButton";
import * as XLSX from "xlsx";

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

  // Import preview state
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    newUsers: UserRow[];
    existingUsers: UserRow[];
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .users()
      .then((list) =>
        setRows(
          list.map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            division: u.division,
            status: u.status,
          }))
        )
      )
      .catch(() =>
        toast({
          title: "Gagal",
          description: "Gagal memuat user",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(
    () =>
      rows.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      role: "",
      division: "",
      status: "active",
      password: "",
    });
  };

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

  const handleCloseEdit = () => {
    setOpenEdit(false);
    setEditingUser(null);
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

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      if (!form.name || !form.email || !form.role) {
        toast({
          title: "Gagal",
          description: "Lengkapi form",
          variant: "destructive",
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

      setRows((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
              ...u,
              name: form.name,
              email: form.email,
              role: form.role,
              division: form.division,
              status: form.status,
            }
            : u
        )
      );

      setOpenEdit(false);
      setEditingUser(null);
      setForm({
        name: "",
        email: "",
        role: "",
        division: "",
        status: "active",
        password: "",
      });

      toast({
        title: "Berhasil",
        description: "Pengguna berhasil diperbarui",
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

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData =
            XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

          const newUsers: UserRow[] = [];
          const existingUsers: UserRow[] = [];

          jsonData.forEach((row) => {
            const email = String(row["Email"] || "").trim();
            const name = String(row["Nama"] || "").trim();
            const role = String(row["Role"] || "").toLowerCase() as Role;
            const status = String(row["Status"] || "active").toLowerCase();
            const division = row["Divisi"] ? String(row["Divisi"]) : null;
            const password = row["Password"]
              ? String(row["Password"])
              : "password123"; // Default password if not provided

            if (!email || !name || !role) return;

            // Check if user already exists
            const exists = rows.find(
              (u) => u.email.toLowerCase() === email.toLowerCase()
            );

            const userObj: UserRow = {
              id: exists ? exists.id : `temp_${Date.now()}_${Math.random()}`, // Temp ID for new, existing ID for existing
              name,
              email,
              role,
              division,
              status,
            };

            // We also need password for creation, so we'll store it in a temporary property if needed,
            // but UserRow doesn't have password. We can attach it to the object we pass to create.
            // For simplicity in preview, we just show UserRow data.
            // We'll store the full data for creation in a separate way or just use this object and cast it.
            (userObj as UserRow & { password?: string }).password = password;

            if (exists) {
              existingUsers.push(userObj);
            } else {
              newUsers.push(userObj);
            }
          });

          setImportPreviewData({ newUsers, existingUsers });
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
      const { newUsers } = importPreviewData;
      const createdUsers: UserRow[] = [];

      for (const user of newUsers) {
        try {
          const created = await api.createUser({
            name: user.name,
            email: user.email,
            role: user.role as Role,
            password:
              (user as UserRow & { password?: string }).password ||
              "default123",
            division: user.division || null,
          });
          createdUsers.push({
            id: created._id,
            name: created.name,
            email: created.email,
            role: created.role,
            division: created.division,
            status: created.status,
          });
        } catch (e) {
          console.error(`Failed to create user ${user.email}:`, e);
        }
      }

      setRows((prev) => [...createdUsers, ...prev]);

      toast({
        title: "Import Berhasil",
        description: `${createdUsers.length} pengguna baru berhasil ditambahkan. ${importPreviewData.existingUsers.length} data duplikat diabaikan.`,
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
      const exportData = filteredUsers.map((u) => ({
        Nama: u.name,
        Email: u.email,
        Role: u.role,
        Divisi: u.division || "-",
        Status: u.status === "active" ? "Aktif" : "Nonaktif",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pengguna");
      XLSX.writeFile(
        wb,
        `Pengguna_${new Date().toISOString().split("T")[0]}.xlsx`
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
          <h1 className="text-3xl font-bold">Pengguna</h1>
          <p className="text-muted-foreground">
            Kelola akun pengguna web (login)
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
                  <Input
                    placeholder="Masukkan nama lengkap"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="Masukkan alamat email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, role: v as typeof form.role }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="non-staff">Non-Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Masukkan password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={async () => {
                    try {
                      if (
                        !form.name ||
                        !form.email ||
                        !form.role ||
                        !form.password
                      ) {
                        toast({
                          title: "Gagal",
                          description: "Lengkapi form",
                          variant: "destructive",
                        });
                        return;
                      }
                      const created = await api.createUser({
                        name: form.name,
                        email: form.email,
                        role: form.role,
                        password: form.password,
                        division: form.division || null,
                      });
                      setRows((prev) => [
                        {
                          id: created._id,
                          name: created.name,
                          email: created.email,
                          role: created.role,
                          division: created.division,
                          status: created.status,
                        },
                        ...prev,
                      ]);
                      setOpenAdd(false);
                      setForm({
                        name: "",
                        email: "",
                        role: "",
                        division: "",
                        status: "active",
                        password: "",
                      });
                      toast({
                        title: "Berhasil",
                        description: "Pengguna berhasil ditambahkan",
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
                placeholder="Cari pengguna..."
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
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Memuat...
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === "active" ? "default" : "secondary"
                        }
                      >
                        {user.status === "active" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Edit Pengguna */}
      <Dialog
        open={openEdit}
        onOpenChange={(open) => !open && handleCloseEdit()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                placeholder="Masukkan nama lengkap"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, role: v as typeof form.role }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="non-staff">Non-Staff</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label>Password Baru (kosongkan jika tidak ingin mengubah)</Label>
              <Input
                type="password"
                placeholder="Masukkan password baru (opsional)"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleCloseEdit}>
                Batal
              </Button>
              <Button type="button" onClick={handleUpdateUser}>
                Simpan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Import Preview */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Import Data Pengguna</DialogTitle>
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
                    {importPreviewData?.newUsers.length || 0}
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
                    {importPreviewData?.existingUsers.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {importPreviewData && importPreviewData.newUsers.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Data Baru</h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Divisi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.newUsers.map((u, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.role}</TableCell>
                          <TableCell>{u.division || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importPreviewData &&
              importPreviewData.existingUsers.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Data Duplikat (Email sudah ada)
                  </h3>
                  <div className="border rounded-lg overflow-auto max-h-40 bg-muted/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewData.existingUsers.map((u, idx) => (
                          <TableRow key={idx} className="opacity-50">
                            <TableCell>{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.role}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

            {importPreviewData && importPreviewData.newUsers.length === 0 && (
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
                !importPreviewData || importPreviewData.newUsers.length === 0
              }
              className="bg-green-600 hover:bg-green-700"
            >
              Import {importPreviewData?.newUsers.length} Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
};

export default Users;
