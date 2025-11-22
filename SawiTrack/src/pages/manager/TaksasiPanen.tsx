import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type EstateOption = { _id: string; estate_name: string };
type DivisionOption = { division_id: number };
type Block = {
  id_blok?: string;
  no_blok?: string;
  luas_blok?: number;
  jumlak_pokok?: number; // note: schema uses jumlak_pokok
};

export default function TaksasiPanen() {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [estates, setEstates] = useState<EstateOption[]>([]);
  const [estateId, setEstateId] = useState<string>('');
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [divisionId, setDivisionId] = useState<string>('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockIndex, setBlockIndex] = useState<string>(''); // index of chosen block in blocks
  const [editingKey, setEditingKey] = useState<string | null>(null); // composite key for editing
  const [pendingEditBlockLabel, setPendingEditBlockLabel] = useState<string>('');

  type TaksasiRow = {
    timestamp: string; // ISO string when saved
    date: string; // YYYY-MM-DD
    estateId: string;
    estateName: string;
    divisionId: string;
    blockLabel: string;
    totalPokok: number;
    samplePokok: number;
    bm: number;
    ptb: number;
    bmbb: number;
    bmm: number;
    avgWeightKg: number;
    basisJanjangPerPemanen: number;
    akpPercent: number;
    taksasiJanjang: number;
    taksasiTon: number;
    kebutuhanPemanen: number;
  };
  const [rows, setRows] = useState<TaksasiRow[]>([]);
  const storageKey = useMemo(() => `taksasi_rows_${date}`, [date]);

  // Page 2 inputs
  const [bm, setBm] = useState<number>(0); // Buah Mentah
  const [ptb, setPtb] = useState<number>(0); // Pokok Tidak Berbuah
  const [bmbb, setBmbb] = useState<number>(0); // Buah Merah Belum Brondol
  const [bmm, setBmm] = useState<number>(0); // Buah Merah Membrodol
  const [avgWeightKg, setAvgWeightKg] = useState<number>(15);
  const [basisJanjangPerPemanen, setBasisJanjangPerPemanen] = useState<number>(120);

  // Employee selection for capacity
  type Emp = { _id: string; name: string; division?: string; role?: string };
  const [employees, setEmployees] = useState<Emp[]>([]);
  const selectionKey = useMemo(() => `taksasi_selection_${date}`, [date]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Custom ("Other") employees added ad-hoc for the day
  const customKey = useMemo(() => `taksasi_custom_${date}`, [date]);
  const [customEmployees, setCustomEmployees] = useState<Emp[]>([]);
  const [otherName, setOtherName] = useState<string>('');
  const allEmployees = useMemo(() => [...employees, ...customEmployees], [employees, customEmployees]);

  // load estates once
  useEffect(() => {
    api.estates()
      .then(setEstates)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat estate'));
  }, []);

  // when estate changes, load divisions
  useEffect(() => {
    if (!estateId) { setDivisions([]); setDivisionId(''); setBlocks([]); setBlockIndex(''); return; }
    api.divisions(estateId)
      .then((rows) => setDivisions(rows || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat divisi'));
  }, [estateId]);

  // when division changes, load blocks
  useEffect(() => {
    if (!estateId || !divisionId) { setBlocks([]); setBlockIndex(''); return; }
    api.blocks(estateId, divisionId)
      .then((rows: Block[]) => setBlocks(rows || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat blok'));
  }, [estateId, divisionId]);

  // load today's rows from localStorage whenever date changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setRows([]); return; }
      const parsed = JSON.parse(raw) as TaksasiRow[];
      setRows(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRows([]);
    }
  }, [storageKey]);

  // load employees and existing selection
  useEffect(() => {
    api.employees()
      .then((list) => {
        // Assume API employee shape includes 'role'; narrow via predicate
        const onlyKaryawan: Emp[] = (list || []).filter((e: unknown): e is Emp => {
          return typeof e === 'object' && e !== null && (e as { role?: string }).role === 'karyawan';
        });
        setEmployees(onlyKaryawan);
      })
      .catch(() => setEmployees([]));
    try {
      const raw = localStorage.getItem(selectionKey);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      setSelectedIds(Array.isArray(arr) ? arr : []);
    } catch { setSelectedIds([]); }
    // load custom employees for date
    try {
      const rawC = localStorage.getItem(customKey);
      const arrC = rawC ? (JSON.parse(rawC) as Emp[]) : [];
      setCustomEmployees(Array.isArray(arrC) ? arrC : []);
    } catch { setCustomEmployees([]); }
  }, [selectionKey, customKey]);

  const selectedBlock: Block | undefined = useMemo(() => {
    const i = Number(blockIndex);
    if (Number.isNaN(i) || i < 0 || i >= blocks.length) return undefined;
    return blocks[i];
  }, [blockIndex, blocks]);

  const totalPokok = selectedBlock?.jumlak_pokok ?? 0;
  const samplePokok = useMemo(() => {
    if (!totalPokok || totalPokok <= 0) return 0;
    return Math.max(1, Math.ceil(totalPokok * 0.10));
  }, [totalPokok]);

  // Derived calculations (assumptions documented below):
  const effectiveSample = Math.max(0, samplePokok - ptb);
  // Assumption: AKP% uses only BMM (ripe and brondol) palms over effective sample
  const akpPercent = effectiveSample > 0 ? (bmm / effectiveSample) * 100 : 0;
  // Estimate non-bearing rate across block
  const nonBearingRate = samplePokok > 0 ? ptb / samplePokok : 0;
  const estimatedNonBearingInBlock = Math.round(nonBearingRate * totalPokok);
  const effectiveBlockPalms = Math.max(0, totalPokok - estimatedNonBearingInBlock);
  // Assumption: 1 janjang per bearing palm on estimation horizon
  const predictedBearingPalms = Math.round((akpPercent / 100) * effectiveBlockPalms);
  const taksasiJanjang = predictedBearingPalms;
  const taksasiTon = (taksasiJanjang * avgWeightKg) / 1000; // tons
  const kebutuhanPemanen = basisJanjangPerPemanen > 0 ? Math.ceil(taksasiJanjang / basisJanjangPerPemanen) : 0;

  function toggleSelect(empId: string) {
    setSelectedIds((prev) => {
      const exists = prev.includes(empId);
      if (exists) {
        const next = prev.filter((id) => id !== empId);
        try { localStorage.setItem(selectionKey, JSON.stringify(next)); } catch (e) { /* ignore */ }
        return next;
      }
      // capacity guard
      if (prev.length >= kebutuhanPemanen && kebutuhanPemanen > 0) {
        toast.error(`Kapasitas penuh (${prev.length}/${kebutuhanPemanen})`);
        return prev;
      }
      const next = [...prev, empId];
      try { localStorage.setItem(selectionKey, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }

  function addOtherEmployee() {
    const name = otherName.trim();
    if (!name) {
      toast.error('Isi nama karyawan lainnya');
      return;
    }
    if (kebutuhanPemanen > 0 && selectedIds.length >= kebutuhanPemanen) {
      toast.error('Kapasitas penuh, tidak bisa menambah');
      return;
    }
    const id = `other_${Date.now()}`;
    const division = divisionId || (employees[0]?.division ?? undefined);
    const newEmp: Emp = { _id: id, name, division, role: 'karyawan' };
    setCustomEmployees(prev => {
      const next = [...prev, newEmp];
      try { localStorage.setItem(customKey, JSON.stringify(next)); } catch {/* ignore */ }
      return next;
    });
    // auto-select it
    setSelectedIds(prev => {
      const next = [...prev, id];
      try { localStorage.setItem(selectionKey, JSON.stringify(next)); } catch {/* ignore */ }
      return next;
    });
    setOtherName('');
    toast.success('Karyawan lainnya ditambahkan');
  }

  async function saveRow() {
    if (!date || !estateId || !divisionId || !selectedBlock) {
      toast.error('Mohon lengkapi Tanggal, Estate, Divisi, dan Blok');
      return;
    }
    if (!totalPokok || totalPokok <= 0) {
      toast.error('Blok tidak memiliki data jumlah pokok');
      return;
    }
    const estateName = estates.find((e) => e._id === estateId)?.estate_name || '-';
    const blockLabel = selectedBlock.no_blok || selectedBlock.id_blok || '-';
    const row: TaksasiRow = {
      timestamp: new Date().toISOString(),
      date,
      estateId,
      estateName,
      divisionId,
      blockLabel,
      totalPokok,
      samplePokok,
      bm,
      ptb,
      bmbb,
      bmm,
      avgWeightKg,
      basisJanjangPerPemanen,
      akpPercent: Number(akpPercent.toFixed(2)),
      taksasiJanjang,
      taksasiTon: Number(taksasiTon.toFixed(2)),
      kebutuhanPemanen,
    };

    // Simpan ke server dulu
    try {
      await api.taksasiCreate({
        date,
        estateId,
        division_id: Number(divisionId),
        block_no: blockLabel,
        weightKg: Math.round(taksasiTon * 1000),
        notes: `AKP=${row.akpPercent}%; BM=${bm}; PTB=${ptb}`,
      });

      // Jika sukses, baru update local state
      const composite = `${date}|${estateId}|${divisionId}|${blockLabel}`;
      let newRows: TaksasiRow[];
      const existingIndex = rows.findIndex(r => `${r.date}|${r.estateId}|${r.divisionId}|${r.blockLabel}` === composite);

      if (existingIndex !== -1) {
        newRows = rows.slice();
        newRows[existingIndex] = row;
        toast.success('Taksasi diperbarui dan tersimpan ke server');
      } else if (editingKey) {
        newRows = rows.map(r => (
          `${r.date}|${r.estateId}|${r.divisionId}|${r.blockLabel}` === editingKey ? row : r
        ));
        toast.success('Taksasi hasil edit tersimpan ke server');
      } else {
        newRows = [...rows, row];
        toast.success('Taksasi tersimpan ke server');
      }

      setRows(newRows);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newRows));
      } catch {
        // ignore localStorage failure
      }

      // reset for next input
      setStep(1);
      setDivisionId('');
      setBlocks([]);
      setBlockIndex('');
      setBm(0); setPtb(0); setBmbb(0); setBmm(0);
      setAvgWeightKg(15); setBasisJanjangPerPemanen(120);
      setEditingKey(null);
      setPendingEditBlockLabel('');

    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal simpan taksasi ke server';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
      toast.error(msg);
    }
  }

  function nextStep() {
    if (step === 1) {
      if (!date || !estateId || !divisionId || !selectedBlock) {
        toast.error('Mohon lengkapi Tanggal, Estate, Divisi, dan Blok');
        return;
      }
      if (!totalPokok || totalPokok <= 0) {
        toast.error('Blok tidak memiliki data jumlah pokok');
        return;
      }
      setStep(2);
    }
  }

  function resetAll() {
    setStep(1);
    setDate(new Date().toISOString().split('T')[0]);
    setEstateId('');
    setDivisionId('');
    setBlocks([]);
    setBlockIndex('');
    setBm(0); setPtb(0); setBmbb(0); setBmm(0);
    setAvgWeightKg(15); setBasisJanjangPerPemanen(120);
  }

  // When editing, after blocks load try to set blockIndex automatically
  useEffect(() => {
    if (editingKey && pendingEditBlockLabel && blocks.length > 0 && blockIndex === '') {
      const idx = blocks.findIndex(b => (b.no_blok || b.id_blok || '-') === pendingEditBlockLabel);
      if (idx !== -1) setBlockIndex(String(idx));
    }
  }, [editingKey, pendingEditBlockLabel, blocks, blockIndex]);

  function startEdit(row: TaksasiRow) {
    setDate(row.date); // ensure same date
    setEstateId(row.estateId);
    setDivisionId(row.divisionId);
    setPendingEditBlockLabel(row.blockLabel);
    setBm(row.bm);
    setPtb(row.ptb);
    setBmbb(row.bmbb);
    setBmm(row.bmm);
    setAvgWeightKg(row.avgWeightKg);
    setBasisJanjangPerPemanen(row.basisJanjangPerPemanen);
    setStep(2);
    setEditingKey(`${row.date}|${row.estateId}|${row.divisionId}|${row.blockLabel}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Taksasi Panen</h1>
        <p className="text-muted-foreground">Form dua langkah untuk prediksi panen</p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 1: Informasi Blok</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estate</Label>
                <Select value={estateId} onValueChange={setEstateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih estate" />
                  </SelectTrigger>
                  <SelectContent>
                    {estates.map((es) => (
                      <SelectItem key={es._id} value={es._id}>{es.estate_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Divisi</Label>
                <Select value={divisionId} onValueChange={setDivisionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((d) => (
                      <SelectItem key={String(d.division_id)} value={String(d.division_id)}>Divisi {d.division_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blok</Label>
                <Select value={blockIndex} onValueChange={setBlockIndex}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih blok" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks.map((b, idx) => (
                      <SelectItem key={`${b.no_blok ?? idx}`} value={String(idx)}>
                        {b.no_blok ?? b.id_blok ?? `Blok ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Jumlah Pokok (dari data blok)</Label>
                <Input readOnly value={totalPokok || ''} />
              </div>
              <div className="space-y-1">
                <Label>Pokok Sample (10% dari jumlah pokok)</Label>
                <Input readOnly value={samplePokok || ''} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={nextStep}>Lanjutkan</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 2: Input Observasi & Parameter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Buah Mentah (BM)</Label>
                <Input type="number" min={0} value={bm} onChange={(e) => setBm(Number(e.target.value || 0))} />
              </div>
              <div className="space-y-2">
                <Label>Pokok Tidak Berbuah (PTB)</Label>
                <Input type="number" min={0} value={ptb} onChange={(e) => setPtb(Number(e.target.value || 0))} />
              </div>
              <div className="space-y-2">
                <Label>Buah Merah Belum Brondol (BMBB)</Label>
                <Input type="number" min={0} value={bmbb} onChange={(e) => setBmbb(Number(e.target.value || 0))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Buah Merah Membrodol (BMM)</Label>
                <Input type="number" min={0} value={bmm} onChange={(e) => setBmm(Number(e.target.value || 0))} />
              </div>
              <div className="space-y-2">
                <Label>Berat Janjang Rata-rata (kg)</Label>
                <Input type="number" min={0} step="0.1" value={avgWeightKg} onChange={(e) => setAvgWeightKg(Number(e.target.value || 0))} />
              </div>
              <div className="space-y-2">
                <Label>Basis Blok (janjang/pemanen)</Label>
                <Input type="number" min={1} value={basisJanjangPerPemanen} onChange={(e) => setBasisJanjangPerPemanen(Number(e.target.value || 0))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hasil Perhitungan</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">AKP % (berdasarkan BMM)</div>
                  <Input readOnly value={akpPercent.toFixed(2)} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Taksasi Janjang (janjang)</div>
                  <Input readOnly value={taksasiJanjang} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Taksasi Tonase (ton)</div>
                  <Input readOnly value={taksasiTon.toFixed(2)} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Kebutuhan Pemanen (orang)</div>
                  <Input readOnly value={kebutuhanPemanen} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Catatan: Perhitungan ini mengasumsikan AKP% dihitung dari BMM/efektif sample (sample - PTB), dan 1 janjang per pokok berbuah. Anda dapat menyesuaikan parameter rata-rata berat janjang dan basis janjang/pemanen.
              </p>
            </div>

            {/* Employee selection dialog */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm">
                <div className="font-medium">Alokasi Pemanen</div>
                <div className="text-muted-foreground">Pilih karyawan sesuai kebutuhan: <span className="font-mono">{selectedIds.length}/{kebutuhanPemanen}</span></div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Pilih Karyawan</Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Pilih Karyawan ({selectedIds.length}/{kebutuhanPemanen})</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-auto">
                    {allEmployees.map((emp) => {
                      const active = selectedIds.includes(emp._id);
                      const atCapacity = !active && kebutuhanPemanen > 0 && selectedIds.length >= kebutuhanPemanen;
                      return (
                        <div
                          key={emp._id}
                          role="button"
                          aria-pressed={active}
                          onClick={() => !atCapacity && toggleSelect(emp._id)}
                          className={`rounded-lg border p-3 transition ${active ? 'bg-emerald-50 border-emerald-300' : 'hover:bg-muted'} ${atCapacity ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="font-medium truncate">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">Divisi {emp.division ?? '-'}</div>
                          {active && <div className="mt-2 inline-block text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Dipilih</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm font-medium">Tambah Karyawan Lain (Other)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nama karyawan baru"
                        value={otherName}
                        onChange={(e) => setOtherName(e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="secondary" onClick={addOtherEmployee}>Tambah</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hanya isi nama. Kolom divisi mengikuti konteks pilihan saat ini.
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">Tidak dapat memilih lebih dari kapasitas.</div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => {
                  // For now we don't persist; we just show a confirmation
                  toast.success('Taksasi dihitung. Anda dapat menyimpan fitur ini nanti.');
                }}>Hitung Ulang</Button>
                <Button onClick={saveRow}>Selesai</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table of saved rows for the selected date */}
      <Card>
        <CardHeader>
          <CardTitle>Tabel Taksasi Hari Ini ({date})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data tersimpan untuk tanggal ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estate</TableHead>
                  <TableHead>Divisi</TableHead>
                  <TableHead>Blok</TableHead>
                  <TableHead className="text-right">Pokok</TableHead>
                  <TableHead className="text-right">Sample</TableHead>
                  <TableHead className="text-right">BM</TableHead>
                  <TableHead className="text-right">PTB</TableHead>
                  <TableHead className="text-right">BMBB</TableHead>
                  <TableHead className="text-right">BMM</TableHead>
                  <TableHead className="text-right">AKP %</TableHead>
                  <TableHead className="text-right">Ton</TableHead>
                  <TableHead className="text-right">Perkiraan Kg</TableHead>
                  <TableHead className="text-right">Pemanen</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.timestamp + i}>
                    <TableCell>{r.estateName}</TableCell>
                    <TableCell>Divisi {r.divisionId}</TableCell>
                    <TableCell>{r.blockLabel}</TableCell>
                    <TableCell className="text-right">{r.totalPokok}</TableCell>
                    <TableCell className="text-right">{r.samplePokok}</TableCell>
                    <TableCell className="text-right">{r.bm}</TableCell>
                    <TableCell className="text-right">{r.ptb}</TableCell>
                    <TableCell className="text-right">{r.bmbb}</TableCell>
                    <TableCell className="text-right">{r.bmm}</TableCell>
                    <TableCell className="text-right">{r.akpPercent.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.taksasiTon.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Math.round(r.taksasiTon * 1000)}</TableCell>
                    <TableCell className="text-right">{r.kebutuhanPemanen}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
