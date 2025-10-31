import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

export default function TaksasiPerBlock() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<Array<{ estateId: string; division_id: number; block_no: string; totalKg: number }>>([]);

  useEffect(() => {
    api.reportTaksasiPerBlock({ date }).then(setRows).catch(()=> setRows([]));
  }, [date]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Report Taksasi per Blok</h3>
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
