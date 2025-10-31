import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, Employee } from '@/lib/api';
import { toast } from 'sonner';

type JobCode = { code: string; name: string; category: 'panen' | 'non-panen'; hkValue: number };
type AttendanceRow = { _id?: string; date: string; employeeId: string; division_id?: number; status: 'present' | 'absent' | 'leave'; hk: number; notes?: string };

export default function Attendance() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [status, setStatus] = useState<'present' | 'absent' | 'leave'>('present');
  const [hk, setHk] = useState<number | ''>(1);
  const [jobcodes, setJobcodes] = useState<JobCode[]>([]);
  const [jobCode, setJobCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => toast.error('Gagal memuat karyawan'));
    api.jobcodes().then(setJobcodes).catch(() => setJobcodes([]));
  }, []);

  useEffect(() => {
    // load existing entries for the date
    api.attendanceList({ date })
      .then((list) => setRows(list.map(r => ({ ...r, status: r.status as 'present'|'absent'|'leave' }))))
      .catch(() => setRows([]));
  }, [date]);

  useEffect(() => {
    if (!jobCode) return;
    const jc = jobcodes.find(j => j.code === jobCode);
    if (jc) setHk(jc.hkValue);
  }, [jobCode, jobcodes]);

  const filtered = useMemo(() => rows.filter(r => r.date.startsWith(date)), [rows, date]);

  const addRow = async () => {
    try {
      if (!date || !employeeId || !status) {
        toast.error('Lengkapi input');
        return;
      }
      const body = { date, employeeId, status, hk: Number(hk || 0), notes } as const;
      await api.attendanceCreate(body);
      toast.success('Absensi tersimpan');
      // reload list
  const latest = await api.attendanceList({ date });
  setRows(latest.map(r => ({ ...r, status: r.status as 'present'|'absent'|'leave' })) as AttendanceRow[]);
      // reset some inputs
      setEmployeeId('');
      setStatus('present');
      setJobCode('');
      setHk(1);
      setNotes('');
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
                  <div>
                    <Label>Kode Pekerjaan</Label>
                    <select className="w-full h-10 border rounded px-2" value={jobCode} onChange={(e)=> setJobCode(e.target.value)}>
                      <option value="">Pilih (opsional)</option>
                      {jobcodes.map(j => (
                        <option key={j.code} value={j.code}>{j.code} - {j.name} ({j.hkValue} HK)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>HK</Label>
                    <Input type="number" value={hk} onChange={(e)=> setHk(e.target.value ? Number(e.target.value) : '')} />
                  </div>
                  <div>
                    <Label>Catatan</Label>
                    <Input type="text" placeholder="Opsional" value={notes} onChange={(e)=> setNotes(e.target.value)} />
                  </div>
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
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">HK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => {
                  const emp = employees.find(e => e._id === r.employeeId);
                  return (
                    <TableRow key={r._id || idx}>
                      <TableCell>{emp?.name || r.employeeId}</TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                      <TableCell className="text-right">{r.hk}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
