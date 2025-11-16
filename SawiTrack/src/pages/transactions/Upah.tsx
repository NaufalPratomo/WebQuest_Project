import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, Employee } from '@/lib/api';
import { toast } from 'sonner';

// Upah page: manage job code, HK, and notes per employee/date using Report collection
// We associate division from selected employee when available.

type JobCode = { code: string; name: string; category: 'panen' | 'non-panen'; hkValue: number };

type ReportRow = {
  _id?: string;
  date: string;
  employeeId?: string;
  employeeName: string;
  division: string;
  jobType: string;
  hk: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
};

export default function Upah() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [jobcodes, setJobcodes] = useState<JobCode[]>([]);
  const [jobCode, setJobCode] = useState<string>('');
  const [hk, setHk] = useState<number | ''>(1);
  const [notes, setNotes] = useState<string>('');
  const [rows, setRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => toast.error('Gagal memuat karyawan'));
    // default job codes requested by user
    const DEFAULT_JOBCODES: JobCode[] = [
      { code: 'panen', name: 'Panen', category: 'panen', hkValue: 1 },
      { code: 'kutip_brodolan', name: 'Kutip Brodolan', category: 'panen', hkValue: 1 },
      { code: 'langsir_manual', name: 'Langsir Manual', category: 'panen', hkValue: 1 },
      { code: 'langsir_kerbau', name: 'Langsir Kerbau', category: 'panen', hkValue: 1 },
      { code: 'langsir_motor', name: 'Langsir Motor', category: 'panen', hkValue: 1 },
      { code: 'langsir_pickup_tracktor', name: 'Langsir Pickup/Tracktor', category: 'panen', hkValue: 1 },
      { code: 'muat_dt_ke_pks', name: 'Muat DT ke PKS', category: 'panen', hkValue: 1 },
    ];

    api.jobcodes()
      .then((list) => {
        if (!Array.isArray(list) || list.length === 0) {
          // fallback to defaults when backend has none
          setJobcodes(DEFAULT_JOBCODES);
        } else {
          setJobcodes(list as JobCode[]);
        }
      })
      .catch(() => {
        // On error, use local defaults so UI remains usable
        setJobcodes(DEFAULT_JOBCODES);
      });
  }, []);

  useEffect(() => {
    // load wage entries (reports) for the date
    api.reports({ startDate: date, endDate: date })
      .then((list) => setRows(list))
      .catch(() => setRows([]));
  }, [date]);

  useEffect(() => {
    if (!jobCode) return;
    const jc = jobcodes.find((j) => j.code === jobCode);
    if (jc) setHk(jc.hkValue);
  }, [jobCode, jobcodes]);

  const filtered = useMemo(() => rows.filter((r) => r.date.startsWith(date)), [rows, date]);

  const addRow = async () => {
    try {
      if (!date || !employeeId || !jobCode) {
        toast.error('Lengkapi input');
        return;
      }
      const emp = employees.find((e) => e._id === employeeId);
      const division = emp?.division ? String(emp.division) : '';
      const body = {
        employeeId,
        employeeName: emp?.name || 'Unknown',
        date,
        division,
        jobType: jobCode, // store job code as jobType
        hk: Number(hk || 0),
        notes,
        status: 'pending' as const,
      };
      await api.createReport(body);
      toast.success('Upah tersimpan');
      // reload list
      const latest = await api.reports({ startDate: date, endDate: date });
      setRows(latest);
      // reset some inputs
      setEmployeeId('');
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
          <h3 className="text-lg font-semibold">Upah Harian</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div>
            <Label>Tanggal</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-4">
            {/* Add wage via dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="mr-2 h-4 w-4" />Tambah Upah</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Upah Harian</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label>Karyawan</Label>
                    <select className="w-full h-10 border rounded px-2" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                      <option value="">Pilih</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Kode Pekerjaan</Label>
                    <select className="w-full h-10 border rounded px-2" value={jobCode} onChange={(e) => setJobCode(e.target.value)}>
                      <option value="">Pilih</option>
                      {jobcodes.map((j) => (
                        <option key={j.code} value={j.code}>
                          {j.code} - {j.name} ({j.hkValue} HK)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>HK</Label>
                    <Input type="number" value={hk} onChange={(e) => setHk(e.target.value ? Number(e.target.value) : '')} />
                  </div>
                  <div>
                    <Label>Catatan</Label>
                    <Input type="text" placeholder="Opsional" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          <h3 className="text-lg font-semibold">Data Upah Tanggal {date}</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tgl_Panen</TableHead>
                  <TableHead>Blok</TableHead>
                  <TableHead>Idmandor</TableHead>
                  <TableHead>Idpemanen</TableHead>
                  <TableHead>kodepekerjaan</TableHead>
                  <TableHead className="text-right">HK</TableHead>
                  <TableHead>catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => (
                  <TableRow key={r._id || idx}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{r.employeeName}</TableCell>
                    <TableCell>{r.jobType}</TableCell>
                    <TableCell className="text-right">{r.hk}</TableCell>
                    <TableCell>{r.notes || '-'}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
