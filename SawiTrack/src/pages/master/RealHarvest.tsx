import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type RealRow = {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  estateId?: string;
  estateName?: string;
  division: string;
  mandor: string;
  pemanen: string;
  janjangTBS: number;
  janjangKosong: number;
  janjangAngkut: number;
  kgAngkut: number;
};

const RealHarvest = () => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<RealRow[]>([]);
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [estateId, setEstateId] = useState<string | undefined>(undefined);
  const [divisions, setDivisions] = useState<Array<{ division_id: number }>>([]);
  const storageKey = useMemo(() => `realharvest_rows_${date}`, [date]);

  // dialog form state
  const [form, setForm] = useState({
    estateId: '',
    division: '',
    mandor: '',
    pemanen: '',
    janjangTBS: '0',
    janjangKosong: '0',
    janjangAngkut: '0',
    kgAngkut: '0',
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

  const filteredRows = useMemo(() => rows.filter(r =>
    (r.division || '').toLowerCase().includes(search.toLowerCase()) ||
    r.mandor.toLowerCase().includes(search.toLowerCase()) ||
    r.pemanen.toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  const totals = useMemo(() => {
    const janjangTBS = filteredRows.reduce((s, r) => s + (r.janjangTBS || 0), 0);
    const janjangKosong = filteredRows.reduce((s, r) => s + (r.janjangKosong || 0), 0);
    const janjangAngkut = filteredRows.reduce((s, r) => s + (r.janjangAngkut || 0), 0);
    const kgAngkut = filteredRows.reduce((s, r) => s + (r.kgAngkut || 0), 0);
    return { janjangTBS, janjangKosong, janjangAngkut, kgAngkut };
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
    if (!form.division || !form.mandor || !form.pemanen) {
      toast.error('Mohon lengkapi mandor, pemanen, dan divisi');
      return;
    }
    const estateName = estates.find(e => e._id === form.estateId)?.estate_name;
    const row: RealRow = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      date,
      estateId: form.estateId || undefined,
      estateName,
      division: form.division,
      mandor: form.mandor,
      pemanen: form.pemanen,
      janjangTBS: Number(form.janjangTBS || 0),
      janjangKosong: Number(form.janjangKosong || 0),
      janjangAngkut: Number(form.janjangAngkut || 0),
      kgAngkut: Number(form.kgAngkut || 0),
    };
    const next = [...rows, row];
    persist(next);
    toast.success('Data panen real ditambahkan');
    setForm({ estateId: '', division: '', mandor: '', pemanen: '', janjangTBS: '0', janjangKosong: '0', janjangAngkut: '0', kgAngkut: '0' });
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
            <Button>
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
                <Label>Tanggal</Label>
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
                <Label>Divisi</Label>
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
                <Label>Mandor</Label>
                <Input placeholder="Nama mandor" value={form.mandor} onChange={(e) => setForm(prev => ({ ...prev, mandor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Pemanen</Label>
                <Input placeholder="Nama pemanen" value={form.pemanen} onChange={(e) => setForm(prev => ({ ...prev, pemanen: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Janjang TBS</Label>
                <Input type="number" min={0} value={form.janjangTBS} onChange={(e) => setForm(prev => ({ ...prev, janjangTBS: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Janjang Kosong</Label>
                <Input type="number" min={0} value={form.janjangKosong} onChange={(e) => setForm(prev => ({ ...prev, janjangKosong: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Janjang Angkut</Label>
                <Input type="number" min={0} value={form.janjangAngkut} onChange={(e) => setForm(prev => ({ ...prev, janjangAngkut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Kg Angkut</Label>
                <Input type="number" min={0} value={form.kgAngkut} onChange={(e) => setForm(prev => ({ ...prev, kgAngkut: e.target.value }))} />
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
                <TableHead>Waktu</TableHead>
                <TableHead>Estate</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Mandor</TableHead>
                <TableHead>Pemanen</TableHead>
                <TableHead className="text-right">Janjang TBS</TableHead>
                <TableHead className="text-right">Janjang Kosong</TableHead>
                <TableHead className="text-right">Janjang Angkut</TableHead>
                <TableHead className="text-right">Kg Angkut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.timestamp).toLocaleTimeString()}</TableCell>
                  <TableCell>{r.estateName || '-'}</TableCell>
                  <TableCell>{r.division}</TableCell>
                  <TableCell>{r.mandor}</TableCell>
                  <TableCell>{r.pemanen}</TableCell>
                  <TableCell className="text-right">{r.janjangTBS}</TableCell>
                  <TableCell className="text-right">{r.janjangKosong}</TableCell>
                  <TableCell className="text-right">{r.janjangAngkut}</TableCell>
                  <TableCell className="text-right">{r.kgAngkut}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right">{totals.janjangTBS}</TableCell>
                <TableCell className="text-right">{totals.janjangKosong}</TableCell>
                <TableCell className="text-right">{totals.janjangAngkut}</TableCell>
                <TableCell className="text-right">{totals.kgAngkut}</TableCell>
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Janjang (Real vs Taksasi)</div>
              <div className="text-lg font-semibold">{totals.janjangTBS} vs {taksasiTotals.taksasiJanjang} janjang</div>
              <div className={`text-sm ${janjangComparison.better ? 'text-emerald-600' : 'text-red-600'}`}>
                {janjangComparison.better ? 'Lebih baik' : 'Kurang baik'} ({janjangComparison.diff >= 0 ? '+' : ''}{janjangComparison.diff} / {janjangComparison.pct}%)
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Tonase (Real vs Taksasi)</div>
              <div className="text-lg font-semibold">{(totals.kgAngkut / 1000).toFixed(2)} ton vs {taksasiTotals.taksasiTon.toFixed(2)} ton</div>
              <div className={`text-sm ${kgComparison.better ? 'text-emerald-600' : 'text-red-600'}`}>
                {kgComparison.better ? 'Lebih baik' : 'Kurang baik'} ({kgComparison.diff >= 0 ? '+' : ''}{kgComparison.diff} kg / {kgComparison.pct}%)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealHarvest;