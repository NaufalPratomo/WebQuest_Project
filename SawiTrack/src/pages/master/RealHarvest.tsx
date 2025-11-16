import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type RealRow = {
  id: string;
  timestamp: string;
  date: string;
  estateId?: string;
  estateName?: string;
  division: string;
  block?: string;
  noTPH?: string;
  mandor: string;
  pemanen: string;
  jobType: string;
  hasilJjg: number;
  upahBasis: number;
  premi: number;
  kgAngkut: number;
};

const RealHarvest = () => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<RealRow[]>([]);
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [estateId, setEstateId] = useState<string | undefined>(undefined);
  const [divisions, setDivisions] = useState<Array<{ division_id: number }>>([]);
  const [blocks, setBlocks] = useState<Array<{ id_blok?: string; no_blok?: string }>>([]);
  const storageKey = useMemo(() => `realharvest_rows_${date}`, [date]);

  // dialog form state
  const [form, setForm] = useState({
    estateId: '',
    division: '',
    blockNo: '',
    noTPH: '',
    mandor: '',
    pemanen: '',
    jobType: '',
    hasilJjg: '0',
    upahBasis: 0,
    premi: '0',
  });

  useEffect(() => {
    // load estates on mount
    api.estates().then(setEstates).catch(() => toast.error('Gagal memuat estate'));
  }, []);

  useEffect(() => {
    // when date changes, (re)load local rows
    try {
      const raw = localStorage.getItem(storageKey);
      setRows(raw ? (JSON.parse(raw) as RealRow[]) : []);
    } catch {
      setRows([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!estateId) { setDivisions([]); return; }
    api.divisions(estateId).then(setDivisions).catch(() => toast.error('Gagal memuat divisi'));
  }, [estateId]);

  // load blocks when estate and division are selected
  useEffect(() => {
    if (!estateId || !form.division) { setBlocks([]); return; }
    api.blocks(estateId, form.division)
      .then((rows: Array<{ id_blok?: string; no_blok?: string }>) => setBlocks(rows || []))
      .catch(() => toast.error('Gagal memuat blok'));
  }, [estateId, form.division]);

  const filteredRows = useMemo(() => rows.filter(r =>
    (r.division || '').toLowerCase().includes(search.toLowerCase()) ||
    r.mandor.toLowerCase().includes(search.toLowerCase()) ||
    r.pemanen.toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  const totals = useMemo(() => {
    const hasilJjg = filteredRows.reduce((s, r) => s + (r.hasilJjg || 0), 0);
    const upahBasis = filteredRows.reduce((s, r) => s + (r.upahBasis || 0), 0);
    const premi = filteredRows.reduce((s, r) => s + (r.premi || 0), 0);
    const kgAngkut = filteredRows.reduce((s, r) => s + (r.kgAngkut || 0), 0);
    const janjangTBS = hasilJjg;
    return { hasilJjg, upahBasis, premi, kgAngkut, janjangTBS };
  }, [filteredRows]);

  // Load taksasi rows from localStorage to compare
  const taksasiKey = useMemo(() => `taksasi_rows_${date}`, [date]);
  const taksasiTotals = useMemo(() => {
    try {
      const raw = localStorage.getItem(taksasiKey);
      const list: Array<{ taksasiJanjang: number; taksasiTon: number }> = raw ? JSON.parse(raw) : [];
      const taksasiJanjang = list.reduce((s, r) => s + (r.taksasiJanjang || 0), 0);
      const taksasiTon = list.reduce((s, r) => s + (r.taksasiTon || 0), 0);
      const taksasiKg = Math.round(taksasiTon * 1000);
      return { taksasiJanjang, taksasiTon, taksasiKg };
    } catch {
      return { taksasiJanjang: 0, taksasiTon: 0, taksasiKg: 0 };
    }
  }, [taksasiKey]);

  function persist(next: RealRow[]) {
    setRows(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) {
      // non-fatal persistence error (e.g., quota exceeded)
      console.error('Gagal menyimpan ke localStorage', e);
    }
  }

  function handleAdd() {
    if (!form.division || !form.mandor || !form.pemanen || !form.jobType) {
      toast.error('Mohon lengkapi divisi, mandor, pemanen, dan pekerjaan');
      return;
    }
    if (!form.blockNo) {
      toast.error('Mohon pilih blok');
      return;
    }
    const estateName = estates.find(e => e._id === form.estateId)?.estate_name;
    const hasil = Number(form.hasilJjg || 0);
    const upah = hasil * 400;
    const premi = Number(form.premi || 0);
    const row: RealRow = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      date,
      estateId: form.estateId || undefined,
      estateName,
      division: form.division,
      block: form.blockNo,
      noTPH: form.noTPH || '',
      mandor: form.mandor,
      pemanen: form.pemanen,
      jobType: form.jobType,
      hasilJjg: hasil,
      upahBasis: upah,
      premi,
      kgAngkut: 0,
    };
    const next = [...rows, row];
    persist(next);
    toast.success('Data realisasi panen ditambahkan');
    setForm({ estateId: '', division: '', blockNo: '', noTPH: '', mandor: '', pemanen: '', jobType: '', hasilJjg: '0', upahBasis: 0, premi: '0' });
  }

  const janjangComparison = useMemo(() => {
    const diff = totals.janjangTBS - taksasiTotals.taksasiJanjang;
    const better = diff >= 0;
    const pct = taksasiTotals.taksasiJanjang > 0 ? Math.round((diff / taksasiTotals.taksasiJanjang) * 100) : 0;
    return { diff, better, pct };
  }, [totals.janjangTBS, taksasiTotals.taksasiJanjang]);

  const kgComparison = useMemo(() => {
    const diff = totals.kgAngkut - taksasiTotals.taksasiKg;
    const better = diff >= 0;
    const pct = taksasiTotals.taksasiKg > 0 ? Math.round((diff / taksasiTotals.taksasiKg) * 100) : 0;
    return { diff, better, pct };
  }, [totals.kgAngkut, taksasiTotals.taksasiKg]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Realisasi Panen (Real Harvest)</h1>
          <p className="text-muted-foreground">Catat data panen aktual untuk dibandingkan dengan taksasi (berdasarkan sampel)</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Real Panen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Data Real Panen</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tgl_Panen</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estate</Label>
                <Select value={form.estateId} onValueChange={(v) => { setForm(prev => ({ ...prev, estateId: v })); setEstateId(v); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih estate" />
                  </SelectTrigger>
                  <SelectContent>
                    {estates.map(es => (
                      <SelectItem key={es._id} value={es._id}>{es.estate_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Div</Label>
                <Select value={form.division} onValueChange={(v) => setForm(prev => ({ ...prev, division: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.length === 0 ? (
                      <SelectItem value="__none" disabled>-- Tidak ada divisi --</SelectItem>
                    ) : (
                      divisions.map(d => (
                        <SelectItem key={String(d.division_id)} value={String(d.division_id)}>Divisi {d.division_id}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blok</Label>
                <Select value={form.blockNo} onValueChange={(v) => setForm(prev => ({ ...prev, blockNo: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih blok" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks.length === 0 ? (
                      <SelectItem value="__none" disabled>-- Tidak ada blok --</SelectItem>
                    ) : (
                      blocks.map((b, idx) => {
                        const label = b.no_blok || b.id_blok || `Blok ${idx + 1}`;
                        return <SelectItem key={label} value={label}>{label}</SelectItem>;
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>NoTPH</Label>
                <Input placeholder="Nomor TPH" value={form.noTPH} onChange={(e) => setForm(prev => ({ ...prev, noTPH: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>mandor</Label>
                <Input placeholder="Nama Mandor" value={form.mandor} onChange={(e) => setForm(prev => ({ ...prev, mandor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>pemanen</Label>
                <Input placeholder="Nama Pemanen" value={form.pemanen} onChange={(e) => setForm(prev => ({ ...prev, pemanen: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>pekerjaan</Label>
                <Select value={form.jobType} onValueChange={(v) => setForm(prev => ({ ...prev, jobType: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pekerjaan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="panen">panen</SelectItem>
                    <SelectItem value="kutip brodolan">kutip brodolan</SelectItem>
                    <SelectItem value="langsir manual">langsir manual</SelectItem>
                    <SelectItem value="langsir kerbau">langsir kerbau</SelectItem>
                    <SelectItem value="langsir motor">langsir motor</SelectItem>
                    <SelectItem value="langsir pickup/tracktor">langsir pickup/tracktor</SelectItem>
                    <SelectItem value="muat dt ke pks">muat dt ke pks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>hasil kerja (jjg)</Label>
                <Input type="number" min={0} value={form.hasilJjg} onChange={(e) => {
                  const val = e.target.value;
                  const hasil = Number(val || 0);
                  const upah = hasil * 400;
                  setForm(prev => ({ ...prev, hasilJjg: val, upahBasis: upah }));
                }} />
              </div>
              <div className="space-y-2">
                <Label>upah basis</Label>
                <Input type="number" value={form.upahBasis} onChange={()=>{}} disabled />
              </div>
              <div className="space-y-2">
                <Label>premi</Label>
                <Input type="number" min={0} value={form.premi} onChange={(e) => setForm(prev => ({ ...prev, premi: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full mt-2" onClick={handleAdd}>Simpan</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="search">Cari</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Cari: divisi / mandor / pemanen"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-date">Tanggal</Label>
              <Input id="filter-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Tgl_Panen</TableHead>
                <TableHead className="text-center">Estate</TableHead>
                <TableHead className="text-center">Div</TableHead>
                <TableHead className="text-center">Blok</TableHead>
                <TableHead className="text-center">NoTPH</TableHead>
                <TableHead className="text-center">mandor</TableHead>
                <TableHead className="text-center">pemanen</TableHead>
                <TableHead className="text-center">pekerjaan</TableHead>
                <TableHead className="text-center">hasil kerja (jjg)</TableHead>
                <TableHead className="text-center">upah basis</TableHead>
                <TableHead className="text-center">premi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center">{r.date}</TableCell>
                  <TableCell className="text-center">{r.estateName || '-'}</TableCell>
                  <TableCell className="text-center">{r.division}</TableCell>
                  <TableCell className="text-center">{r.block || '-'}</TableCell>
                  <TableCell className="text-center">{r.noTPH || '-'}</TableCell>
                  <TableCell className="text-center">{r.mandor || '-'}</TableCell>
                  <TableCell className="text-center">{r.pemanen || '-'}</TableCell>
                  <TableCell className="text-center">{r.jobType}</TableCell>
                  <TableCell className="text-center">{r.hasilJjg}</TableCell>
                  <TableCell className="text-center">{r.upahBasis}</TableCell>
                  <TableCell className="text-center">{r.premi}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium text-center" colSpan={8}>Total</TableCell>
                <TableCell className="text-center">{totals.hasilJjg}</TableCell>
                <TableCell className="text-center">{totals.upahBasis}</TableCell>
                <TableCell className="text-center">{totals.premi}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Comparison to taksasi */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Perbandingan dengan Taksasi (Tanggal {date})</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Janjang (Real vs Taksasi)</div>
            <div className="text-lg font-semibold">{totals.janjangTBS} vs {taksasiTotals.taksasiJanjang} janjang</div>
            <div className={`text-sm ${janjangComparison.better ? 'text-emerald-600' : 'text-red-600'}`}>
              {janjangComparison.better ? 'Lebih baik' : 'Kurang baik'} ({janjangComparison.diff >= 0 ? '+' : ''}{janjangComparison.diff} / {janjangComparison.pct}%)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealHarvest;