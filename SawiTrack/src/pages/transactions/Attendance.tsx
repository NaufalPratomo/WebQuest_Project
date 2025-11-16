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
import { toast } from 'sonner';

type AttendanceRow = { _id?: string; date: string; employeeId: string; division_id?: number; status: 'present' | 'absent' | 'leave'; hk: number; notes?: string };

export default function Attendance() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [estateId, setEstateId] = useState<string>('');
  const [divisions, setDivisions] = useState<Array<{ division_id: number }>>([]);
  const [divisionId, setDivisionId] = useState<number | ''>('');
  type BlockOption = { no_blok?: string; id_blok?: string };
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [blockNo, setBlockNo] = useState<string>('');
  const [mandorId, setMandorId] = useState<string>('');
  const [pemanenId, setPemanenId] = useState<string>('');
  const [statusLabel, setStatusLabel] = useState<'hadir' | 'sakit' | 'alpha' | 'izin_dibayar'>('hadir');
  const [notes] = useState<string>('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => toast.error('Gagal memuat karyawan'));
    api.estates().then(setEstates).catch(() => setEstates([]));
  }, []);

  useEffect(() => {
    // load existing entries for the date
    api.attendanceList({ date })
      .then((list) => setRows(list.map(r => ({ ...r, status: r.status as 'present'|'absent'|'leave' }))))
      .catch(() => setRows([]));
  }, [date]);

  useEffect(() => {
    if (!estateId) { setDivisions([]); setDivisionId(''); return; }
    api.divisions(estateId).then(setDivisions).catch(() => setDivisions([]));
  }, [estateId]);

  useEffect(() => {
    if (!estateId || !divisionId) { setBlocks([]); setBlockNo(''); return; }
    api.blocks(estateId, Number(divisionId))
      .then((b) => setBlocks(Array.isArray(b) ? (b as BlockOption[]) : []))
      .catch(() => setBlocks([]));
  }, [estateId, divisionId]);

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
      if (!date || !pemanenId || !statusLabel) {
        toast.error('Lengkapi input');
        return;
      }
      let mappedStatus: 'present' | 'absent' | 'leave' = 'leave';
      if (statusLabel === 'hadir') mappedStatus = 'present';
      else if (statusLabel === 'alpha') mappedStatus = 'absent';
      else mappedStatus = 'leave';
      const mandorName = employees.find(e => e._id === mandorId)?.name || '';
      const foundEmp = employees.find(e => e.name.toLowerCase() === pemanenId.toLowerCase());
      const employeeIdToSend = foundEmp?._id || pemanenId;
      const notesStr = [
        statusLabel,
        estateId ? `estate=${estateId}` : '',
        divisionId ? `div=${divisionId}` : '',
        blockNo ? `blok=${blockNo}` : '',
        mandorName ? `mandor=${mandorName}` : '',
        pemanenId ? `pemanen=${pemanenId}` : ''
      ].filter(Boolean).join('; ');
      const body = { date, employeeId: employeeIdToSend, division_id: divisionId ? Number(divisionId) : undefined, status: mappedStatus, notes: notesStr } as const;
      await api.attendanceCreate(body);
      toast.success('Absensi tersimpan');
      // reload list
  const latest = await api.attendanceList({ date });
  setRows(latest.map(r => ({ ...r, status: r.status as 'present'|'absent'|'leave' })) as AttendanceRow[]);
      // reset some inputs
      setEstateId('');
      setDivisionId('');
      setBlockNo('');
      setMandorId('');
      setPemanenId('');
      setStatusLabel('hadir');
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
                <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="mr-2 h-4 w-4" />Tambah Absensi</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Absensi Harian</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tgl_Panen</Label>
                    <Input type="date" value={date} onChange={(e)=> setDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Estate</Label>
                    <Select value={estateId} onValueChange={(v)=> setEstateId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih estate" />
                      </SelectTrigger>
                      <SelectContent>
                        {estates.map(es => (
                          <SelectItem key={es._id} value={es._id}>{es.estate_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Div</Label>
                    <Select value={divisionId ? String(divisionId) : ''} onValueChange={(v)=> setDivisionId(v ? Number(v) : '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih divisi" />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions.map(d => (
                          <SelectItem key={d.division_id} value={String(d.division_id)}>
                            {`Divisi ${d.division_id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Blok</Label>
                    <Select value={blockNo} onValueChange={(v)=> setBlockNo(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih blok" />
                      </SelectTrigger>
                      <SelectContent>
                        {blocks.map((b, i) => {
                          const label = String(b.no_blok || b.id_blok || '');
                          return <SelectItem key={`${label}-${i}`} value={label}>{label || `Blok ${i+1}`}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>mandor</Label>
                    <Select value={mandorId} onValueChange={(v)=> setMandorId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih mandor" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>pemanen</Label>
                    <Input type="text" placeholder="Nama pemanen" value={pemanenId} onChange={(e)=> setPemanenId(e.target.value)} />
                  </div>
                  <div>
                    <Label>sts_hadir</Label>
                    <Select value={statusLabel} onValueChange={(v)=> setStatusLabel(v as 'hadir'|'sakit'|'alpha'|'izin_dibayar')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hadir">hadir</SelectItem>
                        <SelectItem value="sakit">sakit</SelectItem>
                        <SelectItem value="alpha">tidak hadir diganti mangkir/alpha</SelectItem>
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
                  <TableHead className="text-center">Tgl_Panen</TableHead>
                  <TableHead className="text-center">Estate</TableHead>
                  <TableHead className="text-center">Div</TableHead>
                  <TableHead className="text-center">Blok</TableHead>
                  <TableHead className="text-center">mandor</TableHead>
                  <TableHead className="text-center">pemanen</TableHead>
                  <TableHead className="text-center">sts_hadir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => {
                  const emp = employees.find(e => e._id === r.employeeId);
                  const estateIdFromNotes = noteVal(r.notes, 'estate');
                  const estateName = estates.find(e => e._id === estateIdFromNotes)?.estate_name || '-';
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
                      <TableCell className="text-center">{r.date ? r.date.split('T')[0] : r.date}</TableCell>
                      <TableCell className="text-center">{estateName}</TableCell>
                      <TableCell className="text-center">{divFromNotes || '-'}</TableCell>
                      <TableCell className="text-center">{blokFromNotes || '-'}</TableCell>
                      <TableCell className="text-center">{mandorFromNotes || '-'}</TableCell>
                      <TableCell className="text-center">{pemanenFromNotes || emp?.name || r.employeeId}</TableCell>
                      <TableCell className="text-center">{statusLabel}</TableCell>
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
