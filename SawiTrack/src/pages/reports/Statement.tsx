import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

export default function Statement() {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<Array<{ estateId: string; division_id: number; totalKg: number; blockCount: number }>>([]);

  useEffect(() => {
    api.reportStatement({ startDate, endDate }).then(setRows).catch(()=> setRows([]));
  }, [startDate, endDate]);

  const grandTotal = rows.reduce((s, r) => s + (r.totalKg || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Data Statement</h3>
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
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.estateId}</TableCell>
                    <TableCell>{r.division_id}</TableCell>
                    <TableCell className="text-right">{r.totalKg}</TableCell>
                    <TableCell className="text-right">{r.blockCount}</TableCell>
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
