import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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

  function saveRow() {
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
    const newRows = [...rows, row];
    setRows(newRows);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newRows));
    } catch {
      // ignore localStorage failure
    }
    // Simpan ke server sebagai taksasi per blok (fokus ke tonase/kg)
    api
      .taksasiCreate({
        date,
        estateId,
        division_id: Number(divisionId),
        block_no: blockLabel,
        weightKg: Math.round(taksasiTon * 1000),
        notes: `AKP=${row.akpPercent}%; BM=${bm}; PTB=${ptb}`,
      })
      .then(() => toast.success('Taksasi tersimpan ke server'))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal simpan taksasi ke server'));
    // reset for next input but keep date and selections so user can continue quickly
    setStep(1);
    // preserve date; clear lower selections and inputs for safety
    setDivisionId('');
    setBlocks([]);
    setBlockIndex('');
    setBm(0); setPtb(0); setBmbb(0); setBmm(0);
    setAvgWeightKg(15); setBasisJanjangPerPemanen(120);
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
              <TableCaption>Data tersimpan di perangkat ini dan akan berbeda untuk setiap tanggal.</TableCaption>
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
