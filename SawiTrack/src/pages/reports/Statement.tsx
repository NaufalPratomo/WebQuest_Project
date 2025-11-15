import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Row = { estateId: string; division_id: number; totalKg: number; blockCount: number };

export default function Statement() {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportCsv = () => {
    const header = ['estateId','division_id','totalKg','blockCount'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      rows.map(r => [r.estateId, r.division_id, r.totalKg, r.blockCount].map(escape).join(','))
    );
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement_${startDate}_${endDate}.csv`;
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
      const days = enumerateDates(startDate, endDate);
  type RealRow = { estateId?: string; division?: string; block?: string; kgAngkut?: number };
  const all: RealRow[] = [];
      for (const d of days) {
        const key = `realharvest_rows_${d}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) all.push(...(arr as RealRow[]));
          }
        } catch {
          // ignore per-day parse errors
        }
      }
      if (all.length === 0) {
        setRows([]);
        toast.info('Tidak ada data realisasi pada rentang tanggal ini.');
        return;
      }

      type Acc = { estateId: string; division_id: number; totalKg: number; blocks: Set<string> };
      const map = new Map<string, Acc>();
      for (const r of all) {
        const estateId: string = r.estateId || '-';
        const division_id: number = Number(r.division || 0);
        const blockLabel: string = r.block || '-';
        const kg: number = Number(r.kgAngkut || 0);
        const key = `${estateId}|${division_id}`;
        const prev = map.get(key) ?? { estateId, division_id, totalKg: 0, blocks: new Set<string>() };
        prev.totalKg += kg;
        if (blockLabel && blockLabel !== '-') prev.blocks.add(blockLabel);
        map.set(key, prev);
      }
      const aggregated: Row[] = Array.from(map.values()).map((v) => ({
        estateId: v.estateId,
        division_id: v.division_id,
        totalKg: Math.round(v.totalKg),
        blockCount: v.blocks.size,
      }));
      // Optional: sort by estate then division
      aggregated.sort((a, b) => a.estateId.localeCompare(b.estateId) || a.division_id - b.division_id);
      setRows(aggregated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat statement realisasi';
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
  }, [startDate, endDate]);

  const grandTotal = rows.reduce((s, r) => s + (r.totalKg || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Report Realisasi Panen (Realisasi per Divisi)</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>Export</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Mulai</Label>
            <Input type="date" value={startDate} onChange={(e)=> setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Selesai</Label>
            <Input type="date" value={endDate} onChange={(e)=> setEndDate(e.target.value)} />
          </div>
          <div className="md:col-span-2 text-right font-medium">Total: {grandTotal} Kg</div>
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
                  <TableHead className="text-right">Total (Kg)</TableHead>
                  <TableHead className="text-right">Jumlah Blok</TableHead>
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
                    <TableCell className="text-right">{r.totalKg}</TableCell>
                    <TableCell className="text-right">{r.blockCount}</TableCell>
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
