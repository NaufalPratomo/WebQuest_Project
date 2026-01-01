import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, Plus, Edit, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, RecapDataRow } from '@/lib/api';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const YEARS = Array.from({ length: 5 }, (_, i) => 2024 + i);

interface RecapCategory {
  name: string;
  rows: RecapDataRow[];
}

const Recap = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear() - 1));
  const [data, setData] = useState<RecapCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<{ catIdx: number; rowIdx: number; id: string } | null>(null);

  // Constants for Formula (should ideally be dynamic/fetched)
  const [totalProduction, setTotalProduction] = useState<number>(1142670); // Default from user request
  const [tbsPrice, setTbsPrice] = useState<number>(2900); // User mentioned 2812 in formula, header had 2900. using 2900 default

  // Form State
  const [formData, setFormData] = useState<Partial<RecapDataRow>>({
    jenisPekerjaan: '',
    aktivitas: '',
    satuan: '',
    hk: 0,
    hasilKerja: 0,
    output: 0,
    satuanOutput: 'Jjg/hk',
    rpKhl: 0,
    rpPremi: 0,
    rpBorongan: 0,
  });
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Fetch Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await api.recapCostsList({ month: selectedMonth, year: selectedYear });

      // Group by category
      const grouped: Record<string, RecapDataRow[]> = {};
      rows.forEach(row => {
        if (!grouped[row.category]) grouped[row.category] = [];
        grouped[row.category].push(row);
      });

      const categories: RecapCategory[] = Object.keys(grouped).sort().map(name => ({
        name,
        rows: grouped[name]
      }));

      // Ensure "Panen" is first if exists
      const panenIdx = categories.findIndex(c => c.name.toLowerCase() === 'panen');
      if (panenIdx > 0) {
        const [panen] = categories.splice(panenIdx, 1);
        categories.unshift(panen);
      }

      setData(categories);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data rekap');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helpers
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const calculateTotals = (category: RecapCategory) => {
    return category.rows.reduce((acc, row) => {
      const totalRp = (row.rpKhl || 0) + (row.rpPremi || 0) + (row.rpBorongan || 0);
      return {
        hk: acc.hk + (row.hk || 0),
        rpKhl: acc.rpKhl + (row.rpKhl || 0),
        rpPremi: acc.rpPremi + (row.rpPremi || 0),
        rpBorongan: acc.rpBorongan + (row.rpBorongan || 0),
        totalRp: acc.totalRp + totalRp,
      };
    }, { hk: 0, rpKhl: 0, rpPremi: 0, rpBorongan: 0, totalRp: 0 });
  };

  const grandTotals = data.map(calculateTotals).reduce((acc, curr) => ({
    hk: acc.hk + curr.hk,
    rpKhl: acc.rpKhl + curr.rpKhl,
    rpPremi: acc.rpPremi + curr.rpPremi,
    rpBorongan: acc.rpBorongan + curr.rpBorongan,
    totalRp: acc.totalRp + curr.totalRp,
  }), { hk: 0, rpKhl: 0, rpPremi: 0, rpBorongan: 0, totalRp: 0 });

  // CRUD Handlers
  const openAddDialog = () => {
    setEditingLoc(null);
    setFormData({
      jenisPekerjaan: '',
      aktivitas: '',
      satuan: '',
      hk: 0,
      hasilKerja: 0,
      output: 0,
      satuanOutput: 'Jjg/hk',
      rpKhl: 0,
      rpPremi: 0,
      rpBorongan: 0,
    });
    // Default to first category if exists
    setTargetCategory(data.length > 0 ? data[0].name : 'Umum');
    setIsDialogOpen(true);
  };

  const openEditDialog = (cat: RecapCategory, row: RecapDataRow, catIdx: number, rowIdx: number) => {
    setEditingLoc({ catIdx, rowIdx, id: row._id! });
    setFormData({ ...row });
    setTargetCategory(cat.name);
    setIsDialogOpen(true);
  };

  const handleDelete = async (catIdx: number, rowIdx: number, id?: string) => {
    if (!id) return;
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      try {
        await api.recapCostDelete(id);
        toast.success('Data berhasil dihapus');
        fetchData(); // Refresh
      } catch (err) {
        toast.error('Gagal menghapus data');
      }
    }
  };

  const handleSave = async () => {
    if (!formData.jenisPekerjaan) {
      toast.error('Jenis Pekerjaan wajib diisi');
      return;
    }

    // Prepare payload
    const categoryName = targetCategory === '__NEW__' ? newCategoryName : targetCategory;
    if (!categoryName) {
      toast.error('Kategori harus dipilih');
      return;
    }

    const payload = {
      ...formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rate: undefined as any, // cleanup if any temp fields
      date: new Date(Number(selectedYear), Number(selectedMonth), 1).toISOString(),
      category: categoryName
    };

    try {
      if (editingLoc) {
        // Update
        await api.recapCostUpdate(editingLoc.id, payload);
        toast.success('Data berhasil diperbarui');
      } else {
        // Create
        await api.recapCostCreate(payload);
        toast.success('Data berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(message || 'Gagal menyimpan data');
    }
  };

  const handleInputChange = (field: keyof RecapDataRow, value: string | number) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      // Auto-calc: Hasil Kerja (Total) = HK * Output (Rate)
      // Note: User formula request "output = HK * hasil kerja" is ambiguous.
      // Assuming physically: Total Result = HK * Productivity.
      // If user edits HK or Output (Productivity), calc Hasil Kerja.
      if (field === 'hk' || field === 'output') {
        const hk = field === 'hk' ? Number(value) : (prev.hk || 0);
        const rate = field === 'output' ? Number(value) : (prev.output || 0);
        next.hasilKerja = hk * rate;
      }

      return next;
    });
  };

  // derived values for header
  const cashToRevenuePercent = (grandTotals.totalRp / (totalProduction * tbsPrice)) * 100;

  return (
    <div className="space-y-6 pb-10 fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 tracking-tight">
            Rekap Pemakaian Dana
          </h1>
          <p className="text-gray-500 mt-1 font-medium">Monitoring Realisasi Dana Operasional</p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all gap-2">
            <Plus className="h-4 w-4" />
            Tambah Data
          </Button>
        </div>
      </div>

      {/* Filter & Global Params Section */}
      <Card className="border-emerald-100 shadow-sm bg-gradient-to-br from-white to-emerald-50/20">
        <CardContent className="p-5">
          <div className="flex flex-col xl:flex-row gap-6 items-end justify-between">
            {/* Filters */}
            <div className="flex gap-4">
              <div className="space-y-1.5 w-32">
                <label className="text-xs font-semibold uppercase tracking-wider text-emerald-600/80">Bulan</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="border-emerald-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 w-24">
                <label className="text-xs font-semibold uppercase tracking-wider text-emerald-600/80">Tahun</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="border-emerald-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Global Constants for Formula */}
            <div className="flex gap-4 bg-white p-3 rounded-lg border shadow-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Total Tonase (Kg)</label>
                <Input
                  type="number"
                  value={totalProduction}
                  onChange={e => setTotalProduction(Number(e.target.value))}
                  className="h-8 w-32 text-right font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Harga TBS (Rp)</label>
                <Input
                  type="number"
                  value={tbsPrice}
                  onChange={e => setTbsPrice(Number(e.target.value))}
                  className="h-8 w-28 text-right font-mono"
                />
              </div>
            </div>

            <Button variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 gap-2">
              <Download className="h-4 w-4" /> Export XLS
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="overflow-hidden border-emerald-100 shadow-xl rounded-xl">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-10 flex justify-center text-emerald-600"><Loader2 className="animate-spin h-8 w-8" /></div>
          ) : (
            <Table className="min-w-[1500px] border-collapse text-sm">
              <TableHeader>
                <TableRow className="border-none">
                  <TableHead rowSpan={2} className="w-[80px] bg-emerald-600 text-white border-r border-emerald-500 text-center font-bold text-xs uppercase">Aksi</TableHead>
                  <TableHead rowSpan={2} colSpan={2} className="bg-emerald-600 text-white border-r border-emerald-500 text-center font-bold text-xs uppercase px-4">Jenis Pekerjaan</TableHead>
                  <TableHead rowSpan={2} className="w-[180px] bg-emerald-600 text-white border-r border-emerald-500 text-center font-bold text-xs uppercase">Aktivitas</TableHead>
                  <TableHead rowSpan={2} className="w-[80px] bg-emerald-600 text-white border-r border-emerald-500 text-center font-bold text-xs uppercase">Satuan</TableHead>
                  <TableHead colSpan={10} className="bg-orange-100 text-orange-900 border-b border-orange-200 text-center font-bold text-base py-2">
                    Realisasi {MONTHS[parseInt(selectedMonth)]} {selectedYear}
                  </TableHead>
                </TableRow>
                <TableRow className="border-none">
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs">HK</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs">Hasil Kerja</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs">Output</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs">Satuan Output</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs w-[120px]">Rp KHL</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs w-[120px]">PREMI (Rp)</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs w-[120px]">BORONGAN (Rp)</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs w-[140px]">TOTAL Rp</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center border-r border-orange-200 font-bold text-xs">Rp/Kg</TableHead>
                  <TableHead className="bg-orange-50 text-orange-900 text-center font-bold text-xs">% Cash To Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-10 text-gray-500">Belum ada data untuk periode ini.</TableCell>
                  </TableRow>
                )}
                {data.map((category, catIdx) => {
                  const catTotal = calculateTotals(category);
                  return (
                    <>
                      {category.rows.map((row, rowIdx) => {
                        const totalRowRp = (row.rpKhl || 0) + (row.rpPremi || 0) + (row.rpBorongan || 0);
                        // Formula: Rp/Kg = Total Rp / Total Tonase (user constant)
                        const rpPerKg = totalProduction > 0 ? totalRowRp / totalProduction : 0;
                        // Formula: Cash to Revenue = Total Rp / (Total Tonase * Price)
                        const revenue = totalProduction * tbsPrice;
                        const cashToRev = revenue > 0 ? (totalRowRp / revenue) * 100 : 0;

                        return (
                          <TableRow key={row._id} className="hover:bg-emerald-50/30 border-b border-dashed border-gray-200 group transition-colors">
                            <TableCell className="border-r border-gray-100 text-center py-2">
                              <div className="flex justify-center gap-1 opacity-60 group-hover:opacity-100">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={() => openEditDialog(category, row, catIdx, rowIdx)}><Edit className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => handleDelete(catIdx, rowIdx, row._id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>

                            {rowIdx === 0 && (
                              <TableCell rowSpan={category.rows.length + 1} className="align-middle bg-orange-100/40 font-bold text-center border-r border-orange-200 text-orange-800">
                                {category.name}
                              </TableCell>
                            )}
                            <TableCell className="border-r border-gray-100 py-3 font-medium text-gray-700">{row.jenisPekerjaan}</TableCell>
                            <TableCell className="border-r border-gray-100 py-3 text-gray-600">{row.aktivitas}</TableCell>
                            <TableCell className="border-r border-gray-100 text-center py-3 text-gray-500">{row.satuan}</TableCell>

                            <TableCell className="text-right border-r border-gray-100 font-medium text-gray-700 bg-gray-50/20">{formatNumber(row.hk)}</TableCell>
                            <TableCell className="text-right border-r border-gray-100 font-medium text-gray-700 bg-gray-50/20">{formatNumber(row.hasilKerja)}</TableCell>
                            <TableCell className="text-center border-r border-gray-100 text-gray-500 bg-gray-50/20">{formatNumber(row.output)}</TableCell>
                            <TableCell className="text-center border-r border-gray-100 text-xs text-gray-400 bg-gray-50/20">{row.satuanOutput}</TableCell>
                            <TableCell className="text-right border-r border-gray-100 font-mono text-gray-700 bg-gray-50/20">{formatNumber(row.rpKhl)}</TableCell>

                            <TableCell className="text-right border-r border-gray-100 font-mono text-gray-700">{formatNumber(row.rpPremi)}</TableCell>
                            <TableCell className="text-right border-r border-gray-100 font-mono text-gray-700">{formatNumber(row.rpBorongan)}</TableCell>
                            <TableCell className="text-right border-r border-gray-100 font-mono font-bold text-emerald-700 bg-emerald-50/10">{formatNumber(totalRowRp)}</TableCell>
                            <TableCell className="text-right border-r border-gray-100 font-mono text-sm text-gray-500">{formatNumber(Number(rpPerKg.toFixed(2)))}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-gray-500">{cashToRev.toFixed(2)}%</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-orange-50 border-t-2 border-orange-100/80 font-semibold shadow-inner">
                        <TableCell className="border-r border-orange-200" />
                        <TableCell colSpan={3} className="text-right border-r border-orange-200 pr-4 text-orange-800 text-xs uppercase">Subtotal {category.name}</TableCell>
                        <TableCell className="text-right border-r border-orange-200 text-orange-900">{formatNumber(catTotal.hk)}</TableCell>
                        <TableCell colSpan={3} className="border-r border-orange-200 bg-orange-100/20" />
                        <TableCell className="text-right border-r border-orange-200 text-orange-900">{formatNumber(catTotal.rpKhl)}</TableCell>
                        <TableCell className="text-right border-r border-orange-200 text-orange-900">{formatNumber(catTotal.rpPremi)}</TableCell>
                        <TableCell className="text-right border-r border-orange-200 text-orange-900">{formatNumber(catTotal.rpBorongan)}</TableCell>
                        <TableCell className="text-right border-r border-orange-200 text-orange-900 font-bold">{formatNumber(catTotal.totalRp)}</TableCell>
                        <TableCell colSpan={2} className="bg-orange-100/20" />
                      </TableRow>
                    </>
                  );
                })}

                {/* Grand Total */}
                {data.length > 0 && (
                  <TableRow className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-sm tracking-wide shadow-md transform scale-[1.002] border-t border-emerald-500">
                    <TableCell className="border-r border-emerald-500/50 bg-black/10" />
                    <TableCell colSpan={4} className="text-center border-r border-emerald-500/50 py-4">GRAND TOTAL</TableCell>
                    <TableCell className="text-right border-r border-emerald-500/50">{formatNumber(grandTotals.hk)}</TableCell>
                    <TableCell colSpan={3} className="border-r border-emerald-500/50 bg-black/10"></TableCell>
                    <TableCell className="text-right border-r border-emerald-500/50">{formatNumber(grandTotals.rpKhl)}</TableCell>
                    <TableCell className="text-right border-r border-emerald-500/50">{formatNumber(grandTotals.rpPremi)}</TableCell>
                    <TableCell className="text-right border-r border-emerald-500/50">{formatNumber(grandTotals.rpBorongan)}</TableCell>
                    <TableCell className="text-right border-r border-emerald-500/50 text-base">{formatNumber(grandTotals.totalRp)}</TableCell>
                    <TableCell className="text-right border-r border-emerald-500/50">
                      {formatNumber(Number((totalProduction > 0 ? grandTotals.totalRp / totalProduction : 0).toFixed(2)))}
                    </TableCell>
                    <TableCell className="text-right font-bold bg-white/10">{cashToRevenuePercent.toFixed(2)}%</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* CRUD Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLoc ? 'Edit Data Operasional' : 'Tambah Data Operasional'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">

            {!editingLoc && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Kategori</Label>
                <div className="col-span-3 space-y-2">
                  <Select value={targetCategory} onValueChange={setTargetCategory}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                    <SelectContent>
                      {data.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}
                      <SelectItem value="__NEW__">+ Buat Kategori Baru</SelectItem>
                    </SelectContent>
                  </Select>
                  {targetCategory === '__NEW__' && (
                    <Input placeholder="Nama Kategori Baru" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="jenisPekerjaan" className="text-right">Jenis Pekerjaan</Label>
              <Input id="jenisPekerjaan" value={formData.jenisPekerjaan} onChange={(e) => handleInputChange('jenisPekerjaan', e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="aktivitas" className="text-right">Aktivitas</Label>
              <Input id="aktivitas" value={formData.aktivitas} onChange={(e) => handleInputChange('aktivitas', e.target.value)} className="col-span-3" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-4 items-center gap-4 col-span-2 md:col-span-1">
                <Label className="text-right">HK</Label>
                <Input type="number" className="col-span-3" value={formData.hk} onChange={(e) => handleInputChange('hk', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 col-span-2 md:col-span-1">
                <Label className="text-right">Output (Rate)</Label>
                <Input type="number" className="col-span-3" value={formData.output} onChange={(e) => handleInputChange('output', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Hasil Kerja (Total)</Label>
              <Input type="number" className="col-span-3 bg-gray-50" value={formData.hasilKerja} readOnly />
              <p className="text-xs text-gray-500 col-start-2 col-span-3">Otomatis dihitung: HK * Output</p>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Satuan Output</Label>
              <Input className="col-span-3" value={formData.satuanOutput} onChange={(e) => handleInputChange('satuanOutput', e.target.value)} />
            </div>

            <h4 className="font-semibold mt-2 mb-1">Rincian Biaya</h4>
            <div className="grid gap-2 border p-3 rounded-md bg-slate-50">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Rp KHL</Label>
                <Input type="number" className="col-span-3" value={formData.rpKhl} onChange={(e) => handleInputChange('rpKhl', Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Premi (Rp)</Label>
                <Input type="number" className="col-span-3" value={formData.rpPremi} onChange={(e) => handleInputChange('rpPremi', Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Borongan (Rp)</Label>
                <Input type="number" className="col-span-3" value={formData.rpBorongan} onChange={(e) => handleInputChange('rpBorongan', Number(e.target.value))} />
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="w-4 h-4 mr-2" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`
        .fade-in-up { animation: fadeInUp 0.5s ease-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
};

export default Recap;