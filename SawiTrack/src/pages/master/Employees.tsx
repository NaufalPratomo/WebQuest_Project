import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Upload, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api, Employee as EmployeeDoc } from '@/lib/api';
import EmployeeEditDialog from './components/EmployeeEditDialog';
import { useRef } from 'react';

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  role: string;
  division?: string;
  status: string;
}

const Employees = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  type RoleOption = 'manager' | 'foreman' | 'employee' | '';
  const [form, setForm] = useState<{ name: string; email: string; role: RoleOption; division: string | ''; password?: string }>(
    { name: '', email: '', role: '', division: '', password: '' }
  );
  const [openEdit, setOpenEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const exportCsv = () => {
    const header = ['id','name','email','role','division','status'];
    const escape = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')].concat(
      filteredEmployees.map(r => [r.id, r.name, r.email, r.role, r.division ?? '', r.status].map(escape).join(','))
    );
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleCsvUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error('CSV kosong');
      const header = lines[0].split(',').map((s)=>s.trim().toLowerCase());
      const idx = (k: string) => header.indexOf(k);
      const requireIdx = (...keys: string[]) => { for (const k of keys) if (idx(k) === -1) throw new Error(`Kolom '${k}' tidak ditemukan`); };
      requireIdx('name','email','role');
      const toBody = (cols: string[]) => {
        const name = cols[idx('name')];
        const email = cols[idx('email')];
        const role = (cols[idx('role')] || 'employee').toLowerCase() as 'manager'|'foreman'|'employee';
        const division = idx('division') !== -1 ? (cols[idx('division')] || '') : '';
        const status = idx('status') !== -1 ? (cols[idx('status')] || 'active') : 'active';
        const providedPwd = idx('password') !== -1 ? (cols[idx('password')] || '') : '';
        const base = (name || (email?.split('@')[0] ?? '')).toString();
        const defaultPwd = base.trim().replace(/\s+/g,'') + '123';
        const finalPwd = providedPwd || defaultPwd;
        return { name, email, role, division: division || null, status: (status === 'inactive' ? 'inactive' : 'active'), ...(finalPwd ? { password: finalPwd } : {}) };
      };
      const existingEmails = new Set(rows.map(r => r.email.toLowerCase()));
      const seen = new Set<string>();
      const bodies = lines.slice(1)
        .map((line)=> line.split(','))
        .map(toBody)
        .filter(b => b.name && b.email && b.role)
        .filter(b => {
          const em = String(b.email).toLowerCase();
          if (seen.has(em)) return false; // duplicate inside CSV
          seen.add(em);
          return !existingEmails.has(em); // skip if already exists
        });
      if (bodies.length === 0) throw new Error('Tidak ada baris valid');
      const results = await Promise.allSettled(bodies.map((b)=> api.createEmployee(b)));
      const successes = results.filter((r): r is PromiseFulfilledResult<EmployeeDoc> => r.status === 'fulfilled').map(r=>r.value);
      const failures = results.filter((r)=> r.status === 'rejected');
      const mapped: EmployeeRow[] = successes.map((e)=> ({ id: e._id, name: e.name, email: e.email, role: e.role, division: e.division || undefined, status: e.status }));
      if (mapped.length) setRows(prev => [...mapped, ...prev]);
      if (failures.length === 0) {
        toast.success(`Import ${mapped.length} karyawan berhasil`);
      } else if (mapped.length > 0) {
        toast.info(`Berhasil ${mapped.length} baris, gagal ${failures.length} baris`);
      } else {
        throw new Error('Semua baris gagal diimport');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal import CSV';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.employees()
      .then((list: EmployeeDoc[]) => {
        if (!mounted) return;
        const mapped: EmployeeRow[] = list.map((e) => ({
          id: e._id,
          name: e.name,
          email: e.email,
          role: e.role,
          division: e.division,
          status: e.status,
        }));
        setRows(mapped);
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  const filteredEmployees = useMemo(() => rows.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Karyawan</h1>
          <p className="text-muted-foreground">Kelola data karyawan</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground">Memuat data...</p>}
        </div>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Karyawan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Karyawan Baru</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" placeholder="Nama lengkap" value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="email@sawit.com" value={form.email} onChange={(e)=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={form.role} onValueChange={(v)=>setForm(f=>({...f, role: v as RoleOption}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="foreman">Foreman</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="division">Divisi</Label>
                <Select value={form.division} onValueChange={(v)=>setForm(f=>({...f, division: v}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apk">APK</SelectItem>
                    <SelectItem value="tpn">TPN</SelectItem>
                    <SelectItem value="divisi">Divisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password (opsional)</Label>
                <Input id="password" type="password" placeholder="Kosongkan jika tidak diisi" value={form.password || ''} onChange={(e)=>setForm(f=>({...f, password: e.target.value}))} />
              </div>
              <Button type="button" className="w-full" onClick={async ()=>{
                try{
                  if(!form.name || !form.email || !form.role){
                    toast.error('Nama, email, dan role wajib diisi');
                    return;
                  }
                  const pwd = (form.password || '').trim();
                  const created = await api.createEmployee({
                    name: form.name,
                    email: form.email,
                    role: (form.role || 'employee') as 'manager' | 'foreman' | 'employee',
                    division: form.division || null,
                    ...(pwd ? { password: pwd } : {}),
                  });
                  setRows(prev=>[{ id: created._id, name: created.name, email: created.email, role: created.role, division: created.division || undefined, status: created.status }, ...prev]);
                  setOpenAdd(false);
                  setForm({ name:'', email:'', role:'', division:'', password: '' });
                  toast.success('Karyawan berhasil ditambahkan');
                }catch(e){
                  const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
                  toast.error(msg);
                }
              }}>
                Simpan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        {/* Edit dialog moved to its own component */}
        <EmployeeEditDialog
          open={openEdit}
          onOpenChange={(v) => {
            setOpenEdit(v);
            if (!v) setEditTarget(null);
          }}
          employee={editTarget ? { id: editTarget.id, name: editTarget.name, email: editTarget.email, role: (editTarget.role as 'manager'|'foreman'|'employee'), division: editTarget.division } : null}
          onUpdated={(updated) => {
            setRows((prev) => prev.map((r) => r.id === updated._id ? ({ id: updated._id, name: updated.name, email: updated.email, role: updated.role, division: updated.division || undefined, status: updated.status }) : r));
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari karyawan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700" disabled={uploading} onClick={() => { if (!uploading) fileInputRef.current?.click(); }}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={exportCsv} disabled={filteredEmployees.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" disabled={uploading} onChange={(e)=> e.target.files && handleCsvUpload(e.target.files[0])} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {employee.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{employee.division}</TableCell>
                  <TableCell>
                    <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                      {employee.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditTarget(employee);
                          setOpenEdit(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={async ()=>{
                        try{
                          await api.deleteEmployee(employee.id);
                          setRows(prev=>prev.filter(r=>r.id!==employee.id));
                          toast.success('Karyawan dihapus');
                        }catch(e){
                          const msg = e instanceof Error ? e.message : 'Gagal menghapus';
                          toast.error(msg);
                        }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Employees;