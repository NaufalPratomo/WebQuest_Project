import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api, Employee as EmployeeDoc } from '@/lib/api';

type Role = 'manager' | 'foreman' | 'employee';
type RoleOption = Role | '';
type Status = 'active' | 'inactive';

export interface EmployeeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string; email: string; role: Role; division?: string; status?: string } | null;
  onUpdated: (updated: EmployeeDoc) => void;
}

export default function EmployeeEditDialog({ open, onOpenChange, employee, onUpdated }: EmployeeEditDialogProps) {
  const [form, setForm] = useState<{ name: string; email: string; role: RoleOption; division: string | ''; status: Status; password?: string }>(
    { name: '', email: '', role: '', division: '', status: 'active', password: '' }
  );
  const [divisions, setDivisions] = useState<string[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  useEffect(() => {
    if (open && employee) {
      setForm({
        name: employee.name,
        email: employee.email,
        role: employee.role,
        division: employee.division || '',
        status: (employee.status === 'inactive' ? 'inactive' : 'active') as Status,
        password: '',
      });
    }
  }, [open, employee]);

  // Load divisions from all estates (union) when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadDivisions() {
      try {
        setLoadingDivisions(true);
        const estates = await api.estates();
        const ids = estates.map((e) => e._id);
        const all: number[] = [];
        for (const id of ids) {
          try {
            const rows = await api.divisions(id);
            rows?.forEach((d) => all.push(Number(d.division_id)));
          } catch (e) {
            // ignore individual estate failure, continue
          }
        }
        if (cancelled) return;
        const uniq = Array.from(new Set(all.filter((n) => !Number.isNaN(n)))).sort((a, b) => a - b);
        setDivisions(uniq.map((n) => String(n)));
      } catch (e) {
        if (!cancelled) toast.error('Gagal memuat daftar divisi');
      } finally {
        if (!cancelled) setLoadingDivisions(false);
      }
    }
    loadDivisions();
    return () => { cancelled = true; };
  }, [open]);

  async function onSave() {
    try {
      if (!employee) return;
      if (!form.name || !form.email || !form.role) {
        toast.error('Nama, email, dan role wajib diisi');
        return;
      }
      const payload: Partial<{ name: string; email: string; role: Role; division: string | null; status: Status; password: string }> = {
        name: form.name,
        email: form.email,
        role: (form.role || 'employee') as Role,
        division: form.division || null,
        status: form.status,
      };
      const pwd = (form.password || '').trim();
      if (pwd) payload.password = pwd;
      const updated = await api.updateEmployee(employee.id, payload);
      onUpdated(updated);
      setForm((f) => ({ ...f, password: '' }));
      onOpenChange(false);
      toast.success('Karyawan diperbarui');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memperbarui';
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Karyawan</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <Label htmlFor="ename">Nama</Label>
            <Input id="ename" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eemail">Email</Label>
            <Input id="eemail" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="erole">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as RoleOption }))}>
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
            <Label htmlFor="edivision">Divisi</Label>
            <Select value={form.division} onValueChange={(v) => setForm((f) => ({ ...f, division: v }))}>
              <SelectTrigger>
                <SelectValue placeholder={loadingDivisions ? 'Memuat divisi...' : 'Pilih divisi'} />
              </SelectTrigger>
              <SelectContent>
                {divisions.length === 0 ? (
                  <SelectItem value="__none" disabled>-- Tidak ada divisi --</SelectItem>
                ) : (
                  divisions.map((d) => (
                    <SelectItem key={d} value={d}>Divisi {d}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="estatus">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Status }))}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="epassword">Password baru (opsional)</Label>
            <Input id="epassword" type="password" placeholder="Kosongkan jika tidak diubah" value={form.password || ''} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <Button type="button" className="w-full" onClick={onSave}>
            Simpan Perubahan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
