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

export interface EmployeeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string; email: string; role: Role; division?: string } | null;
  onUpdated: (updated: EmployeeDoc) => void;
}

export default function EmployeeEditDialog({ open, onOpenChange, employee, onUpdated }: EmployeeEditDialogProps) {
  const [form, setForm] = useState<{ name: string; email: string; role: RoleOption; division: string | ''; password?: string }>(
    { name: '', email: '', role: '', division: '', password: '' }
  );

  useEffect(() => {
    if (open && employee) {
      setForm({
        name: employee.name,
        email: employee.email,
        role: employee.role,
        division: employee.division || '',
        password: '',
      });
    }
  }, [open, employee]);

  async function onSave() {
    try {
      if (!employee) return;
      if (!form.name || !form.email || !form.role) {
        toast.error('Nama, email, dan role wajib diisi');
        return;
      }
      const payload: Partial<{ name: string; email: string; role: Role; division: string | null; password: string }> = {
        name: form.name,
        email: form.email,
        role: (form.role || 'employee') as Role,
        division: form.division || null,
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
