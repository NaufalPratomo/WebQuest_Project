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
  // selection now server-driven (taksasi-selections); legacy key removed
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [estateId, setEstateId] = useState<string | undefined>(undefined);
  const [divisions, setDivisions] = useState<Array<{ division_id: number }>>([]);
  const [blocks, setBlocks] = useState<Array<{ id_blok?: string; no_blok?: string }>>([]);
  // localStorage removed; use server panenList for persistence

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
    // Load both regular employees and custom workers
    api.employees()
      .then(base => {
        api.customWorkers()
          .then(custom => {
            const merged = [
              ...(base || []).map(e => ({ _id: e._id, name: e.name })),
              ...(custom || []).map(c => ({ _id: c._id, name: c.name }))
            ];
            setEmployees(merged);
          })
          .catch(() => setEmployees((base || []).map(e => ({ _id: e._id, name: e.name }))));
      })
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const panen = await api.panenList({ date_panen: date });
        const mapped: RealRow[] = (panen || []).map(p => {
          const estateName = estates.find(e => e._id === p.estateId)?.estate_name || p.estateId;
          return {
          id: String(p._id || `${date}_${p.employeeId || ''}_${p.block_no || ''}`),
          timestamp: p._id ? String(p._id) : new Date(date).toISOString(),
          date,
          estateId: p.estateId,
          estateName: estateName,
          division: String(p.division_id ?? ''),
          block: p.block_no,
          noTPH: (p as { noTPH?: string }).noTPH || '',
          mandor: p.mandorName || '',
          pemanenId: p.employeeId || '',
          pemanenName: p.employeeName || p.employeeId || '',
          jobCode: p.jobCode || 'panen',
          janjangTBS: Number((p as { janjangTBS?: number }).janjangTBS ?? 0),
          janjangKosong: Number((p as { janjangKosong?: number }).janjangKosong ?? 0),
          upahBasis: Number((p as { upahBasis?: number }).upahBasis ?? 0),
          premi: Number((p as { premi?: number }).premi ?? 0),
          totalUpah: Number((p as { totalUpah?: number }).totalUpah ?? 0),
        };
        });
        setRows(mapped);
      } catch { setRows([]); }
      api.attendanceList({ date })
        .then(list => setAttendance(list.map(r => ({ employeeId: r.employeeId, status: r.status }))))
        .catch(()=> setAttendance([]));
    })();
  }, [date, estates]);

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

  const [taksasiTotals, setTaksasiTotals] = useState({ taksasiJanjang: 0, taksasiTon: 0, taksasiKg: 0 });
  useEffect(() => {
    (async () => {
      try {
        const list = await api.taksasiList({ date });
        const janjang = list.reduce((s, r) => {
          const avgW = (r.avgWeightKg && r.avgWeightKg > 0) ? r.avgWeightKg : 15;
          const est = Math.round((r.weightKg || 0) / avgW);
          return s + (r.taksasiJanjang || est);
        }, 0);
        const ton = list.reduce((s, r) => s + (r.taksasiTon || (r.weightKg || 0)/1000), 0);
        setTaksasiTotals({ taksasiJanjang: janjang, taksasiTon: ton, taksasiKg: Math.round(ton*1000) });
      } catch { setTaksasiTotals({ taksasiJanjang: 0, taksasiTon: 0, taksasiKg: 0 }); }
    })();
  }, [date]);

  function persist(next: RealRow[]) {
    // Local optimistic update; server is source of truth but UI updated immediately
    setRows(next);
  }

  // Sync RealHarvest data to Angkut: aggregate janjangTBS by noTPH
  async function syncToAngkut(date: string, estateId: string, division_id: number, block_no: string, noTPH: string) {
    try {
      // Get all RealHarvest data for this date/estate/division/block/noTPH combination
      const allPanen = await api.panenList({ date_panen: date });
      
      // Filter by same estate, division, block, noTPH
      const samePanen = allPanen.filter(p => 
        p.estateId === estateId && 
        p.division_id === division_id && 
        p.block_no === block_no &&
        (p as { noTPH?: string }).noTPH === noTPH
      );
      
      // Aggregate total janjangTBS for this TPH
      const totalJJG = samePanen.reduce((sum, p) => sum + Number((p as { janjangTBS?: number }).janjangTBS || 0), 0);
      
      // Check if Angkut record already exists for this combination
      const existingAngkut = await api.angkutList({ date_panen: date });
      const angkutRecord = existingAngkut.find(a => 
        a.estateId === estateId && 
        a.division_id === division_id && 
        a.block_no === block_no &&
        a.noTPH === noTPH
      );
      
      if (angkutRecord && angkutRecord._id) {
        // Update existing Angkut record with new aggregated JJG Realisasi
        await api.angkutUpdate(angkutRecord._id, {
          jjgRealisasi: totalJJG,
          weightKg: totalJJG * 15, // Assume 15kg per janjang
        } as { jjgRealisasi: number; weightKg: number });
      } else {
        // Create new Angkut record with Realisasi
        await api.angkutCreate({
          date_panen: date,
          date_angkut: date, // Default same day
          estateId,
          division_id,
          block_no,
          noTPH,
          jjgRealisasi: totalJJG,
          jjgAngkut: 0, // Mandor will input this later
          weightKg: totalJJG * 15, // Assume 15kg per janjang
        } as { date_panen: string; date_angkut: string; estateId: string; division_id: number; block_no: string; noTPH: string; jjgRealisasi: number; jjgAngkut: number; weightKg: number });
      }
      
      console.log(`Angkut synced: TPH ${noTPH} = ${totalJJG} JJG`);
    } catch (e) {
      console.warn('Gagal sync ke Angkut:', e);
      // Don't throw - let the main save continue even if sync fails
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
      const backendTarget = rows.find(r => r.id === editingId);
      if (backendTarget && backendTarget.id.match(/^[0-9a-fA-F]{24}$/)) {
        try {
          await api.panenUpdate(backendTarget.id, {
            date_panen: date,
            estateId: form.estateId || '',
            division_id: Number(form.division),
            block_no: form.blockNo,
            weightKg: upahBasis,
            employeeId: form.pemanenId,
            employeeName: pemanenName,
            mandorName: form.mandor,
            jobCode: form.jobCode,
            noTPH: form.noTPH,
            janjangTBS,
            janjangKosong,
            upahBasis,
            premi,
            totalUpah,
          } as { date_panen: string; estateId: string; division_id: number; block_no: string; weightKg: number; employeeId: string; employeeName: string; mandorName: string; jobCode: string; noTPH: string; janjangTBS: number; janjangKosong: number; upahBasis: number; premi: number; totalUpah: number });
          
          // Auto-update Angkut: re-aggregate by noTPH
          await syncToAngkut(date, form.estateId || '', Number(form.division), form.blockNo, form.noTPH);
        } catch (e) {
          console.warn('Gagal update backend panen row', e);
        }
      }
      toast.success('Data real panen diperbarui dan disinkronkan ke Angkut');
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
          mandorName: form.mandor,
          jobCode: form.jobCode,
          noTPH: form.noTPH,
          janjangTBS,
          janjangKosong,
          upahBasis,
          premi,
          totalUpah,
        } as { date_panen: string; estateId: string; division_id: number; block_no: string; weightKg: number; employeeId: string; employeeName: string; mandorName: string; jobCode: string; noTPH: string; janjangTBS: number; janjangKosong: number; upahBasis: number; premi: number; totalUpah: number });
        // store backend id for edit flows (assuming single object return)
        const backendId = (Array.isArray(created) ? created[0]?._id : (created as { _id?: string })?._id) as string | undefined;
        if (backendId) {
          const withId = next.map(r => r.id === row.id ? ({ ...r, _backendId: backendId } as unknown as RealRow) : r);
          // Persisting with extended metadata will drop _backendId due to typing; we only need it transiently in memory
          persist(withId as RealRow[]);
        }
        
        // Auto-create/update Angkut: aggregate by noTPH
        await syncToAngkut(date, form.estateId || '', Number(form.division), form.blockNo, form.noTPH);
      } catch (e) {
        console.warn('Gagal simpan ke backend panen', e);
      }
      toast.success('Data real panen ditambahkan dan disinkronkan ke Angkut');
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
                    <SelectValue placeholder="Pilih pemanen">
                      {form.pemanenId ? employees.find(e => e._id === form.pemanenId)?.name || form.pemanenId : 'Pilih pemanen'}
                    </SelectValue>
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
                <Label>JJG TBS (Hasil Kerja)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.janjangTBS}
                  onChange={(e)=> setForm(p=> ({ ...p, janjangTBS: e.target.value }))}
                  placeholder="Jumlah janjang TBS"
                />
              </div>
              <div className="space-y-2">
                <Label>JJG Kosong</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.janjangKosong}
                  onChange={(e)=> setForm(p=> ({ ...p, janjangKosong: e.target.value }))}
                  placeholder="Jumlah janjang kosong"
                />
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
                <TableHead>Estate</TableHead>
                <TableHead>Div</TableHead>
                <TableHead>Blok</TableHead>
                <TableHead>No TPH</TableHead>
                <TableHead>Pekerjaan</TableHead>
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
                    <TableCell>{r.estateName || r.estateId || '-'}</TableCell>
                    <TableCell>{r.division || '-'}</TableCell>
                    <TableCell>{r.block || '-'}</TableCell>
                    <TableCell>{r.noTPH || '-'}</TableCell>
                    <TableCell>{r.jobCode || '-'}</TableCell>
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
              {filteredRows.length > 0 && (
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={6} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{filteredRows.reduce((s, r) => s + (r.janjangTBS || 0), 0)}</TableCell>
                  <TableCell className="text-right">{filteredRows.reduce((s, r) => s + (r.janjangKosong || 0), 0)}</TableCell>
                  <TableCell className="text-right">{filteredRows.reduce((s, r) => s + (r.upahBasis || 0), 0)}</TableCell>
                  <TableCell className="text-right">{filteredRows.reduce((s, r) => s + (r.premi || 0), 0)}</TableCell>
                  <TableCell className="text-right">{filteredRows.reduce((s, r) => s + (r.totalUpah || 0), 0)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealHarvest;