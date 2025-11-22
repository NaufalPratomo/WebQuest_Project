import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, Employee } from '@/lib/api';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type AttendanceRow = {
  _id?: string;
  date: string;
  employeeId: string;
  // derived metadata from taksasi context
  estateId?: string;
  estateName?: string;
  division_id?: number;
  block_no?: string;
  mandorId?: string;
  status: string;
  hk?: number;
  notes?: string;
};

// map localized status to backend enum and vice versa
type BackendStatus = 'present' | 'absent' | 'leave';
function toBackendStatus(local: string): { backend: BackendStatus; note?: string } {
  switch (local) {
    case 'hadir':
      return { backend: 'present', note: 'status_local=hadir' };
    case 'izin_dibayar':
      return { backend: 'leave', note: 'status_local=izin_dibayar' };
    case 'sakit':
    case 'tidak_hadir_diganti':
    case 'mangkir':
      return { backend: 'absent', note: `status_local=${local}` };
    case 'present':
    case 'absent':
    case 'leave':
    default:
      // already backend or unknown -> pass through best effort
      return { backend: (['present', 'absent', 'leave'].includes(local) ? (local as BackendStatus) : 'absent'), note: undefined };
  }
}

function toLocalStatus(backendOrLocal: string): string {
  // If already one of our localized set, return as-is
  const localized = ['hadir', 'sakit', 'tidak_hadir_diganti', 'mangkir', 'izin_dibayar'];
  if (localized.includes(backendOrLocal)) return backendOrLocal;
  // Map backend enums to our defaults
  if (backendOrLocal === 'present') return 'hadir';
  if (backendOrLocal === 'leave') return 'izin_dibayar';
  if (backendOrLocal === 'absent') return 'sakit';
  return '';
}

