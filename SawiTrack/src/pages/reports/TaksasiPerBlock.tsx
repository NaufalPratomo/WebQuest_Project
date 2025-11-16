import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

type TaksasiRow = {
  timestamp: string;
  date: string;
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

export default function TaksasiPerBlock() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<TaksasiRow[]>([]);
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.estates().then(setEstates).catch(() => setEstates([]));
  }, []);

  const exportCsv = () => {
    const header = ['Estate','Divisi','Blok','Pokok','Sample','BM','PTB','BMBB','BMM','AKP %','Ton','Perkiraan Kg','Pemanen'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      rows.map(r => [
        r.estateName || r.estateId,
        r.divisionId,
        r.blockLabel,
        r.totalPokok,
        r.samplePokok,
        r.bm,
        r.ptb,
        r.bmbb,
        r.bmm,
        r.akpPercent,
        r.taksasiTon,
        Math.round(r.taksasiTon * 1000),
        r.kebutuhanPemanen
      ].map(escape).join(','))
    );
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taksasi_per_blok_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function load() {
    setLoading(true);
    setError(null);
    try {
      // Load from localStorage (where detailed taksasi data is stored)
      const storageKey = `taksasi_rows_${date}`;
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setRows([]);
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(raw) as TaksasiRow[];
      if (Array.isArray(parsed)) {
        // Filter by date and sort
        const filtered = parsed.filter(r => r.date === date);
        setRows(filtered);
      } else {
        setRows([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data taksasi';
      setError(msg);
      setRows([]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Report Taksasi per Blok</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Tanggal</Label>
            <Input type="date" value={date} onChange={(e)=> setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Estate</TableHead>
                  <TableHead className="text-center">Divisi</TableHead>
                  <TableHead className="text-center">Blok</TableHead>
                  <TableHead className="text-center">Pokok</TableHead>
                  <TableHead className="text-center">Sample</TableHead>
                  <TableHead className="text-center">BM</TableHead>
                  <TableHead className="text-center">PTB</TableHead>
                  <TableHead className="text-center">BMBB</TableHead>
                  <TableHead className="text-center">BMM</TableHead>
                  <TableHead className="text-center">AKP %</TableHead>
                  <TableHead className="text-center">Ton</TableHead>
                  <TableHead className="text-center">Perkiraan Kg</TableHead>
                  <TableHead className="text-center">Pemanen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={13} className="text-center text-sm">Memuat…</TableCell></TableRow>
                )}
                {!loading && rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center">{r.estateName || r.estateId}</TableCell>
                    <TableCell className="text-center">{r.divisionId}</TableCell>
                    <TableCell className="text-center">{r.blockLabel}</TableCell>
                    <TableCell className="text-center">{r.totalPokok}</TableCell>
                    <TableCell className="text-center">{r.samplePokok}</TableCell>
                    <TableCell className="text-center">{r.bm}</TableCell>
                    <TableCell className="text-center">{r.ptb}</TableCell>
                    <TableCell className="text-center">{r.bmbb}</TableCell>
                    <TableCell className="text-center">{r.bmm}</TableCell>
                    <TableCell className="text-center">{r.akpPercent.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{r.taksasiTon.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{Math.round(r.taksasiTon * 1000)}</TableCell>
                    <TableCell className="text-center">{r.kebutuhanPemanen}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && !error && (
                  <TableRow><TableCell colSpan={13} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
                {!loading && error && (
                  <TableRow><TableCell colSpan={13} className="text-center text-sm text-destructive">{error}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
