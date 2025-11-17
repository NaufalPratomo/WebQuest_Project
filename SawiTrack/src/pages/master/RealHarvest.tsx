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
  pemanenId: string; // link to employee
  pemanenName: string;
  jobCode: string;
  janjangTBS: number;
  janjangKosong: number;
  upahBasis: number;
  premi: number;
  totalUpah: number;
};

const RealHarvest = () => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<RealRow[]>([]);
  const [attendance, setAttendance] = useState<Array<{ employeeId: string; status: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ _id: string; name: string }>>([]);
  const selectionKey = useMemo(() => `taksasi_selection_${date}`, [date]);
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
    pemanenId: '',
    jobCode: '',
    janjangTBS: '0',
    janjangKosong: '0',
    premi: '0',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // wage placeholders
  const BASIS_PER_PEMANEN = 120; // assumption
  const TARIF_DASAR_PER_JANJANG = 500; // placeholder rupiah
  // List of job codes kept inline in the form below

  // live preview for upah based on current form inputs
  const janjangTBSNum = useMemo(() => Number(form.janjangTBS || 0), [form.janjangTBS]);
  const upahPreview = useMemo(() => janjangTBSNum * TARIF_DASAR_PER_JANJANG, [janjangTBSNum]);
  const premiNum = useMemo(() => Number(form.premi || 0), [form.premi]);
  const totalPreview = useMemo(() => upahPreview + premiNum, [upahPreview, premiNum]);

  useEffect(() => {
    // load estates on mount
    api.estates().then(setEstates).catch(() => toast.error('Gagal memuat estate'));
    api.employees().then(list => setEmployees(list.map(e => ({ _id: e._id, name: e.name })))).catch(()=> setEmployees([]));
  }, []);

  useEffect(() => {
    // when date changes, (re)load local rows
    try {
      const raw = localStorage.getItem(storageKey);
      setRows(raw ? (JSON.parse(raw) as RealRow[]) : []);
    } catch {
      setRows([]);
    }
    // load attendance hadir
    api.attendanceList({ date })
      .then(list => {
        // normalize backend enum to UI-local filter helper
        const norm = list.map(r => ({ employeeId: r.employeeId, status: r.status }));
        setAttendance(norm);
      })
      .catch(()=> setAttendance([]));
  }, [storageKey, date]);

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
    r.pemanenName.toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  const totals = useMemo(() => {
    const janjangTBS = filteredRows.reduce((s, r) => s + (r.janjangTBS || 0), 0);
    const janjangKosong = filteredRows.reduce((s, r) => s + (r.janjangKosong || 0), 0);
    return { janjangTBS, janjangKosong };
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

  async function handleSave() {
    if (!form.division || !form.mandor || !form.pemanenId) {
      toast.error('Mohon lengkapi mandor, pemanen, dan divisi');
      return;
    }
    if (!form.blockNo || !form.jobCode || !form.noTPH) {
      toast.error('Mohon isi blok, kode pekerjaan, dan NoTPH');
      return;
    }
    // verify attendance status hadir
    const att = attendance.find(a => a.employeeId === form.pemanenId);
    if (!att || (att.status !== 'hadir' && att.status !== 'present')) {
      toast.error('Pemanen belum berstatus hadir di absensi');
      return;
    }
    const estateName = estates.find(e => e._id === form.estateId)?.estate_name;
    const pemanenName = employees.find(e => e._id === form.pemanenId)?.name || form.pemanenId;
    const janjangTBS = Number(form.janjangTBS || 0);
    const janjangKosong = Number(form.janjangKosong || 0);
    const upahBasis = janjangTBS * TARIF_DASAR_PER_JANJANG;
  const premi = Number(form.premi || 0);
  const totalUpah = upahBasis + premi;
    if (editingId) {
      const next = rows.map(r => r.id === editingId ? ({
        ...r,
        estateId: form.estateId || undefined,
        estateName,
        division: form.division,
        block: form.blockNo,
        mandor: form.mandor,
        pemanenId: form.pemanenId,
        pemanenName,
        jobCode: form.jobCode,
        noTPH: form.noTPH,
        janjangTBS,
        janjangKosong,
        upahBasis,
        premi,
        totalUpah,
      }) : r);
      persist(next);
      // attempt backend update if _id stored previously
  // find existing row that has backend id stored transiently on object
  const backendTarget = rows.find(r => (r as unknown as { _backendId?: string })._backendId && r.id === editingId) as (RealRow & { _backendId?: string }) | undefined;
      if (backendTarget) {
        try {
          await api.panenCreate({
            _id: backendTarget._backendId!,
            date_panen: date,
            estateId: form.estateId || '',
            division_id: Number(form.division),
            block_no: form.blockNo,
            weightKg: upahBasis, // placeholder mapping; adjust backend meaning later
            employeeId: form.pemanenId,
            employeeName: pemanenName,
            jobCode: form.jobCode,
            notes: `edit:${new Date().toISOString()}`,
            janjangTBS,
            janjangKosong,
            upahBasis,
            premi,
            totalUpah,
          });
        } catch (e) {
          console.warn('Gagal update backend panen row', e);
        }
      }
      toast.success('Data real panen diperbarui');
    } else {
      const row: RealRow = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        date,
        estateId: form.estateId || undefined,
        estateName,
        division: form.division,
        block: form.blockNo,
        mandor: form.mandor,
        pemanenId: form.pemanenId,
        pemanenName,
        jobCode: form.jobCode,
        noTPH: form.noTPH,
        janjangTBS,
        janjangKosong,
        upahBasis,
        premi,
        totalUpah,
      };
      const next = [...rows, row];
      persist(next);
      // backend persistence create
      try {
        const created = await api.panenCreate({
          date_panen: date,
          estateId: form.estateId || '',
          division_id: Number(form.division),
          block_no: form.blockNo,
          weightKg: upahBasis, // placeholder mapping
          employeeId: form.pemanenId,
          employeeName: pemanenName,
          jobCode: form.jobCode,
          notes: `create:${new Date().toISOString()}`,
          janjangTBS,
          janjangKosong,
          upahBasis,
          premi,
          totalUpah,
        });
        // store backend id for edit flows (assuming single object return)
        const backendId = (Array.isArray(created) ? created[0]?._id : (created as { _id?: string })?._id) as string | undefined;
        if (backendId) {
          const withId = next.map(r => r.id === row.id ? ({ ...r, _backendId: backendId } as unknown as RealRow) : r);
          // Persisting with extended metadata will drop _backendId due to typing; we only need it transiently in memory
          persist(withId as RealRow[]);
        }
      } catch (e) {
        console.warn('Gagal simpan ke backend panen', e);
      }
      toast.success('Data real panen ditambahkan');
    }
    setDialogOpen(false);
    setEditingId(null);
  setForm({ estateId: '', division: '', blockNo: '', mandor: '', pemanenId: '', jobCode: '', noTPH: '', janjangTBS: '0', janjangKosong: '0', premi: '0' });
  }

  const janjangComparison = useMemo(() => {
    const diff = totals.janjangTBS - taksasiTotals.taksasiJanjang;
    const better = diff >= 0;
    const pct = taksasiTotals.taksasiJanjang > 0 ? Math.round((diff / taksasiTotals.taksasiJanjang) * 100) : 0;
    return { diff, better, pct };
  }, [totals.janjangTBS, taksasiTotals.taksasiJanjang]);

  // Remove kgAngkut comparison (not part of per-employee wage calc). Placeholder diff based on janjang only.
  // kgComparison removed: tidak ada perhitungan kgAngkut di konteks ini

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
            <div className="grid gap-4 md:grid-cols-2">
          <h1 className="text-3xl font-bold">Realisasi Panen (Real Harvest)</h1>
          <p className="text-muted-foreground">Catat data panen aktual untuk dibandingkan dengan taksasi (berdasarkan sampel)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Real Panen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Perbarui Data Real Panen' : 'Tambah Data Real Panen'}</DialogTitle>
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
                <Label>Pemanen (hadir)</Label>
                <Select value={form.pemanenId} onValueChange={(v)=> setForm(p=> ({ ...p, pemanenId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pemanen" />
                  </SelectTrigger>
                  <SelectContent>
                    {attendance.filter(a=> (a.status==='hadir' || a.status==='present')).map(a => {
                      const emp = employees.find(e => e._id === a.employeeId);
                      return <SelectItem key={a.employeeId} value={a.employeeId}>{emp?.name || a.employeeId}</SelectItem>;
                    })}
                    {attendance.filter(a=> (a.status==='hadir' || a.status==='present')).length === 0 && (
                      <SelectItem value="__none" disabled>Tidak ada karyawan hadir</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kode Pekerjaan</Label>
                <Select value={form.jobCode} onValueChange={(v)=> setForm(p=> ({ ...p, jobCode: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kode" />
                  </SelectTrigger>
                  <SelectContent>
                    {['panen','kutip_brodolan','langsir_manual','langsir_kerbau','langsir_motor','langsir_pickup_tracktor','muat_dt_ke_pks'].map(code => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Upah Basis (Otomatis)</Label>
                <Input readOnly value={upahPreview} />
              </div>
              <div className="space-y-2">
                <Label>Premi (Input Mandor)</Label>
                <Input type="number" min={0} value={form.premi} onChange={(e)=> setForm(p=> ({ ...p, premi: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Total Upah</Label>
                <Input readOnly value={totalPreview} />
              </div>
              {/* Duplicate legacy fields removed; premi now input manual */}
              {/* Removed Angkut fields in per-employee realisasi context */}
            </div>
            <div className="sticky bottom-0 pt-2 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/30">
              <Button className="w-full" onClick={handleSave}>{editingId ? 'Perbarui' : 'Simpan'}</Button>
            </div>
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
                <TableHead>Blok</TableHead>
                <TableHead>Pemanen</TableHead>
                <TableHead className="text-right">JJG TBS</TableHead>
                <TableHead className="text-right">JJG Kosong</TableHead>
                <TableHead className="text-right">Upah Basis</TableHead>
                <TableHead className="text-right">Premi</TableHead>
                <TableHead className="text-right">Total Upah</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => {
                const isComplete = Boolean(r.jobCode && r.noTPH && r.janjangTBS > 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.block || '-'}</TableCell>
                    <TableCell>{r.pemanenName}</TableCell>
                    <TableCell className="text-right">{r.janjangTBS}</TableCell>
                    <TableCell className="text-right">{r.janjangKosong}</TableCell>
                    <TableCell className="text-right">{r.upahBasis}</TableCell>
                    <TableCell className="text-right">{r.premi}</TableCell>
                    <TableCell className="text-right">{r.totalUpah}</TableCell>
                    <TableCell>
                      <Button size="sm" variant={isComplete ? 'outline' : 'default'} onClick={() => {
                        setEditingId(r.id);
                        setDialogOpen(true);
                        setForm({
                          estateId: r.estateId || '',
                          division: r.division || '',
                          blockNo: r.block || '',
                          mandor: r.mandor || '',
                          pemanenId: r.pemanenId,
                          jobCode: r.jobCode || '',
                          noTPH: r.noTPH || '',
                          janjangTBS: String(r.janjangTBS ?? '0'),
                          janjangKosong: String(r.janjangKosong ?? '0'),
                          premi: String(r.premi ?? '0'),
                        });
                        if (r.estateId) setEstateId(r.estateId);
                      }}>{isComplete ? 'Edit' : 'Lengkapi'}</Button>
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

export default RealHarvest;