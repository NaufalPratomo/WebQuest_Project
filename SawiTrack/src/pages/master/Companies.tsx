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
import { Plus, Search, Edit } from "lucide-react";
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
import { Toaster } from "@/components/ui/toaster";
import { api, type Company } from "@/lib/api";
import { TooltipButton } from "@/components/ui/TooltipButton";
import { Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";

const Companies = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Company[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    address: "",
    phone: "",
    email: "",
  });

  // Import preview state
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    newCompanies: Company[];
    existingCompanies: Company[];
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .companies()
      .then((list) => setRows(list))
      .catch(() =>
        toast({
          title: "Gagal",
          description: "Gagal memuat perusahaan",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false));
  }, [toast]);

  const resetForm = () => {
    setForm({
      company_name: "",
      address: "",
      phone: "",
      email: "",
    });
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setForm({
      company_name: company.company_name,
      address: company.address,
      phone: company.phone || "",
      email: company.email || "",
    });
    setOpenEdit(true);
  };

  const handleCloseEdit = () => {
    setOpenEdit(false);
    setEditingCompany(null);
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

  const handleUpdateCompany = async () => {
    if (!editingCompany) return;

    try {
      console.log("Updating company:", editingCompany._id, form);

      if (!form.company_name || !form.address) {
        toast({
          title: "Gagal",
          description: "Nama dan Alamat wajib diisi",
          variant: "destructive",
        });
        return;
      }

      await api.updateCompany(editingCompany._id, {
        company_name: form.company_name,
        address: form.address,
        phone: form.phone || undefined,
        email: form.email || undefined,
      });

      // Update local state
      setRows((prev) =>
        prev.map((c) =>
          c._id === editingCompany._id
            ? {
                ...c,
                ...form,
                phone: form.phone || undefined,
                email: form.email || undefined,
              }
            : c
        )
      );

      setOpenEdit(false);
      setEditingCompany(null);
      setForm({ company_name: "", address: "", phone: "", email: "" });

      toast({
        title: "Berhasil",
        description: "Perusahaan berhasil diperbarui",
      });
    } catch (e) {
      console.error("Error updating company:", e);
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

          const newCompanies: Company[] = [];
          const existingCompanies: Company[] = [];
          const processedNames = new Set<string>(); // Track names already processed in Excel

          jsonData.forEach((row) => {
            const company_name = String(row["Nama Perusahaan"] || "").trim();
            const addressRaw = String(row["Alamat"] || "").trim();

            // Handle empty/null values properly
            const address = addressRaw || "-";
            let phone = "-";
            let email = "-";

            if (
              row["Telepon"] !== null &&
              row["Telepon"] !== undefined &&
              String(row["Telepon"]).trim() !== ""
            ) {
              phone = String(row["Telepon"]).trim();
            }

            if (
              row["Email"] !== null &&
              row["Email"] !== undefined &&
              String(row["Email"]).trim() !== ""
            ) {
              email = String(row["Email"]).trim();
            }

            if (!company_name) return;

            const normalizedName = company_name.toLowerCase();

            // Check if company already exists in database
            const existsInDb = rows.find(
              (c) => c.company_name.toLowerCase() === normalizedName
            );

            // Check if already processed in this Excel file (duplicate within Excel)
            const isDuplicateInExcel = processedNames.has(normalizedName);

            const companyObj: Company = {
              _id: existsInDb
                ? existsInDb._id
                : `temp_${Date.now()}_${Math.random()}`,
              company_name,
              address: address === "-" ? "-" : address,
              phone: phone === "-" ? undefined : phone,
              email: email === "-" ? undefined : email,
            };

            if (existsInDb || isDuplicateInExcel) {
              existingCompanies.push(companyObj);
            } else {
              newCompanies.push(companyObj);
              processedNames.add(normalizedName); // Mark as processed
            }
          });

          setImportPreviewData({ newCompanies, existingCompanies });
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
      const { newCompanies } = importPreviewData;
      const createdCompanies: Company[] = [];

      for (const company of newCompanies) {
        try {
          const created = await api.createCompany({
            company_name: company.company_name,
            address: company.address,
            phone: company.phone,
            email: company.email,
          });
          createdCompanies.push(created);
        } catch (e) {
          console.error(`Failed to create company ${company.company_name}:`, e);
        }
      }

      setRows((prev) => [...createdCompanies, ...prev]);

      toast({
        title: "Import Berhasil",
        description: `${createdCompanies.length} perusahaan baru berhasil ditambahkan. ${importPreviewData.existingCompanies.length} data duplikat diabaikan.`,
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
      const exportData = filtered.map((c) => ({
        "Nama Perusahaan": c.company_name,
        Alamat: c.address,
        Telepon: c.phone || "-",
        Email: c.email || "-",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Perusahaan");
      XLSX.writeFile(
        wb,
        `Perusahaan_${new Date().toISOString().split("T")[0]}.xlsx`
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

  const filtered = useMemo(
    () =>
      rows.filter((c) =>
        c.company_name.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Perusahaan</h1>
          <p className="text-muted-foreground">Kelola daftar perusahaan</p>
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
                Tambah Perusahaan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Perusahaan</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <Label>Nama Perusahaan</Label>
                  <Input
                    placeholder="Masukkan nama perusahaan"
                    value={form.company_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, company_name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alamat</Label>
                  <Input
                    placeholder="Masukkan alamat lengkap perusahaan"
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telepon</Label>
                  <Input
                    placeholder="Masukkan nomor telepon"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
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
                <Button
                  type="button"
                  className="w-full"
                  onClick={async () => {
                    try {
                      console.log("Form data:", form);

                      if (!form.company_name || !form.address) {
                        toast({
                          title: "Gagal",
                          description: "Nama dan Alamat wajib diisi",
                          variant: "destructive",
                        });
                        return;
                      }

                      console.log("Creating company...");
                      const created = await api.createCompany({
                        company_name: form.company_name,
                        address: form.address,
                        phone: form.phone || undefined,
                        email: form.email || undefined,
                      });

                      console.log("Company created:", created);
                      setRows((prev) => [created, ...prev]);
                      setOpenAdd(false);
                      setForm({
                        company_name: "",
                        address: "",
                        phone: "",
                        email: "",
                      });

                      toast({
                        title: "Berhasil",
                        description: "Perusahaan berhasil ditambahkan",
                      });
                    } catch (e) {
                      console.error("Error creating company:", e);
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
                placeholder="Cari perusahaan..."
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
                <TableHead>Nama Perusahaan</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
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
                filtered.map((company) => (
                  <TableRow key={company._id}>
                    <TableCell className="font-medium">
                      {company.company_name}
                    </TableCell>
                    <TableCell>{company.address}</TableCell>
                    <TableCell>{company.phone || "-"}</TableCell>
                    <TableCell>{company.email || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={company.status || "active"}
                        onValueChange={async (newStatus) => {
                          try {
                            await api.updateCompany(company._id, {
                              status: newStatus,
                            });
                            setRows((prev) =>
                              prev.map((c) =>
                                c._id === company._id
                                  ? { ...c, status: newStatus }
                                  : c
                              )
                            );
                            toast({
                              title: "Berhasil",
                              description: "Status perusahaan diperbarui",
                            });
                          } catch (e) {
                            toast({
                              title: "Gagal",
                              description: "Gagal memperbarui status",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Aktif</SelectItem>
                          <SelectItem value="inactive">Nonaktif</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(company)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Edit Perusahaan */}
      <Dialog
        open={openEdit}
        onOpenChange={(open) => !open && handleCloseEdit()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Perusahaan</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label>Nama Perusahaan</Label>
              <Input
                placeholder="Masukkan nama perusahaan"
                value={form.company_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Alamat</Label>
              <Input
                placeholder="Masukkan alamat lengkap perusahaan"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input
                placeholder="Masukkan nomor telepon"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseEdit}>
                Batal
              </Button>
              <Button type="button" onClick={handleUpdateCompany}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Import Preview */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Import Data Perusahaan</DialogTitle>
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
                    {importPreviewData?.newCompanies.length || 0}
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
                    {importPreviewData?.existingCompanies.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {importPreviewData && importPreviewData.newCompanies.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Data Baru</h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Perusahaan</TableHead>
                        <TableHead>Alamat</TableHead>
                        <TableHead>Telepon</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreviewData.newCompanies.map((c, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{c.company_name}</TableCell>
                          <TableCell>{c.address}</TableCell>
                          <TableCell>{c.phone || "-"}</TableCell>
                          <TableCell>{c.email || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importPreviewData &&
              importPreviewData.existingCompanies.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Data Duplikat (Nama sudah ada)
                  </h3>
                  <div className="border rounded-lg overflow-auto max-h-40 bg-muted/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Perusahaan</TableHead>
                          <TableHead>Alamat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewData.existingCompanies.map((c, idx) => (
                          <TableRow key={idx} className="opacity-50">
                            <TableCell>{c.company_name}</TableCell>
                            <TableCell>{c.address}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

            {importPreviewData &&
              importPreviewData.newCompanies.length === 0 && (
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
                !importPreviewData ||
                importPreviewData.newCompanies.length === 0
              }
              className="bg-green-600 hover:bg-green-700"
            >
              Import {importPreviewData?.newCompanies.length} Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
};

export default Companies;
