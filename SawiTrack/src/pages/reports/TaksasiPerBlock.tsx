import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

type Row = { estateId: string; division_id: number; block_no: string; totalKg: number };

export default function TaksasiPerBlock() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportCsv = () => {
    const header = ['estateId','division_id','block_no','totalKg'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      rows.map(r => [r.estateId, r.division_id, r.block_no, r.totalKg].map(escape).join(','))
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Try backend pre-aggregated report first
      const data = await api.reportTaksasiPerBlock({ date });
      setRows(data ?? []);
    } catch (e) {
      // Fallback: aggregate from taksasi list (sum weight per estate/div/block)
      try {
        const list = await api.taksasiList({ date });
        const map = new Map<string, Row>();
        for (const it of list) {
          const key = `${it.estateId}|${it.division_id}|${it.block_no}`;
          const prev = map.get(key) ?? { estateId: it.estateId, division_id: it.division_id, block_no: it.block_no, totalKg: 0 };
          prev.totalKg += it.weightKg ?? 0;
          map.set(key, prev);
        }
        setRows(Array.from(map.values()));
        toast.info('Menampilkan data dari hasil taksasi (fallback).');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memuat report taksasi';
        setError(msg);
        setRows([]);
        toast.error(msg);
      }
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
                  <TableHead>Estate</TableHead>
                  <TableHead>Divisi</TableHead>
                  <TableHead>No Blok</TableHead>
                  <TableHead className="text-right">Total (Kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm">Memuat…</TableCell></TableRow>
                )}
                {!loading && rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.estateId}</TableCell>
                    <TableCell>{r.division_id}</TableCell>
                    <TableCell>{r.block_no}</TableCell>
                    <TableCell className="text-right">{r.totalKg}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && !error && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
                {!loading && error && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-destructive">{error}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
