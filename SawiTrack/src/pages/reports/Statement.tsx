import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
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
  pemanen: string;
  jobType: string;
  hasilJjg: number;
  upahBasis: number;
  premi: number;
  kgAngkut: number;
};

export default function Statement() {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<RealRow[]>([]);
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.estates().then(setEstates).catch(() => setEstates([]));
  }, []);

  const exportCsv = () => {
    const header = ['Tgl_Panen','Estate','Divisi','Blok','NoTPH','mandor','pemanen','pekerjaan','hasil kerja (jjg)','upah basis','premi'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      rows.map(r => [
        r.date,
        r.estateName || r.estateId || '-',
        r.division,
        r.block || '-',
        r.noTPH || '-',
        r.mandor,
        r.pemanen,
        r.jobType,
        r.hasilJjg,
        r.upahBasis,
        r.premi
      ].map(escape).join(','))
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
      const all: RealRow[] = [];
      for (const d of days) {
        try {
          const panen = await api.panenList({ date_panen: d });
          for (const p of panen || []) {
            all.push({
              id: String(p._id || `${d}_${p.employeeId || ''}_${p.block_no || ''}`),
              timestamp: p._id ? String(p._id) : new Date(d).toISOString(),
              date: d,
              estateId: p.estateId,
              estateName: p.estateId,
              division: String(p.division_id ?? ''),
              block: p.block_no,
              noTPH: p.notes ? p.notes.split(';').find(x => x.startsWith('notph='))?.split('=')[1] : undefined,
              mandor: '',
              pemanen: p.employeeName || p.employeeId || '',
              jobType: p.jobCode || '',
              hasilJjg: Number(p.janjangTBS ?? 0),
              upahBasis: Number(p.upahBasis ?? 0),
              premi: Number(p.premi ?? 0),
              kgAngkut: Number(p.weightKg ?? 0),
            });
          }
        } catch { /* ignore day failure */ }
      }
      if (all.length === 0) {
        setRows([]);
        toast.info('Tidak ada data realisasi pada rentang tanggal ini.');
        return;
      }

      // Sort by date, then estate, then division, then block
      all.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const estateA = a.estateName || a.estateId || '';
        const estateB = b.estateName || b.estateId || '';
        if (estateA !== estateB) return estateA.localeCompare(estateB);
        if (a.division !== b.division) return a.division.localeCompare(b.division);
        return (a.block || '').localeCompare(b.block || '');
      });

      setRows(all);
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

  const grandTotalJjg = rows.reduce((s, r) => s + (r.hasilJjg || 0), 0);
  const grandTotalUpah = rows.reduce((s, r) => s + (r.upahBasis || 0), 0);
  const grandTotalPremi = rows.reduce((s, r) => s + (r.premi || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Report Realisasi Panen (Realisasi per Divisi)</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
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
          <div className="md:col-span-2 text-right font-medium">
            <div className="text-sm text-muted-foreground">Total Janjang: {grandTotalJjg} | Total Upah: {grandTotalUpah} | Total Premi: {grandTotalPremi}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Tgl_Panen</TableHead>
                  <TableHead className="text-center">Estate</TableHead>
                  <TableHead className="text-center">Divisi</TableHead>
                  <TableHead className="text-center">Blok</TableHead>
                  <TableHead className="text-center">NoTPH</TableHead>
                  <TableHead className="text-center">mandor</TableHead>
                  <TableHead className="text-center">pemanen</TableHead>
                  <TableHead className="text-center">pekerjaan</TableHead>
                  <TableHead className="text-center">hasil kerja (jjg)</TableHead>
                  <TableHead className="text-center">upah basis</TableHead>
                  <TableHead className="text-center">premi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm">Memuat…</TableCell></TableRow>
                )}
                {!loading && rows.map((r, i) => (
                  <TableRow key={r.id || i}>
                    <TableCell className="text-center">{r.date}</TableCell>
                    <TableCell className="text-center">{r.estateName || r.estateId || '-'}</TableCell>
                    <TableCell className="text-center">{r.division}</TableCell>
                    <TableCell className="text-center">{r.block || '-'}</TableCell>
                    <TableCell className="text-center">{r.noTPH || '-'}</TableCell>
                    <TableCell className="text-center">{r.mandor}</TableCell>
                    <TableCell className="text-center">{r.pemanen}</TableCell>
                    <TableCell className="text-center">{r.jobType}</TableCell>
                    <TableCell className="text-center">{r.hasilJjg}</TableCell>
                    <TableCell className="text-center">{r.upahBasis}</TableCell>
                    <TableCell className="text-center">{r.premi}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length > 0 && (
                  <TableRow className="font-medium">
                    <TableCell className="text-center" colSpan={8}>Total</TableCell>
                    <TableCell className="text-center">{grandTotalJjg}</TableCell>
                    <TableCell className="text-center">{grandTotalUpah}</TableCell>
                    <TableCell className="text-center">{grandTotalPremi}</TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && !error && (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
                {!loading && error && (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-destructive">{error}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
