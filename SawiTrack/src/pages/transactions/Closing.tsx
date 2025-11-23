import { useState, useEffect } from 'react';
import { useClosing } from '@/contexts/ClosingContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { Trash2, AlertTriangle } from 'lucide-react';

const Closing = () => {
  const { closingPeriods, fetchClosingPeriods } = useClosing();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // Auto-populate dates when month/year changes
  useEffect(() => {
    if (month && year) {
      // Create dates in local time to avoid timezone issues with ISOString
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);

      // Format: YYYY-MM-DD
      const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
    }
  }, [month, year]);

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error('Tanggal mulai dan akhir harus diisi.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.');
      return;
    }

    setLoading(true);
    try {
      await api.createClosingPeriod({ startDate, endDate, notes, month, year });
      toast.success('Periode berhasil ditutup.');
      setStartDate('');
      setEndDate('');
      setNotes('');
      await fetchClosingPeriods();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Gagal menutup periode.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin membuka kembali periode ini?')) return;
    try {
      await api.deleteClosingPeriod(id);
      toast.success('Periode berhasil dibuka kembali.');
      await fetchClosingPeriods();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Gagal membuka periode.';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Periode Closing Transaksi</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tutup Periode Baru</CardTitle>
            <CardDescription>
              Menutup periode transaksi akan mencegah perubahan data pada rentang tanggal yang dipilih.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClose} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Bulan</Label>
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'].map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Tahun</Label>
                  <Input
                    id="year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Tanggal Mulai</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Tanggal Akhir</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Catatan (Opsional)</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Tutup buku bulan Januari"
                />
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Pastikan semua data sudah benar sebelum menutup periode.
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Memproses...' : 'Tutup Periode'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Periode Ditutup</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Tanggal Mulai</TableHead>
                  <TableHead>Tanggal Akhir</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closingPeriods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Belum ada periode yang ditutup.
                    </TableCell>
                  </TableRow>
                ) : (
                  closingPeriods.map((period) => {
                    const monthName = period.month ? ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][period.month - 1] : '';
                    const periodeLabel = monthName && period.year ? `${monthName} ${period.year}` : '-';
                    return (
                      <TableRow key={period._id}>
                        <TableCell className="font-medium">{periodeLabel}</TableCell>
                        <TableCell>{format(new Date(period.startDate), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{format(new Date(period.endDate), 'dd MMM yyyy')}</TableCell>
                        <TableCell><Badge variant={period.status === 'active' ? 'default' : 'secondary'}>{period.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></TableCell>
                        <TableCell>{period.notes || '-'}</TableCell>
                        <TableCell>
                          {user?.role === 'manager' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleReopen(period._id)}
                              title="Buka Kembali Periode"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Closing;