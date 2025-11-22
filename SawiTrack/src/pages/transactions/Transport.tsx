import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Download, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, AngkutRow } from '@/lib/api';
import { toast } from 'sonner';

export default function Transport() {
  type BlockOption = { no_blok?: string; id_blok?: string };
  const [datePanen, setDatePanen] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dateAngkut, setDateAngkut] = useState<string>(new Date().toISOString().slice(0, 10));
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [estateId, setEstateId] = useState<string>('');
  const [divisions, setDivisions] = useState<Array<{ division_id: number }>>([]);
  const [divisionId, setDivisionId] = useState<number | ''>('');
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [blockNo, setBlockNo] = useState('');
  const [noTPH, setNoTPH] = useState('');
  const [jjgAngkut, setJjgAngkut] = useState<number | ''>('');
  const [noMobil, setNoMobil] = useState('');
  const [namaSupir, setNamaSupir] = useState('');
  const [rows, setRows] = useState<AngkutRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const harvestStorageKey = useMemo(() => `realharvest_rows_${datePanen}`, [datePanen]);
  // Dialog lengkapi no mobil & supir
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<AngkutRow | null>(null);
  const [editNoMobil, setEditNoMobil] = useState('');
  const [editSupir, setEditSupir] = useState('');

  // Aggregate Real Harvest by TPH for the selected datePanen
  const harvestTotalsByTPH = useMemo(() => {
    try {
      const raw = localStorage.getItem(harvestStorageKey);
      const list: Array<{
        date: string;
        estateId?: string;
        division?: string;
        block?: string;
        noTPH?: string;
        janjangTBS: number;
      }> = raw ? JSON.parse(raw) : [];
      const map = new Map<string, { estateId: string; division_id: number; block_no: string; notph: string; totalJJG: number }>();
      for (const r of list) {
        if (!r || !String(r.date).startsWith(datePanen)) continue;
        const estateId = r.estateId || '';
        const division_id = Number(r.division || 0) || 0;
        const block_no = r.block || '';
        const notph = r.noTPH || '';
        if (!notph) continue; // group only when TPH available
        const key = `${estateId}|${division_id}|${block_no}|${notph}`;
        const prev = map.get(key) || { estateId, division_id, block_no, notph, totalJJG: 0 };
        prev.totalJJG += Number(r.janjangTBS || 0);
        map.set(key, prev);
      }
      return map;
    } catch {
      return new Map<string, { estateId: string; division_id: number; block_no: string; notph: string; totalJJG: number }>();
    }
  }, [harvestStorageKey, datePanen]);
  const exportCsv = () => {
    const header = ['date_panen', 'date_angkut', 'estateId', 'division_id', 'block_no', 'weightKg'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      filtered.map(r => [
        r.date_panen,
        r.date_angkut,
        r.estateId,
        r.division_id,
        r.block_no,
        r.weightKg,
      ].map(escape).join(','))
    );
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `angkut_${datePanen}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    api.estates().then(setEstates).catch(() => toast.error('Gagal memuat estate'));
  }, []);

  useEffect(() => {
    if (!estateId) { setDivisions([]); setDivisionId(''); return; }
    api.divisions(estateId).then(setDivisions).catch(() => toast.error('Gagal memuat divisi'));
    api.blocks(estateId, Number(divisionId)).then((b) => setBlocks(Array.isArray(b) ? (b as BlockOption[]) : [])).catch(() => setBlocks([]));
  }, [estateId, divisionId]);

  useEffect(() => {
    // Load angkut rows then ensure auto-populated from harvest totals
    (async () => {
      try {
        const existing = await api.angkutList({ date_panen: datePanen });
        setRows(existing);
        // build set of existing keys (estate|division|block|notph)
        const existingKeys = new Set(
          existing.map((r) => `${r.estateId}|${r.division_id}|${r.block_no}|${noteVal(r.notes, 'notph')}`),
        );
        const toCreate: AngkutRow[] = [];
        harvestTotalsByTPH.forEach((grp, key) => {
          if (!existingKeys.has(key)) {
            const notes = [`notph=${grp.notph}`, `jjg_angkut=0`].join('; ');
            toCreate.push({
              date_panen: datePanen,
              date_angkut: datePanen, // default same day, can be edited later
              estateId: grp.estateId,
              division_id: grp.division_id,
              block_no: grp.block_no,
              weightKg: 0,
              notes,
            } as AngkutRow);
          }
        });
        if (toCreate.length > 0) {
          try {
            await api.angkutCreate(toCreate);
            const latest = await api.angkutList({ date_panen: datePanen });
            setRows(latest);
          } catch {
            // ignore backend failure; at least UI will reflect harvest aggregates
          }
        }
      } catch {
        setRows([]);
      }
    })();
  }, [datePanen, harvestTotalsByTPH]);

  const filtered = useMemo(() => rows.filter(r => String(r.date_panen).startsWith(datePanen)), [rows, datePanen]);

  // Build derived data including JJG Realisasi and Restan per row
  const derived = useMemo(() => {
    return filtered.map((r) => {
      const key = `${r.estateId}|${r.division_id}|${r.block_no}|${noteVal(r.notes, 'notph')}`;
      const grp = harvestTotalsByTPH.get(key);
      const totalJJG = grp?.totalJJG || 0;
      const jjgAngkut = Number(noteVal(r.notes, 'jjg_angkut') || 0);
      const restan = totalJJG - jjgAngkut;
      return { row: r, totalJJG, jjgAngkut, restan };
    });
  }, [filtered, harvestTotalsByTPH]);

  const addRow = async () => {
    try {
      if (!datePanen || !dateAngkut || !estateId || !divisionId || !blockNo || !jjgAngkut) {
        toast.error('Lengkapi input');
        return;
      }
      const notes = [
        noTPH ? `notph=${noTPH}` : '',
        `jjg_angkut=${jjgAngkut}`,
        noMobil ? `no_mobil=${noMobil}` : '',
        namaSupir ? `supir=${namaSupir}` : '',
      ].filter(Boolean).join('; ');
      const body: AngkutRow = { date_panen: datePanen, date_angkut: dateAngkut, estateId, division_id: Number(divisionId), block_no: blockNo, weightKg: 0, notes };
      const created = await api.angkutCreate(body);
      toast.success('Tersimpan');
      setRows(prev => Array.isArray(created) ? [...prev, ...created] : [...prev, created as AngkutRow]);
      setBlockNo(''); setNoTPH(''); setJjgAngkut(''); setNoMobil(''); setNamaSupir('');
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
      toast.error(msg);
    }
  };

  // Inline update jjg_angkut for a given row, persist to backend
  type AngkutRowWithId = AngkutRow & { _id?: string };
  const updateJjgAngkut = async (r: AngkutRow, value: number) => {
    const notph = noteVal(r.notes, 'notph');
    const no_mobil = noteVal(r.notes, 'no_mobil');
    const supir = noteVal(r.notes, 'supir');
    const notes = [
      notph ? `notph=${notph}` : '',
      `jjg_angkut=${Math.max(0, Math.floor(value || 0))}`,
      no_mobil ? `no_mobil=${no_mobil}` : '',
      supir ? `supir=${supir}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    try {
      const body: AngkutRow = {
        _id: (r as AngkutRowWithId)._id,
        date_panen: r.date_panen,
        date_angkut: r.date_angkut,
        estateId: r.estateId,
        division_id: r.division_id,
        block_no: r.block_no,
        weightKg: r.weightKg || 0,
        notes,
      } as AngkutRow;
      await api.angkutCreate(body);
      const latest = await api.angkutList({ date_panen: datePanen });
      setRows(latest);
      toast.success('JJG angkut diperbarui');
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal memperbarui JJG angkut';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
      toast.error(msg);
    }
  };

  const openComplete = (r: AngkutRow) => {
    setCompleteTarget(r);
    setEditNoMobil(noteVal(r.notes, 'no_mobil') || '');
    setEditSupir(noteVal(r.notes, 'supir') || '');
    setCompleteOpen(true);
  };

  const saveComplete = async () => {
    if (!completeTarget) return;
    try {
      const notph = noteVal(completeTarget.notes, 'notph');
      const jjg = noteVal(completeTarget.notes, 'jjg_angkut');
      const notes = [
        notph ? `notph=${notph}` : '',
        jjg ? `jjg_angkut=${jjg}` : 'jjg_angkut=0',
        editNoMobil ? `no_mobil=${editNoMobil}` : '',
        editSupir ? `supir=${editSupir}` : '',
      ].filter(Boolean).join('; ');
      const body: AngkutRow = {
        _id: (completeTarget as (AngkutRow & { _id?: string }))._id,
        date_panen: completeTarget.date_panen,
        date_angkut: completeTarget.date_angkut,
        estateId: completeTarget.estateId,
        division_id: completeTarget.division_id,
        block_no: completeTarget.block_no,
        weightKg: completeTarget.weightKg || 0,
        notes,
      } as AngkutRow;
      await api.angkutCreate(body);
      const latest = await api.angkutList({ date_panen: datePanen });
      setRows(latest);
      toast.success('Data angkut diperbarui');
      setCompleteOpen(false);
      setCompleteTarget(null);
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
      toast.error(msg);
    }
  };

  const handleCsvUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error('CSV kosong');
      const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
      const idx = (k: string) => header.indexOf(k);
      const requireIdx = (...keys: string[]) => { for (const k of keys) if (idx(k) === -1) throw new Error(`Kolom '${k}' tidak ditemukan`); };
      requireIdx('date_panen', 'date_angkut', 'estateid', 'division_id', 'block_no', 'weightkg');
      const parsed: AngkutRow[] = lines.slice(1).map((line) => {
        const cols = line.split(',');
        return {
          date_panen: cols[idx('date_panen')],
          date_angkut: cols[idx('date_angkut')],
          estateId: cols[idx('estateid')],
          division_id: Number(cols[idx('division_id')]),
          block_no: cols[idx('block_no')],
          weightKg: Number(cols[idx('weightkg')]),
        } as AngkutRow;
      }).filter(r => r.date_panen && r.date_angkut && r.estateId && r.division_id && r.block_no && !Number.isNaN(r.weightKg));
      const key = (r: AngkutRow) => `${String(r.date_panen).slice(0, 10)}|${String(r.date_angkut).slice(0, 10)}|${r.estateId}|${r.division_id}|${r.block_no}`;
      const dates = Array.from(new Set(parsed.map(r => String(r.date_panen).slice(0, 10))));
      let existing: AngkutRow[] = [];
      for (const d of dates) {
        try {
          const list = await api.angkutList({ date_panen: d });
          existing = existing.concat(list);
        } catch { /* ignore per-date error */ }
      }
      const existingKeys = new Set(existing.map(key));
      const seen = new Set<string>();
      const bulk = parsed.filter(r => {
        const k = key(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return !existingKeys.has(k);
      });
      if (bulk.length === 0) {
        toast.info('Semua baris sudah ada, tidak ada data baru');
      } else {
        await api.angkutCreate(bulk);
        toast.success(`Import ${bulk.length} baris berhasil`);
      }
      const latest = await api.angkutList({ date_panen: datePanen });
      setRows(latest);
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal import CSV';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Transaksi Angkutan</h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                disabled={uploading}
                onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={exportCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files && handleCsvUpload(e.target.files[0])}
                disabled={uploading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Tanggal Panen (Kunci)</Label>
            <Input type="date" value={datePanen} onChange={(e) => setDatePanen(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="mr-2 h-4 w-4" />Tambah Angkutan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Data Angkutan</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tanggal Angkut</Label>
                    <Input type="date" value={dateAngkut} onChange={(e) => setDateAngkut(e.target.value)} />
                  </div>
                  <div>
                    <Label>Estate</Label>
                    <select className="w-full h-10 border rounded px-2" value={estateId} onChange={(e) => setEstateId(e.target.value)}>
                      <option value="">Pilih</option>
                      {estates.map(es => <option key={es._id} value={es._id}>{es.estate_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Divisi</Label>
                    <select className="w-full h-10 border rounded px-2" value={divisionId} onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Pilih</option>
                      {divisions.map(d => <option key={d.division_id} value={d.division_id}>Divisi {d.division_id}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Blok</Label>
                    <select className="w-full h-10 border rounded px-2" value={blockNo} onChange={(e) => setBlockNo(e.target.value)}>
                      <option value="">Pilih</option>
                      {blocks.map((b, i: number) => {
                        const label = String(b.no_blok || b.id_blok || '');
                        return <option key={i} value={label}>{label || `Blok ${i + 1}`}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <Label>NoTPH</Label>
                    <Input type="text" value={noTPH} onChange={(e) => setNoTPH(e.target.value)} />
                  </div>
                  <div>
                    <Label>jjg_angkut</Label>
                    <Input type="number" value={jjgAngkut} onChange={(e) => setJjgAngkut(e.target.value ? Number(e.target.value) : '')} />
                  </div>
                  <div>
                    <Label>No. Mobil</Label>
                    <Input type="text" value={noMobil} onChange={(e) => setNoMobil(e.target.value)} />
                  </div>
                  <div>
                    <Label>Nama Supir</Label>
                    <Input type="text" value={namaSupir} onChange={(e) => setNamaSupir(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button onClick={addRow} className="flex-1">Simpan</Button>
                </div>
              </DialogContent>
            </Dialog>

          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Data Angkut (Tanggal Panen {datePanen})</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Tgl_angkut</TableHead>
                  <TableHead className="text-center">Estate</TableHead>
                  <TableHead className="text-center">Div</TableHead>
                  <TableHead className="text-center">Blok</TableHead>
                  <TableHead className="text-center">NoTPH</TableHead>
                  <TableHead className="text-center">JJG Realisasi</TableHead>
                  <TableHead className="text-center">JJG Angkut</TableHead>
                  <TableHead className="text-center">Restan</TableHead>
                  <TableHead className="text-center">No. Mobil</TableHead>
                  <TableHead className="text-center">Nama Supir</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derived.map(({ row: r, totalJJG, jjgAngkut, restan }, idx) => (
                  <TableRow key={(r as AngkutRowWithId)._id || idx}>
                    <TableCell className="text-center">{String(r.date_angkut).slice(0, 10)}</TableCell>
                    <TableCell className="text-center">{r.estateId}</TableCell>
                    <TableCell className="text-center">{r.division_id}</TableCell>
                    <TableCell className="text-center">{r.block_no}</TableCell>
                    <TableCell className="text-center">{noteVal(r.notes, 'notph') || '-'}</TableCell>
                    <TableCell className="text-center font-medium">{totalJJG}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={jjgAngkut}
                        min={0}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : Number(e.target.value);
                          updateJjgAngkut(r, v);
                        }}
                      />
                    </TableCell>
                    <TableCell className={'text-center font-semibold ' + (restan > 0 ? 'text-red-600' : 'text-green-600')}>{restan}</TableCell>
                    <TableCell className="text-center">{noteVal(r.notes, 'no_mobil') || '-'}</TableCell>
                    <TableCell className="text-center">{noteVal(r.notes, 'supir') || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => openComplete(r)}>
                        {(noteVal(r.notes, 'no_mobil') && noteVal(r.notes, 'supir')) ? 'Edit' : 'Lengkapi'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {/* Dialog Lengkapi */}
            <Dialog open={completeOpen} onOpenChange={(o) => { if (!o) { setCompleteOpen(false); setCompleteTarget(null); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{(noteVal(completeTarget?.notes, 'no_mobil') && noteVal(completeTarget?.notes, 'supir')) ? 'Edit Data Angkut' : 'Lengkapi Data Angkut'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>No. Mobil</Label>
                    <Input value={editNoMobil} onChange={(e) => setEditNoMobil(e.target.value)} placeholder="Isi nomor mobil" />
                  </div>
                  <div>
                    <Label>Nama Supir</Label>
                    <Input value={editSupir} onChange={(e) => setEditSupir(e.target.value)} placeholder="Isi nama supir" />
                  </div>
                  <div className="md:col-span-2 text-sm text-muted-foreground">TPH: {noteVal(completeTarget?.notes, 'notph') || '-'}</div>
                  <div className="md:col-span-2 text-sm">JJG Realisasi: {(() => {
                    if (!completeTarget) return 0;
                    const key = `${completeTarget.estateId}|${completeTarget.division_id}|${completeTarget.block_no}|${noteVal(completeTarget.notes, 'notph')}`;
                    return harvestTotalsByTPH.get(key)?.totalJJG || 0;
                  })()}</div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={saveComplete} className="flex-1">Simpan</Button>
                  <Button variant="outline" onClick={() => { setCompleteOpen(false); setCompleteTarget(null); }}>Batal</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
const noteVal = (notes: string | undefined, key: string): string => {
  if (!notes) return '';
  try {
    const parts = notes.split(/;\s*/);
    for (const p of parts) {
      const [k, v] = p.split('=');
      if (k && k.trim() === key) return v ?? '';
    }
    return '';
  } catch { return ''; }
};
