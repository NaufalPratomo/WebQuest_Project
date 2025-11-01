import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [datePanen, setDatePanen] = useState<string>(new Date().toISOString().slice(0,10));
  const [dateAngkut, setDateAngkut] = useState<string>(new Date().toISOString().slice(0,10));
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [estateId, setEstateId] = useState<string>('');
  const [divisions, setDivisions] = useState<Array<{ division_id: number }>>([]);
  const [divisionId, setDivisionId] = useState<number | ''>('');
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [blockNo, setBlockNo] = useState('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [rows, setRows] = useState<AngkutRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api.estates().then(setEstates).catch(() => toast.error('Gagal memuat estate'));
  }, []);

  useEffect(() => {
    if (!estateId) { setDivisions([]); setDivisionId(''); return; }
    api.divisions(estateId).then(setDivisions).catch(() => toast.error('Gagal memuat divisi'));
    api.blocks(estateId, Number(divisionId)).then((b) => setBlocks(Array.isArray(b) ? (b as BlockOption[]) : [])).catch(() => setBlocks([]));
  }, [estateId, divisionId]);

  useEffect(() => {
    api.angkutList({ date_panen: datePanen }).then(setRows).catch(() => setRows([]));
  }, [datePanen]);

  const filtered = useMemo(() => rows.filter(r => String(r.date_panen).startsWith(datePanen)), [rows, datePanen]);

  const addRow = async () => {
    try {
      if (!datePanen || !dateAngkut || !estateId || !divisionId || !blockNo || !weightKg) {
        toast.error('Lengkapi input');
        return;
      }
      const body: AngkutRow = { date_panen: datePanen, date_angkut: dateAngkut, estateId, division_id: Number(divisionId), block_no: blockNo, weightKg: Number(weightKg) };
      const created = await api.angkutCreate(body);
      toast.success('Tersimpan');
      setRows(prev => Array.isArray(created) ? [...prev, ...created] : [...prev, created as AngkutRow]);
      setBlockNo(''); setWeightKg('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
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
      requireIdx('date_panen','date_angkut','estateid','division_id','block_no','weightkg');
      const bulk: AngkutRow[] = lines.slice(1).map((line) => {
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
      if (bulk.length === 0) throw new Error('Tidak ada baris valid');
      await api.angkutCreate(bulk);
      toast.success(`Import ${bulk.length} baris berhasil`);
      const latest = await api.angkutList({ date_panen: datePanen });
      setRows(latest);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal import CSV';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Transaksi Angkutan</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Tanggal Panen (Kunci)</Label>
            <Input type="date" value={datePanen} onChange={(e)=> setDatePanen(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Tambah Angkutan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Data Angkutan</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tanggal Angkut</Label>
                    <Input type="date" value={dateAngkut} onChange={(e)=> setDateAngkut(e.target.value)} />
                  </div>
                  <div>
                    <Label>Estate</Label>
                    <select className="w-full h-10 border rounded px-2" value={estateId} onChange={(e)=> setEstateId(e.target.value)}>
                      <option value="">Pilih</option>
                      {estates.map(es => <option key={es._id} value={es._id}>{es.estate_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Divisi</Label>
                    <select className="w-full h-10 border rounded px-2" value={divisionId} onChange={(e)=> setDivisionId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Pilih</option>
                      {divisions.map(d => <option key={d.division_id} value={d.division_id}>Divisi {d.division_id}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>No Blok</Label>
                    <input className="w-full h-10 border rounded px-2" list="blocks" value={blockNo} onChange={(e)=> setBlockNo(e.target.value)} />
                    <datalist id="blocks">
                      {blocks.map((b, i:number) => <option key={i} value={String(b.no_blok || b.id_blok || '')} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label>Berat (Kg)</Label>
                    <Input type="number" value={weightKg} onChange={(e)=> setWeightKg(e.target.value ? Number(e.target.value) : '')} />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button onClick={addRow} className="flex-1">Simpan</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
            >
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e)=> e.target.files && handleCsvUpload(e.target.files[0])}
              disabled={uploading}
            />
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
                  <TableHead>Tgl_angkut</TableHead>
                  <TableHead>Estate</TableHead>
                  <TableHead>Div</TableHead>
                  <TableHead>Blok</TableHead>
                  <TableHead>NoTPH</TableHead>
                  <TableHead className="text-right">jjg_angkut</TableHead>
                  <TableHead className="text-right">kg_angkut</TableHead>
                  <TableHead className="text-right">jjg_restan</TableHead>
                  <TableHead className="text-right">kg_restan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => (
                  <TableRow key={r._id || idx}>
                    <TableCell>{String(r.date_angkut).slice(0,10)}</TableCell>
                    <TableCell>{r.estateId}</TableCell>
                    <TableCell>{r.division_id}</TableCell>
                    <TableCell>{r.block_no}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{r.weightKg}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
