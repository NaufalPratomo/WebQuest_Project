import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

export default function Trend() {
  const [type, setType] = useState<'panen'|'angkut'|'taksasi'>('panen');
  const [sort, setSort] = useState<'asc'|'desc'>('desc');
  const [rows, setRows] = useState<Array<{ estateId: string; division_id: number; block_no: string; totalKg: number }>>([]);

  useEffect(() => {
    api.reportTrend({ type, sort }).then(setRows).catch(()=> setRows([]));
  }, [type, sort]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Laporan Tren</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Jenis</Label>
            <select className="w-full h-10 border rounded px-2" value={type} onChange={(e)=> setType(e.target.value as 'panen'|'angkut'|'taksasi')}>
              <option value="panen">Panen</option>
              <option value="angkut">Angkut</option>
              <option value="taksasi">Taksasi</option>
            </select>
          </div>
          <div>
            <Label>Urutan</Label>
            <select className="w-full h-10 border rounded px-2" value={sort} onChange={(e)=> setSort(e.target.value as 'asc'|'desc')}>
              <option value="desc">Tertinggi</option>
              <option value="asc">Terendah</option>
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
                  <TableHead>No Blok</TableHead>
                  <TableHead className="text-right">Total (Kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.estateId}</TableCell>
                    <TableCell>{r.division_id}</TableCell>
                    <TableCell>{r.block_no}</TableCell>
                    <TableCell className="text-right">{r.totalKg}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