export default function Attendance() {
  const { user } = useAuth();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [status, setStatus] = useState<string>('hadir');
  const [notes] = useState<string>('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const selectionKey = `taksasi_selection_${date}`;
  const taksasiKey = `taksasi_rows_${date}`;
  const customKey = `taksasi_custom_${date}`;

  // compute taksasi context for the date (use the latest entry for that day)
  const taksasiContext = useMemo(() => {
    try {
      const raw = localStorage.getItem(taksasiKey);
      if (!raw) return null;
      const arr = JSON.parse(raw) as Array<{
        timestamp: string;
        date: string;
        estateId: string;
        estateName: string;
        divisionId: string; // saved as string in taksasi page
        blockLabel: string;
      }>;
      if (!Array.isArray(arr) || arr.length === 0) return null;
      // pick the latest by timestamp
      const latest = [...arr].sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1)).at(-1)!;
      const mandorId = (user?.id || user?._id) as string | undefined;
      return {
        estateId: latest.estateId,
        estateName: latest.estateName,
        division_id: Number(latest.divisionId),
        block_no: latest.blockLabel,
        mandorId,
      } as Pick<AttendanceRow, 'estateId' | 'estateName' | 'division_id' | 'block_no' | 'mandorId'>;
    } catch {
      return null;
    }
  }, [taksasiKey, user?.id, user?._id]);

  useEffect(() => {
    // Load master employees and merge with custom (Other) employees for this date
    let base: Employee[] = [];
    const loadCustom = () => {
      try {
        const raw = localStorage.getItem(customKey);
        const custom = raw ? (JSON.parse(raw) as Array<Pick<Employee, '_id' | 'name'>>) : [];
        setEmployees([...(base || []), ...(Array.isArray(custom) ? (custom as Employee[]) : [])]);
      } catch {
        setEmployees(base || []);
      }
    };
    api
      .employees()
      .then((list) => { base = list || []; loadCustom(); })
      .catch(() => { base = []; loadCustom(); });
  }, [customKey]);

  useEffect(() => {
    // load existing entries for the date and merge with taksasi selection
    api.attendanceList({ date })
      .then((list) => {
        const serverRows = (list.map(r => ({
          ...r,
          // attach taksasi context if not present
          estateId: taksasiContext?.estateId,
          estateName: taksasiContext?.estateName,
          division_id: r.division_id ?? taksasiContext?.division_id,
          block_no: taksasiContext?.block_no,
          mandorId: taksasiContext?.mandorId,
          // normalize status for UI select
          status: toLocalStatus(r.status),
        })) as AttendanceRow[]);
        // merge with taksasi-selected employees for this date
        let selected: string[] = [];
        try {
          const raw = localStorage.getItem(selectionKey);
          selected = raw ? (JSON.parse(raw) as string[]) : [];
        } catch { selected = []; }
        const missing: AttendanceRow[] = selected
          .filter(empId => !serverRows.some(sr => sr.employeeId === empId))
          .map(empId => ({
            date,
            employeeId: empId,
            status: '',
            estateId: taksasiContext?.estateId,
            estateName: taksasiContext?.estateName,
            division_id: taksasiContext?.division_id,
            block_no: taksasiContext?.block_no,
            mandorId: taksasiContext?.mandorId,
          }));
        setRows([...serverRows, ...missing]);
      })
      .catch(() => {
        // if server fails, still show selection as placeholder rows
        try {
          const raw = localStorage.getItem(selectionKey);
          const selected = raw ? (JSON.parse(raw) as string[]) : [];
          setRows(selected.map(empId => ({
            date,
            employeeId: empId,
            status: '',
            estateId: taksasiContext?.estateId,
            estateName: taksasiContext?.estateName,
            division_id: taksasiContext?.division_id,
            block_no: taksasiContext?.block_no,
            mandorId: taksasiContext?.mandorId,
          })));
        } catch { setRows([]); }
      });
  }, [date, selectionKey, taksasiContext]);

  // Attendance now only records presence status; wages handled in Upah page

  const filtered = useMemo(() => rows.filter(r => r.date.startsWith(date)), [rows, date]);

  const noteVal = (notes: string | undefined, key: string): string => {
    if (!notes) return '';
    try {
      const parts = notes.split(/;\s*/);
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k && k.trim() === key) return v ?? '';
      }
      return '';
    } catch { return ''; }
  };

  const addRow = async () => {
    try {
      if (!date || !employeeId || !status) {
        toast.error('Lengkapi input');
        return;
      }
      const map = toBackendStatus(status);
      const body = { date, employeeId, status: map.backend, division_id: taksasiContext?.division_id, notes: map.note } as const;
      await api.attendanceCreate(body);
      toast.success('Absensi tersimpan');
      logActivity({ action: 'attendance_create', category: 'attendance', level: 'info', details: { date, employeeId, status: map.backend } });
      // if present/hadir, auto-generate placeholder in Real Harvest storage
      if (map.backend === 'present') {
        try {
          const realKey = `realharvest_rows_${date}`;
          const raw = localStorage.getItem(realKey);
          const existing: Array<{
            pemanenId: string;
          }> = raw ? JSON.parse(raw) : [];
          const emp = employees.find(e => e._id === employeeId);
          const already = existing.some(r => r.pemanenId === employeeId);
          if (!already) {
            const placeholder = {
              id: `${Date.now()}_${employeeId}`,
              timestamp: new Date().toISOString(),
              date,
              estateId: taksasiContext?.estateId,
              estateName: taksasiContext?.estateName,
              division: taksasiContext?.division_id ? String(taksasiContext.division_id) : '',
              block: taksasiContext?.block_no,
              mandor: user?.name || user?.id || user?._id || '-',
              pemanenId: employeeId,
              pemanenName: emp?.name || employeeId,
              jobCode: '',
              noTPH: '',
              janjangTBS: 0,
              janjangKosong: 0,
              upahBasis: 0,
              premi: 0,
              totalUpah: 0,
            };
            const next = [...existing, placeholder];
            localStorage.setItem(realKey, JSON.stringify(next));
          }
        } catch {/* ignore */ }
      }
      // reload list
      const latest = await api.attendanceList({ date });
      // re-merge with selection
      let selected: string[] = [];
      try { const raw = localStorage.getItem(selectionKey); selected = raw ? JSON.parse(raw) : []; } catch { selected = []; }
      const serverRows = (latest as AttendanceRow[]).map(r => ({
        ...r,
        estateId: taksasiContext?.estateId,
        estateName: taksasiContext?.estateName,
        division_id: r.division_id ?? taksasiContext?.division_id,
        block_no: taksasiContext?.block_no,
        mandorId: taksasiContext?.mandorId,
        status: toLocalStatus(r.status),
      }));
      const missing: AttendanceRow[] = selected
        .filter(id => !serverRows.some(sr => sr.employeeId === id))
        .map(id => ({
          date,
          employeeId: id,
          status: '',
          estateId: taksasiContext?.estateId,
          estateName: taksasiContext?.estateName,
          division_id: taksasiContext?.division_id,
          block_no: taksasiContext?.block_no,
          mandorId: taksasiContext?.mandorId,
        }));
      setRows([...serverRows, ...missing]);
      // reset some inputs
      setEmployeeId('');
      setStatus('hadir');
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
      toast.error(msg);
    }
  };

  const saveInline = async (r: AttendanceRow) => {
    if (!r.employeeId || !r.status) {
      toast.error('Pilih status');
      return;
    }
    try {
      const map = toBackendStatus(r.status);
      await api.attendanceCreate({ date, employeeId: r.employeeId, status: map.backend, division_id: r.division_id ?? taksasiContext?.division_id, notes: map.note });
      // if present/hadir, auto-generate placeholder in Real Harvest storage
      if (map.backend === 'present') {
        try {
          const realKey = `realharvest_rows_${date}`;
          const raw = localStorage.getItem(realKey);
          const existing: Array<{
            pemanenId: string;
          }> = raw ? JSON.parse(raw) : [];
          const emp = employees.find(e => e._id === r.employeeId);
          const already = existing.some(x => x.pemanenId === r.employeeId);
          if (!already) {
            const placeholder = {
              id: `${Date.now()}_${r.employeeId}`,
              timestamp: new Date().toISOString(),
              date,
              estateId: taksasiContext?.estateId,
              estateName: taksasiContext?.estateName,
              division: taksasiContext?.division_id ? String(taksasiContext.division_id) : '',
              block: taksasiContext?.block_no,
              mandor: user?.name || user?.id || user?._id || '-',
              pemanenId: r.employeeId,
              pemanenName: emp?.name || r.employeeId,
              jobCode: '',
              noTPH: '',
              janjangTBS: 0,
              janjangKosong: 0,
              upahBasis: 0,
              premi: 0,
              totalUpah: 0,
            };
            const next = [...existing, placeholder];
            localStorage.setItem(realKey, JSON.stringify(next));
          }
        } catch {/* ignore */ }
      }
      const latest = await api.attendanceList({ date });
      let selected: string[] = [];
      try { const raw = localStorage.getItem(selectionKey); selected = raw ? JSON.parse(raw) : []; } catch { selected = []; }
      const serverRows = (latest as AttendanceRow[]).map(r0 => ({
        ...r0,
        estateId: taksasiContext?.estateId,
        estateName: taksasiContext?.estateName,
        division_id: r0.division_id ?? taksasiContext?.division_id,
        block_no: taksasiContext?.block_no,
        mandorId: taksasiContext?.mandorId,
        status: toLocalStatus(r0.status),
      }));
      const missing: AttendanceRow[] = selected
        .filter(id => !serverRows.some(sr => sr.employeeId === id))
        .map(id => ({
          date,
          employeeId: id,
          status: '',
          estateId: taksasiContext?.estateId,
          estateName: taksasiContext?.estateName,
          division_id: taksasiContext?.division_id,
          block_no: taksasiContext?.block_no,
          mandorId: taksasiContext?.mandorId,
        }));
      setRows([...serverRows, ...missing]);
      toast.success('Status diperbarui');
      logActivity({ action: 'attendance_update', category: 'attendance', level: 'info', details: { date, employeeId: r.employeeId, status: map.backend } });
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Gagal memperbarui';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) msg = maybeError;
        }
      } catch { /* ignore */ }
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
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-4">
            {/* Add attendance via dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="mr-2 h-4 w-4" />Tambah Absensi</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Absensi Harian</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tgl_Panen</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Pemanen</Label>
                    <Select value={employeeId} onValueChange={(v) => setEmployeeId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih pemanen" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>sts_hadir</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hadir">hadir</SelectItem>
                        <SelectItem value="sakit">sakit</SelectItem>
                        <SelectItem value="tidak_hadir_diganti">tidak hadir diganti</SelectItem>
                        <SelectItem value="mangkir">mangkir/alpha</SelectItem>
                        <SelectItem value="izin_dibayar">izin dibayar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button onClick={addRow}>Simpan</Button>
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
                  <TableHead>Mandor</TableHead>
                  <TableHead>Pemanen</TableHead>
                  <TableHead>sts_hadir</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => {
                  const emp = employees.find(e => e._id === r.employeeId);
                  const divFromNotes = noteVal(r.notes, 'div');
                  const blokFromNotes = noteVal(r.notes, 'blok');
                  const mandorFromNotes = noteVal(r.notes, 'mandor');
                  const pemanenFromNotes = noteVal(r.notes, 'pemanen');
                  // Extract status from notes (first part before semicolon, or from status field)
                  let statusLabel = '';
                  if (r.notes) {
                    const firstPart = r.notes.split(';')[0].trim();
                    if (['hadir', 'sakit', 'alpha', 'izin_dibayar'].includes(firstPart)) {
                      statusLabel = firstPart;
                    }
                  }
                  // Fallback to mapped status if not found in notes
                  if (!statusLabel) {
                    if (r.status === 'present') statusLabel = 'hadir';
                    else if (r.status === 'absent') statusLabel = 'alpha';
                    else if (r.status === 'leave') statusLabel = 'sakit';
                    else statusLabel = r.status;
                  }
                  return (
                    <TableRow key={r._id || idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.estateName ?? '-'}</TableCell>
                      <TableCell>{r.division_id ? `Divisi ${r.division_id}` : '-'}</TableCell>
                      <TableCell>{r.block_no ?? '-'}</TableCell>
                      <TableCell>{user?.name || '-'}</TableCell>
                      <TableCell>{emp?.name || r.employeeId}</TableCell>
                      <TableCell>
                        <select
                          className="h-9 border rounded px-2"
                          value={toLocalStatus(r.status) || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows(prev => prev.map((row, i) => i === idx ? { ...row, status: val } : row));
                          }}
                        >
                          <option value="">- pilih -</option>
                          <option value="hadir">Hadir</option>
                          <option value="sakit">Sakit</option>
                          <option value="tidak_hadir_diganti">Tidak hadir diganti</option>
                          <option value="mangkir">Mangkir/Alpha</option>
                          <option value="izin_dibayar">Izin dibayar</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => saveInline(r)}>Simpan</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
