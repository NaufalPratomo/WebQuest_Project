import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

type Row = { 
  estateId: string; 
  estateName?: string;
  division: string; 
  block: string; 
  realJanjang: number; 
  taksasiJanjang: number; 
  diffJanjang: number;
  realTon: number;
  taksasiTon: number;
  diffTon: number;
};

export default function Trend() {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [sort, setSort] = useState<'asc'|'desc'>('desc');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportCsv = () => {
    const header = ['Estate','Divisi','Blok','Taksasi Janjang','Realisasi Janjang','Selisih Janjang','Taksasi Ton','Realisasi Ton','Selisih Ton','Persen'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      rows.map(r => [
        r.estateName || r.estateId,
        r.division,
        r.block,
        r.taksasiJanjang,
        r.realJanjang,
        r.diffJanjang,
        r.taksasiTon.toFixed(2),
        r.realTon.toFixed(2),
        r.diffTon.toFixed(2),
        r.taksasiJanjang > 0 ? ((r.realJanjang / r.taksasiJanjang) * 100).toFixed(2) : ''
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
      // Collect realisasi & taksasi from server across dates
      const dates = enumerateDates(startDate, endDate);
      const realAll: Array<{ estateId: string; estateName?: string; division: string; block: string; hasilJjg: number; ton: number; }> = [];
      const taksAll: Array<{ estateId: string; estateName?: string; division: string; block: string; taksasiJanjang: number; taksasiTon: number; }> = [];
      for (const d of dates) {
        // Panen (realisasi)
        try {
          const panen = await api.panenList({ date_panen: d });
          for (const p of panen || []) {
            const estateId = p.estateId || '-';
            const estateName = p.estateId || undefined; // could map later
            const division = String(p.division_id ?? '-');
            const block = p.block_no || '-';
            const janjang = Number(p.janjangTBS ?? 0);
            const avgW = Number(p.weightKg && p.janjangTBS ? (p.weightKg / Math.max(1, p.janjangTBS)) : 15);
            const ton = p.weightKg != null ? p.weightKg / 1000 : (janjang * avgW) / 1000;
            realAll.push({ estateId, estateName, division, block, hasilJjg: janjang, ton });
          }
        } catch { /* ignore day failure */ }
        // Taksasi
        try {
          const taks = await api.taksasiList({ date: d });
          for (const t of taks || []) {
            const estateId = t.estateId || '-';
            const estateName = t.estateId || undefined;
            const division = String(t.division_id ?? '-');
            const block = t.block_no || '-';
            const avgW = (t.avgWeightKg && t.avgWeightKg > 0) ? t.avgWeightKg : 15;
            const janjang = Number(t.taksasiJanjang ?? Math.round((t.weightKg || 0) / avgW));
            const ton = t.taksasiTon ?? (t.weightKg || 0) / 1000;
            taksAll.push({ estateId, estateName, division, block, taksasiJanjang: janjang, taksasiTon: ton });
          }
        } catch { /* ignore day failure */ }
      }

      // Aggregate by estate + division + block
      const realMap = new Map<string, { 
        estateId: string; 
        estateName?: string;
        division: string; 
        block: string; 
        realJanjang: number;
        realTon: number;
      }>();
      for (const r of realAll) {
        const estateId = r.estateId || '-';
        const estateName = r.estateName;
        const division = r.division || '-';
        const block = r.block || '-';
        const janjang = Number(r.hasilJjg || 0);
        const ton = r.ton || (janjang * 15) / 1000;
        const key = `${estateId}|${division}|${block}`;
        const prev = realMap.get(key) ?? { estateId, estateName, division, block, realJanjang: 0, realTon: 0 };
        prev.realJanjang += janjang;
        prev.realTon += ton;
        realMap.set(key, prev);
      }

      const taksMap = new Map<string, { 
        estateId: string; 
        estateName?: string;
        division: string; 
        block: string; 
        taksasiJanjang: number;
        taksasiTon: number;
      }>();
      for (const t of taksAll) {
        const estateId = t.estateId || '-';
        const estateName = t.estateName;
        const division = t.division || '-';
        const block = t.block || '-';
        const janjang = Number(t.taksasiJanjang || 0);
        const ton = Number(t.taksasiTon || 0);
        const key = `${estateId}|${division}|${block}`;
        const prev = taksMap.get(key) ?? { estateId, estateName, division, block, taksasiJanjang: 0, taksasiTon: 0 };
        prev.taksasiJanjang += janjang;
        prev.taksasiTon += ton;
        taksMap.set(key, prev);
      }

      // Combine keys and compute diff
      const keys = new Set<string>([...realMap.keys(), ...taksMap.keys()]);
      const combined: Row[] = [];
      for (const key of keys) {
        const r = realMap.get(key);
        const t = taksMap.get(key);
        const estateId = r?.estateId || t?.estateId || '-';
        const estateName = r?.estateName || t?.estateName;
        const division = r?.division || t?.division || '-';
        const block = r?.block || t?.block || '-';
        const realJanjang = r?.realJanjang ?? 0;
        const taksasiJanjang = t?.taksasiJanjang ?? 0;
        const diffJanjang = realJanjang - taksasiJanjang;
        const realTon = r?.realTon ?? 0;
        const taksasiTon = t?.taksasiTon ?? 0;
        const diffTon = realTon - taksasiTon;
        combined.push({ 
          estateId, 
          estateName,
          division, 
          block, 
          realJanjang: Math.round(realJanjang), 
          taksasiJanjang: Math.round(taksasiJanjang), 
          diffJanjang,
          realTon,
          taksasiTon,
          diffTon
        });
      }

      // Rank by absolute difference in janjang (default: terbesar)
      combined.sort((a, b) => {
        const da = Math.abs(a.diffJanjang);
        const db = Math.abs(b.diffJanjang);
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
            <h3 className="text-lg font-semibold">Laporan Tren (Ranking Selisih Realisasi vs Taksasi per Blok)</h3>
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
            <Label>Urutan (By |selisih janjang|)</Label>
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
                  <TableHead className="text-center">Estate</TableHead>
                  <TableHead className="text-center">Divisi</TableHead>
                  <TableHead className="text-center">Blok</TableHead>
                  <TableHead className="text-center">Taksasi (Janjang)</TableHead>
                  <TableHead className="text-center">Realisasi (Janjang)</TableHead>
                  <TableHead className="text-center">Selisih (Janjang)</TableHead>
                  <TableHead className="text-center">Taksasi (Ton)</TableHead>
                  <TableHead className="text-center">Realisasi (Ton)</TableHead>
                  <TableHead className="text-center">Selisih (Ton)</TableHead>
                  <TableHead className="text-center">Persen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={10} className="text-center text-sm">Memuat…</TableCell></TableRow>
                )}
                {!loading && rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center">{r.estateName || r.estateId}</TableCell>
                    <TableCell className="text-center">{r.division}</TableCell>
                    <TableCell className="text-center">{r.block}</TableCell>
                    <TableCell className="text-center">{r.taksasiJanjang}</TableCell>
                    <TableCell className="text-center">{r.realJanjang}</TableCell>
                    <TableCell className="text-center">{r.diffJanjang >= 0 ? `+${r.diffJanjang}` : r.diffJanjang}</TableCell>
                    <TableCell className="text-center">{r.taksasiTon.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{r.realTon.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{r.diffTon >= 0 ? `+${r.diffTon.toFixed(2)}` : r.diffTon.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{r.taksasiJanjang > 0 ? ((r.realJanjang / r.taksasiJanjang) * 100).toFixed(2) : '0.00'}%</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && !error && (
                  <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
                {!loading && error && (
                  <TableRow><TableCell colSpan={10} className="text-center text-sm text-destructive">{error}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
