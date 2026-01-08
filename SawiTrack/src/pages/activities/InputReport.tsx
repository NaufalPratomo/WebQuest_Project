import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const InputReport = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [division, setDivision] = useState<string | undefined>(undefined);
  const [estates, setEstates] = useState<Array<{ _id: string; estate_name: string }>>([]);
  const [estateId, setEstateId] = useState<string | undefined>(undefined);
  const [divisions, setDivisions] = useState<Array<{ division_id: number | string }>>([]);
  const [employees, setEmployees] = useState<Array<{ _id: string; name: string; division?: string }>>([]);
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [jobType, setJobType] = useState<string | undefined>(undefined);
  const [hk, setHk] = useState<string>('1.0');
  const [notes, setNotes] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    api.estates()
      .then((rows) => setEstates(rows || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat estate'));

    // load employees list for optional selection/filtering
    api.employees()
      .then((rows) => setEmployees(rows || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat karyawan'));
  }, []);

  useEffect(() => {
    if (!estateId) {
      setDivisions([]);
      setDivision(undefined);
      return;
    }
    api.divisions(estateId)
      .then((rows) => setDivisions(rows || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Gagal memuat divisi'));
  }, [estateId]);

  // when division changes, default employee selection to current user if they belong to that division
  useEffect(() => {
    if (division) {
      // if current user matches division, set them; otherwise clear selection
      if (user?.division && String(user.division) === String(division)) {
        setEmployeeId(user.id);
      } else {
        // prefer first employee in this division if exists
        const first = employees.find((emp) => String(emp.division) === String(division));
        setEmployeeId(first?._id);
      }
    } else {
      setEmployeeId(user?.id);
    }
  }, [division, employees, user]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!division || !jobType || !hk) {
      toast.error('Mohon lengkapi form');
      return;
    }
    try {
      await api.createReport({
        employeeId: employeeId || user?.id,
        employeeName: employees.find((emp) => emp._id === (employeeId || user?.id))?.name || user?.name || 'Unknown',
        date,
        division,
        jobType,
        hk: parseFloat(hk),
        notes,
        status: 'pending',
      });
      toast.success('Laporan berhasil disubmit');
      // reset minimal
      setNotes('');
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'Gagal submit laporan';
      try {
        const parsed = JSON.parse(message);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          const maybeError = (parsed as { error?: string }).error;
          if (maybeError) message = maybeError;
        }
      } catch { /* ignore JSON parse */ }
      toast.error(message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success(`File ${file.name} berhasil diupload`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Input Laporan Harian</h1>
        <p className="text-muted-foreground">Input aktivitas harian kebun</p>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="manual">Form Manual</TabsTrigger>
          <TabsTrigger value="upload">Upload Excel</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Input Manual</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="mr-2 h-4 w-4" />Tambah Laporan</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Input Laporan Harian</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="date">Tanggal</Label>
                        <Input
                          id="date"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estate">Estate</Label>
                        <Select value={estateId} onValueChange={(v) => setEstateId(v || undefined)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih estate" />
                          </SelectTrigger>
                          <SelectContent>
                            {estates.map((es) => (
                              <SelectItem key={es._id} value={es._id}>{es.estate_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="division">Divisi</Label>
                        <Select value={division} onValueChange={setDivision}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih divisi" />
                          </SelectTrigger>
                          <SelectContent>
                            {divisions.length === 0 ? (
                              <SelectItem value="__none" disabled>-- Tidak ada divisi --</SelectItem>
                            ) : (
                              divisions.map((d) => (
                                <SelectItem key={String(d.division_id)} value={String(d.division_id)}>
                                  {`Divisi ${d.division_id}`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="employee">Karyawan</Label>
                        <Select value={employeeId} onValueChange={(v) => setEmployeeId(v || undefined)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih karyawan" />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const pool = division ? employees.filter((e) => String(e.division) === String(division)) : employees;
                              if (pool.length === 0) return <SelectItem value="__none" disabled>-- Tidak ada karyawan --</SelectItem>;
                              return pool.map((emp) => (
                                <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobType">Jenis Pekerjaan</Label>
                        <Select value={jobType} onValueChange={setJobType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih jenis" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="panen">Panen</SelectItem>
                            <SelectItem value="perawatan">Perawatan</SelectItem>
                            <SelectItem value="penanaman">Penanaman</SelectItem>
                            <SelectItem value="transport">Transport</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hk">HK (Hari Kerja)</Label>
                        <Input
                          id="hk"
                          type="number"
                          step="0.1"
                          placeholder="1.0"
                          value={hk}
                          onChange={(e) => setHk(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Catatan</Label>
                      <Textarea
                        id="notes"
                        placeholder="Catatan tambahan..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      Submit Laporan
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload File Excel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Upload File Excel</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Format: APK, TPN, atau Divisi (.xlsx, .xls)
                </p>
                <label htmlFor="file-upload">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Pilih File
                    </span>
                  </Button>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Petunjuk Upload:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>File harus dalam format Excel (.xlsx atau .xls)</li>
                  <li>Gunakan template yang telah disediakan</li>
                  <li>Pastikan semua kolom wajib terisi</li>
                  <li>Maksimal 1000 baris per file</li>
                </ul>
              </div>

              <Button variant="outline" className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download Template Excel
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InputReport;
