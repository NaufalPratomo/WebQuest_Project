import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, Employee } from '@/lib/api';
import { toast } from 'sonner';

type AttendanceRow = { _id?: string; date: string; employeeId: string; division_id?: number; status: 'present' | 'absent' | 'leave'; hk: number; notes?: string };

export default function Attendance() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [status, setStatus] = useState<'present' | 'absent' | 'leave'>('present');
  const [notes] = useState<string>('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => toast.error('Gagal memuat karyawan'));
  }, []);

  useEffect(() => {
    // load existing entries for the date
    api.attendanceList({ date })
      .then((list) => setRows(list.map(r => ({ ...r, status: r.status as 'present'|'absent'|'leave' }))))
      .catch(() => setRows([]));
  }, [date]);

  // Attendance now only records presence status; wages handled in Upah page

  const filtered = useMemo(() => rows.filter(r => r.date.startsWith(date)), [rows, date]);

  const addRow = async () => {
    try {
      if (!date || !employeeId || !status) {
        toast.error('Lengkapi input');
        return;
      }
      const body = { date, employeeId, status } as const;
      await api.attendanceCreate(body);
      toast.success('Absensi tersimpan');
      // reload list
  const latest = await api.attendanceList({ date });
  setRows(latest.map(r => ({ ...r, status: r.status as 'present'|'absent'|'leave' })) as AttendanceRow[]);
      // reset some inputs
      setEmployeeId('');
      setStatus('present');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Absensi Harian</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div>
            <Label>Tanggal</Label>
            <Input type="date" value={date} onChange={(e)=> setDate(e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-4">
            {/* Add attendance via dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button>Tambah Absensi</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Absensi Harian</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label>Karyawan</Label>
                    <select className="w-full h-10 border rounded px-2" value={employeeId} onChange={(e)=> setEmployeeId(e.target.value)}>
                      <option value="">Pilih</option>
                      {employees.map(emp => (
                        <option key={emp._id} value={emp._id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select className="w-full h-10 border rounded px-2" value={status} onChange={(e)=> setStatus(e.target.value as 'present'|'absent'|'leave')}>
                      <option value="present">Hadir</option>
                      <option value="absent">Tidak Hadir</option>
                      <option value="leave">Cuti/Izin</option>
                    </select>
                  </div>
                  {/* Job Code, HK, and Notes moved to Upah page */}
                  <div className="flex gap-2">
                    <Button onClick={addRow}>Simpan</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Data Absensi Tanggal {date}</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tgl_Panen</TableHead>
                  <TableHead>Estate</TableHead>
                  <TableHead>Div</TableHead>
                  <TableHead>Blok</TableHead>
                  <TableHead>Idmandor</TableHead>
                  <TableHead>Idpemanen</TableHead>
                  <TableHead>sts_hadir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => {
                  const emp = employees.find(e => e._id === r.employeeId);
                  return (
                    <TableRow key={r._id || idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{emp?.name || r.employeeId}</TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
