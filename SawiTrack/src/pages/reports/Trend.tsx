import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

type Row = { estateId: string; division_id: number; block: string; realKg: number; taksasiKg: number; diffKg: number };

export default function Trend() {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [sort, setSort] = useState<'asc'|'desc'>('desc');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportCsv = () => {
    const header = ['estateId','division_id','block','taksasiKg','realKg','diffKg','percent'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      rows.map(r => [
        r.estateId,
        r.division_id,
        r.block,
        r.taksasiKg,
        r.realKg,
        r.diffKg,
        r.taksasiKg > 0 ? ((r.realKg / r.taksasiKg) * 100).toFixed(2) : ''
      ].map(escape).join(','))
    );
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tren_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const enumerateDates = useMemo(() => (start: string, end: string): string[] => {
    try {
      const dates: string[] = [];
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return dates;
      if (s > e) return dates;
      const cur = new Date(s);
      while (cur <= e) {
        dates.push(cur.toISOString().slice(0,10));
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    } catch {
      return [];
    }
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Collect realisasi across dates
  type RealRow = { estateId?: string; division?: string; block?: string; kgAngkut?: number };
      const realAll: RealRow[] = [];
      for (const d of enumerateDates(startDate, endDate)) {
        const raw = localStorage.getItem(`realharvest_rows_${d}`);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) realAll.push(...(arr as RealRow[]));
          } catch { /* ignore */ }
        }
      }
      // Collect taksasi across dates
  type TaksRow = { estateId?: string; divisionId?: string; blockLabel?: string; taksasiTon?: number };
      const taksAll: TaksRow[] = [];
      for (const d of enumerateDates(startDate, endDate)) {
        const raw = localStorage.getItem(`taksasi_rows_${d}`);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) taksAll.push(...(arr as TaksRow[]));
          } catch { /* ignore */ }
        }
      }

      // Aggregate by estate + division + block
      const realMap = new Map<string, { estateId: string; division_id: number; block: string; realKg: number }>();
      for (const r of realAll) {
        const estateId = r.estateId || '-';
        const division_id = Number(r.division || 0);
        const block = r.block || '-';
        const kg = Number(r.kgAngkut || 0);
        const key = `${estateId}|${division_id}|${block}`;
        const prev = realMap.get(key) ?? { estateId, division_id, block, realKg: 0 };
        prev.realKg += kg;
        realMap.set(key, prev);
      }

      const taksMap = new Map<string, { estateId: string; division_id: number; block: string; taksasiKg: number }>();
      for (const t of taksAll) {
        const estateId = t.estateId || '-';
        const division_id = Number(t.divisionId || 0);
        const block = t.blockLabel || '-';
        const kg = Math.round(Number(t.taksasiTon || 0) * 1000);
        const key = `${estateId}|${division_id}|${block}`;
        const prev = taksMap.get(key) ?? { estateId, division_id, block, taksasiKg: 0 };
        prev.taksasiKg += kg;
        taksMap.set(key, prev);
      }

      // Combine keys and compute diff
      const keys = new Set<string>([...realMap.keys(), ...taksMap.keys()]);
      const combined: Row[] = [];
      for (const key of keys) {
        const r = realMap.get(key);
        const t = taksMap.get(key);
        const estateId = r?.estateId || t?.estateId || '-';
        const division_id = r?.division_id ?? t?.division_id ?? 0;
        const block = r?.block || t?.block || '-';
        const realKg = r?.realKg ?? 0;
        const taksasiKg = t?.taksasiKg ?? 0;
        const diffKg = realKg - taksasiKg; // positive means real > taksasi
        combined.push({ estateId, division_id, block, realKg: Math.round(realKg), taksasiKg: Math.round(taksasiKg), diffKg });
      }

      // Rank by absolute difference (default: terbesar)
      combined.sort((a, b) => {
        const da = Math.abs(a.diffKg);
        const db = Math.abs(b.diffKg);
        return sort === 'desc' ? db - da : da - db;
      });
      setRows(combined);
      if (combined.length === 0) toast.info('Tidak ada data realisasi / taksasi pada rentang ini.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat tren';
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
  }, [startDate, endDate, sort]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Laporan Tren (Ranking Selisih Real vs Taksasi per Blok)</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <Label>Mulai</Label>
            <Input type="date" value={startDate} onChange={(e)=> setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Selesai</Label>
            <Input type="date" value={endDate} onChange={(e)=> setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Urutan (By |selisih|)</Label>
            <select className="w-full h-10 border rounded px-2" value={sort} onChange={(e)=> setSort(e.target.value as 'asc'|'desc')}>
              <option value="desc">Terbesar</option>
              <option value="asc">Terkecil</option>
            </select>
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
                  <TableHead>Blok</TableHead>
                  <TableHead className="text-right">Taksasi (Kg)</TableHead>
                  <TableHead className="text-right">Realisasi (Kg)</TableHead>
                  <TableHead className="text-right">Selisih (Kg)</TableHead>
                  <TableHead className="text-right">Persen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm">Memuat…</TableCell></TableRow>
                )}
                {!loading && rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.estateId}</TableCell>
                    <TableCell>{r.division_id}</TableCell>
                    <TableCell>{r.block}</TableCell>
                    <TableCell className="text-right">{r.taksasiKg}</TableCell>
                    <TableCell className="text-right">{r.realKg}</TableCell>
                    <TableCell className="text-right">{r.diffKg >= 0 ? `+${r.diffKg}` : r.diffKg}</TableCell>
                    <TableCell className="text-right">{((r.realKg / r.taksasiKg) * 100).toFixed(2) || 0}%</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && !error && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
                {!loading && error && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-destructive">{error}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
